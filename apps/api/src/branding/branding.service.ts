import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { decryptBytes, encryptBytes } from "../security/crypto.js";

export const BRANDING_DEFAULTS = {
  primaryColor: "#5B63F2",
  backgroundColor: "#F6F7FB",
  surfaceColor: "#FFFFFF",
  textColor: "#171B26",
} as const;

export const BRANDING_POLICY = {
  textContrastMinimum: 4.5,
  uiContrastMinimum: 3,
  maxLogoBytes: 1024 * 1024,
  allowedLogoTypes: ["image/png", "image/jpeg", "image/webp"],
  logoUse: "workspace-tenant-context-and-assessment-participant-header",
  invalidCombinations: "blocked",
} as const;

export type BrandingInput = {
  enabled?: boolean;
  primaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  logoAltText?: string | null;
  removeLogo?: boolean;
  logo?: { fileName: string; mimeType: string; base64: string } | null;
};

function hex(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) throw new BadRequestException(`Invalid color: ${value}`);
  return normalized;
}

function channel(n: number) { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }
export function luminance(color: string) {
  const c = hex(color);
  return .2126 * channel(parseInt(c.slice(1, 3), 16)) + .7152 * channel(parseInt(c.slice(3, 5), 16)) + .0722 * channel(parseInt(c.slice(5, 7), 16));
}
export function contrast(a: string, b: string) { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + .05) / (lo! + .05); }
export function readableOn(background: string) { return contrast("#FFFFFF", background) >= contrast("#000000", background) ? "#FFFFFF" : "#000000"; }

export function validateBranding(input: Pick<BrandingInput, "primaryColor" | "backgroundColor" | "surfaceColor" | "textColor">) {
  const colors = { primaryColor: hex(input.primaryColor), backgroundColor: hex(input.backgroundColor), surfaceColor: hex(input.surfaceColor), textColor: hex(input.textColor) };
  const automaticText = readableOn(colors.primaryColor);
  const checks = [
    { key: "text/primary-selection", ratio: contrast(colors.textColor, colors.backgroundColor), minimum: BRANDING_POLICY.textContrastMinimum },
    { key: "text/secondary-selection", ratio: contrast(colors.textColor, colors.surfaceColor), minimum: BRANDING_POLICY.textContrastMinimum },
    { key: "automatic-text/accent", ratio: contrast(automaticText, colors.primaryColor), minimum: BRANDING_POLICY.textContrastMinimum },
  ];
  const failed = checks.filter(x => x.ratio < x.minimum);
  if (failed.length) throw new BadRequestException(`Branding contrast is not accessible: ${failed.map(x => `${x.key} ${x.ratio.toFixed(2)}:1 (min ${x.minimum}:1)`).join("; ")}`);
  return { ...colors, onPrimaryColor: readableOn(colors.primaryColor), checks: checks.map(x => ({ ...x, ratio: Number(x.ratio.toFixed(2)), ok: true })) };
}

function detectedMime(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP") return "image/webp";
  return null;
}

@Injectable()
export class BrandingService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async get(organizationId: string, includeLogo = true) {
    const row = await this.db.organizationBranding.findUnique({ where: { organizationId } });
    const base = row ?? { id: null, organizationId, enabled: false, ...BRANDING_DEFAULTS, logoAltText: null, logoDocumentId: null, updatedBy: null, createdAt: null, updatedAt: null };
    const validated = validateBranding(base);
    let logo: null | { fileName: string; mimeType: string; dataUrl: string; contentHash: string } = null;
    if (includeLogo && row?.logoDocumentId) {
      const record = await this.db.documentRecord.findFirst({ where: { id: row.logoDocumentId, organizationId, recordClass: "BRAND_ASSET" }, include: { blob: true } });
      if (record?.blob) {
        const bytes = decryptBytes(record.blob.bytes);
        logo = { fileName: record.fileName, mimeType: record.mimeType, dataUrl: `data:${record.mimeType};base64,${bytes.toString("base64")}`, contentHash: record.contentHash };
      }
    }
    const configured = Boolean(row?.enabled && row.logoDocumentId && row.updatedBy && row.updatedAt);
    return { logoDocumentId: base.logoDocumentId ?? null, enabled: Boolean(base.enabled), configured, launchEligible: configured, primaryColor: validated.primaryColor, backgroundColor: validated.backgroundColor, surfaceColor: validated.surfaceColor, textColor: validated.textColor, onPrimaryColor: validated.onPrimaryColor, logoAltText: base.logoAltText, logo, checks: validated.checks, updatedBy: base.updatedBy, updatedAt: base.updatedAt, policy: BRANDING_POLICY };
  }

  async fromSnapshot(organizationId: string, snapshot: any) {
    if (!snapshot) return this.get(organizationId, true);
    const validated = validateBranding(snapshot);
    let logo: null | { fileName: string; mimeType: string; dataUrl: string; contentHash: string } = null;
    if (snapshot.logoDocumentId) {
      const record = await this.db.documentRecord.findFirst({ where: { id: String(snapshot.logoDocumentId), organizationId, recordClass: "BRAND_ASSET" }, include: { blob: true } });
      if (record?.blob) { const bytes = decryptBytes(record.blob.bytes); logo = { fileName: record.fileName, mimeType: record.mimeType, dataUrl: `data:${record.mimeType};base64,${bytes.toString("base64")}`, contentHash: record.contentHash }; }
    }
    const configured = Boolean(snapshot.enabled && snapshot.logoDocumentId && snapshot.updatedBy);
    return { logoDocumentId: snapshot.logoDocumentId ?? null, enabled: Boolean(snapshot.enabled), configured, launchEligible: configured, primaryColor: validated.primaryColor, backgroundColor: validated.backgroundColor, surfaceColor: validated.surfaceColor, textColor: validated.textColor, onPrimaryColor: validated.onPrimaryColor, logoAltText: snapshot.logoAltText ?? null, logo, checks: validated.checks, updatedBy: snapshot.updatedBy ?? null, updatedAt: snapshot.updatedAt ?? null, policy: BRANDING_POLICY };
  }

  async update(organizationId: string, actorId: string, input: BrandingInput) {
    const validated = validateBranding(input);
    let upload: null | { fileName: string; mimeType: string; bytes: Buffer; stored: Uint8Array<ArrayBuffer>; contentHash: string } = null;
    if (input.logo) {
      if (!BRANDING_POLICY.allowedLogoTypes.includes(input.logo.mimeType as any)) throw new BadRequestException("Logo must be PNG, JPEG or WebP");
      const bytes = Buffer.from(input.logo.base64, "base64");
      if (!bytes.length || bytes.length > BRANDING_POLICY.maxLogoBytes) throw new BadRequestException("Logo must be between 1 byte and 1 MB");
      const actual = detectedMime(bytes);
      if (!actual || actual !== input.logo.mimeType) throw new BadRequestException("Logo file content does not match its declared image type");
      const encrypted = encryptBytes(bytes); const stored = new Uint8Array(new ArrayBuffer(encrypted.byteLength)); stored.set(encrypted);
      upload = { fileName: input.logo.fileName.slice(0, 180), mimeType: actual, bytes, stored, contentHash: createHash("sha256").update(bytes).digest("hex") };
    }
    const row = await this.db.$transaction(async tx => {
      const current = await tx.organizationBranding.findUnique({ where: { organizationId } });
      let logoDocumentId = input.removeLogo ? null : current?.logoDocumentId ?? null;
      if (upload) {
        const record = await tx.documentRecord.create({ data: { organizationId, recordClass: "BRAND_ASSET", documentType: "ORGANIZATION_LOGO", title: upload.fileName, fileName: upload.fileName, mimeType: upload.mimeType, contentHash: upload.contentHash, immutable: true, metadata: { purpose: "assessment-branding", sizeBytes: upload.bytes.length, encryption: "AES-256-GCM" } } });
        await tx.documentBlob.create({ data: { documentRecordId: record.id, bytes: upload.stored } });
        logoDocumentId = record.id;
      }
      return tx.organizationBranding.upsert({ where: { organizationId }, update: { enabled: input.enabled !== false, primaryColor: validated.primaryColor, backgroundColor: validated.backgroundColor, surfaceColor: validated.surfaceColor, textColor: validated.textColor, logoDocumentId, logoAltText: input.logoAltText?.trim() || null, updatedBy: actorId }, create: { organizationId, enabled: input.enabled !== false, primaryColor: validated.primaryColor, backgroundColor: validated.backgroundColor, surfaceColor: validated.surfaceColor, textColor: validated.textColor, logoDocumentId, logoAltText: input.logoAltText?.trim() || null, updatedBy: actorId } });
    });
    await this.audit.record({ organizationId, actorType: "USER", actorId, action: "ORGANIZATION_ASSESSMENT_BRANDING_UPDATED", targetType: "OrganizationBranding", targetId: row.id, metadata: { primaryColor: validated.primaryColor, backgroundColor: validated.backgroundColor, surfaceColor: validated.surfaceColor, textColor: validated.textColor, logoChanged: Boolean(input.logo || input.removeLogo), enabled: row.enabled } });
    return this.get(organizationId, true);
  }
}
