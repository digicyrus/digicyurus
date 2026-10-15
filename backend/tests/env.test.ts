import assert from "node:assert/strict";
import test from "node:test";

import { loadEnv } from "../src/config/env.js";
import { ConfigError } from "../src/lib/errors.js";

test("missing DATABASE_URL fails environment validation", () => {
  assert.throws(
    () => loadEnv({}),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /DATABASE_URL/);
      assert.equal(error.message.includes("postgres://"), false);
      return true;
    },
  );
});

test("invalid DATABASE_URL does not echo the supplied value", () => {
  const secret = "super-secret-not-a-database-url";
  assert.throws(
    () => loadEnv({ DATABASE_URL: secret }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});

test("valid configuration applies defaults", () => {
  const env = loadEnv({ DATABASE_URL: "postgresql://localhost:5432/digicyrus" });
  assert.equal(env.PORT, 4000);
  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.CORS_ORIGIN, "http://localhost:5173");
});
