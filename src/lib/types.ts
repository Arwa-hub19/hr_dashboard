/* ═══════════════════════════════════════════════════
   Core domain types
   ═══════════════════════════════════════════════════ */

export type Role = "admin" | "manager";
export type OrgLevel = "department" | "sub_department" | "unit";
export type Dimension = "commitment" | "competency";
export type EmploymentType = "full_time" | "part_time" | "contract";
export type CycleStatus = "open" | "closed";
export type QuadrantLabel = "Star Performer" | "Growth Potential" | "Underutilized" | "At Risk";
export type GapDirection = "Motivation Gap" | "Competency Gap" | "Balanced";
export type NotificationType = "review_submitted" | "star_performer" | "low_score_alert" | "cycle_reminder";

/* ═══════════════════════════════════════════════════
   Auth / session context
   ═══════════════════════════════════════════════════ */
export interface SessionContext {
  userId: string;
  role: Role;
  orgNodeId: string | null; // null for admin (sees all)
  name: string;
}

/* ═══════════════════════════════════════════════════
   Org hierarchy
   ═══════════════════════════════════════════════════ */
export interface OrgNode {
  id: string;
  name: string;
  shortName: string;
  level: OrgLevel;
  parentId: string | null;
  headcount: number;
  sortOrder: number;
  children?: OrgNode[];
}

export interface OrgTreeNode extends OrgNode {
  children: OrgTreeNode[];
  employees?: EmployeeSummary[];
}

/* ═══════════════════════════════════════════════════
   Employees
   ═══════════════════════════════════════════════════ */
export interface EmployeeSummary {
  id: string;
  name: string;
  roleTitle: string;
  orgNodeId: string;
  imageUrl: string | null;
  employmentType: EmploymentType;
  isActive: boolean;
}

export interface EmployeeDetail extends EmployeeSummary {
  userId: string | null;
  managerId: string | null;
  managerName?: string;
  hireDate: string;
  departmentName: string;
  orgPath: string[]; // breadcrumb: ["Marketing", "Core Marketing"]
}

/* ═══════════════════════════════════════════════════
   Assessment questions
   ═══════════════════════════════════════════════════ */
export interface Question {
  id: string;
  departmentNodeId: string;
  dimension: Dimension;
  questionText: string;
  weight: number;
  sortOrder: number;
  isActive: boolean;
}

export interface QuestionSnapshot {
  id: string;
  dimension: Dimension;
  questionText: string;
  weight: number;
}

/* ═══════════════════════════════════════════════════
   Assessment cycles
   ═══════════════════════════════════════════════════ */
export interface Cycle {
  id: string;
  year: number;
  month: number;
  status: CycleStatus;
  label: string; // "March 2026"
}

/* ═══════════════════════════════════════════════════
   Assessments & scoring
   ═══════════════════════════════════════════════════ */
export interface AssessmentResponse {
  questionId: string;
  dimension: Dimension;
  score: number;
  notes?: string;
}

export interface AssessmentResult {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  assessorId: string;
  cycleId: string;
  commitmentScore: number;
  competencyScore: number;
  quadrant: QuadrantLabel;
  submittedAt: string;
}

export interface ReadinessProfile {
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  orgNodeId: string;
  commitmentScore: number;
  competencyScore: number;
  quadrant: QuadrantLabel;
  responses: AssessmentResponse[];
  questionSnapshot: QuestionSnapshot[];
}

/* ═══════════════════════════════════════════════════
   Department analytics
   ═══════════════════════════════════════════════════ */
export interface QuadrantDistribution {
  "Star Performer": number;
  "Growth Potential": number;
  "Underutilized": number;
  "At Risk": number;
}

export interface DepartmentReadiness {
  departmentId: string;
  departmentName: string;
  shortName: string;
  headcount: number;
  avgCommitment: number;
  avgCompetency: number;
  gapDirection: GapDirection;
  distribution: QuadrantDistribution;
  totalAssessed: number;
  profiles: ReadinessProfile[];
}

export interface OrgReadiness {
  avgCommitment: number;
  avgCompetency: number;
  gapDirection: GapDirection;
  distribution: QuadrantDistribution;
  totalAssessed: number;
  departments: DepartmentReadiness[];
}

/* ═══════════════════════════════════════════════════
   Monthly analytics (time series)
   ═══════════════════════════════════════════════════ */
export interface MonthlyDeptStat {
  departmentId: string;
  departmentName: string;
  cycleId: string;
  year: number;
  month: number;
  avgCommitment: number;
  avgCompetency: number;
  gapDirection: GapDirection;
  distribution: QuadrantDistribution;
  totalAssessed: number;
}

export interface EmployeeTrend {
  employeeId: string;
  points: {
    cycleId: string;
    year: number;
    month: number;
    commitmentScore: number;
    competencyScore: number;
    quadrant: QuadrantLabel;
  }[];
}

/* ═══════════════════════════════════════════════════
   Notifications
   ═══════════════════════════════════════════════════ */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════
   UI-specific types
   ═══════════════════════════════════════════════════ */
export interface ScatterPoint {
  x: number; // competency
  y: number; // commitment
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
  quadrant: QuadrantLabel;
  employeeId: string;
  dotColor?: string;
}

export interface InterventionRecommendation {
  type: "training" | "engagement" | "critical" | "strength";
  title: string;
  description: string;
  employeeCount: number;
  color: string;
}
