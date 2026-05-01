"use client";

import { create } from "zustand";
import type { Role } from "@/lib/types";

interface DashboardState {
  // Demo auth
  demoRole: Role;
  demoUserId: string;
  demoUserName: string;
  setDemoRole: (role: Role) => void;

  // Cycle selection
  selectedCycleId: string | null;
  setSelectedCycleId: (id: string | null) => void;

  // Filters
  departmentFilter: string | null;
  quadrantFilter: string | null;
  searchQuery: string;
  setDepartmentFilter: (id: string | null) => void;
  setQuadrantFilter: (q: string | null) => void;
  setSearchQuery: (q: string) => void;
  resetFilters: () => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

// Two demo users from seed data
const DEMO_USERS: Record<Role, { id: string; name: string }> = {
  admin: { id: "admin-demo", name: "Naim" },
  manager: { id: "manager-demo", name: "Samira Al-Balushi" },
};

export const useDashboardStore = create<DashboardState>((set) => ({
  demoRole: "admin",
  demoUserId: DEMO_USERS.admin.id,
  demoUserName: DEMO_USERS.admin.name,
  setDemoRole: (role) =>
    set({ demoRole: role, demoUserId: DEMO_USERS[role].id, demoUserName: DEMO_USERS[role].name }),

  selectedCycleId: null,
  setSelectedCycleId: (id) => set({ selectedCycleId: id }),

  departmentFilter: null,
  quadrantFilter: null,
  searchQuery: "",
  setDepartmentFilter: (id) => set({ departmentFilter: id }),
  setQuadrantFilter: (q) => set({ quadrantFilter: q }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  resetFilters: () => set({ departmentFilter: null, quadrantFilter: null, searchQuery: "" }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
