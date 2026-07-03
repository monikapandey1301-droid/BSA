import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, itemType, role } = body;

    if (!itemId || !itemType || !role) {
      return NextResponse.json({ error: "itemId, itemType, and role are required" }, { status: 400 });
    }

    // Role check: Only QA or Admin can approve QA artifacts (per US-0403 / EPIC-06)
    if (role !== "QA" && role !== "Admin") {
      return NextResponse.json({ error: "Only QA Engineers or Administrators can approve test cases and scripts." }, { status: 403 });
    }

    let updatedItem;
    let projectId = "";

    if (itemType === "test_case") {
      const tc = await db.testCase.findUnique({
        where: { id: itemId },
        include: { userStory: { include: { feature: { include: { epic: true } } } } }
      });
      if (!tc) {
        return NextResponse.json({ error: "Test Case not found" }, { status: 404 });
      }
      projectId = tc.userStory.feature.epic.projectId;

      updatedItem = await db.testCase.update({
        where: { id: itemId },
        data: { status: "Approved" }
      });

    } else if (itemType === "script") {
      const script = await db.automationScript.findUnique({
        where: { id: itemId },
        include: { userStory: { include: { feature: { include: { epic: true } } } } }
      });
      if (!script) {
        return NextResponse.json({ error: "Automation Script not found" }, { status: 404 });
      }
      projectId = script.userStory.feature.epic.projectId;

      updatedItem = await db.automationScript.update({
        where: { id: itemId },
        data: { status: "Approved" }
      });
    } else {
      return NextResponse.json({ error: "Invalid itemType. Must be 'test_case' or 'script'" }, { status: 400 });
    }

    // Log in audit log
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "User",
        actorId: role,
        action: `APPROVE_QA_${itemType.toUpperCase()}`,
        entityType: itemType === "test_case" ? "TestCase" : "AutomationScript",
        entityId: itemId,
        afterSnapshotJson: JSON.stringify(updatedItem)
      }
    });

    return NextResponse.json({ success: true, item: updatedItem });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to approve item" }, { status: 500 });
  }
}
