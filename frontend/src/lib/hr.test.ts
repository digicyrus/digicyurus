import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError, createApiClient } from "./api";
import { apiFailure } from "./crm";
import { attendanceBody, createHrApi, employeeBody, wholeRupees } from "./hr";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("hr requests use the session cookie and employee records stay separate from users", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createHrApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            const body = init?.body ? JSON.parse(String(init.body)) as { email?: string; date?: string } : null;
            if (body?.email === "dup@example.com") {
                return jsonResponse({ data: null, error: { code: "CONFLICT", message: "This email is already in use", fields: { email: "Already in use" } } }, 409);
            }
            if (init?.method === "POST" && url.endsWith("/api/attendance")) {
                return jsonResponse({ data: null, error: { code: "CONFLICT", message: "Attendance for this employee and date already exists", fields: { date: "Already recorded" } } }, 409);
            }
            return jsonResponse({ data: { id: "row-1", items: [] }, error: null });
        },
    }));

    await client.employees.list({ page: 1, search: "Meera", department: "Design" });
    assert.equal(calls[0]?.url, "http://localhost:4000/api/employees?page=1&search=Meera&department=Design");
    assert.equal(calls[0]?.init?.credentials, "include");

    const created = employeeBody({
        code: "E-1",
        name: "Meera Nair",
        jobTitle: "Designer",
        department: "Design",
        email: "",
        salary: "45000",
    }, "create");
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.body.salary, 45000);
    assert.equal("email" in created.body, false);
    assert.equal("userId" in created.body, false);
    assert.equal("organizationId" in created.body, false);

    const cleared = employeeBody({
        code: "E-1",
        name: "Meera Nair",
        jobTitle: "Designer",
        department: "Design",
        email: "",
        salary: "",
    }, "update");
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.body.email, null);
    assert.equal("salary" in cleared.body, false);

    const duplicate = employeeBody({
        code: "E-2",
        name: "Ada",
        jobTitle: "Engineer",
        department: "Delivery",
        email: "dup@example.com",
        salary: "10.5",
    }, "create");
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.fields.salary, "Enter a whole number of rupees");

    const validDuplicate = employeeBody({
        code: "E-2",
        name: "Ada",
        jobTitle: "Engineer",
        department: "Delivery",
        email: "dup@example.com",
        salary: "60000",
    }, "create");
    assert.equal(validDuplicate.ok, true);
    if (!validDuplicate.ok) return;
    await assert.rejects(() => client.employees.create(validDuplicate.body), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(apiFailure(error).fields.email, "Already in use");
        return true;
    });

    await client.attendance.list({ employeeId: "11111111-1111-4111-8111-111111111111", from: "2026-07-01", to: "2026-07-31" });
    assert.equal(calls[2]?.url, "http://localhost:4000/api/attendance?employeeId=11111111-1111-4111-8111-111111111111&from=2026-07-01&to=2026-07-31");
    assert.equal(calls[2]?.init?.credentials, "include");

    const attendance = attendanceBody({ employeeId: "11111111-1111-4111-8111-111111111111", date: "2026-07-01", note: "" });
    assert.equal(attendance.ok, true);
    if (!attendance.ok) return;
    assert.equal(attendance.body.note, null);
    assert.equal("status" in attendance.body, false);
    await assert.rejects(() => client.attendance.create(attendance.body), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(apiFailure(error).fields.date, "Already recorded");
        return true;
    });
    assert.equal(wholeRupees("10.50"), null);
});
