export type ProviderCode = "REDSYS" | "PAYPAL" | "BANK_TRANSFER";
export type PaymentProviderCapabilities = {
  provider: ProviderCode;
  externalVault: boolean;
  recurring: boolean;
  webhooks: boolean;
  manualReconciliation: boolean;
  storesSensitiveCredentialsInProofline: false;
};

export const PAYMENT_PROVIDER_CAPABILITIES: Record<ProviderCode, PaymentProviderCapabilities> = {
  REDSYS: { provider: "REDSYS", externalVault: true, recurring: true, webhooks: true, manualReconciliation: false, storesSensitiveCredentialsInProofline: false },
  PAYPAL: { provider: "PAYPAL", externalVault: true, recurring: true, webhooks: true, manualReconciliation: false, storesSensitiveCredentialsInProofline: false },
  BANK_TRANSFER: { provider: "BANK_TRANSFER", externalVault: false, recurring: false, webhooks: false, manualReconciliation: true, storesSensitiveCredentialsInProofline: false },
};

export interface PaymentProviderAdapter {
  readonly provider: ProviderCode;
  createSetupSession(input: { organizationId: string; returnUrl: string }): Promise<{ externalReference: string; redirectUrl?: string }>;
  normalizeWebhook?(payload: unknown, headers: Record<string,string|string[]|undefined>): Promise<{ externalReference: string; status: string; rawReference?: string }>;
}

export function bankTransferInstructions() {
  const accountHolder = process.env.PROOFLINE_BANK_ACCOUNT_HOLDER?.trim() || null;
  const iban = process.env.PROOFLINE_BANK_IBAN?.trim() || null;
  const bic = process.env.PROOFLINE_BANK_BIC?.trim() || null;
  return { configured: Boolean(accountHolder && iban), accountHolder, iban, bic };
}
