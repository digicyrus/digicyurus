import { api } from "./api";
import { toQuery, type Page } from "./crm";

export type Employee = {
    id: string;
    code: string;
    name: string;
    jobTitle: string;
    department: string;
    email: string | null;
    salary: number | null;
    createdAt: string;
    updatedAt: string;
};

export type Attendance = {
    id: string;
    employeeId: string;
    date: string;
    note: string | null;
    createdAt: string;
    updatedAt: string;
};

export type EmployeeDraft = {
    code: string;
    name: string;
    jobTitle: string;
    department: string;
    email?: string | null;
    salary?: number;
};

export type AttendanceDraft = {
    employeeId: string;
    date: string;
    note: string | null;
};

export type Checked<T> = { ok: true; body: T } | { ok: false; message: string; fields: Record<string, string> };

export function wholeRupees(value: string): number | null {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    const amount = Number(text);
    return Number.isSafeInteger(amount) ? amount : null;
}

export function employeeBody(input: {
    code: string;
    name: string;
    jobTitle: string;
    department: string;
    email: string;
    salary: string;
}, mode: "create" | "update"): Checked<EmployeeDraft> {
    const fields: Record<string, string> = {};
    if (!input.code.trim()) fields.code = "Enter a code";
    if (!input.name.trim()) fields.name = "Enter a name";
    if (!input.jobTitle.trim()) fields.jobTitle = "Enter a job title";
    if (!input.department.trim()) fields.department = "Enter a department";
    const salaryText = input.salary.trim();
    const salary = salaryText ? wholeRupees(salaryText) : null;
    if (mode === "create" && salary === null) fields.salary = "Enter a whole number of rupees";
    if (mode === "update" && salaryText && salary === null) fields.salary = "Enter a whole number of rupees";
    if (Object.keys(fields).length > 0) return { ok: false, message: "Check the employee", fields };
    const email = input.email.trim();
    const body: EmployeeDraft = {
        code: input.code.trim(),
        name: input.name.trim(),
        jobTitle: input.jobTitle.trim(),
        department: input.department.trim(),
    };
    if (email) body.email = email;
    else if (mode === "update") body.email = null;
    if (salary !== null) body.salary = salary;
    return { ok: true, body };
}

export function attendanceBody(input: { employeeId: string; date: string; note: string }): Checked<AttendanceDraft> {
    const fields: Record<string, string> = {};
    if (!input.employeeId) fields.employeeId = "Choose an employee";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fields.date = "Enter a valid date";
    if (Object.keys(fields).length > 0) return { ok: false, message: "Check the attendance record", fields };
    return {
        ok: true,
        body: {
            employeeId: input.employeeId,
            date: input.date,
            note: input.note.trim() || null,
        },
    };
}

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

export function createHrApi(client: RequestClient) {
    return {
        employees: {
            list(query: { page?: number; pageSize?: number; search?: string; department?: string } = {}) {
                return client.request<Page<Employee>>(`/api/employees${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Employee>(`/api/employees/${encodeURIComponent(id)}`);
            },
            create(body: EmployeeDraft) {
                return client.request<Employee>("/api/employees", { method: "POST", body });
            },
            update(id: string, body: EmployeeDraft) {
                return client.request<Employee>(`/api/employees/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
        attendance: {
            list(query: { page?: number; pageSize?: number; employeeId?: string; from?: string; to?: string } = {}) {
                return client.request<Page<Attendance>>(`/api/attendance${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Attendance>(`/api/attendance/${encodeURIComponent(id)}`);
            },
            create(body: AttendanceDraft) {
                return client.request<Attendance>("/api/attendance", { method: "POST", body });
            },
            update(id: string, body: Partial<AttendanceDraft>) {
                return client.request<Attendance>(`/api/attendance/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
    };
}

export const hr = createHrApi(api);
