import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check project exists
    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Run counts and queries in parallel
    const [
      docCount,
      epicCount,
      featureCount,
      storyCount,
      testCount,
      scriptCount,
      stories,
      recentLogs,
      epics
    ] = await Promise.all([
      db.document.count({ where: { projectId: id } }),
      db.epic.count({ where: { projectId: id } }),
      db.feature.count({ where: { epic: { projectId: id } } }),
      db.userStory.count({ where: { feature: { epic: { projectId: id } } } }),
      db.testCase.count({ where: { userStory: { feature: { epic: { projectId: id } } } } }),
      db.automationScript.count({ where: { userStory: { feature: { epic: { projectId: id } } } } }),
      db.userStory.findMany({
        where: { feature: { epic: { projectId: id } } },
        select: { id: true, status: true, acceptanceCriteria: { select: { id: true } } },
      }),
      db.auditLog.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.epic.findMany({
        where: { projectId: id },
        include: {
          features: {
            include: {
              _count: { select: { userStories: true } }
            }
          }
        },
        take: 5
      })
    ]);

    // Calculate story status distribution
    const statusCounts = stories.reduce((acc: Record<string, number>, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    // Calculate automation coverage: stories with at least one automation script / total stories
    const totalScenarios = stories.reduce((sum, s) => sum + s.acceptanceCriteria.length, 0);
    
    // Find how many test cases are mapped to scripts
    const storiesWithScripts = await db.userStory.count({
      where: {
        feature: { epic: { projectId: id } },
        automationScripts: { some: {} }
      }
    });

    const coveragePercent = storyCount > 0 ? Math.round((storiesWithScripts / storyCount) * 100) : 0;

    return NextResponse.json({
      project,
      stats: {
        documents: docCount,
        epics: epicCount,
        features: featureCount,
        stories: storyCount,
        testCases: testCount,
        scripts: scriptCount,
        statusCounts,
        coveragePercent,
        totalScenarios
      },
      recentLogs,
      epics
    });
  } catch (error: any) {
    console.error("Error in GET /api/projects/[id]/dashboard:", error);
    return NextResponse.json({ error: error.message || "Failed to load dashboard metrics" }, { status: 500 });
  }
}
