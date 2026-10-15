import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readSeedConfig, runSeed, SeedError, type SeedAdapter, type SeedTransaction } from "../src/db/seed-lib.js";

const PASSWORD = "unique-seed-password";

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: "postgresql://localhost:5432/digicyrus_erp",
    ADMIN_EMAIL: "Admin@DigiCyrus.example",
    ADMIN_PASSWORD: PASSWORD,
    ...overrides,
  };
}

function adapter(options: {
  current?: string;
  tables?: string[];
  hashes?: string[];
  users?: number;
  organizationId?: string | null;
  roleId?: string | null;
} = {}) {
  const calls = { current: 0, tables: 0, hashes: 0, transaction: 0, lock: 0, insertOrganization: 0, insertUser: 0, hash: 0 };
  let inserted: { organizationId: string; passwordHash: string; email: string; name: string } | undefined;
  const tx: SeedTransaction = {
    async lock() {
      calls.lock += 1;
    },
    async countUsers() {
      return options.users ?? 0;
    },
    async findOrganizationId() {
      return options.organizationId ?? null;
    },
    async insertOrganization() {
      calls.insertOrganization += 1;
      return "org-new";
    },
    async findRoleId() {
      return options.roleId === undefined ? "role-1" : options.roleId;
    },
    async insertUser(input) {
      calls.insertUser += 1;
      inserted = input;
    },
  };
  const seedAdapter: SeedAdapter = {
    async currentDatabase() {
      calls.current += 1;
      return options.current ?? "digicyrus_erp";
    },
    async blockedPublicTables() {
      calls.tables += 1;
      return options.tables ?? [];
    },
    async appliedMigrationHashes() {
      calls.hashes += 1;
      return options.hashes ?? ["hash-1"];
    },
    async transaction(run) {
      calls.transaction += 1;
      return run(tx);
    },
  };
  return { calls, seedAdapter, inserted: () => inserted };
}

function logs() {
  const lines: string[] = [];
  return {
    lines,
    log: {
      info(data: Record<string, unknown>, message: string) {
        lines.push(JSON.stringify({ data, message }));
      },
      error(message: string) {
        lines.push(message);
      },
    },
  };
}

test("seed refuses missing credentials and short passwords before touching the database", async () => {
  const target = adapter();
  await assert.rejects(() => runSeed({
    env: env({ ADMIN_EMAIL: "" }),
    adapter: target.seedAdapter,
    hashPassword: async () => "hash",
    expectedHashes: ["hash-1"],
    log: logs().log,
  }), (error: unknown) => error instanceof SeedError && !error.message.includes(PASSWORD));
  assert.equal(target.calls.current, 0);

  const short = adapter();
  await assert.rejects(() => runSeed({
    env: env({ ADMIN_PASSWORD: "tiny" }),
    adapter: short.seedAdapter,
    hashPassword: async () => "hash",
    expectedHashes: ["hash-1"],
    log: logs().log,
  }), (error: unknown) => error instanceof SeedError && error.message === "ADMIN_PASSWORD must be at least 10 characters" && !error.message.includes("tiny"));
  assert.equal(short.calls.transaction, 0);
});

test("seed refuses the unrelated database, foreign tables, and missing migrations", async () => {
  const named = adapter();
  await assert.rejects(() => runSeed({
    env: env({ DATABASE_URL: "postgresql://localhost:5432/digicyrus" }),
    adapter: named.seedAdapter,
    hashPassword: async () => "hash",
    expectedHashes: ["hash-1"],
    log: logs().log,
  }), SeedError);
  assert.equal(named.calls.current, 0);

  const current = adapter({ current: "digicyrus" });
  await assert.rejects(() => runSeed({
    env: env(),
    adapter: current.seedAdapter,
    hashPassword: async () => "hash",
    expectedHashes: ["hash-1"],
    log: logs().log,
  }), SeedError);
  assert.equal(current.calls.transaction, 0);

  for (const table of ["agents", "workspaces"]) {
    const foreign = adapter({ tables: [table] });
    await assert.rejects(() => runSeed({
      env: env(),
      adapter: foreign.seedAdapter,
      hashPassword: async () => "hash",
      expectedHashes: ["hash-1"],
      log: logs().log,
    }), /unrelated application tables/);
    assert.equal(foreign.calls.transaction, 0);
  }

  const missing = adapter({ hashes: [] });
  await assert.rejects(() => runSeed({
    env: env(),
    adapter: missing.seedAdapter,
    hashPassword: async () => "hash",
    expectedHashes: ["hash-1"],
    log: logs().log,
  }), /required ERP migrations are missing/);
  assert.equal(missing.calls.transaction, 0);
});

test("seed creates one super admin or skips existing users without logging secrets", async () => {
  const created = adapter();
  const createdLog = logs();
  const result = await runSeed({
    env: env(),
    adapter: created.seedAdapter,
    hashPassword: async (password) => {
      created.calls.hash += 1;
      return `hashed:${password}`;
    },
    expectedHashes: ["hash-1"],
    log: createdLog.log,
  });
  assert.equal(result, "created");
  assert.equal(created.calls.lock, 1);
  assert.equal(created.calls.insertOrganization, 1);
  assert.equal(created.calls.hash, 1);
  assert.equal(created.inserted()?.organizationId, "org-new");
  assert.equal(created.inserted()?.email, "admin@digicyrus.example");
  assert.equal(created.inserted()?.name, "Super Admin");
  assert.equal(created.inserted()?.passwordHash, `hashed:${PASSWORD}`);
  const rendered = createdLog.lines.join("\n");
  assert.equal(rendered.includes(PASSWORD), false);
  assert.equal(rendered.includes(`hashed:${PASSWORD}`), false);
  assert.equal(rendered.includes("digicyrus_erp"), true);

  const existingOrg = adapter({ organizationId: "org-existing" });
  await runSeed({
    env: env(),
    adapter: existingOrg.seedAdapter,
    hashPassword: async () => "hashed",
    expectedHashes: ["hash-1"],
    log: logs().log,
  });
  assert.equal(existingOrg.calls.insertOrganization, 0);
  assert.equal(existingOrg.inserted()?.organizationId, "org-existing");

  const skipped = adapter({ users: 2 });
  const skippedResult = await runSeed({
    env: env(),
    adapter: skipped.seedAdapter,
    hashPassword: async () => {
      skipped.calls.hash += 1;
      return "changed-hash";
    },
    expectedHashes: ["hash-1"],
    log: logs().log,
  });
  assert.equal(skippedResult, "skipped");
  assert.equal(skipped.calls.insertUser, 0);
  assert.equal(skipped.calls.hash, 0);
});

test("seed configuration and drizzle config never fall back to the unrelated database", () => {
  assert.throws(() => readSeedConfig({}), SeedError);
  const source = readFileSync(new URL("../drizzle.config.ts", import.meta.url), "utf8");
  assert.equal(source.includes("postgresql://localhost:5432/digicyrus"), false);
  assert.equal(source.includes("DATABASE_URL is required"), true);
  const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  assert.equal(server.includes("seed"), false);
});
