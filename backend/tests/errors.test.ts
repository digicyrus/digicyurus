import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import express from "express";
import pino from "pino";
import { z, ZodError } from "zod";

import { AppError } from "../src/lib/errors.js";
import { loggerRedact } from "../src/lib/logger.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { validateBody, validateQuery } from "../src/middleware/validate.js";
import { withHttp } from "./http.js";

function probeApp() {
  const app = express();
  app.use(express.json());
  let bodyReached = false;
  let queryReached = false;

  app.post(
    "/body",
    validateBody(z.object({ name: z.string().min(1) })),
    (req, res) => {
      bodyReached = true;
      res.status(200).json({ data: req.body, error: null });
    },
  );

  app.get(
    "/query",
    validateQuery(z.object({ q: z.string().min(1) })),
    (req, res) => {
      queryReached = true;
      res.status(200).json({ data: { q: req.query.q }, error: null });
    },
  );

  app.get("/app-error", () => {
    throw new AppError(409, "CONFLICT", "Already exists", { email: "Already used" });
  });

  app.get("/zod-throw", () => {
    throw new ZodError([
      {
        code: "custom",
        path: ["email"],
        message: "Invalid email",
      },
    ]);
  });

  app.get("/boom", () => {
    throw new Error("postgres://user:secret-password@db/internal password=hunter2");
  });

  app.use(errorHandler);
  return {
    app,
    bodyReached: () => bodyReached,
    queryReached: () => queryReached,
  };
}

test("AppError returns its status and JSON body", async () => {
  const { app } = probeApp();
  await withHttp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/app-error`);
    const body: unknown = await response.json();
    assert.equal(response.status, 409);
    assert.deepEqual(body, {
      data: null,
      error: {
        code: "CONFLICT",
        message: "Already exists",
        fields: { email: "Already used" },
      },
    });
  });
});

test("Zod errors return field validation details", async () => {
  const { app } = probeApp();
  await withHttp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/zod-throw`);
    const body: unknown = await response.json();
    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fields: { email: "Invalid email" },
      },
    });
  });
});

test("invalid body does not reach the route handler", async () => {
  const probe = probeApp();
  await withHttp(probe.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/body`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const body: unknown = await response.json();
    assert.equal(response.status, 400);
    assert.equal(probe.bodyReached(), false);
    const error = (body as { error: { code: string; fields: Record<string, string> } }).error;
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.equal(typeof error.fields.name, "string");
  });
});

test("valid body reaches the route handler", async () => {
  const probe = probeApp();
  await withHttp(probe.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/body`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "DigiCyrus" }),
    });
    const body: unknown = await response.json();
    assert.equal(response.status, 200);
    assert.equal(probe.bodyReached(), true);
    assert.deepEqual(body, { data: { name: "DigiCyrus" }, error: null });
  });
});

test("invalid query does not reach the route handler", async () => {
  const probe = probeApp();
  await withHttp(probe.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/query`);
    assert.equal(response.status, 400);
    assert.equal(probe.queryReached(), false);
  });
});

test("logger redacts passwords, authorization, and cookies", () => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  const log = pino({ level: "info", redact: loggerRedact }, stream);
  log.info(
    {
      password: "hunter2",
      password_hash: "argon-secret-hash",
      token: "session-token-value",
      ADMIN_PASSWORD: "admin-secret-value",
      "set-cookie": "dc_session=cookie-secret",
      DATABASE_URL: "postgresql://user:secret-password@localhost/digicyrus",
      req: { headers: { authorization: "Bearer abc", cookie: "dc_session=xyz" } },
    },
    "check",
  );
  assert.equal(output.includes("hunter2"), false);
  assert.equal(output.includes("secret-password"), false);
  assert.equal(output.includes("Bearer abc"), false);
  assert.equal(output.includes("dc_session=xyz"), false);
  assert.equal(output.includes("argon-secret-hash"), false);
  assert.equal(output.includes("session-token-value"), false);
  assert.equal(output.includes("admin-secret-value"), false);
  assert.equal(output.includes("cookie-secret"), false);
  assert.equal(output.includes("[Redacted]"), true);
});

test("unknown errors hide internal details", async () => {
  const { app } = probeApp();
  await withHttp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/boom`);
    const text = await response.text();
    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(text), {
      data: null,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong", fields: {} },
    });
    assert.equal(text.includes("secret-password"), false);
    assert.equal(text.includes("hunter2"), false);
    assert.equal(text.includes("postgres://"), false);
    assert.equal(text.includes("stack"), false);
  });
});
