/** CQF-F3 · Manually entered statuses are not provider settlement evidence. */
export type ManualPaymentInput = {
  provider: "REDSYS" | "PAYPAL" | "BANK_TRANSFER";
  kind: "CHARGE" | "REFUND" | "TRANSFER";
  status: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED" | "AWAITING_TRANSFER" | "RECONCILED" | "CANCELED";
  amountCents: number;
  bankReference?: string | null;
};

/** Returns a user-facing rejection reason, or null when the entry is safe to record. */
export function manualPaymentEvidenceError(input: ManualPaymentInput): string | null {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0)
    return "Invalid transaction amount";
  if (input.provider === "BANK_TRANSFER") {
    if (input.kind !== "TRANSFER")
      return "Manual bank transfers must be recorded as TRANSFER, never as a provider charge or refund";
    if (["AUTHORIZED", "CAPTURED", "REFUNDED"].includes(input.status))
      return "Bank transfers cannot be marked as captured or refunded by a manual payment entry";
    if (input.status === "RECONCILED" && (!input.bankReference?.trim() || input.bankReference.trim().length < 5))
      return "A reconciled bank transfer requires a bank statement/operation reference (at least 5 characters)";
    if (input.status === "RECONCILED" && input.amountCents === 0)
      return "A reconciled bank transfer must have a positive amount";
    return null;
  }
  if (["AUTHORIZED", "CAPTURED", "RECONCILED", "REFUNDED"].includes(input.status))
    return "Redsys/PayPal settlement cannot be verified by manual entry; a signed provider integration is required";
  if (input.kind !== "CHARGE")
    return "Manual Redsys/PayPal entries cannot create transfer or refund events";
  return null;
}
