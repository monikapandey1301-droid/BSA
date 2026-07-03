import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Basic Gherkin syntax validator (US-0203)
function validateGherkinSyntax(gherkin: string): string | null {
  const lowercase = gherkin.toLowerCase();
  
  if (!lowercase.includes("scenario:")) {
    return "Acceptance Criteria must contain a 'Scenario: <name>' line.";
  }
  
  const hasGiven = lowercase.includes("given ");
  const hasWhen = lowercase.includes("when ");
  const hasThen = lowercase.includes("then ");
  
  if (!hasGiven || !hasWhen || !hasThen) {
    const missing = [];
    if (!hasGiven) missing.push("Given");
    if (!hasWhen) missing.push("When");
    if (!hasThen) missing.push("Then");
    return `Acceptance Criteria is missing Gherkin keyword(s): ${missing.join(", ")}. Every scenario must follow Given-When-Then structure.`;
  }
  
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const story = await db.userStory.findUnique({
      where: { id },
      include: {
        acceptanceCriteria: true,
        versions: {
          orderBy: { versionNo: "desc" }
        },
        validationResults: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!story) {
      return NextResponse.json({ error: "User Story not found" }, { status: 404 });
    }

    return NextResponse.json(story);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch user story" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { role, capability, benefit, acceptanceCriteria, editorRole } = body;

    if (!role || !capability || !benefit) {
      return NextResponse.json({ error: "Role, capability, and benefit are required" }, { status: 400 });
    }

    // 1. Validate Gherkin Syntax for all criteria (if provided)
    if (acceptanceCriteria && Array.isArray(acceptanceCriteria)) {
      for (const ac of acceptanceCriteria) {
        const error = validateGherkinSyntax(ac.gherkinText);
        if (error) {
          return NextResponse.json({ error: `Gherkin Syntax Error in scenario "${ac.scenarioName}": ${error}` }, { status: 400 });
        }
      }
    }

    // 2. Fetch current story to check project context & versioning
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

    const projectId = story.feature.epic.projectId;
    const beforeSnapshot = JSON.stringify(story);

    // 3. Update story fields and change status to Edited_Pending_Validation (US-0203)
    const newStatus = "Edited_Pending_Validation";
    const newVersionNo = story.currentVersion + 1;

    const updatedStory = await db.userStory.update({
      where: { id },
      data: {
        role,
        capability,
        benefit,
        status: newStatus,
        currentVersion: newVersionNo
      }
    });

    // 4. Replace Acceptance Criteria
    if (acceptanceCriteria && Array.isArray(acceptanceCriteria)) {
      // Delete old criteria
      await db.acceptanceCriterion.deleteMany({
        where: { userStoryId: id }
      });

      // Insert new criteria
      for (let i = 0; i < acceptanceCriteria.length; i++) {
        const ac = acceptanceCriteria[i];
        await db.acceptanceCriterion.create({
          data: {
            userStoryId: id,
            scenarioName: ac.scenarioName,
            gherkinText: ac.gherkinText,
            orderIndex: i
          }
        });
      }
    }

    // 5. Create version history snapshot
    await db.storyVersion.create({
      data: {
        userStoryId: id,
        versionNo: newVersionNo,
        contentSnapshot: JSON.stringify({
          role,
          capability,
          benefit,
          status: newStatus,
          acceptanceCriteria
        }),
        editedBy: editorRole || "User",
        editType: "Human"
      }
    });

    // 6. Log audit trail
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "User",
        actorId: editorRole || "User",
        action: "EDIT_USER_STORY",
        entityType: "UserStory",
        entityId: id,
        beforeSnapshotJson: beforeSnapshot,
        afterSnapshotJson: JSON.stringify(updatedStory)
      }
    });

    const fullStory = await db.userStory.findUnique({
      where: { id },
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

    return NextResponse.json(fullStory);

  } catch (error: any) {
    console.error("Failed to update user story:", error);
    return NextResponse.json({ error: error.message || "Failed to edit user story" }, { status: 500 });
  }
}
