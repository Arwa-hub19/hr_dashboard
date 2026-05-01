import { NextResponse } from "next/server";
import * as data from "@/lib/services/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const cycleId = searchParams.get("cycleId") || undefined;
  const deptId = searchParams.get("deptId") || undefined;
  const empId = searchParams.get("empId") || undefined;

  try {
    switch (action) {
      case "orgReadiness": return NextResponse.json(await data.getOrgReadiness(cycleId));
      case "deptReadiness":
        if (!deptId) return NextResponse.json({ error: "deptId required" }, { status: 400 });
        return NextResponse.json(await data.getDepartmentReadiness(deptId, cycleId));
      case "employeeReadiness":
        if (!empId) return NextResponse.json({ error: "empId required" }, { status: 400 });
        return NextResponse.json(await data.getEmployeeReadiness(empId, cycleId));
      case "departments": return NextResponse.json(await data.getDepartments());
      case "orgTree": return NextResponse.json(await data.buildOrgTree());
      case "employees": return NextResponse.json(await data.getEmployees(deptId));
      case "employee":
        if (!empId) return NextResponse.json({ error: "empId required" }, { status: 400 });
        return NextResponse.json(await data.getEmployee(empId));
      case "cycles": return NextResponse.json(await data.getCycles());
      case "deptHistory":
        if (!deptId) return NextResponse.json({ error: "deptId required" }, { status: 400 });
        return NextResponse.json(await data.getDepartmentHistory(deptId));
      case "empTrend":
        if (!empId) return NextResponse.json({ error: "empId required" }, { status: 400 });
        return NextResponse.json(await data.getEmployeeTrend(empId));
      case "unrated": return NextResponse.json(await data.getUnratedEmployees(cycleId));
      case "questions":
        if (!deptId) return NextResponse.json({ error: "deptId required" }, { status: 400 });
        return NextResponse.json(await data.getQuestions(deptId));
      case "nodeChildren":
        if (!deptId) return NextResponse.json({ error: "deptId required" }, { status: 400 });
        return NextResponse.json(await data.getNodeChildren(deptId));
      case "nodeAncestry":
        if (!deptId) return NextResponse.json({ error: "deptId required" }, { status: 400 });
        return NextResponse.json(await data.getNodeAncestry(deptId));
      case "notifications": return NextResponse.json(await data.getNotifications(searchParams.get("userId") || ""));
      case "unreadCount": return NextResponse.json({ count: await data.getUnreadCount(searchParams.get("userId") || "") });
      case "threshold": return NextResponse.json({ threshold: await data.getThreshold() });
      default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[API Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
