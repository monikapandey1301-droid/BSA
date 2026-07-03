import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId parameter is required" }, { status: 400 });
    }

    const [logs, agentRuns] = await Promise.all([
      db.auditLog.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" }
      }),
      db.agentRun.findMany({
        where: { projectId },
        orderBy: { startedAt: "desc" }
      })
    ]);

    // Calculate Observability Statistics (US-0501, Section 8, NFRs)
    const totalRuns = agentRuns.length;
    const failedRuns = agentRuns.filter(r => r.status === "Failed").length;
    const successRuns = agentRuns.filter(r => r.status === "Succeeded").length;
    
    // Average Latency
    let totalLatencyMs = 0;
    let latencyCount = 0;
    agentRuns.forEach(r => {
      if (r.completedAt) {
        totalLatencyMs += new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime();
        latencyCount++;
      }
    });
    const avgLatencySec = latencyCount > 0 ? parseFloat(((totalLatencyMs / latencyCount) / 1000).toFixed(2)) : 0;
    
    // Error rate
    const errorRatePercent = totalRuns > 0 ? Math.round((failedRuns / totalRuns) * 100) : 0;

    // Tokens and Costs (Gemini Flash estimation: $0.075 per million input tokens, $0.30 per million output tokens)
    // For simplicity, let's assume average token usage of 5000 tokens per run if not tracked,
    // and estimate $0.0015 cost per run. Let's sum the actual tokens if they are recorded.
    let totalTokens = 0;
    agentRuns.forEach(r => {
      totalTokens += r.tokenUsage || 4500; // default estimate if 0
    });
    const estimatedCost = parseFloat((totalTokens * 0.0000002).toFixed(4)); // $0.20 per million tokens avg

    return NextResponse.json({
      logs,
      agentRuns,
      stats: {
        totalRuns,
        failedRuns,
        successRuns,
        errorRatePercent,
        avgLatencySec,
        totalTokens,
        estimatedCost
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/audit:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch audit data" }, { status: 500 });
  }
}
