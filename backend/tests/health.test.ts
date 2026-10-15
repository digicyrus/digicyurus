import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { withHttp } from "./http.js";

test("importing the app does not start a listener", () => {
  const app = createApp();
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});

test("GET /api/health returns ok without calling the database", async () => {
  let databaseCalls = 0;
  const app = createApp({
    checkDatabase: async () => {
      databaseCalls += 1;
    },
  });

  await withHttp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body: unknown = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: { status: "ok" }, error: null });
  });

  assert.equal(databaseCalls, 0);
});

test("GET /api/ready returns 503 without leaking database details", async () => {
  const secret = "postgresql://user:secret-password@db.internal:5432/digicyrus";
  const app = createApp({
    checkDatabase: async () => {
      throw new Error(`connect ECONNREFUSED ${secret}`);
    },
  });

  await withHttp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ready`);
    const text = await response.text();
    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(text), {
      data: null,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database is unavailable",
        fields: {},
      },
    });
    assert.equal(text.includes(secret), false);
    assert.equal(text.includes("secret-password"), false);
  });
});

test("unknown routes use the error envelope", async () => {
  const app = createApp();
  await withHttp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/missing`);
    const body: unknown = await response.json();
    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      data: null,
      error: { code: "NOT_FOUND", message: "Route not found", fields: {} },
    });
  });
});
