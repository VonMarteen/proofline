const LOCAL_DATABASE_URL = "postgresql://proofline:proofline_local_only@127.0.0.1:55432/proofline?schema=public";

export function applyLocalDefaults() {
  if (process.env.NODE_ENV === "production") return;
  process.env.NODE_ENV ??= "development";
  process.env.AUTH_MODE ??= "dev";
  process.env.PORT ??= "4100";
  // Local Proofline must not inherit an unrelated DATABASE_URL from the machine.
  process.env.DATABASE_URL = process.env.PROOFLINE_DATABASE_URL ?? LOCAL_DATABASE_URL;
  process.env.SERVICE_TOKEN ??= "proofline-local-service-token";
  process.env.DEV_ENCRYPTION_KEY_B64 ??= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  process.env.DEV_BLIND_INDEX_KEY ??= "proofline-local-blind-index-key";
  process.env.AUTH_OTP_PEPPER ??= "proofline-local-otp-pepper";
  process.env.CLIENT_APP_URL ??= "http://localhost:3101";
  process.env.CONTROL_APP_URL ??= "http://localhost:3103";
  process.env.CORS_ORIGINS ??= "http://localhost:3100,http://localhost:3101,http://localhost:3102,http://127.0.0.1:3100,http://127.0.0.1:3101,http://127.0.0.1:3102";
  process.env.ANALYTICS_URL ??= "http://127.0.0.1:58100";
}

export { LOCAL_DATABASE_URL };
