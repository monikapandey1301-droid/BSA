import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (error: any) {
    console.error("Error in GET /api/projects:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, ownerId } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    // Check for duplicate project names within a workspace (per US-0101)
    const existing = await db.project.findFirst({
      where: { name, status: { not: "SoftDeleted" } },
    });

    if (existing) {
      return NextResponse.json({ error: "Project name already exists in this workspace" }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        name,
        description,
        ownerId: ownerId || "default_owner",
        status: "Active",
      },
    });

    // Create default project membership for the owner (per EPIC-06)
    await db.projectMember.create({
      data: {
        projectId: project.id,
        userId: ownerId || "default_owner",
        role: "Admin", // Owner is Admin/Owner
      },
    });

    // Log audit trail
    await db.auditLog.create({
      data: {
        projectId: project.id,
        actorType: "User",
        actorId: ownerId || "default_owner",
        action: "CREATE_PROJECT",
        entityType: "Project",
        entityId: project.id,
        afterSnapshotJson: JSON.stringify(project),
      },
    });

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("Error in POST /api/projects:", error);
    return NextResponse.json({ error: error.message || "Failed to create project" }, { status: 500 });
  }
}
