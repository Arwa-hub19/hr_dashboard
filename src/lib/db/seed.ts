import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { v4 as uuid } from "uuid";
import { calculateDimensionScore, classifyQuadrant, determineGap, buildDistribution, aggregateScores } from "../services/scoring";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error("TURSO_DATABASE_URL is not set");

const client = createClient({ url, authToken });
const db = drizzle(client, { schema });

let _seed = 42;
function rand() { _seed = (_seed * 16807 + 0) % 2147483647; return (_seed - 1) / 2147483646; }
function clamp(v: number, lo = 1, hi = 10) { return Math.max(lo, Math.min(hi, Math.round(v))); }
const now = new Date().toISOString();

async function seed() {
  console.log("🌱 Seeding HR Readiness database...\n");

  // Create tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, org_node_id TEXT, image_url TEXT, has_seen_welcome INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS org_nodes (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL, level TEXT NOT NULL, parent_id TEXT, headcount INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, role_title TEXT NOT NULL, org_node_id TEXT NOT NULL, manager_id TEXT, image_url TEXT, hire_date TEXT NOT NULL, employment_type TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assessment_questions (id TEXT PRIMARY KEY, department_node_id TEXT NOT NULL, dimension TEXT NOT NULL, question_text TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1.0, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assessment_cycles (id TEXT PRIMARY KEY, year INTEGER NOT NULL, month INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', opens_at TEXT NOT NULL, closes_at TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS year_month_idx ON assessment_cycles (year, month);
    CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, assessor_id TEXT NOT NULL, cycle_id TEXT NOT NULL, commitment_score REAL NOT NULL, competency_score REAL NOT NULL, quadrant TEXT NOT NULL, question_snapshot TEXT NOT NULL, submitted_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS emp_cycle_idx ON assessments (employee_id, cycle_id);
    CREATE TABLE IF NOT EXISTS assessment_responses (id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, question_id TEXT NOT NULL, dimension TEXT NOT NULL, score INTEGER NOT NULL, notes TEXT);
    CREATE TABLE IF NOT EXISTS monthly_department_stats (id TEXT PRIMARY KEY, department_node_id TEXT NOT NULL, cycle_id TEXT NOT NULL, avg_commitment REAL NOT NULL, avg_competency REAL NOT NULL, gap_direction TEXT NOT NULL, quadrant_distribution TEXT NOT NULL, total_assessed INTEGER NOT NULL, total_employees INTEGER NOT NULL, computed_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS dept_cycle_stats_idx ON monthly_department_stats (department_node_id, cycle_id);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, data TEXT, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);

  // Clear data
  await client.executeMultiple(`
    DELETE FROM assessment_responses; DELETE FROM assessments; DELETE FROM monthly_department_stats;
    DELETE FROM assessment_cycles; DELETE FROM assessment_questions; DELETE FROM notifications;
    DELETE FROM employees; DELETE FROM users; DELETE FROM org_nodes; DELETE FROM settings;
  `);

  // ─── ORG NODES ───
  console.log("  📁 Creating org hierarchy...");
  type N = { id: string; name: string; short: string; level: string; parentId: string | null; hc: number; sort: number };
  const nodes: N[] = [];
  let si = 0;
  function addDept(id: string, name: string, short: string, hc: number, subs: any[]) {
    nodes.push({ id, name, short, level: "department", parentId: null, hc, sort: si++ });
    for (const s of subs) {
      nodes.push({ id: s.id, name: s.name, short: s.short, level: "sub_department", parentId: id, hc: s.hc, sort: si++ });
      for (const u of s.units || []) nodes.push({ id: u.id, name: u.name, short: u.short, level: "unit", parentId: s.id, hc: u.hc, sort: si++ });
    }
  }
  addDept("dg-office","Director General Office","DG Office",17,[{id:"dg-coord",name:"Coordination, Translation & Archive",short:"Coord",hc:10},{id:"dg-board",name:"Secretary to the Board",short:"Board",hc:7}]);
  addDept("exhibitions-library","Exhibitions & Music Library","Exhibitions",11,[{id:"exhibitions",name:"Exhibitions",short:"Exhibitions",hc:3},{id:"music-library",name:"Music Library",short:"Music Library",hc:5},{id:"exlib-support",name:"Coordination & Support",short:"Support",hc:3}]);
  addDept("admin-finance","Administration & Finance Directorate","Admin & Finance",58,[{id:"admin-general",name:"Administration",short:"Admin",hc:26},{id:"financial-affairs",name:"Financial Affairs",short:"Finance",hc:18},{id:"info-technology",name:"Information Technology",short:"IT",hc:14}]);
  addDept("contracts-procurement","Contracts & Procurement","Contracts",18,[{id:"contracts-legal",name:"Contracts & Legal",short:"Contracts",hc:5},{id:"procurement",name:"Procurement",short:"Procurement",hc:10},{id:"logistics",name:"Logistics & Clearance",short:"Logistics",hc:3}]);
  addDept("human-resources","Human Resources","HR",9,[{id:"hr-recruitment",name:"Recruitment",short:"Recruitment",hc:4},{id:"hr-training",name:"Training",short:"Training",hc:2},{id:"hr-health-safety",name:"Health & Safety",short:"H&S",hc:3}]);
  addDept("education-engagement","Education & Community Engagement","Education",5,[{id:"education",name:"Education",short:"Education",hc:3},{id:"outreach",name:"Outreach & Audience Engagement",short:"Outreach",hc:2}]);
  addDept("artistic-western","Artistic Western Programming","Western Arts",6,[]);
  addDept("artistic-arabic","Artistic Arabic Programming","Arabic Arts",4,[]);
  addDept("production-events","Production & Events","Production",12,[{id:"rehearsals",name:"Rehearsals & Production",short:"Rehearsals",hc:8},{id:"travel-accom",name:"Travel & Accommodation",short:"Travel",hc:4}]);
  addDept("marketing","Marketing Directorate","Marketing",60,[{id:"core-marketing",name:"Core Marketing",short:"Core",hc:3},{id:"sales-advertising",name:"Sales & Advertising",short:"Sales",hc:3},{id:"front-of-house",name:"Front of House & Box Office",short:"FOH",hc:45},{id:"design-branding",name:"Design & Branding",short:"Design",hc:4},{id:"press-media",name:"Press & Media",short:"Press",hc:3}]);
  addDept("technical","Technical Department","Technical",62,[{id:"stage",name:"Stage",short:"Stage",hc:30},{id:"sound-broadcast",name:"Sound & Broadcast",short:"Sound",hc:12},{id:"lighting",name:"Lighting",short:"Lighting",hc:12},{id:"costume-wardrobe",name:"Costume & Wardrobe",short:"Costume",hc:8}]);
  addDept("facility-management","Facility Management","Facilities",18,[{id:"maintenance",name:"Maintenance & Engineering",short:"Maintenance",hc:12},{id:"support-services",name:"Support Services",short:"Support",hc:3},{id:"surveying",name:"Surveying & Drafting",short:"Surveying",hc:3}]);
  addDept("retail-bizdev","Retail & Business Development","Retail",2,[]);
  addDept("security","Security Unit","Security",1,[]);

  for (const n of nodes) {
    await db.insert(schema.orgNodes).values({ id:n.id, name:n.name, shortName:n.short, level:n.level as any, parentId:n.parentId, headcount:n.hc, sortOrder:n.sort, createdAt:now });
  }

  // ─── USERS ───
  console.log("  👤 Creating users...");
  const adminId = "admin-001";
  await db.insert(schema.users).values([
    { id:adminId, email:"naim@rohm.om", passwordHash:"$demo$", name:"Naim Al-Busaidi", role:"admin", orgNodeId:null, hasSeenWelcome:false, createdAt:now },
    { id:"mgr-001", email:"samira@rohm.om", passwordHash:"$demo$", name:"Samira Al-Balushi", role:"manager", orgNodeId:"marketing", hasSeenWelcome:false, createdAt:now },
  ]);

  // ─── EMPLOYEES ───
  console.log("  🧑‍💼 Creating employees...");
  type E = { id:string; name:string; role:string; node:string; type?:string };
  const emps: E[] = [
    {id:"E001",name:"Khalid Al-Busaidi",role:"Executive Coordinator",node:"dg-coord"},
    {id:"E002",name:"Maryam Al-Lawati",role:"Senior Translator",node:"dg-coord"},
    {id:"E003",name:"Fatima Al-Hinai",role:"Board Secretary",node:"dg-board"},
    {id:"E004",name:"Sara Al-Rashdi",role:"Curator",node:"exhibitions"},
    {id:"E005",name:"Nasser Al-Maskari",role:"Music Librarian",node:"music-library"},
    {id:"E006",name:"Layla Al-Siyabi",role:"Archive Assistant",node:"exlib-support",type:"part_time"},
    {id:"E007",name:"Mohammed Al-Kindi",role:"Finance Manager",node:"financial-affairs"},
    {id:"E008",name:"Aisha Al-Zadjali",role:"Budget Analyst",node:"financial-affairs"},
    {id:"E009",name:"Sultan Al-Harthi",role:"IT Infrastructure Lead",node:"info-technology"},
    {id:"E010",name:"Huda Al-Balushi",role:"Personnel Officer",node:"admin-general"},
    {id:"E011",name:"Yusuf Al-Farsi",role:"Contracts Manager",node:"contracts-legal"},
    {id:"E012",name:"Noora Al-Abri",role:"Procurement Officer",node:"procurement"},
    {id:"E013",name:"Ahmed Al-Wahaibi",role:"Logistics Coordinator",node:"logistics"},
    {id:"E014",name:"Salma Al-Riyami",role:"HR Manager",node:"hr-recruitment"},
    {id:"E015",name:"Hassan Al-Mamari",role:"Training Specialist",node:"hr-training"},
    {id:"E016",name:"Zahra Al-Habsi",role:"Health & Safety Officer",node:"hr-health-safety"},
    {id:"E017",name:"Amira Al-Ghafri",role:"Education Coordinator",node:"education"},
    {id:"E018",name:"Tariq Al-Maskari",role:"Outreach Specialist",node:"outreach"},
    {id:"E019",name:"Jean-Pierre Dubois",role:"Programme Director",node:"artistic-western"},
    {id:"E020",name:"Elena Rossi",role:"Artist Liaison",node:"artistic-western",type:"contract"},
    {id:"E021",name:"Abdulrahman Al-Rawahi",role:"Arabic Programme Director",node:"artistic-arabic"},
    {id:"E022",name:"Nawal Al-Kindi",role:"Cultural Coordinator",node:"artistic-arabic"},
    {id:"E023",name:"James Mitchell",role:"Production Manager",node:"rehearsals"},
    {id:"E024",name:"Ruqaya Al-Jabri",role:"Travel Coordinator",node:"travel-accom"},
    {id:"E025",name:"Anna Schmidt",role:"Stage Manager",node:"rehearsals",type:"contract"},
    {id:"E026",name:"Samira Al-Balushi",role:"Marketing Director",node:"core-marketing"},
    {id:"E027",name:"Omar Al-Habsi",role:"Sales Manager",node:"sales-advertising"},
    {id:"E028",name:"Rana Al-Suleimani",role:"Front of House Manager",node:"front-of-house"},
    {id:"E029",name:"Mariam Al-Nabhani",role:"Graphic Designer",node:"design-branding"},
    {id:"E030",name:"Saif Al-Toubi",role:"Press Officer",node:"press-media"},
    {id:"E031",name:"David Thompson",role:"Technical Director",node:"stage"},
    {id:"E032",name:"Ali Al-Rawas",role:"Sound Engineer",node:"sound-broadcast"},
    {id:"E033",name:"Marco Bianchi",role:"Lighting Designer",node:"lighting"},
    {id:"E034",name:"Khadija Al-Busaidi",role:"Wardrobe Supervisor",node:"costume-wardrobe"},
    {id:"E035",name:"Ricardo Silva",role:"Stage Technician",node:"stage",type:"contract"},
    {id:"E036",name:"Ibrahim Al-Hinai",role:"Facilities Manager",node:"maintenance"},
    {id:"E037",name:"Rashid Al-Lawati",role:"HVAC Technician",node:"maintenance"},
    {id:"E038",name:"Sami Al-Ghafri",role:"Surveyor",node:"surveying"},
    {id:"E039",name:"Badr Al-Riyami",role:"Retail Manager",node:"retail-bizdev"},
    {id:"E040",name:"Yahya Al-Farsi",role:"Security Chief",node:"security"},
    {id:"E041",name:"Thuraya Al-Rashdi",role:"Box Office Supervisor",node:"front-of-house"},
    {id:"E042",name:"Hamad Al-Jabri",role:"Rigging Specialist",node:"stage"},
  ];
  for (const e of emps) {
    await db.insert(schema.employees).values({ id:e.id, name:e.name, roleTitle:e.role, orgNodeId:e.node, employmentType:(e.type||"full_time") as any, hireDate:"2023-01-15", isActive:true, createdAt:now });
  }

  // ─── QUESTIONS ───
  console.log("  ❓ Creating assessment questions...");
  const QS: Record<string, {c:string[]; k:string[]}> = {
    "dg-office": { c:["Demonstrates discretion with sensitive executive communications","Takes initiative coordinating cross-departmental correspondence","Meets tight deadlines for Board documentation","Shows ownership over translation quality","Flags coordination gaps proactively"], k:["Produces accurate Arabic/English translations","Prepares Board agendas and resolutions independently","Maintains organized archive system","Understands diplomatic correspondence protocols","Manages the DG's calendar with sound judgment"] },
    "exhibitions-library": { c:["Shows enthusiasm for curating cultural content","Suggests new exhibition themes or acquisitions","Maintains spaces without supervision","Follows through on installation schedules","Supports cross-functional events"], k:["Plans exhibitions from concept to installation","Maintains accurate cataloguing","Understands preservation standards","Demonstrates knowledge of regional arts","Prepares publishable write-ups"] },
    "admin-finance": { c:["Demonstrates accountability for financial accuracy","Proactively identifies inefficiencies","Adheres to audit requirements","Takes ownership through resolution","Responds promptly to queries"], k:["Proficient in budget preparation","Processes payments independently","Understands financial compliance","Manages IT infrastructure effectively","Produces accurate financial statements"] },
    "contracts-procurement": { c:["Ensures procurement transparency","Tracks milestones proactively","Resolves supplier issues","Maintains complete documentation","Expedites urgent requests"], k:["Drafts contracts to legal standards","Understands tendering regulations","Manages customs clearance","Evaluates supplier performance","Demonstrates cost analysis knowledge"] },
    "human-resources": { c:["Treats matters with confidentiality","Identifies development opportunities","Follows recruitment timelines","Shows investment in safety","Takes ownership of onboarding"], k:["Manages recruitment cycles independently","Demonstrates labor law knowledge","Designs training programs","Enforces health and safety standards","Maintains accurate HR records"] },
    "education-engagement": { c:["Passionate about accessible arts education","Develops outreach proposals","Manages workshops reliably","Builds community partnerships","Maintains energy during outreach"], k:["Designs workshops for varied ages","Understands impact measurement","Produces educational materials","Demonstrates cultural context knowledge","Plans events aligned with mission"] },
    "artistic-western": { c:["Dedicated to world-class programming","Researches artists for future seasons","Follows through on commitments","Seeks feedback to refine choices","Adapts to rapid replanning"], k:["Deep knowledge of Western performing arts","Negotiates artist terms independently","Assesses production feasibility","Manages planning timelines","Prepares programme notes"] },
    "artistic-arabic": { c:["Dedicated to elevating Arabic arts","Identifies emerging Arab artists","Builds regional relationships","Manages logistics reliably","Maintains off-season enthusiasm"], k:["Deep knowledge of Arabic music","Curates balanced programming","Understands regional contracts","Prepares bilingual materials","Incorporates audience feedback"] },
    "production-events": { c:["Reliable during long production days","Takes ownership of schedules","Flexible with rescheduling","Follows through on travel arrangements","Communicates updates to stakeholders"], k:["Manages multi-day schedules independently","Handles travel logistics accurately","Understands production workflows","Manages event budgets","Resolves operational issues"] },
    "marketing": { c:["Pitches campaign ideas proactively","Takes ownership of audience experience","Reliable during launch periods","Monitors brand consistency","Professional in front-of-house"], k:["Plans multi-channel campaigns","Proficient in box office systems","Produces quality design assets","Manages press relationships","Uses analytics for strategy"] },
    "technical": { c:["Zero-compromise on safety","Reliable during performances","Proactive equipment maintenance","Composure under pressure","Communicates technical risks"], k:["Operates stage machinery independently","Proficient in sound engineering","Executes lighting plots safely","Interprets technical riders","Follows safety protocols"] },
    "facility-management": { c:["Reports building issues proactively","Responds to requests promptly","Reliable preventive maintenance","Pride in facility standards","Adapts to event calendars"], k:["Diagnoses and repairs systems","Understands BMS","Produces accurate measurements","Coordinates external contractors","Knowledge of fire safety"] },
    "retail-bizdev": { c:["Identifies revenue opportunities","Takes ownership of presentation","Follows through on leads","Proposes brand-aligned merchandise","Maintains enthusiasm"], k:["Manages retail operations","Understands revenue forecasting","Produces business cases","Demonstrates merchandising principles","Tracks commercial KPIs"] },
    "security": { c:["Unwavering vigilance","Reports risks proactively","Coordinates external security","Professional during VIP events","Enforces access control"], k:["Implements emergency procedures","Manages CCTV and reporting","Crowd management knowledge","Coordinates with authorities","Produces risk assessments"] },
  };
  type QRec = { id:string; dept:string; dim:string; text:string };
  const qRecs: QRec[] = [];
  for (const [dept, qs] of Object.entries(QS)) {
    const prefix = dept.split("-").map(w=>w[0].toUpperCase()).join("").slice(0,3);
    let ci=0, ki=0;
    for (const t of qs.c) { ci++; const id=`${prefix}-C${String(ci).padStart(2,"0")}`; qRecs.push({id,dept,dim:"commitment",text:t}); await db.insert(schema.assessmentQuestions).values({id, departmentNodeId:dept, dimension:"commitment", questionText:t, weight:1.0, sortOrder:ci, isActive:true, createdAt:now}); }
    for (const t of qs.k) { ki++; const id=`${prefix}-K${String(ki).padStart(2,"0")}`; qRecs.push({id,dept,dim:"competency",text:t}); await db.insert(schema.assessmentQuestions).values({id, departmentNodeId:dept, dimension:"competency", questionText:t, weight:1.0, sortOrder:ki, isActive:true, createdAt:now}); }
  }

  // ─── CYCLES ───
  console.log("  📅 Creating cycles...");
  const cycles = [
    {id:"cycle-2026-01",year:2026,month:1,status:"closed" as const,opensAt:"2026-01-01T00:00:00Z",closesAt:"2026-01-31T23:59:59Z"},
    {id:"cycle-2026-02",year:2026,month:2,status:"closed" as const,opensAt:"2026-02-01T00:00:00Z",closesAt:"2026-02-28T23:59:59Z"},
    {id:"cycle-2026-03",year:2026,month:3,status:"closed" as const,opensAt:"2026-03-01T00:00:00Z",closesAt:"2026-03-31T23:59:59Z"},
    {id:"cycle-2026-04",year:2026,month:4,status:"open" as const,opensAt:"2026-04-01T00:00:00Z",closesAt:null},
  ];
  for (const c of cycles) await db.insert(schema.assessmentCycles).values(c);

  // ─── ASSESSMENTS ───
  console.log("  📊 Generating assessments...");
  function getDeptId(nodeId: string): string {
    const n = nodes.find(x => x.id === nodeId);
    if (!n) return nodeId;
    if (n.level === "department") return n.id;
    return n.parentId ? getDeptId(n.parentId) : nodeId;
  }
  const profiles = [
    {cB:8.5,kB:8.2,cT:0.1,kT:0.15},{cB:9,kB:8.8,cT:0,kT:0},{cB:8,kB:5.2,cT:0,kT:0.3},{cB:7.8,kB:5.5,cT:0.1,kT:0.1},
    {cB:5,kB:8,cT:-0.2,kT:0},{cB:5.5,kB:7.8,cT:0.3,kT:0},{cB:4.2,kB:4,cT:0.2,kT:0.2},{cB:5,kB:5,cT:0,kT:0},
    {cB:7.5,kB:7.5,cT:0.2,kT:0.2},{cB:6,kB:8.5,cT:0.1,kT:0},{cB:9.2,kB:6,cT:0,kT:0.2},{cB:7.2,kB:7.2,cT:0,kT:0},
    {cB:3.5,kB:6,cT:0.3,kT:0.1},{cB:8,kB:4.5,cT:0,kT:0.4},{cB:6.5,kB:6.5,cT:-0.1,kT:-0.1},{cB:7.5,kB:9,cT:0,kT:0},
    {cB:4,kB:7.5,cT:0.2,kT:0},{cB:9,kB:9,cT:0,kT:0},{cB:6,kB:4.2,cT:0.1,kT:0.2},{cB:7.8,kB:5.8,cT:0,kT:0.3},{cB:8.2,kB:7.8,cT:0,kT:0},
  ];
  const closedCycles = cycles.filter(c => c.status === "closed");
  for (let ci = 0; ci < closedCycles.length; ci++) {
    const cycle = closedCycles[ci];
    const deptScores: Record<string,{cs:number[];ks:number[];qs:string[]}> = {};
    for (let ei = 0; ei < emps.length; ei++) {
      const emp = emps[ei]; const p = profiles[ei % profiles.length];
      const deptId = getDeptId(emp.node);
      const dQs = qRecs.filter(q => q.dept === deptId);
      const cQs = dQs.filter(q => q.dim === "commitment");
      const kQs = dQs.filter(q => q.dim === "competency");
      if (!cQs.length || !kQs.length) continue;
      const cBase = p.cB + p.cT * ci; const kBase = p.kB + p.kT * ci;
      const cResps = cQs.map(q => ({qId:q.id,dim:"commitment",s:clamp(Math.round((cBase+(rand()-0.5)*2.5)*10)/10)}));
      const kResps = kQs.map(q => ({qId:q.id,dim:"competency",s:clamp(Math.round((kBase+(rand()-0.5)*2.5)*10)/10)}));
      const cScore = calculateDimensionScore(cResps.map(r=>({questionId:r.qId,score:r.s})),cQs.map(q=>({id:q.id,weight:1})));
      const kScore = calculateDimensionScore(kResps.map(r=>({questionId:r.qId,score:r.s})),kQs.map(q=>({id:q.id,weight:1})));
      const quad = classifyQuadrant(cScore, kScore);
      const snap = dQs.map(q => ({id:q.id,dimension:q.dim,questionText:q.text,weight:1}));
      const aId = `A-${cycle.id}-${emp.id}`;
      await db.insert(schema.assessments).values({id:aId,employeeId:emp.id,assessorId:adminId,cycleId:cycle.id,commitmentScore:cScore,competencyScore:kScore,quadrant:quad,questionSnapshot:JSON.stringify(snap),submittedAt:`${cycle.year}-${String(cycle.month).padStart(2,"0")}-15T10:00:00Z`});
      for (const r of [...cResps,...kResps]) await db.insert(schema.assessmentResponses).values({id:uuid(),assessmentId:aId,questionId:r.qId,dimension:r.dim as any,score:r.s});
      if (!deptScores[deptId]) deptScores[deptId]={cs:[],ks:[],qs:[]};
      deptScores[deptId].cs.push(cScore); deptScores[deptId].ks.push(kScore); deptScores[deptId].qs.push(quad);
    }
    for (const [dId, sc] of Object.entries(deptScores)) {
      const dn = nodes.find(n=>n.id===dId);
      const agg = aggregateScores(sc.cs.map((c,i)=>({commitment:c,competency:sc.ks[i]})));
      const dist = buildDistribution(sc.qs as any);
      const gap = determineGap(agg.avgCommitment, agg.avgCompetency);
      await db.insert(schema.monthlyDepartmentStats).values({id:uuid(),departmentNodeId:dId,cycleId:cycle.id,avgCommitment:agg.avgCommitment,avgCompetency:agg.avgCompetency,gapDirection:gap,quadrantDistribution:JSON.stringify(dist),totalAssessed:sc.cs.length,totalEmployees:dn?.hc||0,computedAt:now});
    }
  }

  // ─── NOTIFICATIONS ───
  console.log("  🔔 Creating notifications...");
  await db.insert(schema.notifications).values([
    {id:uuid(),recipientId:adminId,type:"star_performer",title:"Star Performer Alert",message:"Jean-Pierre Dubois scored above 8.5 in both dimensions for March 2026.",data:JSON.stringify({employeeId:"E019"}),isRead:false,createdAt:now},
    {id:uuid(),recipientId:adminId,type:"cycle_reminder",title:"April Cycle Open",message:"The April 2026 cycle is now open. 42 employees pending review.",data:JSON.stringify({cycleId:"cycle-2026-04",pending:42}),isRead:false,createdAt:now},
    {id:uuid(),recipientId:adminId,type:"low_score_alert",title:"Low Score Alert",message:"Technical Department: 3 employees in 'At Risk' quadrant for March.",data:JSON.stringify({departmentId:"technical"}),isRead:true,createdAt:now},
  ]);

  // ─── SETTINGS ───
  console.log("  ⚙️  Settings...");
  await db.insert(schema.settings).values([
    {key:"quadrant_threshold",value:JSON.stringify(7),updatedAt:now},
    {key:"star_alert_threshold",value:JSON.stringify(8.5),updatedAt:now},
    {key:"low_score_alert_threshold",value:JSON.stringify(4),updatedAt:now},
  ]);

  console.log(`\n✅ Seed complete! ${nodes.length} nodes, ${emps.length} employees, ${qRecs.length} questions, ${closedCycles.length*emps.length} assessments`);
}

seed().catch(console.error);
