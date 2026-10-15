import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { hashSessionToken } from "../src/modules/auth/sessions.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { withHttp } from "./http.js";

const PASSWORD = "correct-password";

function authApp(options: { secureCookies?: boolean; limiter?: ReturnType<typeof createLoginRateLimiter> } = {}) {
  const store = createMemoryAuthStore();
  const verifier = createFakeVerifier();
  store.users.push(authUser());
  const app = createApp({
    auth: {
      store,
      verifier,
      secureCookies: options.secureCookies ?? false,
      rateLimiter: options.limiter ?? createLoginRateLimiter(),
    },
  });
  return { app, store, verifier };
}

async function login(baseUrl: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("login sets an httpOnly session cookie and hides the token", async () => {
  const { app, store } = authApp();
  await withHttp(app, async (baseUrl) => {
    const response = await login(baseUrl, { email: "Ada@digicyrus.example", password: PASSWORD, role: "Client" });
    const body: unknown = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      data: { id: "user-1", name: "Ada Admin", email: "ada@digicyrus.example", role: "Super Admin" },
      error: null,
    });
    assert.equal(JSON.stringify(body).includes(PASSWORD), false);
    assert.equal(setCookie.includes("dc_session="), true);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\//i);
    assert.match(setCookie, /Max-Age=43200/i);
    assert.equal(/Secure/i.test(setCookie), false);
    const token = setCookie.split(";", 1)[0]?.replace("dc_session=", "") ?? "";
    assert.equal(JSON.stringify(body).includes(token), false);
    assert.equal(store.sessions[0]?.tokenHash, hashSessionToken(token));
    assert.notEqual(store.sessions[0]?.tokenHash, token);
  });
});

test("production cookies are marked Secure", async () => {
  const { app } = authApp({ secureCookies: true });
  await withHttp(app, async (baseUrl) => {
    const response = await login(baseUrl, { email: "ada@digicyrus.example", password: PASSWORD });
    assert.match(response.headers.get("set-cookie") ?? "", /Secure/i);
  });
});

test("unknown email, wrong password, and disabled accounts share one response", async () => {
  const { app, store, verifier } = authApp();
  store.users.push(authUser({ id: "disabled", email: "off@digicyrus.example", status: "disabled" }));
  await withHttp(app, async (baseUrl) => {
    const unknown = await login(baseUrl, { email: "missing@digicyrus.example", password: PASSWORD });
    const wrong = await login(baseUrl, { email: "ada@digicyrus.example", password: "wrong-password" });
    const disabled = await login(baseUrl, { email: "off@digicyrus.example", password: PASSWORD });
    const unknownBody = await unknown.json();
    const wrongBody = await wrong.json();
    const disabledBody = await disabled.json();
    assert.equal(unknown.status, 401);
    assert.deepEqual(unknownBody, wrongBody);
    assert.deepEqual(disabledBody, wrongBody);
    assert.equal(wrongBody.error.code, "INVALID_CREDENTIALS");
    assert.equal(verifier.calls[0]?.hash, "fake:dummy");
    assert.equal(verifier.calls[1]?.hash, "fake:correct-password");
    assert.equal(verifier.calls[2]?.hash, "fake:correct-password");
    assert.equal(store.sessions.length, 0);
  });
});

test("short passwords are rejected without verification or echoing the password", async () => {
  const { app, verifier } = authApp();
  await withHttp(app, async (baseUrl) => {
    const response = await login(baseUrl, { email: "ada@digicyrus.example", password: "short" });
    const text = await response.text();
    assert.equal(response.status, 400);
    assert.equal(text.includes("short"), false);
    assert.equal(JSON.parse(text).error.code, "VALIDATION_ERROR");
    assert.equal(verifier.calls.length, 0);
  });
});

test("me returns the signed-in user and logout revokes the session", async () => {
  const { app, store } = authApp();
  await withHttp(app, async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(missing.status, 401);
    assert.equal((await missing.json()).error.code, "AUTHENTICATION_REQUIRED");

    const signedIn = await login(baseUrl, { email: "ada@digicyrus.example", password: PASSWORD });
    const cookie = (signedIn.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";
    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    const meBody = await me.json();
    assert.equal(me.status, 200);
    assert.deepEqual(meBody.data.permissions, ["dashboard:view"]);
    assert.equal(JSON.stringify(meBody).includes("password"), false);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { cookie } });
    const cleared = logout.headers.get("set-cookie") ?? "";
    assert.equal(logout.status, 200);
    assert.match(cleared, /Max-Age=0/i);
    assert.equal(store.sessions[0]?.revokedAt instanceof Date, true);
    const after = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    assert.equal(after.status, 401);
  });
});

test("logout succeeds when no session cookie is present", async () => {
  const { app } = authApp();
  await withHttp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { status: "logged_out" }, error: null });
  });
});

test("expired sessions are rejected", async () => {
  const { app, store } = authApp();
  store.sessions.push({
    userId: "user-1",
    tokenHash: hashSessionToken("expired-token"),
    expiresAt: new Date(Date.now() - 1000),
    revokedAt: null,
  });
  await withHttp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: "dc_session=expired-token" } });
    assert.equal(response.status, 401);
  });
});

test("login is limited to 10 attempts per email and 30 per IP", async () => {
  const limiter = createLoginRateLimiter();
  const { app, verifier } = authApp({ limiter });
  await withHttp(app, async (baseUrl) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await login(baseUrl, { email: "ada@digicyrus.example", password: "wrong-password" });
      assert.equal(response.status, 401);
    }
    const blocked = await login(baseUrl, { email: "ada@digicyrus.example", password: "wrong-password" });
    const blockedBody = await blocked.json();
    assert.equal(blocked.status, 429);
    assert.equal(blockedBody.error.code, "RATE_LIMITED");
    assert.equal(blockedBody.error.message, "Too many attempts");
    assert.equal(verifier.calls.length, 10);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await login(baseUrl, { email: `person-${attempt}@digicyrus.example`, password: PASSWORD });
      assert.equal(response.status, 401);
    }
    const ipBlocked = await login(baseUrl, { email: "last@digicyrus.example", password: PASSWORD });
    assert.equal(ipBlocked.status, 429);
  });
});
