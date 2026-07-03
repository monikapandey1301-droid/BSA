import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { role } = body; // The user's role (e.g. PO, BA, Admin)

    // Enforce role restrictions (Only PO or Admin can approve, per US-0302 / EPIC-06)
    if (role !== "PO" && role !== "Admin") {
      return NextResponse.json({ error: "Only Product Owners or Admins can approve stories" }, { status: 403 });
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
      data: { status: "Approved" },
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

    // Log audit log
    await db.auditLog.create({
      data: {
        projectId: story.feature.epic.projectId,
        actorType: "User",
        actorId: role,
        action: "APPROVE_USER_STORY",
        entityType: "UserStory",
        entityId: id,
        afterSnapshotJson: JSON.stringify(updated)
      }
    });

    return NextResponse.json({ success: true, story: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to approve story" }, { status: 500 });
  }
}
