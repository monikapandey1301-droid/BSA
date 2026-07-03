import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { role, comment } = body;

    // Enforce role restrictions (Only PO or Admin can request changes)
    if (role !== "PO" && role !== "Admin") {
      return NextResponse.json({ error: "Only Product Owners or Admins can request changes" }, { status: 403 });
    }

    const story = await db.userStory.findUnique({
      where: { id },
      include: {
        feature: {
          include: {
            epic: true
          }
        }
      }
    });

    if (!story) {
      return NextResponse.json({ error: "User Story not found" }, { status: 404 });
    }

    const updated = await db.userStory.update({
      where: { id },
      data: { status: "Changes_Requested" },
      include: {
        acceptanceCriteria: {
          orderBy: { orderIndex: "asc" }
        },
        validationResults: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    // Log audit log with comment
    await db.auditLog.create({
      data: {
        projectId: story.feature.epic.projectId,
        actorType: "User",
        actorId: role,
        action: "REQUEST_CHANGES_ON_USER_STORY",
        entityType: "UserStory",
        entityId: id,
        afterSnapshotJson: JSON.stringify({ comment: comment || "Changes requested", story: updated })
      }
    });

    return NextResponse.json({ success: true, story: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to request changes" }, { status: 500 });
  }
}
