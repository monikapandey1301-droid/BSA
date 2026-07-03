import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Basic Gherkin syntax validator
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { featureId, role, capability, benefit, acceptanceCriteria, editorRole } = body;

    if (!featureId || !role || !capability || !benefit) {
      return NextResponse.json({ error: "FeatureId, role, capability, and benefit are required" }, { status: 400 });
    }

    // 1. Validate Gherkin Syntax for all criteria
    if (acceptanceCriteria && Array.isArray(acceptanceCriteria)) {
      for (const ac of acceptanceCriteria) {
        const error = validateGherkinSyntax(ac.gherkinText);
        if (error) {
          return NextResponse.json({ error: `Gherkin Syntax Error in scenario "${ac.scenarioName}": ${error}` }, { status: 400 });
        }
      }
    }

    // 2. Fetch feature context for audit logs
    const feature = await db.feature.findUnique({
      where: { id: featureId },
      include: {
        epic: true
      }
    });

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    const projectId = feature.epic.projectId;

    // 3. Create UserStory in database
    const story = await db.userStory.create({
      data: {
        featureId,
        role,
        capability,
        benefit,
        status: "Manual_Draft",
        currentVersion: 1
      }
    });

    // 4. Create Acceptance Criteria
    const savedCriteria = [];
    if (acceptanceCriteria && Array.isArray(acceptanceCriteria)) {
      for (let i = 0; i < acceptanceCriteria.length; i++) {
        const ac = acceptanceCriteria[i];
        const criterion = await db.acceptanceCriterion.create({
          data: {
            userStoryId: story.id,
            scenarioName: ac.scenarioName,
            gherkinText: ac.gherkinText,
            orderIndex: i
          }
        });
        savedCriteria.push(criterion);
      }
    }

    // 5. Create initial StoryVersion snapshot
    await db.storyVersion.create({
      data: {
        userStoryId: story.id,
        versionNo: 1,
        contentSnapshot: JSON.stringify({
          role,
          capability,
          benefit,
          status: "Manual_Draft",
          acceptanceCriteria
        }),
        editedBy: editorRole || "User",
        editType: "Human"
      }
    });

    // 6. Log audit log
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "User",
        actorId: editorRole || "User",
        action: "CREATE_MANUAL_USER_STORY",
        entityType: "UserStory",
        entityId: story.id,
        afterSnapshotJson: JSON.stringify(story)
      }
    });

    const fullStory = await db.userStory.findUnique({
      where: { id: story.id },
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
    console.error("Failed to create user story:", error);
    return NextResponse.json({ error: error.message || "Failed to create user story" }, { status: 500 });
  }
}
