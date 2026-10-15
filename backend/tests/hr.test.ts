import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryAttendanceStore, createMemoryEmployeeStore } from "./memory-hr.js";
import { withHttp } from "./http.js";

const MISSING_ID = "22222222-2222-4222-8222-222222222222";

function hrApp(permissions: string[], organizationId = "org-1") {
  const auth = createMemoryAuthStore();
  auth.users.push(authUser({
    email: "ada@digicyrus.example",
    organizationId,
    permissions,
    passwordHash: "fake:correct-password",
  }));
  auth.users.push(authUser({
    id: "user-2",
    email: "bob@digicyrus.example",
    organizationId: "org-2",
    permissions,
    passwordHash: "fake:correct-password",
  }));
  const employees = createMemoryEmployeeStore();
  const attendance = createMemoryAttendanceStore();
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    hr: { employees, attendance },
  });
  return { app, auth, employees, attendance };
}

async function signIn(baseUrl: string, email = "ada@digicyrus.example"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct-password" }),
  });
  assert.equal(response.status, 200);
  return (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";
}

function employeeBody(overrides: Record<string, unknown> = {}) {
  return {
    code: "EMP-11",
    name: "Sana Ali",
    jobTitle: "Project Manager",
    department: "Delivery",
    email: "sana@digicyrus.example",
    salary: 95000,
    ...overrides,
  };
}

test("employees stay separate from users and honor uniqueness, filters, and permissions", async () => {
  const state = hrApp([...permissionsForRole("admin")]);
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/employees`)).status, 401);

    const invalid = await fetch(`${baseUrl}/api/employees`, {
      method: "POST",
      headers,
      body: JSON.stringify(employeeBody({ salary: -1, email: "not-an-email" })),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.employees.records.length, 0);
    assert.equal(state.auth.users.length, 2);

    const created = await fetch(`${baseUrl}/api/employees`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...employeeBody(), organizationId: "org-2", userId: "user-2", attendance: 96, leaves: 2 }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.code, "EMP-11");
    assert.equal(createdBody.data.salary, 95000);
    assert.equal(createdBody.data.jobTitle, "Project Manager");
    assert.equal(createdBody.data.attendance, undefined);
    assert.equal(state.employees.records[0]?.organizationId, "org-1");
    assert.equal(state.auth.users.length, 2);
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const duplicateCode = await fetch(`${baseUrl}/api/employees`, {
      method: "POST",
      headers,
      body: JSON.stringify(employeeBody({ email: "other@digicyrus.example" })),
    });
    assert.equal(duplicateCode.status, 409);
    const duplicateEmail = await fetch(`${baseUrl}/api/employees`, {
      method: "POST",
      headers,
      body: JSON.stringify(employeeBody({ code: "EMP-19", email: "Sana@Digicyrus.example" })),
    });
    assert.equal(duplicateEmail.status, 409);

    await fetch(`${baseUrl}/api/employees`, {
      method: "POST",
      headers,
      body: JSON.stringify(employeeBody({ code: "EMP-13", name: "Manav Kohli", jobTitle: "Developer", department: "Engineering", email: "manav@digicyrus.example", salary: 78000 })),
    });

    const search = await fetch(`${baseUrl}/api/employees?search=sana&department=Delivery&sort=name&page=1&pageSize=1`, { headers });
    const searchBody = await search.json();
    assert.equal(search.status, 200);
    assert.equal(searchBody.data.total, 1);
    assert.equal(searchBody.data.items[0].name, "Sana Ali");

    const page = await fetch(`${baseUrl}/api/employees?sort=code&page=2&pageSize=1`, { headers });
    assert.equal((await page.json()).data.items.length, 1);

    const missing = await fetch(`${baseUrl}/api/employees/${MISSING_ID}`, { headers });
    assert.equal(missing.status, 404);
    const otherOrg = await signIn(baseUrl, "bob@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/employees/${createdBody.data.id}`, { headers: { cookie: otherOrg } });
    assert.equal(hidden.status, 404);

    const updated = await fetch(`${baseUrl}/api/employees/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ salary: 98000, department: "Delivery" }),
    });
    assert.equal((await updated.json()).data.salary, 98000);
  });

  const hr = hrApp([...permissionsForRole("hr")]);
  await withHttp(hr.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/employees`, { headers: { cookie } });
    assert.equal(listed.status, 200);
    const created = await fetch(`${baseUrl}/api/employees`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(employeeBody()),
    });
    assert.equal(created.status, 403);
  });

  const sales = hrApp([...permissionsForRole("sales_executive")]);
  await withHttp(sales.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/employees`, { headers: { cookie } });
    assert.equal(listed.status, 403);
  });
});

test("attendance is unique per employee and date and stays inside the organization", async () => {
  const state = hrApp([...permissionsForRole("hr")]);
  const employee = await state.employees.insert({
    organizationId: "org-1",
    code: "EMP-13",
    name: "Manav Kohli",
    jobTitle: "Developer",
    department: "Engineering",
    email: "manav@digicyrus.example",
    salaryRupees: 78000,
  });
  const foreign = await state.employees.insert({
    organizationId: "org-2",
    code: "EMP-99",
    name: "Foreign",
    jobTitle: "Developer",
    department: "Engineering",
    email: null,
    salaryRupees: 1,
  });
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/attendance?from=2026-07-01&to=2026-07-31`)).status, 401);

    const invalid = await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers,
      body: JSON.stringify({ employeeId: employee.id, date: "14 Jul", shift: "Morning" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.attendance.records.length, 0);

    const unknown = await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers,
      body: JSON.stringify({ employeeId: foreign.id, date: "2026-07-14" }),
    });
    assert.equal(unknown.status, 404);

    const created = await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers,
      body: JSON.stringify({ employeeId: employee.id, date: "2026-07-14", note: "On site", organizationId: "org-2" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.date, "2026-07-14");
    assert.equal(createdBody.data.employeeId, employee.id);
    assert.equal(state.attendance.records[0]?.organizationId, "org-1");
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const duplicate = await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers,
      body: JSON.stringify({ employeeId: employee.id, date: "2026-07-14" }),
    });
    assert.equal(duplicate.status, 409);

    await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers,
      body: JSON.stringify({ employeeId: employee.id, date: "2026-08-02" }),
    });
    const listed = await fetch(`${baseUrl}/api/attendance?employeeId=${employee.id}&from=2026-07-01&to=2026-07-31&page=1&pageSize=10`, { headers });
    const listedBody = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedBody.data.total, 1);
    assert.equal(listedBody.data.items[0].id, createdBody.data.id);

    const reversed = await fetch(`${baseUrl}/api/attendance?from=2026-08-01&to=2026-07-01`, { headers });
    assert.equal(reversed.status, 400);

    const otherOrg = await signIn(baseUrl, "bob@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/attendance/${createdBody.data.id}`, { headers: { cookie: otherOrg } });
    assert.equal(hidden.status, 404);
    const missing = await fetch(`${baseUrl}/api/attendance/${MISSING_ID}`, { headers });
    assert.equal(missing.status, 404);

    const updated = await fetch(`${baseUrl}/api/attendance/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ note: "Client visit" }),
    });
    assert.equal((await updated.json()).data.note, "Client visit");
    const clash = await fetch(`${baseUrl}/api/attendance/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ date: "2026-08-02" }),
    });
    assert.equal(clash.status, 409);
  });

  const sales = hrApp([...permissionsForRole("sales_executive")]);
  await withHttp(sales.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/attendance`, { headers: { cookie } });
    assert.equal(listed.status, 403);
  });
});

test("hr migration extends employees, records attendance, and does not invent payroll", () => {
  const sql = readFileSync(new URL("../drizzle/0005_hr.sql", import.meta.url), "utf8");
  assert.equal(/insert\s+into/i.test(sql), false);
  assert.equal(sql.includes("attendance_employee_date_unique"), true);
  assert.equal(sql.includes("employees_org_code_unique"), true);
  assert.equal(/create table "payroll"/i.test(sql), false);
  assert.equal(sql.includes("overtime"), false);
});
