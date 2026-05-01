import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/* ═══════════════════════════════════════════════════
   USERS — login accounts (Admin / Manager)
   ═══════════════════════════════════════════════════ */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // uuid
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "manager"] }).notNull(),
  orgNodeId: text("org_node_id").references(() => orgNodes.id),
  imageUrl: text("image_url"),
  hasSeenWelcome: integer("has_seen_welcome", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  orgNode: one(orgNodes, { fields: [users.orgNodeId], references: [orgNodes.id] }),
  assessmentsGiven: many(assessments, { relationName: "assessor" }),
  notifications: many(notifications),
}));

/* ═══════════════════════════════════════════════════
   ORG_NODES — self-referential hierarchy
   Department → Sub-department → Unit
   ═══════════════════════════════════════════════════ */
export const orgNodes = sqliteTable("org_nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  level: text("level", { enum: ["department", "sub_department", "unit"] }).notNull(),
  parentId: text("parent_id").references((): any => orgNodes.id),
  headcount: integer("headcount").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const orgNodesRelations = relations(orgNodes, ({ one, many }) => ({
  parent: one(orgNodes, { fields: [orgNodes.parentId], references: [orgNodes.id], relationName: "parentChild" }),
  children: many(orgNodes, { relationName: "parentChild" }),
  employees: many(employees),
  questions: many(assessmentQuestions),
}));

/* ═══════════════════════════════════════════════════
   EMPLOYEES — all staff
   ═══════════════════════════════════════════════════ */
export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  roleTitle: text("role_title").notNull(),
  orgNodeId: text("org_node_id").notNull().references(() => orgNodes.id),
  managerId: text("manager_id").references((): any => employees.id),
  imageUrl: text("image_url"),
  hireDate: text("hire_date").notNull(),
  employmentType: text("employment_type", { enum: ["full_time", "part_time", "contract"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  orgNode: one(orgNodes, { fields: [employees.orgNodeId], references: [orgNodes.id] }),
  manager: one(employees, { fields: [employees.managerId], references: [employees.id], relationName: "managerReports" }),
  reports: many(employees, { relationName: "managerReports" }),
  assessments: many(assessments, { relationName: "assessed" }),
}));

/* ═══════════════════════════════════════════════════
   ASSESSMENT_QUESTIONS — editable question bank
   Scoped to department-level org_node
   ═══════════════════════════════════════════════════ */
export const assessmentQuestions = sqliteTable("assessment_questions", {
  id: text("id").primaryKey(),
  departmentNodeId: text("department_node_id").notNull().references(() => orgNodes.id),
  dimension: text("dimension", { enum: ["commitment", "competency"] }).notNull(),
  questionText: text("question_text").notNull(),
  weight: real("weight").notNull().default(1.0),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const assessmentQuestionsRelations = relations(assessmentQuestions, ({ one }) => ({
  department: one(orgNodes, { fields: [assessmentQuestions.departmentNodeId], references: [orgNodes.id] }),
}));

/* ═══════════════════════════════════════════════════
   ASSESSMENT_CYCLES — monthly periods
   ═══════════════════════════════════════════════════ */
export const assessmentCycles = sqliteTable("assessment_cycles", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  opensAt: text("opens_at").notNull(),
  closesAt: text("closes_at"),
}, (table) => ({
  yearMonthUnique: uniqueIndex("year_month_idx").on(table.year, table.month),
}));

export const assessmentCyclesRelations = relations(assessmentCycles, ({ many }) => ({
  assessments: many(assessments),
  departmentStats: many(monthlyDepartmentStats),
}));

/* ═══════════════════════════════════════════════════
   ASSESSMENTS — one per employee per cycle
   Contains snapshot + calculated scores
   ═══════════════════════════════════════════════════ */
export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  assessorId: text("assessor_id").notNull().references(() => users.id),
  cycleId: text("cycle_id").notNull().references(() => assessmentCycles.id),
  commitmentScore: real("commitment_score").notNull(),
  competencyScore: real("competency_score").notNull(),
  quadrant: text("quadrant").notNull(),
  questionSnapshot: text("question_snapshot").notNull(), // JSON string — frozen question set
  submittedAt: text("submitted_at").notNull(),
}, (table) => ({
  employeeCycleUnique: uniqueIndex("emp_cycle_idx").on(table.employeeId, table.cycleId),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  employee: one(employees, { fields: [assessments.employeeId], references: [employees.id], relationName: "assessed" }),
  assessor: one(users, { fields: [assessments.assessorId], references: [users.id], relationName: "assessor" }),
  cycle: one(assessmentCycles, { fields: [assessments.cycleId], references: [assessmentCycles.id] }),
  responses: many(assessmentResponses),
}));

/* ═══════════════════════════════════════════════════
   ASSESSMENT_RESPONSES — per-question scores
   question_id references the snapshot, not live questions
   ═══════════════════════════════════════════════════ */
export const assessmentResponses = sqliteTable("assessment_responses", {
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id").notNull().references(() => assessments.id),
  questionId: text("question_id").notNull(), // references snapshot qId
  dimension: text("dimension", { enum: ["commitment", "competency"] }).notNull(),
  score: integer("score").notNull(), // 1-10
  notes: text("notes"),
});

export const assessmentResponsesRelations = relations(assessmentResponses, ({ one }) => ({
  assessment: one(assessments, { fields: [assessmentResponses.assessmentId], references: [assessments.id] }),
}));

/* ═══════════════════════════════════════════════════
   MONTHLY_DEPARTMENT_STATS — pre-computed rollups
   Powers real-time dashboard and historical analytics
   ═══════════════════════════════════════════════════ */
export const monthlyDepartmentStats = sqliteTable("monthly_department_stats", {
  id: text("id").primaryKey(),
  departmentNodeId: text("department_node_id").notNull().references(() => orgNodes.id),
  cycleId: text("cycle_id").notNull().references(() => assessmentCycles.id),
  avgCommitment: real("avg_commitment").notNull(),
  avgCompetency: real("avg_competency").notNull(),
  gapDirection: text("gap_direction").notNull(), // "Motivation Gap" | "Competency Gap" | "Balanced"
  quadrantDistribution: text("quadrant_distribution").notNull(), // JSON: {star: n, growth: n, ...}
  totalAssessed: integer("total_assessed").notNull(),
  totalEmployees: integer("total_employees").notNull(),
  computedAt: text("computed_at").notNull(),
}, (table) => ({
  deptCycleUnique: uniqueIndex("dept_cycle_stats_idx").on(table.departmentNodeId, table.cycleId),
}));

export const monthlyDepartmentStatsRelations = relations(monthlyDepartmentStats, ({ one }) => ({
  department: one(orgNodes, { fields: [monthlyDepartmentStats.departmentNodeId], references: [orgNodes.id] }),
  cycle: one(assessmentCycles, { fields: [monthlyDepartmentStats.cycleId], references: [assessmentCycles.id] }),
}));

/* ═══════════════════════════════════════════════════
   NOTIFICATIONS — admin notification feed
   ═══════════════════════════════════════════════════ */
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id").notNull().references(() => users.id),
  type: text("type", { enum: ["review_submitted", "star_performer", "low_score_alert", "cycle_reminder"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: text("data"), // JSON string — payload with employeeId, score, etc.
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, { fields: [notifications.recipientId], references: [users.id] }),
}));

/* ═══════════════════════════════════════════════════
   SETTINGS — key-value config
   ═══════════════════════════════════════════════════ */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON string
  updatedAt: text("updated_at").notNull(),
});
