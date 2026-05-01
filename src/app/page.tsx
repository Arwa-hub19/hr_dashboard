"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import {
  LayoutDashboard, Building2, ClipboardCheck, Settings, ChevronRight, Search,
  TrendingUp, Award, Target, Zap, Shield, Users, AlertTriangle, BookOpen,
  CheckCircle, Bell, UserCircle, Menu, X, Calendar, Eye, EyeOff, ChevronDown,
  GitBranch, Clock, ArrowUpRight, ArrowDownRight, Minus, Star,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useDashboardStore } from "@/stores/dashboardStore";
import { cn, formatScore, getQuadrantBadgeClass, getScoreColor, getGapColor, formatMonth, formatMonthFull } from "@/lib/utils";
import type {
  OrgReadiness, DepartmentReadiness, ReadinessProfile, QuadrantLabel, GapDirection,
  QuadrantDistribution, EmployeeDetail, EmployeeTrend, MonthlyDeptStat, Cycle,
  Notification, OrgNode, OrgTreeNode, Question, InterventionRecommendation,
} from "@/lib/types";

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════ */
const Q_COLORS: Record<QuadrantLabel, string> = {
  "Star Performer": "#2d7a4f", "Growth Potential": "#3565a8",
  "Underutilized": "#b8860b", "At Risk": "#b33a3a",
};
const Q_BG: Record<QuadrantLabel, string> = {
  "Star Performer": "#2d7a4f12", "Growth Potential": "#3565a812",
  "Underutilized": "#b8860b12", "At Risk": "#b33a3a12",
};
const DEPT_PALETTE = ["#4a332a","#6b4a3d","#8b6352","#3565a8","#2d7a4f","#b8860b","#b33a3a",
  "#7c5cbf","#b8973a","#5a8a6e","#a05d3b","#6889a8","#9b6b8a","#708090"];

/* ═══════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════ */
function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: any }) {
  return (
    <div className="stat-card">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-brand-500 tracking-wide uppercase">{label}</span>
        {Icon && <Icon size={15} color={color || "#8b6352"} />}
      </div>
      <span className="font-display text-2xl font-bold" style={{ color: color || "#1a1210" }}>{value}</span>
      {sub && <span className="text-xs text-brand-400">{sub}</span>}
    </div>
  );
}

function QuadBadge({ quadrant, size = "md" }: { quadrant: QuadrantLabel; size?: "sm" | "md" | "lg" }) {
  const cls = size === "sm" ? "text-[10px] px-1.5 py-0.5" : size === "lg" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5";
  return <span className={cn("badge", getQuadrantBadgeClass(quadrant), cls)}>{quadrant}</span>;
}

function GapBadge({ gap }: { gap: GapDirection }) {
  const color = getGapColor(gap);
  return <span className="badge text-xs" style={{ background: color + "15", color }}>{gap}</span>;
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color = getScoreColor(score);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-brand-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold min-w-[24px] text-right" style={{ color }}>{score}</span>
    </div>
  );
}

function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-brand-400 flex-wrap mb-1">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={11} />}
          {item.onClick ? (
            <span onClick={item.onClick} className="text-brand-600 cursor-pointer hover:text-brand-800 transition-colors">{item.label}</span>
          ) : <span className="text-brand-500">{item.label}</span>}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-brand-300 mb-3"><Users size={36} className="mx-auto" /></div>
      <p className="text-sm text-brand-500 mb-4">{message}</p>
      {action && onAction && <button className="btn-primary text-xs" onClick={onAction}>{action}</button>}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CHART: Quadrant Scatter
   ═══════════════════════════════════════════════════ */
function QuadrantChart({ data, onDotClick, height = 340, threshold = 7 }: any) {
  const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-brand-100 rounded-lg p-3 shadow-lg text-xs font-body">
        <div className="font-semibold text-brand-900">{d.name}</div>
        <div className="text-brand-500">{d.role}</div>
        <div className="flex gap-3 mt-1.5">
          <span>C: <b className="text-brand-800">{d.y}</b></span>
          <span>K: <b className="text-brand-800">{d.x}</b></span>
        </div>
        <div className="mt-1"><QuadBadge quadrant={d.quadrant} size="sm" /></div>
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 15, bottom: 25, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8d5c930" />
        <XAxis type="number" dataKey="x" domain={[0, 10.5]} tick={{ fontFamily: "DM Sans", fontSize: 10, fill: "#a47e6b" }} label={{ value: "Competency →", position: "bottom", fontFamily: "DM Sans", fontSize: 11, fill: "#8b6352", offset: 0 }} />
        <YAxis type="number" dataKey="y" domain={[0, 10.5]} tick={{ fontFamily: "DM Sans", fontSize: 10, fill: "#a47e6b" }} label={{ value: "Commitment →", angle: -90, position: "left", fontFamily: "DM Sans", fontSize: 11, fill: "#8b6352" }} />
        <ReferenceLine x={threshold} stroke="#d4b8a8" strokeDasharray="6 4" strokeWidth={0.5} />
        <ReferenceLine y={threshold} stroke="#d4b8a8" strokeDasharray="6 4" strokeWidth={0.5} />
        <Tooltip content={<Tip />} />
        <Scatter data={data} onClick={(d: any) => onDotClick?.(d.employeeId)} cursor="pointer">
          {data.map((d: any, i: number) => <Cell key={i} fill={d.dotColor || Q_COLORS[d.quadrant as QuadrantLabel]} fillOpacity={0.8} r={5} stroke="#fff" strokeWidth={1.5} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════
   CHART: Distribution Donut
   ═══════════════════════════════════════════════════ */
function DonutChart({ distribution, height = 240 }: { distribution: QuadrantDistribution; height?: number }) {
  const data = Object.entries(distribution).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} cornerRadius={3}>
          {data.map((d, i) => <Cell key={i} fill={Q_COLORS[d.name as QuadrantLabel]} />)}
        </Pie>
        <Tooltip formatter={(v: any, name: string) => [`${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, name]} contentStyle={{ fontFamily: "DM Sans", fontSize: 12, borderRadius: 8 }} />
        <text x="50%" y="46%" textAnchor="middle" fontFamily="Playfair Display" fontSize={24} fontWeight={700} fill="#1a1210">{total}</text>
        <text x="50%" y="57%" textAnchor="middle" fontFamily="DM Sans" fontSize={10} fill="#a47e6b">assessed</text>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════
   CHART: Department Bars
   ═══════════════════════════════════════════════════ */
function DeptBarChart({ departments, onBarClick, height = 380 }: any) {
  const sorted = [...departments].filter((d: any) => d.totalAssessed > 0).sort((a: any, b: any) => ((b.avgCommitment + b.avgCompetency) / 2) - ((a.avgCommitment + a.avgCompetency) / 2));
  const data = sorted.map((d: any) => ({ name: d.shortName || d.departmentName, commitment: d.avgCommitment, competency: d.avgCompetency, id: d.departmentId }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 15, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#e8d5c920" horizontal={false} />
        <XAxis type="number" domain={[0, 10]} tick={{ fontFamily: "DM Sans", fontSize: 10, fill: "#a47e6b" }} />
        <YAxis type="category" dataKey="name" width={95} tick={{ fontFamily: "DM Sans", fontSize: 10, fill: "#6b4a3d", cursor: "pointer" }} />
        <Tooltip contentStyle={{ fontFamily: "DM Sans", fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="commitment" fill="#b8973a" radius={[0, 3, 3, 0]} name="Commitment" cursor="pointer" onClick={(d: any) => onBarClick?.(d.id)} />
        <Bar dataKey="competency" fill="#4a332a" radius={[0, 3, 3, 0]} name="Competency" cursor="pointer" onClick={(d: any) => onBarClick?.(d.id)} />
        <Legend wrapperStyle={{ fontFamily: "DM Sans", fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════
   CHART: Score Gauge (SVG)
   ═══════════════════════════════════════════════════ */
function ScoreGauge({ score, label, threshold = 7 }: { score: number; label: string; threshold?: number }) {
  const pct = (score / 10) * 100;
  const color = getScoreColor(score);
  const r = 48, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e8d5c9" strokeWidth="7" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x="60" y="55" textAnchor="middle" fontFamily="Playfair Display" fontSize="26" fontWeight="700" fill={color}>{formatScore(score)}</text>
        <text x="60" y="72" textAnchor="middle" fontFamily="DM Sans" fontSize="9" fill="#a47e6b">/ 10</text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{score >= threshold ? "High" : "Low"} {label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CHART: Trend Line
   ═══════════════════════════════════════════════════ */
function TrendChart({ data, height = 200 }: { data: { month: string; commitment: number; competency: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 15, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8d5c920" />
        <XAxis dataKey="month" tick={{ fontFamily: "DM Sans", fontSize: 10, fill: "#a47e6b" }} />
        <YAxis domain={[0, 10]} tick={{ fontFamily: "DM Sans", fontSize: 10, fill: "#a47e6b" }} />
        <Tooltip contentStyle={{ fontFamily: "DM Sans", fontSize: 12, borderRadius: 8 }} />
        <Line type="monotone" dataKey="commitment" stroke="#b8973a" strokeWidth={2} dot={{ r: 3 }} name="Commitment" />
        <Line type="monotone" dataKey="competency" stroke="#4a332a" strokeWidth={2} dot={{ r: 3 }} name="Competency" />
        <ReferenceLine y={7} stroke="#d4b8a8" strokeDasharray="4 4" strokeWidth={0.5} />
        <Legend wrapperStyle={{ fontFamily: "DM Sans", fontSize: 11 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: DASHBOARD (Organization Overview)
   ═══════════════════════════════════════════════════ */
function DashboardPage({ navigate }: { navigate: (p: string, params?: any) => void }) {
  const [org, setOrg] = useState<OrgReadiness | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cycleId?: string) => {
    setLoading(true);
    const [orgData, cycleData] = await Promise.all([api.orgReadiness(cycleId), api.cycles()]);
    setOrg(orgData);
    setCycles(cycleData);
    if (!selectedCycle && cycleData.length > 0) {
      const closed = cycleData.filter((c: Cycle) => c.status === "closed");
      if (closed.length > 0) setSelectedCycle(closed[0].id);
    }
    setLoading(false);
  }, [selectedCycle]);

  useEffect(() => { load(); }, []);

  const handleCycleChange = (cycleId: string) => { setSelectedCycle(cycleId); load(cycleId); };

  const scatterData = useMemo(() => {
    if (!org) return [];
    return org.departments.flatMap((d, di) =>
      d.profiles.map(p => ({
        x: p.competencyScore, y: p.commitmentScore, name: p.employeeName, role: p.employeeRole,
        quadrant: p.quadrant, employeeId: p.employeeId, dotColor: DEPT_PALETTE[di % DEPT_PALETTE.length],
      }))
    );
  }, [org]);

  if (loading || !org) return <Loader />;

  const gapIcon = org.gapDirection.includes("Competency") ? Target : org.gapDirection.includes("Motivation") ? Zap : CheckCircle;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="section-title">Organization Overview</h1>
          <p className="section-subtitle">Staff readiness across the Royal Opera House Muscat</p>
        </div>
        <select className="select-field w-auto min-w-[160px]" value={selectedCycle} onChange={e => handleCycleChange(e.target.value)}>
          {cycles.filter(c => c.status === "closed").map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Commitment" value={formatScore(org.avgCommitment)} icon={TrendingUp} color="#b8973a" sub="Organization avg" />
        <StatCard label="Competency" value={formatScore(org.avgCompetency)} icon={TrendingUp} color="#4a332a" sub="Organization avg" />
        <StatCard label="Assessed" value={org.totalAssessed} icon={Users} sub="of ~281 total staff" />
        <StatCard label="Gap Driver" value={org.gapDirection.replace(" Gap", "")} icon={gapIcon} color={getGapColor(org.gapDirection)} sub={org.gapDirection === "Balanced" ? "No significant gap" : "Trailing dimension"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-brand-800 mb-0.5">Readiness Quadrant</h3>
          <p className="text-xs text-brand-400 mb-3">Each dot is an employee — colored by department</p>
          <QuadrantChart data={scatterData} onDotClick={(id: string) => navigate("employee", { empId: id })} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-800 mb-3">Quadrant Distribution</h3>
          <DonutChart distribution={org.distribution} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            {(Object.entries(org.distribution) as [QuadrantLabel, number][]).map(([q, n]) => (
              <div key={q} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-sm" style={{ background: Q_COLORS[q] }} />
                <span className="text-brand-500">{q}:</span>
                <span className="font-semibold text-brand-800">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-brand-800 mb-0.5">Department Comparison</h3>
        <p className="text-xs text-brand-400 mb-2">Sorted by readiness — click to drill down</p>
        <DeptBarChart departments={org.departments} onBarClick={(id: string) => navigate("department", { deptId: id })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["Motivation Gap", "Competency Gap"] as const).map(gapType => {
          const depts = org.departments.filter(d => d.gapDirection === gapType && d.totalAssessed > 0);
          const color = getGapColor(gapType);
          return (
            <div key={gapType} className="card p-5" style={{ borderLeft: `3px solid ${color}` }}>
              <h4 className="text-xs font-semibold mb-3" style={{ color }}>Departments with {gapType}s</h4>
              {depts.length === 0
                ? <p className="text-xs text-brand-400">No departments in this category</p>
                : depts.map(d => (
                  <div key={d.departmentId} onClick={() => navigate("department", { deptId: d.departmentId })} className="flex justify-between items-center py-2 border-b border-brand-50 cursor-pointer hover:bg-brand-50/50 px-2 -mx-2 rounded transition-colors">
                    <span className="text-sm text-brand-800">{d.departmentName}</span>
                    <span className="text-xs text-brand-400">C:{formatScore(d.avgCommitment)} / K:{formatScore(d.avgCompetency)}</span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: DEPARTMENTS GRID
   ═══════════════════════════════════════════════════ */
function DepartmentsPage({ navigate }: { navigate: (p: string, params?: any) => void }) {
  const [departments, setDepartments] = useState<DepartmentReadiness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.orgReadiness().then(org => { setDepartments(org.departments); setLoading(false); });
  }, []);

  if (loading) return <Loader />;

  const sorted = [...departments].sort((a, b) => ((a.avgCommitment + a.avgCompetency) / 2) - ((b.avgCommitment + b.avgCompetency) / 2));

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="section-title">Departments</h1>
        <p className="section-subtitle">Sorted by readiness — weakest first for prioritization</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map(d => {
          const borderColor = getGapColor(d.gapDirection);
          return (
            <div key={d.departmentId} onClick={() => navigate("department", { deptId: d.departmentId })} className="card-hover p-5 cursor-pointer" style={{ borderLeft: `4px solid ${borderColor}` }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-brand-900">{d.departmentName}</h3>
                  <span className="text-xs text-brand-400">{d.headcount} staff · {d.totalAssessed} assessed</span>
                </div>
                <GapBadge gap={d.gapDirection} />
              </div>
              <div className="flex gap-6 mb-3">
                <div>
                  <span className="text-[10px] text-brand-400 uppercase tracking-wide">Commitment</span>
                  <div className="font-display text-xl font-bold text-brand-800">{d.totalAssessed > 0 ? formatScore(d.avgCommitment) : "—"}</div>
                </div>
                <div>
                  <span className="text-[10px] text-brand-400 uppercase tracking-wide">Competency</span>
                  <div className="font-display text-xl font-bold text-brand-800">{d.totalAssessed > 0 ? formatScore(d.avgCompetency) : "—"}</div>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(d.distribution) as [QuadrantLabel, number][]).filter(([, n]) => n > 0).map(([q, n]) => (
                  <span key={q} className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: Q_BG[q], color: Q_COLORS[q] }}>
                    {q.split(" ").map(w => w[0]).join("")}: {n}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: DEPARTMENT DRILLDOWN
   ═══════════════════════════════════════════════════ */
function DeptDrilldownPage({ deptId, navigate }: { deptId: string; navigate: (p: string, params?: any) => void }) {
  const [dept, setDept] = useState<DepartmentReadiness | null>(null);
  const [history, setHistory] = useState<MonthlyDeptStat[]>([]);
  const [children, setChildren] = useState<OrgNode[]>([]);
  const [search, setSearch] = useState("");
  const [qFilter, setQFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.deptReadiness(deptId),
      api.deptHistory(deptId),
      api.nodeChildren(deptId),
    ]).then(([d, h, c]) => { setDept(d); setHistory(h); setChildren(c); setLoading(false); });
  }, [deptId]);

  if (loading || !dept) return <Loader />;

  const scatterData = dept.profiles.map(p => ({
    x: p.competencyScore, y: p.commitmentScore, name: p.employeeName, role: p.employeeRole,
    quadrant: p.quadrant, employeeId: p.employeeId,
  }));

  const trendData = history.map(h => ({
    month: formatMonth(h.month, h.year), commitment: h.avgCommitment, competency: h.avgCompetency,
  }));

  const filtered = dept.profiles.filter(p => {
    const ms = !search || p.employeeName.toLowerCase().includes(search.toLowerCase()) || p.employeeRole.toLowerCase().includes(search.toLowerCase());
    const mq = qFilter === "All" || p.quadrant === qFilter;
    return ms && mq;
  });

  // Interventions
  const total = dept.totalAssessed;
  const interventions: { icon: any; title: string; desc: string; color: string }[] = [];
  if (total > 0) {
    if (dept.distribution["Growth Potential"] / total > 0.3) interventions.push({ icon: BookOpen, title: "Targeted Skills Training", desc: `${dept.distribution["Growth Potential"]} employees need skill development.`, color: "#3565a8" });
    if (dept.distribution["Underutilized"] / total > 0.3) interventions.push({ icon: Zap, title: "Engagement Initiative", desc: `${dept.distribution["Underutilized"]} skilled employees need re-engagement.`, color: "#b8860b" });
    if (dept.distribution["At Risk"] / total > 0.2) interventions.push({ icon: AlertTriangle, title: "Critical Attention Required", desc: `${dept.distribution["At Risk"]} employees require intervention.`, color: "#b33a3a" });
    if (dept.distribution["Star Performer"] / total > 0.6) interventions.push({ icon: Award, title: "Department Strength", desc: `${dept.distribution["Star Performer"]} star performers — consider mentoring.`, color: "#2d7a4f" });
  }

  return (
    <div className="space-y-6 page-enter">
      <Breadcrumb items={[
        { label: "Dashboard", onClick: () => navigate("dashboard") },
        { label: "Departments", onClick: () => navigate("departments") },
        { label: dept.departmentName },
      ]} />
      <div>
        <h1 className="section-title">{dept.departmentName}</h1>
        <p className="section-subtitle">{dept.headcount} staff{children.length > 0 && ` · ${children.length} sub-units: ${children.map((c: any) => c.shortName || c.name).join(", ")}`}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Commitment" value={formatScore(dept.avgCommitment)} color="#b8973a" />
        <StatCard label="Competency" value={formatScore(dept.avgCompetency)} color="#4a332a" />
        <StatCard label="Assessed" value={dept.totalAssessed} icon={Users} />
        <StatCard label="Gap Driver" value={dept.gapDirection.replace(" Gap", "")} color={getGapColor(dept.gapDirection)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-800 mb-2">Readiness Quadrant</h3>
          <QuadrantChart data={scatterData} onDotClick={(id: string) => navigate("employee", { empId: id })} height={300} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-800 mb-2">Score Trend</h3>
          {trendData.length > 0 ? <TrendChart data={trendData} height={300} /> : <EmptyState message="No historical data yet" />}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-brand-800">Employee Roster</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="input-field pl-8 py-2 text-xs w-48" />
            </div>
            <select value={qFilter} onChange={e => setQFilter(e.target.value)} className="select-field py-2 text-xs w-40">
              <option value="All">All Quadrants</option>
              {(["Star Performer", "Growth Potential", "Underutilized", "At Risk"] as const).map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-brand-100">
                {["Name", "Role", "Commitment", "Competency", "Quadrant"].map(h => <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-brand-500">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.employeeId} onClick={() => navigate("employee", { empId: p.employeeId })} className="border-b border-brand-50 cursor-pointer hover:bg-brand-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-brand-900">{p.employeeName}</td>
                  <td className="py-2.5 px-3 text-brand-500">{p.employeeRole}</td>
                  <td className="py-2.5 px-3 w-32"><ScoreBar score={p.commitmentScore} /></td>
                  <td className="py-2.5 px-3 w-32"><ScoreBar score={p.competencyScore} /></td>
                  <td className="py-2.5 px-3"><QuadBadge quadrant={p.quadrant} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {interventions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-brand-800 mb-3">Recommended Interventions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {interventions.map((int, i) => (
              <div key={i} className="card p-4 flex gap-3 items-start" style={{ borderLeft: `3px solid ${int.color}` }}>
                <int.icon size={18} color={int.color} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-brand-900">{int.title}</div>
                  <div className="text-xs text-brand-500 mt-0.5">{int.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: EMPLOYEE PROFILE
   ═══════════════════════════════════════════════════ */
function EmployeeProfilePage({ empId, navigate }: { empId: string; navigate: (p: string, params?: any) => void }) {
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [readiness, setReadiness] = useState<ReadinessProfile | null>(null);
  const [trend, setTrend] = useState<EmployeeTrend | null>(null);
  const [deptR, setDeptR] = useState<DepartmentReadiness | null>(null);
  const [orgR, setOrgR] = useState<OrgReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.employee(empId),
      api.employeeReadiness(empId),
      api.empTrend(empId),
      api.orgReadiness(),
    ]).then(async ([e, r, t, o]) => {
      setEmp(e); setReadiness(r); setTrend(t); setOrgR(o);
      if (e) { const d = await api.deptReadiness(e.orgPath?.[0] ? e.orgNodeId : e.orgNodeId); setDeptR(o.departments.find((dd: any) => dd.profiles.some((p: any) => p.employeeId === empId)) || null); }
      setLoading(false);
    });
  }, [empId]);

  if (loading || !emp) return <Loader />;

  const cQuestions = readiness?.questionSnapshot?.filter((q: any) => q.dimension === "commitment") || [];
  const kQuestions = readiness?.questionSnapshot?.filter((q: any) => q.dimension === "competency") || [];

  const trendData = trend?.points.map(p => ({
    month: formatMonth(p.month, p.year), commitment: p.commitmentScore, competency: p.competencyScore,
  })) || [];

  const allResponses = readiness?.responses || [];
  const sorted = [...allResponses].sort((a, b) => b.score - a.score);
  const strongest = sorted.slice(0, 2);
  const weakest = sorted.slice(-2).reverse();
  const getQText = (qId: string) => readiness?.questionSnapshot?.find((q: any) => q.id === qId)?.questionText || qId;

  let intervention = { title: "Ready for Growth", desc: "Star performer ready for stretch assignments and leadership.", color: "#2d7a4f", icon: Award };
  if (readiness) {
    if (readiness.commitmentScore < 7 && readiness.competencyScore >= 7) intervention = { title: "Engagement & Motivation Support", desc: "Has skills but needs re-engagement. Consider recognition and stretch projects.", color: "#b8860b", icon: Zap };
    else if (readiness.commitmentScore >= 7 && readiness.competencyScore < 7) intervention = { title: "Skills Development & Training", desc: "High motivation with skill gaps. Invest in targeted training and mentoring.", color: "#3565a8", icon: BookOpen };
    else if (readiness.commitmentScore < 7 && readiness.competencyScore < 7) intervention = { title: "Comprehensive Development Plan", desc: "Needs intervention across both dimensions. Close management support required.", color: "#b33a3a", icon: AlertTriangle };
  }

  return (
    <div className="space-y-6 page-enter">
      <Breadcrumb items={[
        { label: "Dashboard", onClick: () => navigate("dashboard") },
        { label: "Departments", onClick: () => navigate("departments") },
        { label: emp.departmentName, onClick: () => navigate("department", { deptId: emp.orgPath?.[0] || emp.orgNodeId }) },
        { label: emp.name },
      ]} />

      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="section-title">{emp.name}</h1>
          <p className="section-subtitle">{emp.roleTitle} · {emp.departmentName}</p>
        </div>
        {readiness && <QuadBadge quadrant={readiness.quadrant} size="lg" />}
      </div>

      {readiness ? (
        <>
          <div className="card p-6 flex justify-center items-center gap-12 flex-wrap">
            <ScoreGauge score={readiness.commitmentScore} label="Commitment" />
            <div className="flex flex-col items-center gap-1">
              <QuadBadge quadrant={readiness.quadrant} size="lg" />
              <span className="text-[10px] text-brand-400 mt-1">Classification</span>
            </div>
            <ScoreGauge score={readiness.competencyScore} label="Competency" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {([{ title: "Commitment Questions", qs: cQuestions, dim: "commitment" }, { title: "Competency Questions", qs: kQuestions, dim: "competency" }] as const).map(({ title, qs, dim }) => (
              <div key={dim} className="card p-5">
                <h3 className="text-sm font-semibold text-brand-800 mb-4">{title}</h3>
                <div className="space-y-3">
                  {qs.map((q: any) => {
                    const resp = readiness.responses.find(r => r.questionId === q.id);
                    const score = resp?.score || 0;
                    return (
                      <div key={q.id} className="pl-3" style={{ borderLeft: score < 5 ? "2px solid #b33a3a" : "2px solid transparent" }}>
                        <div className="text-xs text-brand-500 mb-1">{q.questionText}</div>
                        <ScoreBar score={score} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {trendData.length > 1 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-brand-800 mb-2">Score Trend Over Time</h3>
              <TrendChart data={trendData} />
            </div>
          )}

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-brand-800 mb-3">Comparative Context</h3>
            {([{ label: "Commitment", empScore: readiness.commitmentScore, deptAvg: deptR?.avgCommitment || 0, orgAvg: orgR?.avgCommitment || 0, color: "#b8973a" },
              { label: "Competency", empScore: readiness.competencyScore, deptAvg: deptR?.avgCompetency || 0, orgAvg: orgR?.avgCompetency || 0, color: "#4a332a" }
            ]).map(d => (
              <div key={d.label} className="mb-4">
                <div className="text-xs font-semibold text-brand-500 mb-2">{d.label}</div>
                {([{ label: emp.name, score: d.empScore, opacity: 1 }, { label: "Dept Avg", score: d.deptAvg, opacity: 0.5 }, { label: "Org Avg", score: d.orgAvg, opacity: 0.3 }]).map(row => (
                  <div key={row.label} className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-brand-400 w-16 text-right">{row.label}</span>
                    <div className="flex-1 h-2 bg-brand-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(row.score / 10) * 100}%`, background: d.color, opacity: row.opacity }} />
                    </div>
                    <span className="text-xs font-semibold min-w-[28px]" style={{ color: d.color }}>{formatScore(row.score)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4" style={{ borderTop: "3px solid #2d7a4f" }}>
              <h4 className="text-xs font-semibold text-quadrant-star mb-2 flex items-center gap-1"><Award size={13} /> Top Strengths</h4>
              {strongest.map(r => <div key={r.questionId} className="text-xs text-brand-500 mb-1.5">· {getQText(r.questionId)} <b className="text-quadrant-star">({r.score})</b></div>)}
            </div>
            <div className="card p-4" style={{ borderTop: "3px solid #b33a3a" }}>
              <h4 className="text-xs font-semibold text-quadrant-risk mb-2 flex items-center gap-1"><Target size={13} /> Development Areas</h4>
              {weakest.map(r => <div key={r.questionId} className="text-xs text-brand-500 mb-1.5">· {getQText(r.questionId)} <b className="text-quadrant-risk">({r.score})</b></div>)}
            </div>
            <div className="card p-4" style={{ borderLeft: `3px solid ${intervention.color}` }}>
              <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: intervention.color }}><intervention.icon size={13} /> Recommendation</h4>
              <div className="text-sm font-semibold text-brand-900 mb-1">{intervention.title}</div>
              <div className="text-xs text-brand-500">{intervention.desc}</div>
            </div>
          </div>
        </>
      ) : (
        <EmptyState message="No assessment data for this employee yet" action="Start Assessment" onAction={() => navigate("assess")} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: ASSESSMENT FORM
   ═══════════════════════════════════════════════════ */
function AssessPage({ navigate }: { navigate: (p: string, params?: any) => void }) {
  const [step, setStep] = useState(1);
  const [deptId, setDeptId] = useState("");
  const [empId, setEmpId] = useState("");
  const [departments, setDepartments] = useState<OrgNode[]>([]);
  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { api.departments().then(setDepartments); }, []);
  useEffect(() => { if (deptId) { api.employees(deptId).then(setEmployees); api.questions(deptId).then(setQuestions); } }, [deptId]);
  useEffect(() => { if (questions.length > 0) { const init: Record<string, number> = {}; questions.forEach(q => init[q.id] = 5); setScores(init); } }, [questions]);

  const emp = employees.find(e => e.id === empId);
  const cQs = questions.filter(q => q.dimension === "commitment");
  const kQs = questions.filter(q => q.dimension === "competency");

  const calcAvg = (qs: Question[]) => {
    if (qs.length === 0) return 0;
    const total = qs.reduce((s, q) => s + (scores[q.id] || 5) * q.weight, 0);
    const wSum = qs.reduce((s, q) => s + q.weight, 0);
    return Math.round((total / wSum) * 100) / 100;
  };
  const cScore = calcAvg(cQs);
  const kScore = calcAvg(kQs);
  const quad = cScore >= 7 && kScore >= 7 ? "Star Performer" : cScore >= 7 ? "Growth Potential" : kScore >= 7 ? "Underutilized" : "At Risk";

  const stepLabels = ["Select Employee", "Commitment", "Competency", "Review"];

  if (submitted) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 page-enter">
      <CheckCircle size={44} className="text-quadrant-star" />
      <h2 className="font-display text-2xl font-semibold text-brand-900">Assessment Submitted</h2>
      <p className="text-sm text-brand-500">{emp?.name} — <QuadBadge quadrant={quad as QuadrantLabel} /></p>
      <button className="btn-primary mt-2" onClick={() => navigate("department", { deptId })}>View Department</button>
    </div>
  );

  const SliderQ = ({ q }: { q: Question }) => (
    <div className="bg-surface-secondary rounded-lg p-4 mb-2.5">
      <div className="text-sm text-brand-800 mb-2.5">{q.questionText}</div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-brand-400">1</span>
        <input type="range" min="1" max="10" step="1" value={scores[q.id] || 5} onChange={e => setScores({ ...scores, [q.id]: parseInt(e.target.value) })} className="flex-1" />
        <span className="text-[10px] text-brand-400">10</span>
        <span className="font-display text-xl font-bold text-brand-800 min-w-[28px] text-center">{scores[q.id] || 5}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 page-enter max-w-2xl">
      <h1 className="section-title">New Assessment</h1>
      <div className="flex gap-0 items-center">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center" style={{ flex: i < 3 ? 1 : "none" }}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all", i + 1 <= step ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-400")}>
                {i + 1}
              </div>
              <span className={cn("text-[9px]", i + 1 <= step ? "text-brand-700" : "text-brand-400")}>{label}</span>
            </div>
            {i < 3 && <div className={cn("flex-1 h-0.5 mx-2 mb-4 transition-all", i + 2 <= step ? "bg-brand-700" : "bg-brand-100")} />}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-brand-500 block mb-1.5">Department</label>
              <select value={deptId} onChange={e => { setDeptId(e.target.value); setEmpId(""); }} className="select-field">
                <option value="">Select department…</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {deptId && (
              <div>
                <label className="text-xs font-semibold text-brand-500 block mb-1.5">Employee</label>
                <select value={empId} onChange={e => setEmpId(e.target.value)} className="select-field">
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.roleTitle}</option>)}
                </select>
              </div>
            )}
            {emp && (
              <div className="bg-surface-secondary rounded-lg p-4 border-l-3" style={{ borderLeft: "3px solid #4a332a" }}>
                <div className="font-semibold text-brand-900">{emp.name}</div>
                <div className="text-xs text-brand-500">{emp.roleTitle} · {emp.departmentName}</div>
              </div>
            )}
            <div className="flex justify-end">
              <button disabled={!empId} className="btn-primary" onClick={() => setStep(2)}>Next →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-base font-semibold text-brand-900 mb-1">Commitment Assessment</h3>
            <p className="text-xs text-brand-400 mb-4">Rate each question from 1 (Strongly Disagree) to 10 (Exceptional)</p>
            {cQs.map(q => <SliderQ key={q.id} q={q} />)}
            <div className="flex justify-between mt-4">
              <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn-primary" onClick={() => setStep(3)}>Next →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-base font-semibold text-brand-900 mb-1">Competency Assessment</h3>
            <p className="text-xs text-brand-400 mb-4">Rate each question from 1 (Strongly Disagree) to 10 (Exceptional)</p>
            {kQs.map(q => <SliderQ key={q.id} q={q} />)}
            <div className="flex justify-between mt-4">
              <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button className="btn-primary" onClick={() => setStep(4)}>Review →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="text-base font-semibold text-brand-900 mb-4">Review Assessment</h3>
            <div className="bg-surface-secondary rounded-lg p-4 mb-4">
              <div className="font-semibold text-brand-900">{emp?.name}</div>
              <div className="text-xs text-brand-500">{emp?.roleTitle} · {emp?.departmentName}</div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg" style={{ background: "#b8973a15" }}>
                <div className="text-[10px] text-brand-500">Commitment</div>
                <div className="font-display text-xl font-bold" style={{ color: "#b8973a" }}>{formatScore(cScore)}</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "#4a332a15" }}>
                <div className="text-[10px] text-brand-500">Competency</div>
                <div className="font-display text-xl font-bold" style={{ color: "#4a332a" }}>{formatScore(kScore)}</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: Q_BG[quad as QuadrantLabel] }}>
                <div className="text-[10px] text-brand-500 mb-1">Quadrant</div>
                <QuadBadge quadrant={quad as QuadrantLabel} size="sm" />
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button className="btn-secondary" onClick={() => setStep(3)}>← Back</button>
              <button className="btn-primary bg-quadrant-star hover:bg-quadrant-star/90" onClick={() => setSubmitted(true)}>Submit Assessment ✓</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: UNRATED TRACKER
   ═══════════════════════════════════════════════════ */
function UnratedPage({ navigate }: { navigate: (p: string, params?: any) => void }) {
  const [groups, setGroups] = useState<{ department: string; deptId: string; employees: EmployeeDetail[] }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.unrated().then(g => { setGroups(g); setLoading(false); }); }, []);

  if (loading) return <Loader />;
  const totalUnrated = groups.reduce((s, g) => s + g.employees.length, 0);

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="section-title">Unrated This Month</h1>
        <p className="section-subtitle">{totalUnrated} employees pending assessment in the current cycle</p>
      </div>
      {groups.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle size={36} className="mx-auto text-quadrant-star mb-3" />
          <p className="text-sm text-brand-500">All employees have been assessed this month.</p>
        </div>
      ) : groups.map(g => (
        <div key={g.deptId} className="card p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-brand-800">{g.department}</h3>
            <span className="badge bg-quadrant-risk-bg text-quadrant-risk">{g.employees.length} pending</span>
          </div>
          <div className="space-y-1.5">
            {g.employees.map(e => (
              <div key={e.id} className="flex justify-between items-center py-2 px-3 hover:bg-brand-50 rounded-lg cursor-pointer transition-colors" onClick={() => navigate("assess")}>
                <div>
                  <span className="text-sm font-medium text-brand-800">{e.name}</span>
                  <span className="text-xs text-brand-400 ml-2">{e.roleTitle}</span>
                </div>
                <span className="text-xs text-brand-500 flex items-center gap-1"><Clock size={11} /> Rate now →</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: NOTIFICATIONS
   ═══════════════════════════════════════════════════ */
function NotificationsPage({ navigate }: { navigate: (p: string, params?: any) => void }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { demoUserId } = useDashboardStore();

  useEffect(() => {
    api.notifications(demoUserId).then(n => { setNotifs(n); setLoading(false); });
  }, [demoUserId]);

  if (loading) return <Loader />;

  const iconMap: Record<string, any> = { review_submitted: ClipboardCheck, star_performer: Star, low_score_alert: AlertTriangle, cycle_reminder: Calendar };
  const colorMap: Record<string, string> = { review_submitted: "#3565a8", star_performer: "#b8973a", low_score_alert: "#b33a3a", cycle_reminder: "#4a332a" };

  return (
    <div className="space-y-6 page-enter">
      <h1 className="section-title">Notifications</h1>
      {notifs.length === 0 ? <EmptyState message="No notifications yet" /> : (
        <div className="space-y-2">
          {notifs.map(n => {
            const Icon = iconMap[n.type] || Bell;
            const color = colorMap[n.type] || "#6b4a3d";
            return (
              <div key={n.id} className={cn("card p-4 flex gap-3 items-start", !n.isRead && "border-l-[3px]")} style={!n.isRead ? { borderLeftColor: color } : {}}>
                <Icon size={16} color={color} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-brand-900">{n.title}</div>
                  <div className="text-xs text-brand-500 mt-0.5">{n.message}</div>
                  <div className="text-[10px] text-brand-400 mt-1.5">{new Date(n.createdAt).toLocaleDateString()}</div>
                </div>
                {!n.isRead && <div className="w-2 h-2 rounded-full bg-quadrant-risk mt-1.5 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: ORG CHART
   ═══════════════════════════════════════════════════ */
function OrgChartPage({ navigate }: { navigate: (p: string, params?: any) => void }) {
  const [tree, setTree] = useState<OrgTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { api.orgTree().then(t => { setTree(t); setLoading(false); }); }, []);

  if (loading) return <Loader />;

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const renderNode = (node: OrgTreeNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const levelColors = ["#4a332a", "#6b4a3d", "#8b6352"];
    const color = levelColors[depth] || "#a47e6b";

    return (
      <div key={node.id} style={{ marginLeft: depth * 24 }}>
        <div className="flex items-center gap-2 py-1.5 px-3 hover:bg-brand-50 rounded-lg cursor-pointer transition-colors group" onClick={() => hasChildren ? toggle(node.id) : navigate("department", { deptId: node.id })}>
          {hasChildren ? (
            <ChevronRight size={13} className={cn("text-brand-400 transition-transform", isExpanded && "rotate-90")} />
          ) : <div className="w-3.5" />}
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
          <span className="text-sm font-medium text-brand-800">{node.name}</span>
          <span className="text-xs text-brand-400 ml-auto">{node.headcount} staff</span>
          <span className="badge text-[9px] bg-brand-50 text-brand-500">{node.level.replace("_", " ")}</span>
        </div>
        {hasChildren && isExpanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="section-title">Organization Chart</h1>
        <p className="section-subtitle">ROHM organizational hierarchy — click to expand, drill into departments</p>
      </div>
      <div className="card p-4">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE: SETTINGS
   ═══════════════════════════════════════════════════ */
function SettingsPage() {
  const [threshold, setThreshold] = useState(7.0);
  useEffect(() => { api.threshold().then(d => setThreshold(d.threshold)); }, []);

  return (
    <div className="space-y-6 page-enter max-w-xl">
      <h1 className="section-title">Settings</h1>
      <div className="card p-6">
        <h3 className="text-base font-semibold text-brand-900 mb-1">Scoring Configuration</h3>
        <p className="text-xs text-brand-400 mb-5">Adjust the threshold that defines "High" vs "Low" on each dimension</p>
        <div className="flex items-center gap-4 mb-5">
          <span className="text-xs text-brand-400">5.0</span>
          <input type="range" min="5" max="9" step="0.5" value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} className="flex-1" />
          <span className="text-xs text-brand-400">9.0</span>
          <span className="font-display text-2xl font-bold text-brand-800 min-w-[36px] text-center">{threshold}</span>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-base font-semibold text-brand-900 mb-1">Scoring Formula</h3>
        <p className="text-xs text-brand-400 mb-4">Weighted arithmetic mean — self-normalizing across any number of questions</p>
        <div className="bg-brand-950 rounded-lg p-4 font-mono text-sm text-brand-200">
          <div>Score = Σ(score<sub>i</sub> × weight<sub>i</sub>) / Σ(weight<sub>i</sub>)</div>
          <div className="text-brand-600 mt-2">// Works with any number of questions</div>
          <div className="text-brand-600">// Weights default to 1.0 (simple average)</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CONFETTI WELCOME (Naim's first login)
   ═══════════════════════════════════════════════════ */
function WelcomeModal({ name, onClose }: { name: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadConfetti = async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#b8973a", "#4a332a", "#d4b95c", "#2d7a4f", "#ffffff"] });
        setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } }), 250);
        setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } }), 400);
      } catch {}
    };
    loadConfetti();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div ref={canvasRef} className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="text-4xl mb-4">🎭</div>
        <h2 className="font-display text-2xl font-bold text-brand-900 mb-2">Welcome to ROHM, {name}!</h2>
        <p className="text-sm text-brand-500 mb-6">Your HR Readiness Dashboard is ready. Explore your organization's staff readiness, identify gaps, and direct the right interventions.</p>
        <button className="btn-primary w-full" onClick={onClose}>Let's Get Started</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN APPLICATION SHELL
   ═══════════════════════════════════════════════════ */
export default function AppShell() {
  const { demoRole, demoUserName, setDemoRole } = useDashboardStore();
  const [route, setRoute] = useState<{ page: string; deptId?: string; empId?: string }>({ page: "dashboard" });
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Check welcome flag for Naim
    const welcomed = localStorage.getItem("rohm_welcomed");
    if (!welcomed && demoRole === "admin") {
      setShowWelcome(true);
      localStorage.setItem("rohm_welcomed", "true");
    }
  }, [demoRole]);

  useEffect(() => {
    api.unreadCount(useDashboardStore.getState().demoUserId).then(d => setUnreadCount(d.count)).catch(() => {});
  }, [route]);

  const navigate = useCallback((page: string, params?: any) => {
    setRoute({ page, ...params });
    setMobileMenu(false);
    window.scrollTo(0, 0);
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "departments", label: "Departments", icon: Building2 },
    { id: "orgchart", label: "Org Chart", icon: GitBranch },
    { id: "assess", label: "New Assessment", icon: ClipboardCheck },
    { id: "unrated", label: "Unrated Tracker", icon: Clock },
    ...(demoRole === "admin" ? [
      { id: "notifications", label: "Notifications", icon: Bell, badge: unreadCount },
      { id: "settings", label: "Settings", icon: Settings },
    ] : []),
  ];

  const isActive = (id: string) => route.page === id || (id === "departments" && ["department", "employee"].includes(route.page));

  const renderPage = () => {
    switch (route.page) {
      case "dashboard": return <DashboardPage navigate={navigate} />;
      case "departments": return <DepartmentsPage navigate={navigate} />;
      case "department": return <DeptDrilldownPage deptId={route.deptId!} navigate={navigate} />;
      case "employee": return <EmployeeProfilePage empId={route.empId!} navigate={navigate} />;
      case "assess": return <AssessPage navigate={navigate} />;
      case "unrated": return <UnratedPage navigate={navigate} />;
      case "notifications": return <NotificationsPage navigate={navigate} />;
      case "orgchart": return <OrgChartPage navigate={navigate} />;
      case "settings": return <SettingsPage />;
      default: return <DashboardPage navigate={navigate} />;
    }
  };

  return (
    <div className="flex min-h-screen font-body">
      {showWelcome && <WelcomeModal name={demoUserName.split(" ")[0]} onClose={() => setShowWelcome(false)} />}

      {/* Mobile overlay */}
      {mobileMenu && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setMobileMenu(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 h-screen w-[220px] bg-brand-950 flex flex-col z-40 transition-transform duration-200",
        mobileMenu ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-5 pb-4 border-b border-brand-800/30">
          <div className="font-display text-lg font-bold text-white tracking-wider">ROHM</div>
          <div className="text-[10px] font-medium text-accent-gold tracking-wide mt-0.5">HR READINESS DASHBOARD</div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(item => (
            <div key={item.id} onClick={() => navigate(item.id)} className={cn(
              "flex items-center gap-2.5 px-5 py-2.5 cursor-pointer transition-all text-sm",
              isActive(item.id)
                ? "border-l-[3px] border-accent-gold bg-brand-800/40 text-white font-medium"
                : "border-l-[3px] border-transparent text-brand-300 hover:text-white hover:bg-brand-800/20"
            )}>
              <item.icon size={16} />
              <span>{item.label}</span>
              {(item as any).badge > 0 && <span className="ml-auto bg-quadrant-risk text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{(item as any).badge}</span>}
            </div>
          ))}
        </nav>

        {/* Role switcher */}
        <div className="p-4 border-t border-brand-800/30">
          <div className="text-[10px] text-brand-500 uppercase tracking-wide mb-2">Demo Mode</div>
          <div className="flex gap-1.5">
            {(["admin", "manager"] as const).map(role => (
              <button key={role} onClick={() => setDemoRole(role)} className={cn(
                "flex-1 text-[10px] py-1.5 rounded-md font-medium transition-all capitalize",
                demoRole === role ? "bg-accent-gold text-brand-950" : "bg-brand-800/40 text-brand-400 hover:text-white"
              )}>{role}</button>
            ))}
          </div>
          <div className="text-[10px] text-brand-500 mt-2 truncate">{demoUserName}</div>
          <div className="text-[9px] text-brand-600 mt-1">Beta v0.1</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-surface-primary/80 backdrop-blur-md border-b border-brand-100/40 px-6 py-3 flex items-center justify-between">
          <button className="lg:hidden p-1" onClick={() => setMobileMenu(true)}><Menu size={20} className="text-brand-600" /></button>
          <div className="text-xs text-brand-400 hidden lg:block">Royal Opera House Oman — Staff Readiness Assessment</div>
          <div className="flex items-center gap-3">
            {demoRole === "admin" && (
              <button onClick={() => navigate("notifications")} className="relative p-1.5 hover:bg-brand-50 rounded-lg transition-colors">
                <Bell size={16} className="text-brand-500" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-quadrant-risk text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">{unreadCount}</span>}
              </button>
            )}
            <div className="flex items-center gap-2 pl-3 border-l border-brand-100">
              <UserCircle size={18} className="text-brand-400" />
              <span className="text-xs text-brand-600 font-medium hidden sm:inline">{demoUserName}</span>
              <span className="badge text-[9px] bg-brand-50 text-brand-500 capitalize">{demoRole}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 lg:p-8 max-w-[1200px]" key={route.page + route.deptId + route.empId}>
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
