/**
 * Normalizes and sanitizes API / system error messages.
 * Prevents leaking internal database, Prisma, or SQL traces to user-facing UI.
 * Accepts either a raw string or an Axios/Error object.
 */
export function sanitizeErrorMessage(errorOrMessage?: any): string {
  let rawMessage = "";

  if (typeof errorOrMessage === "string") {
    rawMessage = errorOrMessage;
  } else if (errorOrMessage && typeof errorOrMessage === "object") {
    rawMessage =
      errorOrMessage.response?.data?.message ||
      errorOrMessage.data?.message ||
      errorOrMessage.message ||
      "";
  }

  if (!rawMessage || typeof rawMessage !== "string") {
    return "An unexpected error occurred. Please try again.";
  }

  const trimmed = rawMessage.trim();

  // Guard against leaking internal database, SQL, or stack traces
  if (
    /prisma|sql|database|table|column|select|insert|update|delete|pg_catalog|constraint|unique key|duplicate key|stack|at \//i.test(
      trimmed
    )
  ) {
    return "A database error occurred. Please try again or contact support.";
  }

  // Network connection failures
  if (/econnrefused|failed to fetch|network error|timeout/i.test(trimmed)) {
    return "Unable to reach Advance Pay servers. Please check your internet connection.";
  }

  return trimmed;
}
