import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId parameter is required" }, { status: 400 });
    }

    // Load full requirements hierarchy: Epics -> Features -> UserStories -> AcceptanceCriteria & ValidationResults
    const epics = await db.epic.findMany({
      where: { projectId },
      include: {
        features: {
          include: {
            userStories: {
              include: {
                acceptanceCriteria: {
                  orderBy: { orderIndex: "asc" }
                },
                validationResults: {
                  orderBy: { createdAt: "desc" },
                  take: 1
                },
                testCases: true,
                automationScripts: true
              },
              orderBy: { createdAt: "asc" }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json(epics);
  } catch (error: any) {
    console.error("Error in GET /api/requirements:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch requirements hierarchy" }, { status: 500 });
  }
}
