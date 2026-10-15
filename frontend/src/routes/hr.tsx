import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { RelationPicker, useResolvedLabels } from "@/components/relation-picker";
import { PageHeader, Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDay } from "@/lib/crm";
import { attendanceBody, employeeBody, hr, type Attendance, type Employee } from "@/lib/hr";
import { canBrowseEmployees, linkedLabel, loadEmployeeOptions, lookupEmployeeName } from "@/lib/relations";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/hr")({
    head: () => ({
        meta: [
            { title: "HR & People — DigiCyrus ERP" },
            { name: "description", content: "Employee records and attendance for the agency team." },
            { property: "og:title", content: "HR & People — DigiCyrus ERP" },
            { property: "og:description", content: "Employee records and attendance for the agency team." },
        ],
    }),
    component: HrPage,
});

const PAGE_SIZE = 20;

function HrPage() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canViewEmployees = canBrowseEmployees(permissions);
    const canCreateEmployee = permissions.includes("employees:create");
    const canUpdateEmployee = permissions.includes("employees:update");
    const canAttendance = permissions.includes("attendance:view");
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeeTotal, setEmployeeTotal] = useState(0);
    const [employeePage, setEmployeePage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [department, setDepartment] = useState("");
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [attendanceTotal, setAttendanceTotal] = useState(0);
    const [attendancePage, setAttendancePage] = useState(1);
    const [employeeId, setEmployeeId] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [employeeEditor, setEmployeeEditor] = useState<Employee | "new" | null>(null);
    const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
    const [attendanceEditor, setAttendanceEditor] = useState<Attendance | "new" | null>(null);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setEmployeePage(1);
            setQuery(search.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!canViewEmployees) {
            setEmployees([]);
            setEmployeeTotal(0);
            return;
        }
        let active = true;
        setLoading(true);
        void hr.employees.list({
            page: employeePage,
            pageSize: PAGE_SIZE,
            search: query || undefined,
            department: department.trim() || undefined,
        }).then((result) => {
            if (!active) return;
            setEmployees(result.items);
            setEmployeeTotal(result.total);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setEmployees([]);
            setEmployeeTotal(0);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [canViewEmployees, employeePage, query, department, revision, auth.refresh]);

    useEffect(() => {
        if (!canAttendance) {
            setAttendance([]);
            setAttendanceTotal(0);
            return;
        }
        let active = true;
        void hr.attendance.list({
            page: attendancePage,
            pageSize: PAGE_SIZE,
            employeeId: employeeId || undefined,
            from: from || undefined,
            to: to || undefined,
        }).then((result) => {
            if (!active) return;
            setAttendance(result.items);
            setAttendanceTotal(result.total);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setAttendance([]);
            setAttendanceTotal(0);
        });
        return () => {
            active = false;
        };
    }, [canAttendance, attendancePage, employeeId, from, to, revision, auth.refresh]);

    const employeeLabels = useResolvedLabels(attendance.map((record) => record.employeeId), canViewEmployees, lookupEmployeeName);
    const employeePages = Math.max(1, Math.ceil(employeeTotal / PAGE_SIZE));
    const attendancePages = Math.max(1, Math.ceil(attendanceTotal / PAGE_SIZE));

    return (
        <AppShell>
            <PageHeader
                title="HR"
                subtitle={canViewEmployees ? (loading ? "Loading employees…" : `${employeeTotal} employees`) : "Employee records are not available for this role"}
                actions={canCreateEmployee ? (
                    <Button size="sm" onClick={() => setEmployeeEditor("new")}>
                        <Plus className="h-4 w-4" /> New employee
                    </Button>
                ) : null}
            />
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            <p className="text-xs text-muted-foreground">Leave, payroll runs, payslips, and performance scores are not available.</p>

            <Tabs defaultValue="people" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="people">People</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="reports">Daily reports</TabsTrigger>
                </TabsList>

                <TabsContent value="people">
                    <Panel>
                        {canViewEmployees ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                                <Input className="max-w-xs" placeholder="Search employees…" value={search} onChange={(event) => setSearch(event.target.value)} />
                                <Input aria-label="Department" className="max-w-[12rem]" placeholder="Department" value={department} onChange={(event) => { setDepartment(event.target.value); setEmployeePage(1); }} />
                            </div>
                        ) : <p className="text-sm text-muted-foreground">You do not have access to employees.</p>}
                        {loading && canViewEmployees ? <p className="text-sm text-muted-foreground">Loading employees…</p> : null}
                        {canViewEmployees && !loading && employees.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No employees</p> : null}
                        {employees.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Salary</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employees.map((employee) => (
                                            <TableRow key={employee.id} className="cursor-pointer" onClick={() => setSelectedEmployeeId(employee.id)}>
                                                <TableCell className="font-mono text-xs">{employee.code}</TableCell>
                                                <TableCell className="font-medium">{employee.name}</TableCell>
                                                <TableCell className="text-muted-foreground">{employee.jobTitle}</TableCell>
                                                <TableCell className="text-muted-foreground">{employee.department}</TableCell>
                                                <TableCell className="text-muted-foreground">{employee.email ?? "—"}</TableCell>
                                                <TableCell className="font-mono text-xs">{employee.salary === null ? "—" : inr(employee.salary)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : null}
                        {canViewEmployees ? (
                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                <span>Page {employeePage} of {employeePages}</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" disabled={employeePage <= 1} onClick={() => setEmployeePage((current) => current - 1)}>Previous</Button>
                                    <Button variant="outline" size="sm" disabled={employeePage >= employeePages} onClick={() => setEmployeePage((current) => current + 1)}>Next</Button>
                                </div>
                            </div>
                        ) : null}
                    </Panel>
                </TabsContent>

                <TabsContent value="attendance">
                    <Panel
                        title="Attendance"
                        description={canAttendance ? `${attendanceTotal} records` : "Attendance is not available for this role"}
                        actions={canAttendance ? (
                            <Button size="sm" onClick={() => setAttendanceEditor("new")}><Plus className="h-4 w-4" /> Record attendance</Button>
                        ) : null}
                    >
                        {canAttendance ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                                <div className="min-w-56">
                                    <RelationPicker label="Employee" value={employeeId} emptyLabel="All employees" enabled={canViewEmployees} selectedLabel={employeeLabels[employeeId]} load={loadEmployeeOptions} onChange={(id) => { setEmployeeId(id); setAttendancePage(1); }} unavailable="Employee filter needs employee access." />
                                </div>
                                <Input aria-label="From" type="date" className="w-40" value={from} onChange={(event) => { setFrom(event.target.value); setAttendancePage(1); }} />
                                <Input aria-label="To" type="date" className="w-40" value={to} onChange={(event) => { setTo(event.target.value); setAttendancePage(1); }} />
                            </div>
                        ) : null}
                        {canAttendance && attendance.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No attendance records</p> : null}
                        {attendance.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Note</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendance.map((record) => (
                                            <TableRow key={record.id} className="cursor-pointer" onClick={() => setSelectedAttendanceId(record.id)}>
                                                <TableCell>{formatDay(record.date)}</TableCell>
                                                <TableCell className="font-medium">{linkedLabel(record.employeeId, employeeLabels, "Employee name unavailable", "Employee name unavailable")}</TableCell>
                                                <TableCell className="text-muted-foreground">{record.note ?? "—"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : null}
                        {canAttendance ? (
                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                <span>Page {attendancePage} of {attendancePages}</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" disabled={attendancePage <= 1} onClick={() => setAttendancePage((current) => current - 1)}>Previous</Button>
                                    <Button variant="outline" size="sm" disabled={attendancePage >= attendancePages} onClick={() => setAttendancePage((current) => current + 1)}>Next</Button>
                                </div>
                            </div>
                        ) : null}
                    </Panel>
                </TabsContent>

                <TabsContent value="reports">
                    <Panel title="Daily work reports" description="Submitted today">
                        <p className="text-sm text-muted-foreground">Daily work reports are not available.</p>
                    </Panel>
                </TabsContent>
            </Tabs>

            <EmployeeDetailDialog
                employeeId={selectedEmployeeId}
                canEdit={canUpdateEmployee}
                revision={revision}
                onOpenChange={(open) => { if (!open) setSelectedEmployeeId(null); }}
                onEdit={(employee) => { setSelectedEmployeeId(null); setEmployeeEditor(employee); }}
            />
            <EmployeeDialog
                open={employeeEditor !== null}
                employee={employeeEditor === "new" ? null : employeeEditor}
                onOpenChange={(open) => { if (!open) setEmployeeEditor(null); }}
                onSaved={() => { setEmployeeEditor(null); setRevision((current) => current + 1); }}
            />
            <AttendanceDetailDialog
                attendanceId={selectedAttendanceId}
                labels={employeeLabels}
                canEdit={canAttendance}
                revision={revision}
                onOpenChange={(open) => { if (!open) setSelectedAttendanceId(null); }}
                onEdit={(record) => { setSelectedAttendanceId(null); setAttendanceEditor(record); }}
            />
            <AttendanceDialog
                open={attendanceEditor !== null}
                record={attendanceEditor === "new" ? null : attendanceEditor}
                canEmployees={canViewEmployees}
                onOpenChange={(open) => { if (!open) setAttendanceEditor(null); }}
                onSaved={() => { setAttendanceEditor(null); setRevision((current) => current + 1); }}
            />
        </AppShell>
    );
}

function EmployeeDetailDialog({ employeeId, canEdit, revision, onOpenChange, onEdit }: {
    employeeId: string | null;
    canEdit: boolean;
    revision: number;
    onOpenChange: (open: boolean) => void;
    onEdit: (employee: Employee) => void;
}) {
    const auth = useAuth();
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!employeeId) {
            setEmployee(null);
            return;
        }
        let active = true;
        setMessage(null);
        void hr.employees.get(employeeId).then((result) => {
            if (active) setEmployee(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setEmployee(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [employeeId, revision, auth.refresh]);

    return (
        <Dialog open={employeeId !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{employee ? employee.name : "Employee"}</DialogTitle></DialogHeader>
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                {!employee && !message ? <p className="text-sm text-muted-foreground">Loading employee…</p> : null}
                {employee ? (
                    <div className="space-y-2 text-sm">
                        <p>Code {employee.code}</p>
                        <p>{employee.jobTitle} · {employee.department}</p>
                        <p>{employee.email ?? "No email"}</p>
                        <p>{employee.salary === null ? "No salary" : inr(employee.salary)}</p>
                        {canEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(employee)}>Edit</Button> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function EmployeeDialog({ open, employee, onOpenChange, onSaved }: {
    open: boolean;
    employee: Employee | null;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    const auth = useAuth();
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [department, setDepartment] = useState("");
    const [email, setEmail] = useState("");
    const [salary, setSalary] = useState("");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setCode(employee?.code ?? "");
        setName(employee?.name ?? "");
        setJobTitle(employee?.jobTitle ?? "");
        setDepartment(employee?.department ?? "");
        setEmail(employee?.email ?? "");
        setSalary(employee?.salary === null || employee === null ? "" : String(employee.salary));
        setFields({});
        setMessage(null);
    }, [employee, open]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = employeeBody({ code, name, jobTitle, department, email, salary }, employee ? "update" : "create");
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (employee) await hr.employees.update(employee.id, checked.body);
            else await hr.employees.create(checked.body);
            onSaved();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setFields(failure.fields);
            setMessage(failure.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{employee ? "Edit employee" : "New employee"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Code" value={code} error={fields.code} onChange={setCode} />
                    <Field label="Name" value={name} error={fields.name} onChange={setName} />
                    <Field label="Job title" value={jobTitle} error={fields.jobTitle} onChange={setJobTitle} />
                    <Field label="Department" value={department} error={fields.department} onChange={setDepartment} />
                    <Field label="Email" type="email" value={email} error={fields.email} onChange={setEmail} required={false} />
                    <Field label="Salary (₹)" value={salary} error={fields.salary} onChange={setSalary} required={employee === null} />
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AttendanceDetailDialog({ attendanceId, labels, canEdit, revision, onOpenChange, onEdit }: {
    attendanceId: string | null;
    labels: Record<string, string | null>;
    canEdit: boolean;
    revision: number;
    onOpenChange: (open: boolean) => void;
    onEdit: (record: Attendance) => void;
}) {
    const auth = useAuth();
    const [record, setRecord] = useState<Attendance | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!attendanceId) {
            setRecord(null);
            return;
        }
        let active = true;
        setMessage(null);
        void hr.attendance.get(attendanceId).then((result) => {
            if (active) setRecord(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setRecord(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [attendanceId, revision, auth.refresh]);

    return (
        <Dialog open={attendanceId !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{record ? formatDay(record.date) : "Attendance"}</DialogTitle></DialogHeader>
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                {!record && !message ? <p className="text-sm text-muted-foreground">Loading attendance…</p> : null}
                {record ? (
                    <div className="space-y-2 text-sm">
                        <p>{linkedLabel(record.employeeId, labels, "Employee name unavailable", "Employee name unavailable")}</p>
                        <p>{record.note ?? "No note"}</p>
                        {canEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(record)}>Edit</Button> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function AttendanceDialog({ open, record, canEmployees, onOpenChange, onSaved }: {
    open: boolean;
    record: Attendance | null;
    canEmployees: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    const auth = useAuth();
    const [employeeId, setEmployeeId] = useState("");
    const [date, setDate] = useState("");
    const [note, setNote] = useState("");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setEmployeeId(record?.employeeId ?? "");
        setDate(record?.date ?? "");
        setNote(record?.note ?? "");
        setFields({});
        setMessage(null);
    }, [record, open]);
    const employeeLabels = useResolvedLabels([employeeId], canEmployees, lookupEmployeeName);

    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = attendanceBody({ employeeId, date, note });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (record) await hr.attendance.update(record.id, checked.body);
            else await hr.attendance.create(checked.body);
            onSaved();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setFields(failure.fields);
            setMessage(failure.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{record ? "Edit attendance" : "Record attendance"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <RelationPicker label="Employee" value={employeeId} emptyLabel="Choose an employee" required enabled={canEmployees} selectedLabel={employeeLabels[employeeId]} load={loadEmployeeOptions} onChange={setEmployeeId} unavailable="Choosing an employee needs employee access." />
                    {fields.employeeId ? <p className="text-xs text-destructive">{fields.employeeId}</p> : null}
                    <Field label="Date" type="date" value={date} error={fields.date} onChange={setDate} />
                    <Field label="Note" value={note} error={fields.note} onChange={setNote} required={false} />
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, value, error, type = "text", required = true, onChange }: { label: string; value: string; error?: string; type?: string; required?: boolean; onChange: (value: string) => void }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1" type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}
