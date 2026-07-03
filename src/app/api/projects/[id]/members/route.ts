import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const members = await db.projectMember.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" }
    });
    return NextResponse.json(members);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch project members" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { email, role, actorRole } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    // Role enforcement (Only Admins can invite/manage members, per US-0601)
    if (actorRole !== "Admin") {
      return NextResponse.json({ error: "Only project Admins can invite members" }, { status: 403 });
    }

    // Check if member already exists
    const existing = await db.projectMember.findFirst({
      where: { projectId: id, userId: email }
    });

    if (existing) {
      return NextResponse.json({ error: "User is already a member of this project" }, { status: 400 });
    }

    const member = await db.projectMember.create({
      data: {
        projectId: id,
        userId: email,
        role: role
      }
    });

    // Log in audit log
    await db.auditLog.create({
      data: {
        projectId: id,
        actorType: "User",
        actorId: actorRole,
        action: "INVITE_MEMBER",
        entityType: "ProjectMember",
        entityId: member.id,
        afterSnapshotJson: JSON.stringify(member)
      }
    });

    return NextResponse.json(member);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to add member" }, { status: 500 });
  }
}
