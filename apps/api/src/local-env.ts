const LOCAL_DATABASE_URL = "postgresql://proofline:proofline_local_only@127.0.0.1:4232/proofline?schema=public";

export function applyLocalDefaults() {
  if (process.env.NODE_ENV === "production") return;
  process.env.NODE_ENV ??= "development";
  process.env.AUTH_MODE ??= "dev";
  process.env.PORT ??= "4201";
  process.env.CONTROL_API_PORT ??= "4206";
  // Local Proofline must not inherit an unrelated DATABASE_URL from the machine.
  process.env.DATABASE_URL = process.env.PROOFLINE_DATABASE_URL ?? LOCAL_DATABASE_URL;
  process.env.SERVICE_TOKEN ??= "proofline-local-service-token";
  process.env.DEV_ENCRYPTION_KEY_B64 ??= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  process.env.DEV_BLIND_INDEX_KEY ??= "proofline-local-blind-index-key";
  process.env.AUTH_OTP_PEPPER ??= "proofline-local-otp-pepper";
  process.env.SITE_APP_URL ??= "http://localhost:4200";
  process.env.CLIENT_APP_URL ??= "http://localhost:4202";
  process.env.RESPOND_APP_URL ??= "http://localhost:4203";
  process.env.CONTROL_APP_URL ??= "http://localhost:4204";
  process.env.SUPPORT_APP_URL ??= "http://localhost:4205";
  process.env.API_INTERNAL_URL ??= "http://127.0.0.1:4201";
  process.env.CONTROL_API_INTERNAL_URL ??= "http://127.0.0.1:4206";
  process.env.CORS_ORIGINS ??= "http://localhost:4200,http://localhost:4202,http://localhost:4203,http://127.0.0.1:4200,http://127.0.0.1:4202,http://127.0.0.1:4203";
  process.env.CONTROL_CORS_ORIGINS ??= "http://localhost:4204,http://localhost:4205,http://127.0.0.1:4204,http://127.0.0.1:4205";
  process.env.ANALYTICS_URL ??= "http://127.0.0.1:4281";
  process.env.SMTP_HOST ??= "127.0.0.1";
  process.env.SMTP_PORT ??= "4225";
}

export { LOCAL_DATABASE_URL };
