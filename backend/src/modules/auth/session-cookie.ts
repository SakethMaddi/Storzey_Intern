export const SESSION_COOKIE_NAME = "token";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionCookieOptions {
  path: "/";
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
}

export interface ClearSessionCookieOptions {
  path: "/";
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
}

export function sessionCookieOptions(isProduction: boolean): SessionCookieOptions {
  return {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function clearSessionCookieOptions(
  isProduction: boolean
): ClearSessionCookieOptions {
  return {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
  };
}

interface CookieReply {
  setCookie(name: string, value: string, options: SessionCookieOptions): void;
  clearCookie(name: string, options: ClearSessionCookieOptions): void;
}

export function setSessionCookie(
  reply: CookieReply,
  token: string,
  isProduction: boolean
): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(isProduction));
}

export function clearSessionCookie(reply: CookieReply, isProduction: boolean): void {
  reply.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions(isProduction));
}
