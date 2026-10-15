import assert from "node:assert/strict";
import test from "node:test";

import { dummyPasswordHash, hashPassword, verifyPassword } from "../src/modules/auth/passwords.js";

test("argon2id hashes and verifies passwords", async () => {
  const hashed = await hashPassword("correct horse");
  assert.equal(hashed.startsWith("$argon2id$"), true);
  assert.equal(await verifyPassword(hashed, "correct horse"), true);
  assert.equal(await verifyPassword(hashed, "wrong password"), false);
  const dummy = await dummyPasswordHash();
  assert.equal(await dummyPasswordHash(), dummy);
  assert.notEqual(dummy, hashed);
});
