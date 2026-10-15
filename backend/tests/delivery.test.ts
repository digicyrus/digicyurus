import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import type { NewClient } from "../src/modules/crm/clients.store.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryClientStore } from "./memory-crm.js";
import { createMemoryPlannerStore, createMemoryProjectStore, createMemoryTaskStore } from "./memory-delivery.js";
import { withHttp } from "./http.js";

const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_EMPLOYEE_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNEE_USER_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_USER_ID = "55555555-5555-4555-8555-555555555555";
const MISSING_ID = "22222222-2222-4222-8222-222222222222";

function deliveryApp(permissions: string[], organizationId = "org-1") {
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
  auth.users.push(authUser({
    id: "user-3",
    email: "cara@digicyrus.example",
    organizationId,
    permissions,
    passwordHash: "fake:correct-password",
  }));
  const clients = createMemoryClientStore();
  const projects = createMemoryProjectStore();
  const tasks = createMemoryTaskStore();
  const planner = createMemoryPlannerStore();
  projects.employees.push({ id: EMPLOYEE_ID, organizationId }, { id: OTHER_EMPLOYEE_ID, organizationId: "org-2" });
  tasks.employees.push({ id: EMPLOYEE_ID, organizationId }, { id: OTHER_EMPLOYEE_ID, organizationId: "org-2" });
  tasks.users.push({ id: ASSIGNEE_USER_ID, organizationId }, { id: OTHER_USER_ID, organizationId: "org-2" });
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    delivery: { clients, projects, tasks, planner },
  });
  return { app, clients, projects, tasks, planner };
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

function clientInput(organizationId: string, overrides: Partial<NewClient> = {}): NewClient {
  return {
    organizationId,
    code: "C-101",
    name: "Orbit Health",
    contactName: "Rhea Kapoor",
    industry: "Healthcare",
    status: "Active",
    rating: 4,
    customerSince: "2022-04-01",
    email: "rhea@orbit.example",
    phone: null,
    ...overrides,
  };
}

function projectBody(clientId: string, overrides: Record<string, unknown> = {}) {
  return {
    code: "P-330",
    name: "Orbit Patient App",
    description: "Patient booking and records",
    clientId,
    status: "On Track",
    priority: "High",
    startDate: "2026-08-01",
    dueDate: "2026-09-18",
    ...overrides,
  };
}

function taskBody(projectId: string, overrides: Record<string, unknown> = {}) {
  return {
    projectId,
    title: "Appointment booking flow",
    description: "Book a clinic visit",
    status: "In Progress",
    priority: "High",
    dueDate: "2026-08-10",
    assigneeEmployeeId: EMPLOYEE_ID,
    ...overrides,
  };
}

test("projects support create, filters, pagination, conflicts, and organization isolation", async () => {
  const { app, clients, projects } = deliveryApp([...permissionsForRole("project_manager")]);
  const client = await clients.insert(clientInput("org-1"));
  const foreignClient = await clients.insert(clientInput("org-2", { code: "C-202", email: "foreign@example" }));
  await withHttp(app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const anonymous = await fetch(`${baseUrl}/api/projects`);
    assert.equal(anonymous.status, 401);

    const invalid = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(projectBody(client.id, { dueDate: "2026-07-01", status: "Archived" })),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
    assert.equal(projects.records.length, 0);

    const unknownClient = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(projectBody(foreignClient.id)),
    });
    assert.equal(unknownClient.status, 404);
    const unknownEmployee = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(projectBody(client.id, { managerEmployeeId: OTHER_EMPLOYEE_ID })),
    });
    assert.equal(unknownEmployee.status, 404);

    const created = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...projectBody(client.id, { managerEmployeeId: EMPLOYEE_ID }), organizationId: "org-2", id: "client-supplied" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.code, "P-330");
    assert.equal(createdBody.data.clientId, client.id);
    assert.equal(createdBody.data.managerEmployeeId, EMPLOYEE_ID);
    assert.notEqual(createdBody.data.id, "client-supplied");
    assert.equal(projects.records[0]?.organizationId, "org-1");
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const duplicate = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(projectBody(client.id, { name: "Second" })),
    });
    assert.equal(duplicate.status, 409);

    await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(projectBody(client.id, { code: "P-331", name: "Vertex Tracking Portal", description: "Fleet map", status: "Delayed", priority: "Low", dueDate: "2026-08-12" })),
    });

    const search = await fetch(`${baseUrl}/api/projects?search=orbit&status=On%20Track&priority=High&clientId=${client.id}&sort=dueDate&direction=desc&page=1&pageSize=1`, { headers });
    const searchBody = await search.json();
    assert.equal(search.status, 200);
    assert.equal(searchBody.data.total, 1);
    assert.equal(searchBody.data.items[0].name, "Orbit Patient App");

    const page = await fetch(`${baseUrl}/api/projects?sort=name&page=2&pageSize=1`, { headers });
    const pageBody = await page.json();
    assert.equal(pageBody.data.total, 2);
    assert.equal(pageBody.data.items.length, 1);

    const missing = await fetch(`${baseUrl}/api/projects/${MISSING_ID}`, { headers });
    assert.equal(missing.status, 404);
    const otherOrg = await signIn(baseUrl, "bob@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/projects/${createdBody.data.id}`, { headers: { cookie: otherOrg } });
    assert.equal(hidden.status, 404);

    const updated = await fetch(`${baseUrl}/api/projects/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "At Risk", startDate: "2026-10-01" }),
    });
    assert.equal(updated.status, 400);
    const kept = await fetch(`${baseUrl}/api/projects/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "At Risk" }),
    });
    assert.equal(kept.status, 200);
    assert.equal((await kept.json()).data.status, "At Risk");
  });
});

test("developers can view projects but cannot create them", async () => {
  const { app } = deliveryApp([...permissionsForRole("developer")]);
  await withHttp(app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/projects`, { headers: { cookie } });
    assert.equal(listed.status, 200);
    const created = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(projectBody(MISSING_ID)),
    });
    assert.equal(created.status, 403);
  });
});

test("sales cannot read projects", async () => {
  const { app } = deliveryApp([...permissionsForRole("sales_executive")]);
  await withHttp(app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/projects`, { headers: { cookie } });
    assert.equal(listed.status, 403);
  });
});

test("tasks validate relationships, filters, and developer update limits", async () => {
  const manager = deliveryApp([...permissionsForRole("project_manager")]);
  const client = await manager.clients.insert(clientInput("org-1"));
  const project = await manager.projects.insert({
    organizationId: "org-1",
    clientId: client.id,
    managerEmployeeId: EMPLOYEE_ID,
    code: "P-330",
    name: "Orbit Patient App",
    description: "",
    status: "On Track",
    priority: "High",
    startDate: "2026-08-01",
    dueDate: "2026-09-18",
  });
  const foreignProject = await manager.projects.insert({
    organizationId: "org-2",
    clientId: client.id,
    managerEmployeeId: null,
    code: "P-999",
    name: "Foreign",
    description: "",
    status: "On Track",
    priority: "Low",
    startDate: "2026-08-01",
    dueDate: "2026-09-01",
  });

  await withHttp(manager.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const anonymous = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(anonymous.status, 401);

    const invalid = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(taskBody(project.id, { title: "", dueDate: "10 Aug" })),
    });
    assert.equal(invalid.status, 400);
    assert.equal(manager.tasks.records.length, 0);

    const missingProject = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(taskBody(foreignProject.id)),
    });
    assert.equal(missingProject.status, 404);
    const missingEmployee = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(taskBody(project.id, { assigneeEmployeeId: OTHER_EMPLOYEE_ID })),
    });
    assert.equal(missingEmployee.status, 404);
    const missingUser = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(taskBody(project.id, { assigneeUserId: OTHER_USER_ID })),
    });
    assert.equal(missingUser.status, 404);

    const created = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...taskBody(project.id, { assigneeUserId: ASSIGNEE_USER_ID }), organizationId: "org-2" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.status, "In Progress");
    assert.equal(createdBody.data.assigneeEmployeeId, EMPLOYEE_ID);
    assert.equal(createdBody.data.assigneeUserId, ASSIGNEE_USER_ID);
    assert.equal(manager.tasks.records[0]?.organizationId, "org-1");
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(taskBody(project.id, { title: "SEO audit report", description: "Cobalt notes", status: "Backlog", priority: "Low", dueDate: "2026-08-20", assigneeEmployeeId: null })),
    });
    await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(taskBody(project.id, { title: "Undated cleanup", dueDate: null, status: "Done", priority: "Low" })),
    });

    const filtered = await fetch(`${baseUrl}/api/tasks?search=booking&projectId=${project.id}&assigneeEmployeeId=${EMPLOYEE_ID}&status=In%20Progress&priority=High&dueFrom=2026-08-01&dueTo=2026-08-12&page=1&pageSize=10`, { headers });
    const filteredBody = await filtered.json();
    assert.equal(filtered.status, 200);
    assert.equal(filteredBody.data.total, 1);
    assert.equal(filteredBody.data.items[0].title, "Appointment booking flow");

    const outside = await fetch(`${baseUrl}/api/tasks?dueFrom=2026-08-15&dueTo=2026-08-20`, { headers });
    const outsideBody = await outside.json();
    assert.equal(outsideBody.data.total, 1);
    assert.equal(outsideBody.data.items[0].title, "SEO audit report");

    const reversed = await fetch(`${baseUrl}/api/tasks?dueFrom=2026-09-01&dueTo=2026-08-01`, { headers });
    assert.equal(reversed.status, 400);

    const page = await fetch(`${baseUrl}/api/tasks?sort=title&page=2&pageSize=1`, { headers });
    assert.equal((await page.json()).data.items.length, 1);

    const missing = await fetch(`${baseUrl}/api/tasks/${MISSING_ID}`, { headers });
    assert.equal(missing.status, 404);
    const otherOrg = await signIn(baseUrl, "bob@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/tasks/${createdBody.data.id}`, { headers: { cookie: otherOrg } });
    assert.equal(hidden.status, 404);

    const updated = await fetch(`${baseUrl}/api/tasks/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "Review", priority: "Medium" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).data.status, "Review");
  });

  const developer = deliveryApp([...permissionsForRole("developer")]);
  const devClient = await developer.clients.insert(clientInput("org-1"));
  const devProject = await developer.projects.insert({
    organizationId: "org-1",
    clientId: devClient.id,
    managerEmployeeId: null,
    code: "P-330",
    name: "Orbit Patient App",
    description: "",
    status: "On Track",
    priority: "High",
    startDate: "2026-08-01",
    dueDate: "2026-09-18",
  });
  await withHttp(developer.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const listed = await fetch(`${baseUrl}/api/tasks`, { headers });
    assert.equal(listed.status, 200);
    const created = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(taskBody(devProject.id)),
    });
    assert.equal(created.status, 403);
    const task = await developer.tasks.insert({
      organizationId: "org-1",
      projectId: devProject.id,
      assigneeEmployeeId: EMPLOYEE_ID,
      assigneeUserId: null,
      title: "Checkout redesign",
      description: "",
      status: "Backlog",
      priority: "Medium",
      dueDate: "2026-08-08",
    });
    const moved = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "Done" }),
    });
    assert.equal(moved.status, 200);
    assert.equal((await moved.json()).data.status, "Done");
  });
});

test("planner entries stay personal, honor a date range, and cannot be deleted", async () => {
  const { app, planner } = deliveryApp([...permissionsForRole("developer")]);
  await withHttp(app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const anonymous = await fetch(`${baseUrl}/api/planner?from=2026-08-01&to=2026-08-31`);
    assert.equal(anonymous.status, 401);

    const missingRange = await fetch(`${baseUrl}/api/planner`, { headers });
    assert.equal(missingRange.status, 400);
    const reversed = await fetch(`${baseUrl}/api/planner?from=2026-08-31&to=2026-08-01`, { headers });
    assert.equal(reversed.status, 400);
    const badTime = await fetch(`${baseUrl}/api/planner`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Standup", entryDate: "2026-08-10", time: "25:00" }),
    });
    assert.equal(badTime.status, 400);
    assert.equal(planner.records.length, 0);

    const created = await fetch(`${baseUrl}/api/planner`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Sprint planning", entryDate: "2026-08-10", time: "16:30", tag: "Projects", done: false, userId: "user-3", organizationId: "org-2" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.entryDate, "2026-08-10");
    assert.equal(createdBody.data.time, "16:30");
    assert.equal(planner.records[0]?.userId, "user-1");
    assert.equal(planner.records[0]?.organizationId, "org-1");
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    await fetch(`${baseUrl}/api/planner`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Before", entryDate: "2026-07-31", time: "09:00" }),
    });
    await fetch(`${baseUrl}/api/planner`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Last day", entryDate: "2026-08-31" }),
    });

    const listed = await fetch(`${baseUrl}/api/planner?from=2026-08-01&to=2026-08-31`, { headers });
    const listedBody = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedBody.data.from, "2026-08-01");
    assert.equal(listedBody.data.to, "2026-08-31");
    assert.deepEqual(listedBody.data.items.map((item: { title: string }) => item.title), ["Sprint planning", "Last day"]);

    const colleague = await signIn(baseUrl, "cara@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/planner?from=2026-07-01&to=2026-09-01`, { headers: { cookie: colleague } });
    assert.equal((await hidden.json()).data.items.length, 0);
    const stolen = await fetch(`${baseUrl}/api/planner/${createdBody.data.id}`, {
      method: "PATCH",
      headers: { cookie: colleague, "content-type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    assert.equal(stolen.status, 404);

    const otherOrg = await signIn(baseUrl, "bob@digicyrus.example");
    const foreign = await fetch(`${baseUrl}/api/planner/${createdBody.data.id}`, {
      method: "PATCH",
      headers: { cookie: otherOrg, "content-type": "application/json" },
      body: JSON.stringify({ title: "Taken" }),
    });
    assert.equal(foreign.status, 404);

    const updated = await fetch(`${baseUrl}/api/planner/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ done: true }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).data.done, true);

    const removed = await fetch(`${baseUrl}/api/planner/${createdBody.data.id}`, { method: "DELETE", headers });
    assert.equal(removed.status, 404);
    assert.equal(planner.records.length, 3);
  });

  const admin = deliveryApp([...permissionsForRole("admin")]);
  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/planner?from=2026-08-01&to=2026-08-31`, { headers: { cookie } });
    assert.equal(listed.status, 403);
    const created = await fetch(`${baseUrl}/api/planner`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Admin note", entryDate: "2026-08-10" }),
    });
    assert.equal(created.status, 403);
  });

  const viewer = deliveryApp(["planner:view"]);
  await withHttp(viewer.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const created = await fetch(`${baseUrl}/api/planner`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Read only", entryDate: "2026-08-10" }),
    });
    assert.equal(created.status, 403);
  });
});

test("delivery migration declares the approved statuses and inserts no rows", () => {
  const sql = readFileSync(new URL("../drizzle/0003_delivery.sql", import.meta.url), "utf8");
  assert.equal(/insert\s+into/i.test(sql), false);
  assert.equal(sql.includes("'On Track', 'At Risk', 'Delayed', 'Completed'"), true);
  assert.equal(sql.includes("'Backlog', 'In Progress', 'Review', 'Done'"), true);
  assert.equal(sql.includes("'High', 'Medium', 'Low'"), true);
  assert.equal(sql.includes("planner:delete"), false);
  assert.equal(sql.includes("DELETE FROM"), false);
});
