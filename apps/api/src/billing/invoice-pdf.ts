export type InvoicePdfSnapshot = {
  locale: "es" | "en";
  invoiceNumber: string;
  status: string;
  issuedAt: string;
  dueAt?: string | null;
  paidAt?: string | null;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxRate?: number | null;
  issuer: {
    name: string;
    taxId?: string | null;
    address?: string | null;
    email?: string | null;
  };
  customer: {
    name: string;
    legalName?: string | null;
    taxId?: string | null;
    address?: string | null;
    country?: string | null;
    billingEmail?: string | null;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    amountCents: number;
  }>;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  servicePeriod?: string | null;
  notes?: string | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 42;
const RIGHT = 553;

function esc(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2022]/g, "-")
    .replace(/[^\x20-\xFF]/g, "?");
}

function formatMoney(cents: number, currency: string, locale: "es" | "en") {
  const amount = cents / 100;
  const formatted = amount.toLocaleString(locale === "es" ? "es-ES" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

function shortDate(value: string | null | undefined, locale: "es" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function wrap(value: string, max = 66) {
  const words = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let row = "";
  for (const word of words) {
    const candidate = row ? `${row} ${word}` : word;
    if (candidate.length > max && row) {
      rows.push(row);
      row = word;
    } else {
      row = candidate;
    }
  }
  if (row) rows.push(row);
  return rows.length ? rows : [""];
}

function statusLabel(status: string, locale: "es" | "en") {
  const key = status.toUpperCase();
  const labels: Record<string, [string, string]> = {
    OPEN: ["Pendiente", "Outstanding"],
    PAID: ["Pagada", "Paid"],
    VOID: ["Anulada", "Void"],
    UNCOLLECTIBLE: ["Incobrable", "Uncollectible"],
    DRAFT: ["Borrador", "Draft"],
  };
  return labels[key]?.[locale === "es" ? 0 : 1] ?? status.replaceAll("_", " ");
}

function statusColor(status: string) {
  switch (status.toUpperCase()) {
    case "PAID": return "0.06 0.58 0.43";
    case "VOID": return "0.48 0.52 0.57";
    case "UNCOLLECTIBLE": return "0.78 0.18 0.22";
    default: return "0.83 0.48 0.08";
  }
}

function estimateWidth(text: string, size: number) {
  return esc(text).length * size * 0.50;
}

export function buildInvoicePdf(snapshot: InvoicePdfSnapshot) {
  const es = snapshot.locale === "es";
  const objects: string[] = [];
  const addObject = (value: string) => {
    objects.push(value);
    return objects.length;
  };

  const fontRegular = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const commands: string[] = [];
  const emit = (...parts: string[]) => commands.push(...parts.filter(Boolean));

  const text = (x: number, y: number, size: number, value: string, bold = false, color = "0.08 0.10 0.13") =>
    `BT /F${bold ? 2 : 1} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${esc(value)}) Tj ET`;
  const textRight = (right: number, y: number, size: number, value: string, bold = false, color = "0.08 0.10 0.13") =>
    text(Math.max(LEFT, right - estimateWidth(value, size)), y, size, value, bold, color);
  const line = (x1: number, y1: number, x2: number, y2: number, color = "0.84 0.87 0.90", width = 0.7) =>
    `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
  const fill = (x: number, y: number, w: number, h: number, color: string) =>
    `${color} rg ${x} ${y} ${w} ${h} re f`;
  const strokeRect = (x: number, y: number, w: number, h: number, color = "0.84 0.87 0.90", width = 0.7) =>
    `${color} RG ${width} w ${x} ${y} ${w} ${h} re S`;

  const textRows = (x: number, y: number, size: number, value: string, maxChars: number, leading = 13, bold = false, color = "0.18 0.21 0.25", maxRows = 4) => {
    const rows = wrap(value, maxChars).slice(0, maxRows);
    rows.forEach((row, index) => emit(text(x, y - index * leading, size, row, bold, color)));
    return rows.length;
  };

  emit("q");
  emit(fill(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "1 1 1"));

  // Brand header.
  emit(fill(0, 790, PAGE_WIDTH, 52, "0.045 0.065 0.082"));
  emit(fill(42, 808, 11, 11, "0.10 0.83 0.66"));
  emit(text(62, 806, 15, "PROOFLINE", true, "0.95 0.97 0.98"));
  emit(text(151, 807, 8.5, "Signal & Structure", false, "0.66 0.72 0.76"));

  // Invoice title and key identifiers.
  emit(text(LEFT, 744, 30, es ? "Factura" : "Invoice", true));

  emit(fill(360, 705, 193, 59, "0.96 0.975 0.98"));
  emit(strokeRect(360, 705, 193, 59, "0.88 0.91 0.93"));
  emit(text(373, 745, 8.5, es ? "NUMERO DE FACTURA" : "INVOICE NUMBER", true, "0.42 0.46 0.50"));
  emit(text(373, 724, 13, snapshot.invoiceNumber, true));
  emit(textRight(540, 744, 8.5, es ? "ESTADO" : "STATUS", true, "0.42 0.46 0.50"));
  emit(textRight(540, 724, 10.5, statusLabel(snapshot.status, snapshot.locale), true, statusColor(snapshot.status)));

  // Issuer/customer cards.
  emit(text(LEFT, 672, 8.5, es ? "EMISOR" : "ISSUER", true, "0.42 0.46 0.50"));
  emit(text(313, 672, 8.5, es ? "CLIENTE" : "CUSTOMER", true, "0.42 0.46 0.50"));
  emit(strokeRect(LEFT, 568, 235, 88));
  emit(strokeRect(313, 568, 240, 88));

  emit(text(54, 633, 11.5, snapshot.issuer.name, true));
  let issuerY = 615;
  for (const item of [
    snapshot.issuer.taxId ? `${es ? "NIF/CIF" : "Tax ID"}: ${snapshot.issuer.taxId}` : null,
    snapshot.issuer.address,
    snapshot.issuer.email,
  ].filter(Boolean) as string[]) {
    const used = textRows(54, issuerY, 8.8, item, 44, 11.5, false, "0.32 0.36 0.40", 2);
    issuerY -= used * 11.5 + 2;
  }

  emit(text(325, 633, 11.5, snapshot.customer.legalName || snapshot.customer.name, true));
  let customerY = 615;
  for (const item of [
    snapshot.customer.taxId ? `${es ? "NIF/CIF" : "Tax ID"}: ${snapshot.customer.taxId}` : null,
    snapshot.customer.address,
    snapshot.customer.country,
    snapshot.customer.billingEmail,
  ].filter(Boolean) as string[]) {
    const used = textRows(325, customerY, 8.8, item, 42, 11.5, false, "0.32 0.36 0.40", 2);
    customerY -= used * 11.5 + 2;
  }

  // Dates / service metadata.
  const metaY = 534;
  emit(line(LEFT, metaY + 13, RIGHT, metaY + 13));
  const meta = [
    { x: LEFT, label: es ? "Fecha de emision" : "Issue date", value: shortDate(snapshot.issuedAt, snapshot.locale) },
    { x: 180, label: es ? "Vencimiento" : "Due date", value: shortDate(snapshot.dueAt, snapshot.locale) },
    { x: 318, label: es ? "Fecha de pago" : "Paid date", value: shortDate(snapshot.paidAt, snapshot.locale) },
    { x: 445, label: es ? "Moneda" : "Currency", value: snapshot.currency },
  ];
  for (const item of meta) {
    emit(text(item.x, metaY - 2, 8, item.label.toUpperCase(), true, "0.46 0.49 0.53"));
    emit(text(item.x, metaY - 20, 9.5, item.value, true));
  }
  if (snapshot.servicePeriod) {
    emit(text(LEFT, metaY - 45, 8, (es ? "PERIODO DE SERVICIO" : "SERVICE PERIOD"), true, "0.46 0.49 0.53"));
    emit(text(LEFT, metaY - 61, 9.5, snapshot.servicePeriod, true));
  }

  // Item table.
  const tableTop = snapshot.servicePeriod ? 430 : 467;
  emit(fill(LEFT, tableTop, RIGHT - LEFT, 27, "0.945 0.96 0.967"));
  emit(text(53, tableTop + 9, 8, es ? "CONCEPTO" : "DESCRIPTION", true, "0.34 0.38 0.42"));
  emit(textRight(389, tableTop + 9, 8, es ? "CANT." : "QTY", true, "0.34 0.38 0.42"));
  emit(textRight(474, tableTop + 9, 8, es ? "PRECIO UNIT." : "UNIT PRICE", true, "0.34 0.38 0.42"));
  emit(textRight(542, tableTop + 9, 8, "TOTAL", true, "0.34 0.38 0.42"));

  let y = tableTop - 23;
  const visibleLines = snapshot.lines.slice(0, 7);
  for (const item of visibleLines) {
    const rows = wrap(item.description, 50).slice(0, 2);
    rows.forEach((row, index) => emit(text(53, y - index * 12, 9.2, row)));
    emit(textRight(389, y, 9, String(item.quantity)));
    emit(textRight(474, y, 9, formatMoney(item.unitPriceCents, snapshot.currency, snapshot.locale)));
    emit(textRight(542, y, 9, formatMoney(item.amountCents, snapshot.currency, snapshot.locale), true));
    const rowHeight = Math.max(34, rows.length * 12 + 14);
    y -= rowHeight;
    emit(line(LEFT, y + 10, RIGHT, y + 10, "0.91 0.925 0.94"));
  }

  if (snapshot.lines.length > visibleLines.length) {
    emit(text(53, y - 2, 8.5, es ? `+ ${snapshot.lines.length - visibleLines.length} conceptos adicionales` : `+ ${snapshot.lines.length - visibleLines.length} additional items`, false, "0.42 0.46 0.50"));
    y -= 28;
  }

  // Totals, visually prominent but compact.
  const totalsTop = Math.max(165, y - 8);
  emit(fill(347, totalsTop - 111, 206, 111, "0.965 0.977 0.98"));
  emit(strokeRect(347, totalsTop - 111, 206, 111, "0.88 0.91 0.93"));
  emit(text(362, totalsTop - 22, 9, es ? "Base imponible" : "Subtotal", false, "0.38 0.42 0.46"));
  emit(textRight(538, totalsTop - 22, 9.5, formatMoney(snapshot.subtotalCents, snapshot.currency, snapshot.locale), true));

  const taxLabel = snapshot.taxRate != null
    ? `${es ? "IVA" : "VAT"} ${snapshot.taxRate.toFixed(snapshot.taxRate % 1 === 0 ? 0 : 2)}%`
    : (es ? "Impuestos" : "Tax");
  emit(text(362, totalsTop - 48, 9, taxLabel, false, "0.38 0.42 0.46"));
  emit(textRight(538, totalsTop - 48, 9.5, formatMoney(snapshot.taxCents, snapshot.currency, snapshot.locale), true));
  emit(line(362, totalsTop - 63, 538, totalsTop - 63, "0.82 0.85 0.88"));
  emit(text(362, totalsTop - 88, 11.5, "TOTAL", true));
  emit(textRight(538, totalsTop - 89, 14, formatMoney(snapshot.totalCents, snapshot.currency, snapshot.locale), true, "0.03 0.55 0.43"));

  // Optional operational payment information.
  let infoY = Math.min(totalsTop - 18, 198);
  const info: Array<[string, string | null | undefined]> = [
    [es ? "Metodo de pago" : "Payment method", snapshot.paymentMethod],
    [es ? "Referencia de pago" : "Payment reference", snapshot.paymentReference],
  ];
  const presentInfo = info.filter(([, value]) => Boolean(value));
  if (presentInfo.length) {
    emit(text(LEFT, infoY, 8, (es ? "INFORMACION DE PAGO" : "PAYMENT INFORMATION"), true, "0.46 0.49 0.53"));
    infoY -= 18;
    for (const [label, value] of presentInfo) {
      emit(text(LEFT, infoY, 8.5, `${label}:`, true, "0.32 0.36 0.40"));
      emit(text(135, infoY, 8.5, String(value), false, "0.32 0.36 0.40"));
      infoY -= 15;
    }
  }

  if (snapshot.notes) {
    const noteY = Math.max(104, infoY - 13);
    emit(text(LEFT, noteY, 8, (es ? "NOTAS" : "NOTES"), true, "0.46 0.49 0.53"));
    textRows(LEFT, noteY - 17, 8.3, snapshot.notes, 82, 11, false, "0.36 0.40 0.44", 3);
  }

  // Footer.
  emit(line(LEFT, 76, RIGHT, 76));
  emit(text(LEFT, 58, 7.8, es ? "Factura generada a partir del ledger de facturacion de PROOFLINE." : "Invoice generated from the PROOFLINE billing ledger.", false, "0.48 0.51 0.55"));
  emit(text(LEFT, 42, 8, "PROOFLINE - ARMAR TECHNOLOGIES", true, "0.34 0.38 0.42"));
  emit(textRight(RIGHT, 42, 7.8, snapshot.invoiceNumber, false, "0.48 0.51 0.55"));
  emit("Q");

  const content = `${commands.join("\n")}\n`;
  const stream = addObject(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`);
  const pages = addObject("PAGES");
  const page = addObject(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${stream} 0 R >>`);
  objects[pages - 1] = `<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
  const root = addObject(`<< /Type /Catalog /Pages ${pages} 0 R >>`);

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    out += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${root} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
