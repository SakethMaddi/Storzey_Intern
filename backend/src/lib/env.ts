import { config } from "dotenv";
import { validateJwtSecret } from "./jwt.js";

// Load local environment files if present
// Neon CLI writes its variables at the workspace root. Do not override values
// already injected by a deployment platform or supplied in backend/.env.
config({ path: new URL("../../../.env", import.meta.url), override: false });
config({ path: new URL("../../.env", import.meta.url), override: false });
config({ path: new URL("../../../.env.local", import.meta.url), override: false });
config({ override: false });

export interface ValidatedEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL?: string | undefined;
  CORS_ORIGIN?: string | undefined;
  RAZORPAY_KEY_ID?: string | undefined;
  RAZORPAY_KEY_SECRET?: string | undefined;
  RAZORPAY_WEBHOOK_SECRET?: string | undefined;
  PORT: number;
  NODE_ENV: string;
  isProduction: boolean;
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: number | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASS?: string | undefined;
  SMTP_FROM?: string | undefined;
}

const PLACEHOLDER_PREFIXES = ["your_", "rzp_test_placeholder", "rzp_live_placeholder"];
const KNOWN_PLACEHOLDERS = new Set([
  "your_key_id",
  "your_key_secret",
  "your_webhook_secret",
  "placeholder",
  "changeme",
  "secret",
]);

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (KNOWN_PLACEHOLDERS.has(lower)) return true;
  return PLACEHOLDER_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Validates the runtime environment according to deployment rules.
 * Throws a descriptive Error (without revealing secrets) if validation fails.
 */
export function validateEnv(
  isProduction: boolean = process.env.NODE_ENV === "production"
): ValidatedEnv {
  const nodeEnv = process.env.NODE_ENV || (isProduction ? "production" : "development");

  // 1. DATABASE_URL validation
  const rawDbUrl = process.env.DATABASE_URL?.trim();
  if (!rawDbUrl) {
    throw new Error("DATABASE_URL is required. Please set DATABASE_URL.");
  }

  try {
    const parsedDbUrl = new URL(rawDbUrl);
    if (parsedDbUrl.protocol !== "postgres:" && parsedDbUrl.protocol !== "postgresql:") {
      throw new Error("DATABASE_URL must have postgres: or postgresql: protocol.");
    }
  } catch (err: any) {
    if (err.message.includes("protocol")) {
      throw err;
    }
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
  }

  // 2. JWT_SECRET validation (reuses validateJwtSecret)
  const jwtResult = validateJwtSecret(process.env.JWT_SECRET, isProduction);
  if (!jwtResult.isValid) {
    throw new Error(jwtResult.error || "JWT_SECRET validation failed.");
  }

  // 3. FRONTEND_URL validation
  let normalizedFrontendOrigin: string | undefined;
  const rawFrontendUrl = process.env.FRONTEND_URL?.trim();

  if (isProduction) {
    if (!rawFrontendUrl) {
      throw new Error("FRONTEND_URL is required in production.");
    }

    try {
      const parsedUrl = new URL(rawFrontendUrl);

      if (parsedUrl.protocol !== "https:") {
        throw new Error("FRONTEND_URL must use https: protocol in production.");
      }

      if (!parsedUrl.hostname) {
        throw new Error("FRONTEND_URL must include a valid hostname.");
      }

      if (parsedUrl.username || parsedUrl.password) {
        throw new Error("FRONTEND_URL must not contain embedded username or password.");
      }

      if (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "") {
        throw new Error("FRONTEND_URL must not contain a path.");
      }

      if (parsedUrl.search) {
        throw new Error("FRONTEND_URL must not contain a query string.");
      }

      if (parsedUrl.hash) {
        throw new Error("FRONTEND_URL must not contain a fragment.");
      }

      normalizedFrontendOrigin = parsedUrl.origin;
    } catch (err: any) {
      if (err.message.startsWith("FRONTEND_URL")) {
        throw err;
      }
      throw new Error("FRONTEND_URL is not a valid absolute URL.");
    }
  } else if (rawFrontendUrl) {
    try {
      const parsedUrl = new URL(rawFrontendUrl);
      normalizedFrontendOrigin = parsedUrl.origin;
    } catch {
      // In non-production, if it can't be parsed with URL, strip trailing slashes if string
      normalizedFrontendOrigin = rawFrontendUrl.replace(/\/+$/, "");
    }
  }

  // 4. DEMO_PAYMENTS_ENABLED protection
  const demoPayments = process.env.DEMO_PAYMENTS_ENABLED?.trim().toLowerCase();
  if (isProduction && demoPayments === "true") {
    throw new Error("DEMO_PAYMENTS_ENABLED must not be enabled in production.");
  }

  // 5. Razorpay credentials validation
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (isProduction) {
    if (!keyId) {
      throw new Error("RAZORPAY_KEY_ID is required in production.");
    }
    if (isPlaceholder(keyId)) {
      throw new Error("RAZORPAY_KEY_ID cannot be a placeholder or test template value in production.");
    }

    if (!keySecret) {
      throw new Error("RAZORPAY_KEY_SECRET is required in production.");
    }
    if (isPlaceholder(keySecret)) {
      throw new Error("RAZORPAY_KEY_SECRET cannot be a placeholder or test template value in production.");
    }

    if (!webhookSecret) {
      throw new Error("RAZORPAY_WEBHOOK_SECRET is required in production.");
    }
    if (isPlaceholder(webhookSecret)) {
      throw new Error("RAZORPAY_WEBHOOK_SECRET cannot be a placeholder or test template value in production.");
    }

    if (!keyId.startsWith("rzp_test_")) {
      throw new Error(
        "RAZORPAY_KEY_ID must be a Razorpay test-mode key (rzp_test_...) in production."
      );
    }
  }

  // 6. PORT validation
  let port = 5001;
  const rawPort = process.env.PORT?.trim();
  if (rawPort !== undefined && rawPort !== "") {
    const parsedPort = Number(rawPort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw new Error("PORT must be an integer between 1 and 65535.");
    }
    port = parsedPort;
  }

  // 7. SMTP configuration validation (Optional in development, validated in production if configured)
  const smtpHost = process.env.SMTP_HOST?.trim();
  const rawSmtpPort = process.env.SMTP_PORT?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim();

  let smtpPort: number | undefined;
  if (rawSmtpPort) {
    const parsed = Number(rawSmtpPort);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error("SMTP_PORT must be an integer between 1 and 65535.");
    }
    smtpPort = parsed;
  }

  if (isProduction && (smtpHost || smtpUser || smtpPass)) {
    if (!smtpHost) {
      throw new Error("SMTP_HOST is required when email configuration is enabled in production.");
    }
    if (!smtpUser) {
      throw new Error("SMTP_USER is required when email configuration is enabled in production.");
    }
    if (!smtpPass) {
      throw new Error("SMTP_PASS is required when email configuration is enabled in production.");
    }
    if (isPlaceholder(smtpHost) || isPlaceholder(smtpUser) || isPlaceholder(smtpPass)) {
      throw new Error("SMTP credentials cannot be placeholders in production.");
    }
  }

  return {
    DATABASE_URL: rawDbUrl,
    JWT_SECRET: jwtResult.secret,
    FRONTEND_URL: rawFrontendUrl,
    CORS_ORIGIN: normalizedFrontendOrigin,
    RAZORPAY_KEY_ID: keyId,
    RAZORPAY_KEY_SECRET: keySecret,
    RAZORPAY_WEBHOOK_SECRET: webhookSecret,
    PORT: port,
    NODE_ENV: nodeEnv,
    isProduction,
    SMTP_HOST: smtpHost,
    SMTP_PORT: smtpPort,
    SMTP_USER: smtpUser,
    SMTP_PASS: smtpPass,
    SMTP_FROM: smtpFrom,
  };
}

