import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId parameter is required" }, { status: 400 });
    }

    // Fetch approved user stories in this project, including test cases and scripts
    const stories = await db.userStory.findMany({
      where: {
        feature: {
          epic: {
            projectId
          }
        },
        status: "Approved"
      },
      include: {
        acceptanceCriteria: true,
        testCases: true,
        automationScripts: true,
        feature: {
          select: {
            title: true,
            epic: {
              select: {
                title: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(stories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch QA stories" }, { status: 500 });
  }
}
