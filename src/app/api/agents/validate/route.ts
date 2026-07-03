import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface ValidationIssue {
  severity: "blocker" | "warning" | "suggestion";
  category: "ambiguity" | "missing_negative_case" | "untestable_criterion" | "duplicate" | "conflict" | "non_atomic_story";
  message: string;
  related_gherkin_scenario: string | null;
}

// Smart rule-based validation critique engine for local fallback
function runRuleBasedValidation(
  story: { role: string; capability: string; benefit: string },
  criteria: Array<{ scenarioName: string; gherkinText: string }>
): { verdict: string; issues: ValidationIssue[]; suggestedFix: string | null } {
  const issues: ValidationIssue[] = [];
  let hasBlocker = false;

  const fullText = `${story.role} ${story.capability} ${story.benefit} ${criteria.map(c => c.gherkinText).join(" ")}`.toLowerCase();

  // 1. Check for vague/untestable buzzwords (US-0301 "untestable_criterion" / "ambiguity")
  const vagueWords = ["quickly", "fast", "efficiently", "user-friendly", "beautiful", "intuitive", "robust", "easy", "securely", "error-free"];
  vagueWords.forEach(word => {
    if (fullText.includes(word)) {
      issues.push({
        severity: "warning",
        category: "ambiguity",
        message: `Criterion contains the subjective/vague term "${word}". Consider specifying a measurable metric (e.g. "within 2 seconds" instead of "quickly").`,
        related_gherkin_scenario: null
      });
    }
  });

  // 2. Check for missing negative scenarios
  const negativeKeywords = ["error", "fail", "invalid", "expired", "missing", "incorrect", "denied", "forbidden", "exception", "validation error"];
  const hasNegativeCase = criteria.some(c => 
    negativeKeywords.some(keyword => c.gherkinText.toLowerCase().includes(keyword))
  );

  if (!hasNegativeCase && criteria.length > 0) {
    issues.push({
      severity: "warning",
      category: "missing_negative_case",
      message: "The story appears to only describe positive ('happy path') scenarios. Consider adding negative/error scenarios (e.g. handling invalid inputs or authorization failures).",
      related_gherkin_scenario: null
    });
  }

  // 3. Parse and validate Gherkin structure for each scenario
  criteria.forEach(c => {
    const text = c.gherkinText;
    const hasGiven = /given\s+/i.test(text);
    const hasWhen = /when\s+/i.test(text);
    const hasThen = /then\s+/i.test(text);

    if (!hasGiven || !hasWhen || !hasThen) {
      hasBlocker = true;
      let missingSteps = [];
      if (!hasGiven) missingSteps.push("Given");
      if (!hasWhen) missingSteps.push("When");
      if (!hasThen) missingSteps.push("Then");

      issues.push({
        severity: "blocker",
        category: "untestable_criterion",
        message: `Scenario "${c.scenarioName}" is missing Gherkin step(s): ${missingSteps.join(", ")}. A scenario must follow Given-When-Then flow to be automated.`,
        related_gherkin_scenario: c.scenarioName
      });
    }
  });

  // 4. Check story atomicity (non-atomic story if it does too much)
  if (story.capability.toLowerCase().includes(" and ") || story.capability.toLowerCase().includes(" as well as ")) {
    issues.push({
      severity: "warning",
      category: "non_atomic_story",
      message: "The story capability contains 'and' or 'as well as'. This might indicate a compound requirement. Consider breaking it down into smaller, atomic stories.",
      related_gherkin_scenario: null
    });
  }

  // Determine verdict
  let verdict = "pass";
  if (hasBlocker) {
    verdict = "fail";
  } else if (issues.length > 0) {
    verdict = "pass_with_warnings";
  }

  // Generate suggested fix
  let suggestedFix = null;
  if (verdict === "fail") {
    suggestedFix = "Ensure all Gherkin scenarios contain at least one Given, When, and Then step. Remove vague adjectives like 'beautiful' or 'quickly' and replace them with concrete, measurable criteria.";
  } else if (verdict === "pass_with_warnings" && !hasNegativeCase) {
    suggestedFix = "Add a Gherkin scenario describing what happens when validation fails or invalid data is inputted (e.g., 'Scenario: Prevent duplicate naming').";
  }

  return { verdict, issues, suggestedFix };
}

export async function POST(req: NextRequest) {
  let agentRunId = "";
  let projectId = "";
  try {
    const body = await req.json();
    const { userStoryId, role } = body;

    if (!userStoryId) {
      return NextResponse.json({ error: "userStoryId is required" }, { status: 400 });
    }

    // 1. Fetch UserStory and its Acceptance Criteria
    const story = await db.userStory.findUnique({
      where: { id: userStoryId },
      include: {
        acceptanceCriteria: true,
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

    projectId = story.feature.epic.projectId;
    const apiKey = process.env.GEMINI_API_KEY;
    const isLocalFallback = !apiKey;

    // 2. Create AgentRun record
    const agentRun = await db.agentRun.create({
      data: {
        projectId,
        agentType: "Validation",
        modelName: isLocalFallback ? "RegExp Critique Engine" : "gemini-2.5-flash",
        modelVersion: isLocalFallback ? "v1.0-local" : "latest",
        promptTemplateVersion: "validation.review.v1",
        status: "Running",
        inputJson: JSON.stringify({ userStoryId, role })
      }
    });
    agentRunId = agentRun.id;

    // Log validation start
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "User",
        actorId: role,
        action: "TRIGGER_VALIDATION_AGENT",
        entityType: "UserStory",
        entityId: userStoryId
      }
    });

    let resultData;

    if (isLocalFallback) {
      resultData = runRuleBasedValidation(story, story.acceptanceCriteria);
    } else {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are a Senior Software Developer acting as a Validation Agent.
Your job is to review the following User Story and Gherkin Acceptance Criteria for clarity, testability, atomicity, ambiguity, and completeness.

Input User Story:
Role: ${story.role}
Capability: ${story.capability}
Benefit: ${story.benefit}

Gherkin Acceptance Criteria Scenarios:
${story.acceptanceCriteria.map(c => `Scenario: ${c.scenarioName}\n${c.gherkinText}`).join("\n\n")}

Verify:
1. Gherkin structure: Scenario must have Given, When, Then steps.
2. Subjective terms: terms like "beautiful", "fast", "robust", "securely" are ambiguous and make criteria untestable. They should fail or warning.
3. Edge cases: is there a negative path or error handling scenario? If not, flag warning of missing negative case.
4. Atomicity: is the capability doing too many things (non_atomic_story)?

You must return a JSON response matching this schema:
{
  "verdict": "pass | pass_with_warnings | fail",
  "issues": [
    {
      "severity": "blocker | warning | suggestion",
      "category": "ambiguity | missing_negative_case | untestable_criterion | duplicate | conflict | non_atomic_story",
      "message": "detailed explanation of issue",
      "related_gherkin_scenario": "scenario name or null"
    }
  ],
  "suggestedFix": "markdown string of how the BA can fix this story, or null if pass"
}

A "fail" verdict requires at least one blocker. Missing negative cases or vague terms should be warning or suggestion. Missing Given/When/Then steps in a scenario is a blocker.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        resultData = JSON.parse(text);
      } catch (err: any) {
        console.error("Gemini Validation Agent failed, running local rule parser:", err);
        resultData = runRuleBasedValidation(story, story.acceptanceCriteria);
      }
    }

    // 3. Save validation result in DB
    const validationResult = await db.validationResult.create({
      data: {
        userStoryId,
        verdict: resultData.verdict.toUpperCase(),
        issuesJson: JSON.stringify(resultData.issues),
        agentRunId: agentRunId
      }
    });

    // 4. Map verdict to Story Status
    let newStatus = "VALIDATED";
    if (resultData.verdict === "fail") {
      newStatus = "VALIDATION_FAILED";
    } else if (resultData.verdict === "pass_with_warnings") {
      newStatus = "VALIDATED_WARNINGS";
    }

    const updatedStory = await db.userStory.update({
      where: { id: userStoryId },
      data: { status: newStatus }
    });

    // Log history snapshot
    await db.storyVersion.create({
      data: {
        userStoryId,
        versionNo: story.currentVersion + 1,
        contentSnapshot: JSON.stringify({
          role: story.role,
          capability: story.capability,
          benefit: story.benefit,
          status: newStatus,
          validationVerdict: resultData.verdict,
          issues: resultData.issues
        }),
        editedBy: "Validation_Agent",
        editType: "AI"
      }
    });

    // Update story version number
    const finalStory = await db.userStory.update({
      where: { id: userStoryId },
      data: { currentVersion: story.currentVersion + 1 },
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

    // 5. Update AgentRun status
    await db.agentRun.update({
      where: { id: agentRunId },
      data: {
        status: "Succeeded",
        outputJson: JSON.stringify(resultData),
        completedAt: new Date()
      }
    });

    // Log success audit
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "Agent",
        actorId: "Validation_Agent",
        action: `VALIDATE_REQUIREMENT_${resultData.verdict.toUpperCase()}`,
        entityType: "UserStory",
        entityId: userStoryId,
        afterSnapshotJson: JSON.stringify(validationResult)
      }
    });

    return NextResponse.json({ success: true, result: validationResult, story: finalStory });

  } catch (error: any) {
    console.error("Validation Agent failed:", error);

    if (agentRunId) {
      await db.agentRun.update({
        where: { id: agentRunId },
        data: {
          status: "Failed",
          errorMessage: error.message || "Unknown validation error",
          completedAt: new Date()
        }
      });

      if (projectId) {
        await db.auditLog.create({
          data: {
            projectId,
            actorType: "Agent",
            actorId: "Validation_Agent",
            action: "VALIDATE_REQUIREMENT_FAILED",
            entityType: "AgentRun",
            entityId: agentRunId,
            afterSnapshotJson: JSON.stringify({ error: error.message || "Unknown error" })
          }
        });
      }
    }

    return NextResponse.json({ error: error.message || "Validation failed" }, { status: 500 });
  }
}
