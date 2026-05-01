import { db } from "../db";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import * as s from "../db/schema";
import { classifyQuadrant, determineGap, buildDistribution, aggregateScores, weightedOrgAverage } from "./scoring";
import type { OrgNode, OrgTreeNode, EmployeeDetail, DepartmentReadiness, OrgReadiness, ReadinessProfile, Cycle, MonthlyDeptStat, EmployeeTrend, Notification, QuadrantLabel, GapDirection, QuadrantDistribution, Question } from "../types";

const MONTHS = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── ORG HIERARCHY ───
export async function getAllOrgNodes(): Promise<OrgNode[]> {
  const rows = await db.select().from(s.orgNodes).orderBy(asc(s.orgNodes.sortOrder));
  return rows.map(r => ({ id:r.id, name:r.name, shortName:r.shortName, level:r.level as any, parentId:r.parentId, headcount:r.headcount, sortOrder:r.sortOrder }));
}
export async function buildOrgTree(): Promise<OrgTreeNode[]> {
  const allNodes = await getAllOrgNodes();
  const map = new Map<string, OrgTreeNode>();
  const roots: OrgTreeNode[] = [];
  for (const n of allNodes) map.set(n.id, { ...n, children: [] });
  for (const n of allNodes) { const node = map.get(n.id)!; if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(node); else roots.push(node); }
  return roots;
}
export async function getDepartments(): Promise<OrgNode[]> {
  return (await db.select().from(s.orgNodes).where(eq(s.orgNodes.level,"department")).orderBy(asc(s.orgNodes.sortOrder))) as any;
}
export async function getOrgNode(id: string): Promise<OrgNode|null> {
  const row = await db.select().from(s.orgNodes).where(eq(s.orgNodes.id,id)).limit(1);
  return row[0] ? row[0] as any : null;
}
export async function getNodeAncestry(nodeId: string): Promise<OrgNode[]> {
  const path: OrgNode[] = [];
  let current = await getOrgNode(nodeId);
  while (current) { path.unshift(current); current = current.parentId ? await getOrgNode(current.parentId) : null; }
  return path;
}
export async function getNodeChildren(parentId: string): Promise<OrgNode[]> {
  return (await db.select().from(s.orgNodes).where(eq(s.orgNodes.parentId,parentId)).orderBy(asc(s.orgNodes.sortOrder))) as any;
}
async function getDeptIdForNode(nodeId: string): Promise<string> {
  const ancestry = await getNodeAncestry(nodeId);
  const dept = ancestry.find(n => n.level === "department");
  return dept ? dept.id : nodeId;
}
async function getAllDescendantIds(nodeId: string): Promise<string[]> {
  const ids = [nodeId];
  const children = await getNodeChildren(nodeId);
  for (const child of children) ids.push(...await getAllDescendantIds(child.id));
  return ids;
}

// ─── EMPLOYEES ───
export async function getEmployees(orgNodeId?: string): Promise<EmployeeDetail[]> {
  let rows;
  if (orgNodeId) {
    const nodeIds = await getAllDescendantIds(orgNodeId);
    rows = await db.select().from(s.employees).where(and(inArray(s.employees.orgNodeId, nodeIds), eq(s.employees.isActive, true)));
  } else {
    rows = await db.select().from(s.employees).where(eq(s.employees.isActive, true));
  }
  const results: EmployeeDetail[] = [];
  for (const r of rows) {
    const ancestry = await getNodeAncestry(r.orgNodeId);
    results.push({ id:r.id, name:r.name, roleTitle:r.roleTitle, orgNodeId:r.orgNodeId, imageUrl:r.imageUrl, employmentType:r.employmentType as any, isActive:r.isActive!, userId:r.userId, managerId:r.managerId, hireDate:r.hireDate, departmentName:ancestry[0]?.name||"", orgPath:ancestry.map(n=>n.shortName) });
  }
  return results;
}
export async function getEmployee(id: string): Promise<EmployeeDetail|null> {
  const rows = await db.select().from(s.employees).where(eq(s.employees.id, id)).limit(1);
  const row = rows[0]; if (!row) return null;
  const ancestry = await getNodeAncestry(row.orgNodeId);
  return { id:row.id, name:row.name, roleTitle:row.roleTitle, orgNodeId:row.orgNodeId, imageUrl:row.imageUrl, employmentType:row.employmentType as any, isActive:row.isActive!, userId:row.userId, managerId:row.managerId, hireDate:row.hireDate, departmentName:ancestry[0]?.name||"", orgPath:ancestry.map(n=>n.shortName) };
}

// ─── CYCLES ───
export async function getCycles(): Promise<Cycle[]> {
  const rows = await db.select().from(s.assessmentCycles).orderBy(desc(s.assessmentCycles.year), desc(s.assessmentCycles.month));
  return rows.map(c => ({ ...c, status:c.status as any, label:`${MONTHS[c.month]} ${c.year}` }));
}
export async function getLatestClosedCycle(): Promise<Cycle|null> {
  const rows = await db.select().from(s.assessmentCycles).where(eq(s.assessmentCycles.status,"closed")).orderBy(desc(s.assessmentCycles.year),desc(s.assessmentCycles.month)).limit(1);
  const r = rows[0]; return r ? { ...r, status:r.status as any, label:`${MONTHS[r.month]} ${r.year}` } : null;
}
export async function getCurrentCycle(): Promise<Cycle|null> {
  const rows = await db.select().from(s.assessmentCycles).where(eq(s.assessmentCycles.status,"open")).orderBy(desc(s.assessmentCycles.year),desc(s.assessmentCycles.month)).limit(1);
  const r = rows[0]; return r ? { ...r, status:r.status as any, label:`${MONTHS[r.month]} ${r.year}` } : null;
}

// ─── READINESS (REAL-TIME) ───
export async function getEmployeeReadiness(empId: string, cycleId?: string): Promise<ReadinessProfile|null> {
  const emp = await getEmployee(empId); if (!emp) return null;
  const cycle = cycleId || (await getLatestClosedCycle())?.id; if (!cycle) return null;
  const aRows = await db.select().from(s.assessments).where(and(eq(s.assessments.employeeId, empId), eq(s.assessments.cycleId, cycle))).limit(1);
  const assessment = aRows[0]; if (!assessment) return null;
  const responses = await db.select().from(s.assessmentResponses).where(eq(s.assessmentResponses.assessmentId, assessment.id));
  const snapshot = JSON.parse(assessment.questionSnapshot);
  return { employeeId:emp.id, employeeName:emp.name, employeeRole:emp.roleTitle, orgNodeId:emp.orgNodeId, commitmentScore:assessment.commitmentScore, competencyScore:assessment.competencyScore, quadrant:assessment.quadrant as QuadrantLabel, responses:responses.map(r=>({questionId:r.questionId,dimension:r.dimension as any,score:r.score,notes:r.notes||undefined})), questionSnapshot:snapshot };
}
export async function getDepartmentReadiness(deptId: string, cycleId?: string): Promise<DepartmentReadiness> {
  const dept = await getOrgNode(deptId);
  const cycle = cycleId || (await getLatestClosedCycle())?.id;
  const employees = await getEmployees(deptId);
  const profiles: ReadinessProfile[] = [];
  if (cycle) { for (const emp of employees) { const r = await getEmployeeReadiness(emp.id, cycle); if (r) profiles.push(r); } }
  const scores = profiles.map(p => ({ commitment:p.commitmentScore, competency:p.competencyScore }));
  const agg = aggregateScores(scores);
  const dist = buildDistribution(profiles.map(p => p.quadrant));
  const gap = determineGap(agg.avgCommitment, agg.avgCompetency);
  return { departmentId:deptId, departmentName:dept?.name||"", shortName:dept?.shortName||"", headcount:dept?.headcount||0, avgCommitment:agg.avgCommitment, avgCompetency:agg.avgCompetency, gapDirection:gap, distribution:dist, totalAssessed:profiles.length, profiles };
}
export async function getOrgReadiness(cycleId?: string): Promise<OrgReadiness> {
  const departments = await getDepartments();
  const cycle = cycleId || (await getLatestClosedCycle())?.id;
  const deptReadiness: DepartmentReadiness[] = [];
  for (const d of departments) deptReadiness.push(await getDepartmentReadiness(d.id, cycle));
  const withData = deptReadiness.filter(d => d.totalAssessed > 0);
  const orgAvg = weightedOrgAverage(withData.map(d => ({ avgCommitment:d.avgCommitment, avgCompetency:d.avgCompetency, count:d.totalAssessed })));
  const totalDist: QuadrantDistribution = {"Star Performer":0,"Growth Potential":0,"Underutilized":0,"At Risk":0};
  for (const d of withData) for (const [q,n] of Object.entries(d.distribution)) totalDist[q as QuadrantLabel]+=n;
  const totalAssessed = withData.reduce((s,d)=>s+d.totalAssessed,0);
  return { avgCommitment:orgAvg.avgCommitment, avgCompetency:orgAvg.avgCompetency, gapDirection:determineGap(orgAvg.avgCommitment,orgAvg.avgCompetency), distribution:totalDist, totalAssessed, departments:deptReadiness };
}

// ─── ANALYTICS (HISTORICAL) ───
export async function getDepartmentHistory(deptId: string): Promise<MonthlyDeptStat[]> {
  const rows = await db.select().from(s.monthlyDepartmentStats).innerJoin(s.assessmentCycles, eq(s.monthlyDepartmentStats.cycleId,s.assessmentCycles.id)).where(eq(s.monthlyDepartmentStats.departmentNodeId,deptId)).orderBy(asc(s.assessmentCycles.year),asc(s.assessmentCycles.month));
  const dept = await getOrgNode(deptId);
  return rows.map(r => ({ departmentId:deptId, departmentName:dept?.name||"", cycleId:r.assessment_cycles.id, year:r.assessment_cycles.year, month:r.assessment_cycles.month, avgCommitment:r.monthly_department_stats.avgCommitment, avgCompetency:r.monthly_department_stats.avgCompetency, gapDirection:r.monthly_department_stats.gapDirection as GapDirection, distribution:JSON.parse(r.monthly_department_stats.quadrantDistribution), totalAssessed:r.monthly_department_stats.totalAssessed }));
}
export async function getEmployeeTrend(empId: string): Promise<EmployeeTrend> {
  const rows = await db.select().from(s.assessments).innerJoin(s.assessmentCycles, eq(s.assessments.cycleId,s.assessmentCycles.id)).where(eq(s.assessments.employeeId,empId)).orderBy(asc(s.assessmentCycles.year),asc(s.assessmentCycles.month));
  return { employeeId:empId, points:rows.map(r=>({ cycleId:r.assessment_cycles.id, year:r.assessment_cycles.year, month:r.assessment_cycles.month, commitmentScore:r.assessments.commitmentScore, competencyScore:r.assessments.competencyScore, quadrant:r.assessments.quadrant as QuadrantLabel })) };
}

// ─── UNRATED ───
export async function getUnratedEmployees(cycleId?: string) {
  const cycle = cycleId || (await getCurrentCycle())?.id || (await getLatestClosedCycle())?.id;
  if (!cycle) return [];
  const allEmps = await getEmployees();
  const assessed = await db.select({empId:s.assessments.employeeId}).from(s.assessments).where(eq(s.assessments.cycleId,cycle));
  const assessedIds = new Set(assessed.map(r=>r.empId));
  const unrated = allEmps.filter(e=>!assessedIds.has(e.id));
  const grouped = new Map<string,{dept:string;deptId:string;emps:EmployeeDetail[]}>();
  for (const emp of unrated) {
    const deptId = await getDeptIdForNode(emp.orgNodeId);
    const dept = await getOrgNode(deptId);
    const key = dept?.name||"Unknown";
    if (!grouped.has(key)) grouped.set(key,{dept:key,deptId,emps:[]});
    grouped.get(key)!.emps.push(emp);
  }
  return Array.from(grouped.values()).map(g=>({department:g.dept,deptId:g.deptId,employees:g.emps}));
}

// ─── QUESTIONS ───
export async function getQuestions(departmentId: string): Promise<Question[]> {
  const rows = await db.select().from(s.assessmentQuestions).where(and(eq(s.assessmentQuestions.departmentNodeId,departmentId),eq(s.assessmentQuestions.isActive,true))).orderBy(asc(s.assessmentQuestions.dimension),asc(s.assessmentQuestions.sortOrder));
  return rows.map(q=>({ id:q.id, departmentNodeId:q.departmentNodeId, dimension:q.dimension as any, questionText:q.questionText, weight:q.weight, sortOrder:q.sortOrder, isActive:q.isActive! }));
}

// ─── NOTIFICATIONS ───
export async function getNotifications(userId: string): Promise<Notification[]> {
  const rows = await db.select().from(s.notifications).where(eq(s.notifications.recipientId,userId)).orderBy(desc(s.notifications.createdAt));
  return rows.map(r=>({ id:r.id, type:r.type as any, title:r.title, message:r.message, data:r.data?JSON.parse(r.data):undefined, isRead:r.isRead!, createdAt:r.createdAt }));
}
export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await db.select({count:sql<number>`count(*)`}).from(s.notifications).where(and(eq(s.notifications.recipientId,userId),eq(s.notifications.isRead,false)));
  return rows[0]?.count || 0;
}

// ─── SETTINGS ───
export async function getSetting(key: string): Promise<any> {
  const rows = await db.select().from(s.settings).where(eq(s.settings.key,key)).limit(1);
  return rows[0] ? JSON.parse(rows[0].value) : null;
}
export async function getThreshold(): Promise<number> { return (await getSetting("quadrant_threshold")) ?? 7.0; }
