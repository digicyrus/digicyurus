import { parseCookie, stringifySetCookie } from "cookie";

export const SESSION_COOKIE = "dc_session";

export function readSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const value = parseCookie(header)[SESSION_COOKIE];
  return value || undefined;
}

export function sessionCookie(token: string, secure: boolean): string {
  return stringifySetCookie({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
    secure,
  });
}

export function clearSessionCookie(secure: boolean): string {
  return stringifySetCookie({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure,
  });
}
