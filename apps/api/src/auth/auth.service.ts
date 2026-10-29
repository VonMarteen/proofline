import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { sha256 } from "../security/crypto.js";

const CLIENT_SESSION_DAYS = 7;
const CLIENT_TRUST_DAYS = 30;
const INTERNAL_SESSION_HOURS = 8;
const INTERNAL_TRUST_HOURS = 24;
const OTP_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 6;

const addMs = (ms: number) => new Date(Date.now() + ms);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const opaqueToken = () => randomBytes(32).toString("base64url");
const sixDigitCode = () => String(randomInt(100000, 1000000));
const deviceHash = (raw: string) => sha256(`device:${raw}`);
const otpPepper = () => process.env.AUTH_OTP_PEPPER ?? (process.env.NODE_ENV !== "production" ? "proofline-local-otp-pepper" : "");
function requestMeta(userAgent?: string, ip?: string) { return { userAgentHash: userAgent ? sha256(`ua:${userAgent}`) : null, ipHash: ip ? sha256(`ip:${ip}`) : null }; }
function codeHash(code: string, email: string, device: string) { const pepper = otpPepper(); if (!pepper) throw new Error("AUTH_OTP_PEPPER is required in production"); return sha256(`${pepper}:${normalizeEmail(email)}:${device}:${code}`); }

export function hashPassword(password: string) {
  if (password.length < 10) throw new BadRequestException("Password must contain at least 10 characters");
  const salt = randomBytes(16).toString("base64url");
  const derived = scryptSync(password, salt, 32).toString("base64url");
  return `scrypt$${salt}$${derived}`;
}
export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = Buffer.from(scryptSync(password, salt, 32));
  const target = Buffer.from(expected, "base64url");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  private async enqueueOtp(email: string, code: string, audience: "CLIENT" | "INTERNAL", locale: string) {
    const es = locale !== "en";
    await this.db.outboxEvent.create({ data: { type: "SEND_EMAIL", payload: {
      to: email,
      subject: audience === "INTERNAL" ? "Proofline · código de acceso interno" : "Proofline · código de acceso",
      text: es ? `Tu código de verificación de Proofline es ${code}. Caduca en ${OTP_MINUTES} minutos. Si no has iniciado este acceso, ignora este mensaje.` : `Your Proofline verification code is ${code}. It expires in ${OTP_MINUTES} minutes. If you did not start this sign-in, ignore this message.`,
      category: audience === "INTERNAL" ? "internal_auth_otp" : "client_auth_otp",
      locale: es ? "es" : "en",
    } } });
  }

  private async createClientSession(userId: string, membershipId: string, trustedDeviceId: string | null, stepUp: boolean) {
    const token = opaqueToken(), expiresAt = addMs(CLIENT_SESSION_DAYS * 86_400_000);
    await this.db.clientAuthSession.create({ data: { userId, membershipId, trustedDeviceId, tokenHash: sha256(token), expiresAt, stepUpAt: stepUp ? new Date() : null } });
    return { token, expiresAt };
  }
  private async createInternalSession(internalUserId: string, trustedDeviceId: string | null, stepUp: boolean) {
    const token = opaqueToken(), expiresAt = addMs(INTERNAL_SESSION_HOURS * 3_600_000);
    await this.db.internalAuthSession.create({ data: { internalUserId, trustedDeviceId, tokenHash: sha256(token), expiresAt, stepUpAt: stepUp ? new Date() : null } });
    return { token, expiresAt };
  }

  async requestClientLogin(input: { email: string; password: string; deviceToken: string; organizationId?: string; userAgent?: string; ip?: string }) {
    const email = normalizeEmail(input.email);
    const user = await this.db.user.findUnique({ where: { email }, include: { memberships: { include: { organization: true }, orderBy: { createdAt: "asc" } } } });
    if (!user || user.accountStatus === "DISABLED" || !verifyPassword(input.password, user.passwordHash)) throw new UnauthorizedException("Invalid credentials");
    const membership = input.organizationId ? user.memberships.find(m => m.organizationId === input.organizationId) : user.memberships[0];
    if (!membership) throw new UnauthorizedException("No active organization membership");
    const dHash = deviceHash(input.deviceToken), meta = requestMeta(input.userAgent, input.ip);
    const trusted = await this.db.trustedLoginDevice.findUnique({ where: { userId_deviceHash: { userId: user.id, deviceHash: dHash } } });
    const sameBrowser = !trusted?.userAgentHash || !meta.userAgentHash || trusted.userAgentHash === meta.userAgentHash;
    if (trusted && !trusted.revokedAt && trusted.trustedUntil > new Date() && sameBrowser) {
      await this.db.trustedLoginDevice.update({ where: { id: trusted.id }, data: { lastSeenAt: new Date(), lastIpHash: meta.ipHash, userAgentHash: meta.userAgentHash } });
      const session = await this.createClientSession(user.id, membership.id, trusted.id, false);
      await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return { requiresOtp: false, sessionToken: session.token, expiresAt: session.expiresAt, user: { email: user.email, name: user.displayName, role: membership.role, organization: { id: membership.organization.id, name: membership.organization.name } } };
    }
    const code = sixDigitCode();
    const challenge = await this.db.authChallenge.create({ data: { audience: "CLIENT", purpose: user.emailVerifiedAt ? "LOGIN" : "EMAIL_VERIFICATION", userId: user.id, emailLookup: sha256(email), codeHash: codeHash(code, email, dHash), deviceHash: dHash, userAgentHash: meta.userAgentHash, ipHash: meta.ipHash, expiresAt: addMs(OTP_MINUTES * 60_000) } });
    await this.enqueueOtp(user.email, code, "CLIENT", user.locale);
    return { requiresOtp: true, challengeId: challenge.id, expiresInSeconds: OTP_MINUTES * 60, organization: { id: membership.organization.id, name: membership.organization.name } };
  }

  async verifyClientOtp(input: { challengeId: string; code: string; deviceToken: string; trustDevice?: boolean; organizationId?: string; userAgent?: string; ip?: string }) {
    const challenge = await this.db.authChallenge.findUnique({ where: { id: input.challengeId }, include: { user: { include: { memberships: { include: { organization: true }, orderBy: { createdAt: "asc" } } } } } });
    if (!challenge || challenge.audience !== "CLIENT" || !challenge.user || challenge.usedAt || challenge.expiresAt <= new Date()) throw new UnauthorizedException("Verification code expired or invalid");
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) throw new UnauthorizedException("Verification attempts exceeded");
    const dHash = deviceHash(input.deviceToken), expected = codeHash(input.code.trim(), challenge.user.email, dHash);
    if (dHash !== challenge.deviceHash || expected !== challenge.codeHash) { await this.db.authChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } }); throw new UnauthorizedException("Invalid verification code"); }
    const membership = input.organizationId ? challenge.user.memberships.find(m => m.organizationId === input.organizationId) : challenge.user.memberships[0];
    if (!membership) throw new UnauthorizedException("No active organization membership");
    const meta = requestMeta(input.userAgent, input.ip); let trustedDeviceId: string | null = null;
    if (input.trustDevice !== false) {
      const trusted = await this.db.trustedLoginDevice.upsert({ where: { userId_deviceHash: { userId: challenge.user.id, deviceHash: dHash } }, update: { trustedUntil: addMs(CLIENT_TRUST_DAYS * 86_400_000), revokedAt: null, lastSeenAt: new Date(), lastIpHash: meta.ipHash, userAgentHash: meta.userAgentHash }, create: { userId: challenge.user.id, deviceHash: dHash, trustedUntil: addMs(CLIENT_TRUST_DAYS * 86_400_000), lastIpHash: meta.ipHash, userAgentHash: meta.userAgentHash } });
      trustedDeviceId = trusted.id;
    }
    await this.db.authChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
    await this.db.user.update({ where: { id: challenge.user.id }, data: { accountStatus: "ACTIVE", emailVerifiedAt: challenge.user.emailVerifiedAt ?? new Date(), lastLoginAt: new Date() } });
    const session = await this.createClientSession(challenge.user.id, membership.id, trustedDeviceId, true);
    return { sessionToken: session.token, expiresAt: session.expiresAt, user: { email: challenge.user.email, name: challenge.user.displayName, role: membership.role, organization: { id: membership.organization.id, name: membership.organization.name } } };
  }

  async requestInternalLogin(input: { email: string; password: string; deviceToken: string; userAgent?: string; ip?: string }) {
    const email = normalizeEmail(input.email), user = await this.db.internalUser.findUnique({ where: { email } });
    if (!user || user.status !== "ACTIVE" || !verifyPassword(input.password, user.passwordHash)) throw new UnauthorizedException("Invalid internal credentials");
    const dHash = deviceHash(input.deviceToken), meta = requestMeta(input.userAgent, input.ip);
    const trusted = await this.db.internalTrustedDevice.findUnique({ where: { internalUserId_deviceHash: { internalUserId: user.id, deviceHash: dHash } } });
    const sameBrowser = !trusted?.userAgentHash || !meta.userAgentHash || trusted.userAgentHash === meta.userAgentHash;
    if (trusted && !trusted.revokedAt && trusted.trustedUntil > new Date() && sameBrowser) {
      await this.db.internalTrustedDevice.update({ where: { id: trusted.id }, data: { lastSeenAt: new Date(), lastIpHash: meta.ipHash, userAgentHash: meta.userAgentHash } });
      const session = await this.createInternalSession(user.id, trusted.id, false);
      await this.db.internalUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return { requiresOtp: false, sessionToken: session.token, expiresAt: session.expiresAt, user: { email: user.email, name: user.displayName, role: user.role } };
    }
    const code = sixDigitCode();
    const challenge = await this.db.authChallenge.create({ data: { audience: "INTERNAL", purpose: "LOGIN", internalUserId: user.id, emailLookup: sha256(email), codeHash: codeHash(code, email, dHash), deviceHash: dHash, userAgentHash: meta.userAgentHash, ipHash: meta.ipHash, expiresAt: addMs(OTP_MINUTES * 60_000) } });
    await this.enqueueOtp(user.email, code, "INTERNAL", "es");
    return { requiresOtp: true, challengeId: challenge.id, expiresInSeconds: OTP_MINUTES * 60 };
  }

  async verifyInternalOtp(input: { challengeId: string; code: string; deviceToken: string; trustDevice?: boolean; userAgent?: string; ip?: string }) {
    const challenge = await this.db.authChallenge.findUnique({ where: { id: input.challengeId }, include: { internalUser: true } });
    if (!challenge || challenge.audience !== "INTERNAL" || !challenge.internalUser || challenge.usedAt || challenge.expiresAt <= new Date()) throw new UnauthorizedException("Verification code expired or invalid");
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) throw new UnauthorizedException("Verification attempts exceeded");
    const dHash = deviceHash(input.deviceToken), expected = codeHash(input.code.trim(), challenge.internalUser.email, dHash);
    if (dHash !== challenge.deviceHash || expected !== challenge.codeHash) { await this.db.authChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } }); throw new UnauthorizedException("Invalid verification code"); }
    const meta = requestMeta(input.userAgent, input.ip); let trustedDeviceId: string | null = null;
    if (input.trustDevice !== false) {
      const trusted = await this.db.internalTrustedDevice.upsert({ where: { internalUserId_deviceHash: { internalUserId: challenge.internalUser.id, deviceHash: dHash } }, update: { trustedUntil: addMs(INTERNAL_TRUST_HOURS * 3_600_000), revokedAt: null, lastSeenAt: new Date(), lastIpHash: meta.ipHash, userAgentHash: meta.userAgentHash }, create: { internalUserId: challenge.internalUser.id, deviceHash: dHash, trustedUntil: addMs(INTERNAL_TRUST_HOURS * 3_600_000), lastIpHash: meta.ipHash, userAgentHash: meta.userAgentHash } });
      trustedDeviceId = trusted.id;
    }
    await this.db.authChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
    await this.db.internalUser.update({ where: { id: challenge.internalUser.id }, data: { emailVerifiedAt: challenge.internalUser.emailVerifiedAt ?? new Date(), lastLoginAt: new Date() } });
    const session = await this.createInternalSession(challenge.internalUser.id, trustedDeviceId, true);
    return { sessionToken: session.token, expiresAt: session.expiresAt, user: { email: challenge.internalUser.email, name: challenge.internalUser.displayName, role: challenge.internalUser.role } };
  }

  async resolveClientSession(token: string) {
    const session = await this.db.clientAuthSession.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true, membership: { include: { organization: true } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.accountStatus !== "ACTIVE") return null;
    await this.db.clientAuthSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    return { sessionId: session.id, email: session.user.email, role: session.membership.role, name: session.user.displayName, organizationId: session.membership.organizationId, organizationName: session.membership.organization.name, stepUpAt: session.stepUpAt };
  }
  async resolveInternalSession(token: string) {
    const session = await this.db.internalAuthSession.findUnique({ where: { tokenHash: sha256(token) }, include: { internalUser: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.internalUser.status !== "ACTIVE") return null;
    await this.db.internalAuthSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    return { sessionId: session.id, email: session.internalUser.email, role: session.internalUser.role, name: session.internalUser.displayName, stepUpAt: session.stepUpAt };
  }

  async revokeClientSession(token: string) { await this.db.clientAuthSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } }); }
  async revokeInternalSession(token: string) { await this.db.internalAuthSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } }); }

  async activateClient(input: { token: string; password: string }) {
    const activation = await this.db.accountActivation.findUnique({ where: { tokenHash: sha256(input.token) }, include: { user: true } });
    if (!activation || activation.usedAt || activation.expiresAt <= new Date()) throw new UnauthorizedException("Activation link expired or invalid");
    const passwordHash = hashPassword(input.password);
    await this.db.$transaction([this.db.user.update({ where: { id: activation.userId }, data: { passwordHash, accountStatus: "ACTIVE", emailVerifiedAt: activation.user.emailVerifiedAt ?? new Date() } }), this.db.accountActivation.update({ where: { id: activation.id }, data: { usedAt: new Date() } })]);
    return { ok: true };
  }
  async activateInternal(input: { token: string; password: string }) {
    const activation = await this.db.internalAccountActivation.findUnique({ where: { tokenHash: sha256(input.token) }, include: { internalUser: true } });
    if (!activation || activation.usedAt || activation.expiresAt <= new Date()) throw new UnauthorizedException("Activation link expired or invalid");
    const passwordHash = hashPassword(input.password);
    await this.db.$transaction([this.db.internalUser.update({ where: { id: activation.internalUserId }, data: { passwordHash, status: "ACTIVE", emailVerifiedAt: activation.internalUser.emailVerifiedAt ?? new Date() } }), this.db.internalAccountActivation.update({ where: { id: activation.id }, data: { usedAt: new Date() } })]);
    return { ok: true };
  }

  async createActivation(userId: string, email: string, locale: string) {
    const raw = opaqueToken();
    await this.db.accountActivation.create({ data: { userId, tokenHash: sha256(raw), expiresAt: addMs(72 * 3_600_000) } });
    const base = process.env.CLIENT_APP_URL ?? "http://localhost:4202";
    const activationUrl = `${base}/activate?token=${encodeURIComponent(raw)}&locale=${locale === "en" ? "en" : "es"}`;
    const es = locale !== "en";
    await this.db.outboxEvent.create({ data: { type: "SEND_EMAIL", payload: { to: email, subject: es ? "PROOFLINE · Activa tu acceso" : "PROOFLINE · Activate your access", text: es ? `Tu organización de PROOFLINE está preparada. Crea tu contraseña desde este enlace (válido durante 72 horas): ${activationUrl}` : `Your PROOFLINE organization is ready. Create your password from this link (valid for 72 hours): ${activationUrl}`, category: "client_activation", locale: es ? "es" : "en" } } });
    return { activationUrl };
  }
  async createInternalActivation(internalUserId: string, email: string, locale = "es") {
    const raw = opaqueToken();
    await this.db.internalAccountActivation.create({ data: { internalUserId, tokenHash: sha256(raw), expiresAt: addMs(24 * 3_600_000) } });
    const base = process.env.CONTROL_APP_URL ?? "http://localhost:4204";
    const activationUrl = `${base}/activate?token=${encodeURIComponent(raw)}&locale=${locale === "en" ? "en" : "es"}`;
    const es = locale !== "en";
    await this.db.outboxEvent.create({ data: { type: "SEND_EMAIL", payload: { to: email, subject: es ? "PROOFLINE Control · Activa tu acceso" : "PROOFLINE Control · Activate your access", text: es ? `Se ha creado tu acceso interno a PROOFLINE Control. Define tu contraseña desde este enlace de un solo uso (válido durante 24 horas): ${activationUrl}` : `Your internal PROOFLINE Control access has been created. Set your password using this one-time link (valid for 24 hours): ${activationUrl}`, category: "internal_activation", locale: es ? "es" : "en" } } });
    return { activationUrl };
  }
}
