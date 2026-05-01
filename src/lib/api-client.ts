"use client";

const BASE = "/api/dashboard";

async function fetchAPI(params: Record<string, string>) {
  const url = new URL(BASE, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  orgReadiness: (cycleId?: string) => fetchAPI({ action: "orgReadiness", ...(cycleId && { cycleId }) }),
  deptReadiness: (deptId: string, cycleId?: string) => fetchAPI({ action: "deptReadiness", deptId, ...(cycleId && { cycleId }) }),
  employeeReadiness: (empId: string, cycleId?: string) => fetchAPI({ action: "employeeReadiness", empId, ...(cycleId && { cycleId }) }),
  departments: () => fetchAPI({ action: "departments" }),
  orgTree: () => fetchAPI({ action: "orgTree" }),
  employees: (deptId?: string) => fetchAPI({ action: "employees", ...(deptId && { deptId }) }),
  employee: (empId: string) => fetchAPI({ action: "employee", empId }),
  cycles: () => fetchAPI({ action: "cycles" }),
  deptHistory: (deptId: string) => fetchAPI({ action: "deptHistory", deptId }),
  empTrend: (empId: string) => fetchAPI({ action: "empTrend", empId }),
  unrated: (cycleId?: string) => fetchAPI({ action: "unrated", ...(cycleId && { cycleId }) }),
  questions: (deptId: string) => fetchAPI({ action: "questions", deptId }),
  nodeChildren: (nodeId: string) => fetchAPI({ action: "nodeChildren", deptId: nodeId }),
  nodeAncestry: (nodeId: string) => fetchAPI({ action: "nodeAncestry", deptId: nodeId }),
  notifications: (userId: string) => fetchAPI({ action: "notifications", userId }),
  unreadCount: (userId: string) => fetchAPI({ action: "unreadCount", userId }),
  threshold: () => fetchAPI({ action: "threshold" }),
};
