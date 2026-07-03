import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id },
      include: {
        documents: true,
        members: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("Error in GET /api/projects/[id]:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, status, userId } = body;

    const existingProject = await db.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Capture before snapshot for audit trail
    const beforeSnapshot = JSON.stringify(existingProject);

    const updatedProject = await db.project.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    // Log audit trail
    await db.auditLog.create({
      data: {
        projectId: id,
        actorType: "User",
        actorId: userId || "default_user",
        action: `UPDATE_PROJECT_${status || "DETAILS"}`,
        entityType: "Project",
        entityId: id,
        beforeSnapshotJson: beforeSnapshot,
        afterSnapshotJson: JSON.stringify(updatedProject),
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error: any) {
    console.error("Error in PATCH /api/projects/[id]:", error);
    return NextResponse.json({ error: error.message || "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "default_user";

    const existingProject = await db.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const beforeSnapshot = JSON.stringify(existingProject);

    // Soft-delete: update status to SoftDeleted
    const softDeletedProject = await db.project.update({
      where: { id },
      data: {
        status: "SoftDeleted",
      },
    });

    // Log audit trail
    await db.auditLog.create({
      data: {
        projectId: id,
        actorType: "User",
        actorId: userId,
        action: "SOFT_DELETE_PROJECT",
        entityType: "Project",
        entityId: id,
        beforeSnapshotJson: beforeSnapshot,
        afterSnapshotJson: JSON.stringify(softDeletedProject),
      },
    });

    return NextResponse.json({ success: true, project: softDeletedProject });
  } catch (error: any) {
    console.error("Error in DELETE /api/projects/[id]:", error);
    return NextResponse.json({ error: error.message || "Failed to delete project" }, { status: 500 });
  }
}
