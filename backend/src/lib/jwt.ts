const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "fallback_advance_pay_secret_jwt_key_2026",
  "secret",
  "jwt_secret",
  "changeme",
  "password",
  "12345678",
  "test_jwt_secret_key_1234567890",
  "your_jwt_secret",
  "your_secret_key",
  "advance_pay_super_secret_jwt_key_2026_change_in_production",
]);

const MIN_JWT_SECRET_LENGTH = 32;

export interface JwtSecretValidationResult {
  isValid: boolean;
  secret: string;
  error?: string;
}

/**
 * Validates JWT_SECRET for production and local environments.
 * - In production: Must be present, >= 32 chars, and not a known placeholder.
 * - In development/test: If present, must not be empty. Can fallback to dev secret if not production.
 */
export function validateJwtSecret(
  rawSecret: string | undefined,
  isProduction: boolean = process.env.NODE_ENV === "production"
): JwtSecretValidationResult {
  const secret = rawSecret?.trim();

  if (isProduction) {
    if (!secret) {
      return {
        isValid: false,
        secret: "",
        error: "FATAL: JWT_SECRET environment variable is missing in production.",
      };
    }

    if (secret.length < MIN_JWT_SECRET_LENGTH) {
      return {
        isValid: false,
        secret: "",
        error: `FATAL: JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long in production.`,
      };
    }

    if (KNOWN_PLACEHOLDER_SECRETS.has(secret.toLowerCase())) {
      return {
        isValid: false,
        secret: "",
        error: "FATAL: JWT_SECRET is set to an insecure default or placeholder value in production.",
      };
    }

    return {
      isValid: true,
      secret,
    };
  }

  // Non-production (development / test)
  if (secret) {
    return {
      isValid: true,
      secret,
    };
  }

  return {
    isValid: true,
    secret: "dev_fallback_advance_pay_jwt_secret_key_2026",
  };
}

