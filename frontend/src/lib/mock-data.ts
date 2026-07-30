export type Role =
    | "Super Admin"
    | "Admin"
    | "Sales Executive"
    | "Project Manager"
    | "Developer"
    | "Marketing Executive"
    | "HR"
    | "Accountant"
    | "Client";

export const currentUser = {
    name: "Aarav Mehta",
    email: "aarav@digicyrus.com",
    role: "Super Admin" as Role,
    initials: "AM",
};

export const inr = (n: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);

export const kpis = [
    { label: "Monthly Revenue", value: 4820000, delta: 12.4, format: "inr" },
    { label: "Pending Payments", value: 1140000, delta: -4.1, format: "inr" },
    { label: "Profit", value: 1685000, delta: 8.9, format: "inr" },
    { label: "Expenses", value: 3135000, delta: 3.2, format: "inr" },
    { label: "Active Projects", value: 24, delta: 5, format: "num" },
    { label: "Completed Projects", value: 138, delta: 6, format: "num" },
    { label: "Delayed Projects", value: 3, delta: -2, format: "num" },
    { label: "Total Clients", value: 86, delta: 4, format: "num" },
    { label: "Active Leads", value: 41, delta: 9, format: "num" },
    { label: "Conversion Rate", value: 32.6, delta: 2.4, format: "pct" },
    { label: "Team Members", value: 29, delta: 3, format: "num" },
    { label: "Monthly Goal", value: 78, delta: 78, format: "pct" },
] as const;

export const revenueTrend = [
    { month: "Feb", revenue: 3200000, expenses: 2350000, profit: 850000 },
    { month: "Mar", revenue: 3650000, expenses: 2480000, profit: 1170000 },
    { month: "Apr", revenue: 3410000, expenses: 2610000, profit: 800000 },
    { month: "May", revenue: 4020000, expenses: 2740000, profit: 1280000 },
    { month: "Jun", revenue: 4380000, expenses: 2905000, profit: 1475000 },
    { month: "Jul", revenue: 4820000, expenses: 3135000, profit: 1685000 },
];

export const cashFlow = [
    { month: "Feb", inflow: 3050000, outflow: 2410000 },
    { month: "Mar", inflow: 3510000, outflow: 2520000 },
    { month: "Apr", inflow: 3300000, outflow: 2680000 },
    { month: "May", inflow: 3980000, outflow: 2790000 },
    { month: "Jun", inflow: 4210000, outflow: 2960000 },
    { month: "Jul", inflow: 4640000, outflow: 3180000 },
];

export const salesFunnel = [
    { stage: "New", count: 148 },
    { stage: "Contacted", count: 112 },
    { stage: "Qualified", count: 78 },
    { stage: "Proposal", count: 46 },
    { stage: "Negotiation", count: 27 },
    { stage: "Won", count: 18 },
];

export const leadSources = [
    { name: "Referral", value: 34 },
    { name: "Website", value: 26 },
    { name: "LinkedIn", value: 18 },
    { name: "Ads", value: 14 },
    { name: "Events", value: 8 },
];

export const projectStatus = [
    { name: "On Track", value: 16 },
    { name: "At Risk", value: 5 },
    { name: "Delayed", value: 3 },
    { name: "Completed", value: 12 },
];

export const monthlyGrowth = [
    { month: "Feb", clients: 62, projects: 18 },
    { month: "Mar", clients: 67, projects: 19 },
    { month: "Apr", clients: 71, projects: 21 },
    { month: "May", clients: 76, projects: 22 },
    { month: "Jun", clients: 81, projects: 23 },
    { month: "Jul", clients: 86, projects: 24 },
];

export const todaysTasks = [
    { id: 1, title: "Send revised proposal to Nimbus Retail", time: "10:30", done: false, tag: "Sales" },
    { id: 2, title: "Design review — Orbit Health app", time: "12:00", done: true, tag: "Design" },
    { id: 3, title: "Invoice follow-up: INV-2041", time: "15:00", done: false, tag: "Finance" },
    { id: 4, title: "Sprint planning — Website revamp", time: "16:30", done: false, tag: "Projects" },
];

export const meetings = [
    { id: 1, title: "Kickoff — Vertex Logistics", time: "11:00 AM", with: "Rhea Kapoor", mode: "Google Meet" },
    { id: 2, title: "Quarterly review — Nimbus Retail", time: "02:00 PM", with: "Kabir Shah", mode: "Office" },
    { id: 3, title: "Ad performance sync", time: "05:15 PM", with: "Marketing team", mode: "Zoom" },
];

export const activities = [
    { id: 1, text: "Payment of ₹3,20,000 received from Orbit Health", time: "22m ago", type: "finance" },
    { id: 2, text: "Lead 'Sunrise Interiors' moved to Negotiation", time: "1h ago", type: "lead" },
    { id: 3, text: "Milestone 'Phase 2 UI' completed on Vertex Portal", time: "3h ago", type: "project" },
    { id: 4, text: "Proposal PRO-118 signed digitally", time: "5h ago", type: "proposal" },
    { id: 5, text: "New employee Ishita Rao onboarded", time: "Yesterday", type: "hr" },
];

export const followUps = [
    { id: 1, client: "Nimbus Retail", owner: "Sana", due: "Today 04:00 PM", status: "Due" },
    { id: 2, client: "Sunrise Interiors", owner: "Dev", due: "Today 06:30 PM", status: "Due" },
    { id: 3, client: "Cobalt Studio", owner: "Aarav", due: "Yesterday", status: "Missed" },
    { id: 4, client: "Orbit Health", owner: "Rhea", due: "Tomorrow", status: "Upcoming" },
    { id: 5, client: "Vertex Logistics", owner: "Sana", due: "Jul 12", status: "Completed" },
];

export const clients = [
    { id: "C-101", name: "Nimbus Retail", contact: "Kabir Shah", industry: "E-commerce", status: "Active", rating: 5, value: 1850000, since: "2023" },
    { id: "C-102", name: "Orbit Health", contact: "Rhea Kapoor", industry: "Healthcare", status: "Active", rating: 4, value: 2400000, since: "2022" },
    { id: "C-103", name: "Vertex Logistics", contact: "Imran Qureshi", industry: "Logistics", status: "Active", rating: 4, value: 980000, since: "2024" },
    { id: "C-104", name: "Cobalt Studio", contact: "Meera Nair", industry: "Media", status: "On Hold", rating: 3, value: 420000, since: "2024" },
    { id: "C-105", name: "Sunrise Interiors", contact: "Yash Patel", industry: "Interior", status: "Prospect", rating: 4, value: 660000, since: "2025" },
    { id: "C-106", name: "Lumen Edtech", contact: "Ananya Bose", industry: "Education", status: "Active", rating: 5, value: 1320000, since: "2023" },
];

export const leadStages = [
    "New",
    "Contacted",
    "Qualified",
    "Meeting Scheduled",
    "Proposal Sent",
    "Negotiation",
    "Won",
    "Lost",
] as const;
export type LeadStage = (typeof leadStages)[number];

export type Lead = {
    id: string;
    company: string;
    person: string;
    stage: LeadStage;
    value: number;
    source: string;
    priority: "High" | "Medium" | "Low";
    closing: string;
    probability: number;
};

export const leads: Lead[] = [
    { id: "L-2201", company: "Sunrise Interiors", person: "Yash Patel", stage: "Negotiation", value: 660000, source: "Referral", priority: "High", closing: "12 Aug", probability: 70 },
    { id: "L-2202", company: "Kite Fintech", person: "Dhruv Sethi", stage: "Proposal Sent", value: 1450000, source: "LinkedIn", priority: "High", closing: "20 Aug", probability: 55 },
    { id: "L-2203", company: "Grove Cafe Chain", person: "Nisha Rao", stage: "Qualified", value: 380000, source: "Website", priority: "Medium", closing: "28 Aug", probability: 40 },
    { id: "L-2204", company: "Helix Pharma", person: "Arjun Menon", stage: "Meeting Scheduled", value: 920000, source: "Events", priority: "Medium", closing: "02 Sep", probability: 35 },
    { id: "L-2205", company: "Pixel Toys", person: "Tara Iyer", stage: "Contacted", value: 240000, source: "Ads", priority: "Low", closing: "10 Sep", probability: 20 },
    { id: "L-2206", company: "Northwind Realty", person: "Vikram Rana", stage: "New", value: 1750000, source: "Referral", priority: "High", closing: "18 Sep", probability: 15 },
    { id: "L-2207", company: "Bloom Cosmetics", person: "Ira Shaikh", stage: "Won", value: 540000, source: "Website", priority: "Medium", closing: "01 Jul", probability: 100 },
    { id: "L-2208", company: "Steelcore Mfg", person: "Rohit Jain", stage: "Lost", value: 300000, source: "Ads", priority: "Low", closing: "24 Jun", probability: 0 },
];

export const projects = [
    { id: "P-330", name: "Nimbus Commerce Revamp", client: "Nimbus Retail", pm: "Sana Ali", progress: 72, status: "On Track", priority: "High", budget: 1850000, due: "30 Aug", team: ["SA", "DV", "MK"] },
    { id: "P-331", name: "Orbit Patient App", client: "Orbit Health", pm: "Dev Verma", progress: 46, status: "At Risk", priority: "High", budget: 2400000, due: "18 Sep", team: ["DV", "RK"] },
    { id: "P-332", name: "Vertex Tracking Portal", client: "Vertex Logistics", pm: "Sana Ali", progress: 88, status: "On Track", priority: "Medium", budget: 980000, due: "12 Aug", team: ["SA", "IQ"] },
    { id: "P-333", name: "Cobalt Brand Site", client: "Cobalt Studio", pm: "Meera Nair", progress: 25, status: "Delayed", priority: "Low", budget: 420000, due: "05 Aug", team: ["MN"] },
    { id: "P-334", name: "Lumen LMS Phase 3", client: "Lumen Edtech", pm: "Dev Verma", progress: 100, status: "Completed", priority: "Medium", budget: 1320000, due: "01 Jul", team: ["DV", "AB", "TK"] },
];

export const taskBoard = {
    Backlog: [
        { id: "T-1", title: "Migrate product schema", project: "Nimbus", assignee: "MK", labels: ["Backend"], due: "12 Aug" },
        { id: "T-2", title: "SEO audit report", project: "Cobalt", assignee: "MN", labels: ["Marketing"], due: "14 Aug" },
    ],
    "In Progress": [
        { id: "T-3", title: "Checkout redesign", project: "Nimbus", assignee: "SA", labels: ["Design"], due: "08 Aug" },
        { id: "T-4", title: "Appointment booking flow", project: "Orbit", assignee: "DV", labels: ["Frontend"], due: "10 Aug" },
    ],
    Review: [
        { id: "T-5", title: "Fleet map clustering", project: "Vertex", assignee: "IQ", labels: ["Frontend"], due: "07 Aug" },
    ],
    Done: [
        { id: "T-6", title: "Payment gateway swap", project: "Nimbus", assignee: "MK", labels: ["Backend"], due: "02 Aug" },
        { id: "T-7", title: "Phase 3 handover", project: "Lumen", assignee: "AB", labels: ["PM"], due: "01 Jul" },
    ],
} as const;

export const invoices = [
    { id: "INV-2041", client: "Nimbus Retail", amount: 620000, tax: 111600, status: "Pending", date: "12 Jul", due: "26 Jul" },
    { id: "INV-2042", client: "Orbit Health", amount: 320000, tax: 57600, status: "Paid", date: "10 Jul", due: "24 Jul" },
    { id: "INV-2043", client: "Vertex Logistics", amount: 245000, tax: 44100, status: "Overdue", date: "28 Jun", due: "12 Jul" },
    { id: "INV-2044", client: "Lumen Edtech", amount: 480000, tax: 86400, status: "Paid", date: "05 Jul", due: "19 Jul" },
    { id: "INV-2045", client: "Cobalt Studio", amount: 150000, tax: 27000, status: "Draft", date: "18 Jul", due: "01 Aug" },
];

export const expenses = [
    { id: "E-91", head: "Salaries", amount: 1980000, month: "Jul", vendor: "Payroll" },
    { id: "E-92", head: "Ad Spend", amount: 480000, month: "Jul", vendor: "Meta / Google" },
    { id: "E-93", head: "Software", amount: 165000, month: "Jul", vendor: "SaaS stack" },
    { id: "E-94", head: "Office & Utilities", amount: 310000, month: "Jul", vendor: "Workspace" },
    { id: "E-95", head: "Contractors", amount: 200000, month: "Jul", vendor: "Freelancers" },
];

export const proposals = [
    { id: "PRO-118", client: "Sunrise Interiors", value: 660000, status: "Signed", version: "v3", sent: "08 Jul" },
    { id: "PRO-119", client: "Kite Fintech", value: 1450000, status: "Sent", version: "v1", sent: "16 Jul" },
    { id: "PRO-120", client: "Helix Pharma", value: 920000, status: "Draft", version: "v2", sent: "—" },
];

export const agreements = [
    { id: "AGR-51", client: "Nimbus Retail", type: "Master Services", expiry: "31 Mar 2026", signed: true },
    { id: "AGR-52", client: "Orbit Health", type: "NDA", expiry: "12 Nov 2025", signed: true },
    { id: "AGR-53", client: "Kite Fintech", type: "NDA", expiry: "—", signed: false },
];

export const employees = [
    { id: "EMP-11", name: "Sana Ali", role: "Project Manager", dept: "Delivery", attendance: 96, leaves: 2, performance: 92, salary: 95000 },
    { id: "EMP-12", name: "Dev Verma", role: "Project Manager", dept: "Delivery", attendance: 92, leaves: 3, performance: 88, salary: 92000 },
    { id: "EMP-13", name: "Manav Kohli", role: "Developer", dept: "Engineering", attendance: 98, leaves: 1, performance: 90, salary: 78000 },
    { id: "EMP-14", name: "Meera Nair", role: "Marketing Executive", dept: "Marketing", attendance: 90, leaves: 4, performance: 84, salary: 62000 },
    { id: "EMP-15", name: "Ishita Rao", role: "Intern", dept: "Design", attendance: 99, leaves: 0, performance: 80, salary: 20000 },
    { id: "EMP-16", name: "Nikhil Sharma", role: "Accountant", dept: "Finance", attendance: 94, leaves: 2, performance: 87, salary: 70000 },
];

export const campaigns = [
    { id: "CMP-7", name: "Monsoon Retail Push", channel: "Meta Ads", spend: 220000, leads: 148, roi: 3.4, status: "Running" },
    { id: "CMP-8", name: "Healthcare Search", channel: "Google Ads", spend: 180000, leads: 96, roi: 2.7, status: "Running" },
    { id: "CMP-9", name: "LinkedIn Thought Leadership", channel: "LinkedIn", spend: 80000, leads: 41, roi: 1.9, status: "Paused" },
];

export const contentCalendar = [
    { id: 1, date: "Mon 04", title: "Case study: Vertex portal", channel: "LinkedIn", status: "Scheduled" },
    { id: 2, date: "Tue 05", title: "Reel — behind the build", channel: "Instagram", status: "Draft" },
    { id: 3, date: "Wed 06", title: "SEO blog: agency ops", channel: "Blog", status: "Published" },
    { id: 4, date: "Fri 08", title: "Client testimonial", channel: "YouTube", status: "Scheduled" },
];

export const trafficTrend = [
    { month: "Feb", sessions: 18400, leads: 96 },
    { month: "Mar", sessions: 21200, leads: 112 },
    { month: "Apr", sessions: 19800, leads: 104 },
    { month: "May", sessions: 24600, leads: 131 },
    { month: "Jun", sessions: 27100, leads: 148 },
    { month: "Jul", sessions: 30400, leads: 165 },
];

export const assets = [
    { id: "A-1", name: "digicyrus.com", type: "Domain", vendor: "GoDaddy", renewal: "14 Sep 2025", cost: 1400, status: "Active" },
    { id: "A-2", name: "Cloud Hosting — Prod", type: "Hosting", vendor: "AWS", renewal: "01 Aug 2025", cost: 48000, status: "Due Soon" },
    { id: "A-3", name: "Wildcard SSL", type: "SSL", vendor: "Sectigo", renewal: "22 Dec 2025", cost: 9500, status: "Active" },
    { id: "A-4", name: "Figma Organization", type: "License", vendor: "Figma", renewal: "05 Aug 2025", cost: 68000, status: "Due Soon" },
    { id: "A-5", name: "Ahrefs Standard", type: "Subscription", vendor: "Ahrefs", renewal: "19 Oct 2025", cost: 17500, status: "Active" },
];

export const referrals = [
    { id: "R-4", partner: "Kunal Desai", deals: 6, revenue: 1450000, commission: 145000, status: "Paid" },
    { id: "R-5", partner: "Bright Consulting", deals: 3, revenue: 820000, commission: 82000, status: "Pending" },
    { id: "R-6", partner: "Nidhi Verma", deals: 2, revenue: 360000, commission: 36000, status: "Paid" },
];

export const notifications = [
    { id: 1, title: "Invoice INV-2043 is overdue", time: "10m", type: "warning" },
    { id: 2, title: "Kite Fintech opened your proposal", time: "1h", type: "info" },
    { id: 3, title: "AWS hosting renews in 3 days", time: "4h", type: "warning" },
    { id: 4, title: "Payment received — Orbit Health", time: "1d", type: "success" },
];

export const rolePermissions: { role: Role; modules: string[] }[] = [
    { role: "Super Admin", modules: ["All modules", "Billing", "Roles & Permissions"] },
    { role: "Admin", modules: ["Dashboard", "CRM", "Projects", "Finance", "HR", "Reports"] },
    { role: "Sales Executive", modules: ["Dashboard", "CRM", "Leads", "Sales", "Follow-ups"] },
    { role: "Project Manager", modules: ["Dashboard", "Projects", "Tasks", "Clients"] },
    { role: "Developer", modules: ["Projects", "Tasks", "Daily Planner"] },
    { role: "Marketing Executive", modules: ["Marketing", "Leads", "Reports"] },
    { role: "HR", modules: ["HR", "Attendance", "Payroll"] },
    { role: "Accountant", modules: ["Finance", "Invoices", "Reports"] },
    { role: "Client", modules: ["Project Status", "Invoices", "Documents"] },
];

export const searchIndex = [
    ...clients.map((c) => ({ label: c.name, group: "Clients", to: "/crm" })),
    ...leads.map((l) => ({ label: l.company, group: "Leads", to: "/leads" })),
    ...projects.map((p) => ({ label: p.name, group: "Projects", to: "/projects" })),
    ...invoices.map((i) => ({ label: `${i.id} · ${i.client}`, group: "Invoices", to: "/finance" })),
    ...employees.map((e) => ({ label: e.name, group: "Employees", to: "/hr" })),
];
