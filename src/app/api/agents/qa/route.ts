import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface ManualStep {
  step_no: number;
  action: string;
  expected: string;
}

interface MockTestCase {
  title: string;
  priority: "High" | "Medium" | "Low";
  preconditions: string;
  steps: ManualStep[];
  mapped_scenario_names: string[];
}

// Local mock parser that translates Gherkin into manual test cases and automated scripts
function runLocalQAGenerator(
  storyId: string,
  role: string,
  capability: string,
  benefit: string,
  criteria: Array<{ scenarioName: string; gherkinText: string }>,
  storyTypeHint: string
): {
  testCases: MockTestCase[];
  automationScript: {
    detectedType: "UI" | "API" | "Batch";
    framework: string;
    language: string;
    fileName: string;
    sourceCode: string;
    mappedTestCaseTitles: string[];
  }
} {
  const testCases: MockTestCase[] = [];
  
  // Parse Gherkin to construct manual test cases
  criteria.forEach((ac, idx) => {
    const lines = ac.gherkinText.split("\n").map(l => l.trim());
    const givens = lines.filter(l => l.toLowerCase().startsWith("given") || (l.toLowerCase().startsWith("and") && lines.indexOf(l) < lines.findIndex(x => x.toLowerCase().startsWith("when"))));
    const whens = lines.filter(l => l.toLowerCase().startsWith("when") || (l.toLowerCase().startsWith("and") && lines.indexOf(l) > lines.findIndex(x => x.toLowerCase().startsWith("when")) && lines.indexOf(l) < lines.findIndex(x => x.toLowerCase().startsWith("then"))));
    const thens = lines.filter(l => l.toLowerCase().startsWith("then") || (l.toLowerCase().startsWith("and") && lines.indexOf(l) > lines.findIndex(x => x.toLowerCase().startsWith("then"))));

    const preconditions = givens.map(g => g.replace(/^(given|and)\s+/i, "")).join("; ");
    const steps: ManualStep[] = [];
    
    // Fill in steps from Whens
    whens.forEach((w, sIdx) => {
      const action = w.replace(/^(when|and)\s+/i, "");
      const expected = thens[sIdx] ? thens[sIdx].replace(/^(then|and)\s+/i, "") : "Observe expected changes";
      steps.push({
        step_no: sIdx + 1,
        action: `Perform action: ${action}`,
        expected: `Verify that: ${expected}`
      });
    });

    // Fallback if no when steps
    if (steps.length === 0) {
      steps.push({
        step_no: 1,
        action: "Perform Gherkin scenario steps",
        expected: thens.map(t => t.replace(/^(then|and)\s+/i, "")).join("; ") || "Verify expected outcome"
      });
    }

    testCases.push({
      title: `TC-${100 + idx}: ${ac.scenarioName}`,
      priority: idx === 0 ? "High" : "Medium",
      preconditions: preconditions || "User is logged in",
      steps,
      mapped_scenario_names: [ac.scenarioName]
    });
  });

  // Detect script type (UI or API)
  const isApi = capability.toLowerCase().includes("api") || capability.toLowerCase().includes("endpoint") || capability.toLowerCase().includes("json") || capability.toLowerCase().includes("request");
  const detectedType: "UI" | "API" | "Batch" = isApi ? "API" : "UI";

  let framework = "Playwright";
  let language = "TypeScript";
  let fileName = `test-${storyId.substring(0, 8)}.spec.ts`;
  let sourceCode = "";

  if (detectedType === "UI") {
    // Generate Playwright script
    sourceCode = `import { test, expect } from '@playwright/test';

/**
 * Functional UI Test Suite for: ${capability}
 * Persona: ${role}
 */
test.describe('${capability.replace(/'/g, "\\'")}', () => {

`;

    criteria.forEach((ac, idx) => {
      const cleanScenarioName = ac.scenarioName.replace(/'/g, "\\'");
      sourceCode += `  test('${cleanScenarioName}', async ({ page }) => {
    // Mapped to: TC-${100 + idx}
    // Gherkin Scenario: ${ac.scenarioName}

`;
      const lines = ac.gherkinText.split("\n").map(l => l.trim());
      lines.forEach(l => {
        if (!l) return;
        sourceCode += `    // ${l}\n`;
        
        // Simple heuristic execution translation
        if (l.toLowerCase().startsWith("given")) {
          sourceCode += `    await page.goto('/');\n`;
        } else if (l.toLowerCase().startsWith("when")) {
          sourceCode += `    // TODO: Implement click/input interaction\n    // await page.click('button:has-text("Submit")');\n`;
        } else if (l.toLowerCase().startsWith("then")) {
          sourceCode += `    // TODO: Implement assertions\n    // await expect(page.locator('body')).toContainText('success');\n`;
        }
      });
      sourceCode += `  });\n\n`;
    });

    sourceCode += `});\n`;
  } else {
    // Generate Postman API Collection JSON script
    framework = "Postman";
    language = "JSON";
    fileName = `postman-collection-${storyId.substring(0, 8)}.json`;
    
    const postmanItems = criteria.map((ac, idx) => {
      return {
        name: ac.scenarioName,
        request: {
          method: capability.toLowerCase().includes("create") || capability.toLowerCase().includes("post") ? "POST" : "GET",
          header: [
            { key: "Content-Type", value: "application/json" }
          ],
          url: {
            raw: "{{base_url}}/api/resources",
            host: ["{{base_url}}"],
            path: ["api", "resources"]
          },
          description: `Gherkin: ${ac.gherkinText.replace(/\n/g, " | ")}`
        },
        event: [
          {
            listen: "test",
            script: {
              exec: [
                `pm.test("Status code is 200/201", function () {`,
                `    pm.expect(pm.response.code).to.be.oneOf([200, 201]);`,
                `});`,
                `pm.test("Response is valid JSON", function () {`,
                `    pm.response.to.have.jsonBody();`,
                `});`
              ],
              type: "text/javascript"
            }
          }
        ]
      };
    });

    sourceCode = JSON.stringify({
      info: {
        name: `API Suite: ${capability}`,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: postmanItems
    }, null, 2);
  }

  return {
    testCases,
    automationScript: {
      detectedType,
      framework,
      language,
      fileName,
      sourceCode,
      mappedTestCaseTitles: testCases.map(tc => tc.title)
    }
  };
}

export async function POST(req: NextRequest) {
  let agentRunId = "";
  let projectId = "";
  try {
    const body = await req.json();
    const { userStoryId, actionType, role } = body; // actionType: "test_cases" | "automation_script"

    if (!userStoryId || !actionType) {
      return NextResponse.json({ error: "userStoryId and actionType are required" }, { status: 400 });
    }

    // 1. Fetch UserStory (Must be APPROVED per US-0401)
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

    // Server-side guard: Story must be approved!
    if (story.status !== "Approved") {
      return NextResponse.json({ error: "Only approved stories can have test cases or automation scripts generated." }, { status: 400 });
    }

    projectId = story.feature.epic.projectId;
    const apiKey = process.env.GEMINI_API_KEY;
    const isLocalFallback = !apiKey;

    // 2. Create AgentRun entry
    const agentRun = await db.agentRun.create({
      data: {
        projectId,
        agentType: "QA",
        modelName: isLocalFallback ? "RegExp Test Scaffolder" : "gemini-2.5-flash",
        modelVersion: isLocalFallback ? "v1.0-local" : "latest",
        promptTemplateVersion: `qa.${actionType}.v1`,
        status: "Running",
        inputJson: JSON.stringify({ userStoryId, actionType, role })
      }
    });
    agentRunId = agentRun.id;

    // Log QA trigger
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "User",
        actorId: role,
        action: `TRIGGER_QA_AGENT_${actionType.toUpperCase()}`,
        entityType: "UserStory",
        entityId: userStoryId
      }
    });

    let resultData;

    if (isLocalFallback) {
      // Local mock engine
      resultData = runLocalQAGenerator(
        userStoryId,
        story.role,
        story.capability,
        story.benefit,
        story.acceptanceCriteria,
        "UI"
      );
    } else {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });

        if (actionType === "test_cases") {
          const prompt = `You are a Senior QA Engineer (QA Agent). 
Your task is to generate structured manual test cases for the following User Story and its Gherkin Scenarios.

Story details:
Role: ${story.role}
Capability: ${story.capability}
Benefit: ${story.benefit}

Acceptance Criteria Gherkin:
${story.acceptanceCriteria.map(c => `Scenario: ${c.scenarioName}\n${c.gherkinText}`).join("\n\n")}

Your response must be a JSON matching this schema:
{
  "testCases": [
    {
      "title": "TC-100: name of test case",
      "priority": "High | Medium | Low",
      "preconditions": "preconditions for test",
      "steps": [
        {
          "step_no": 1,
          "action": "action to perform",
          "expected": "expected outcome"
        }
      ],
      "mapped_scenario_names": ["scenario name it covers"]
    }
  ]
}`;

          const result = await model.generateContent(prompt);
          const text = result.response.text();
          resultData = { testCases: JSON.parse(text).testCases, automationScript: null };
        } else {
          // automation_script
          const prompt = `You are a Senior QA Automation Engineer (QA Agent).
Your task is to generate a functional Playwright UI test script scaffold in TypeScript or a Postman API script in JSON based on the Gherkin scenarios provided.

Story details:
Role: ${story.role}
Capability: ${story.capability}
Benefit: ${story.benefit}

Acceptance Criteria Gherkin:
${story.acceptanceCriteria.map(c => `Scenario: ${c.scenarioName}\n${c.gherkinText}`).join("\n\n")}

Decide if this story is a "UI" or "API" test. If UI, output standard Playwright TypeScript. If API, output Postman Collection JSON.
Provide comment tags in the code linking each test scenario back to its Gherkin Scenario.

Your response must be a JSON matching this schema:
{
  "automationScript": {
    "detectedType": "UI | API | Batch",
    "framework": "Playwright | Postman",
    "language": "TypeScript | JSON",
    "fileName": "test filename",
    "sourceCode": "full test code source",
    "mappedTestCaseTitles": ["TC-100", "..."]
  }
}`;

          const result = await model.generateContent(prompt);
          const text = result.response.text();
          resultData = { testCases: [], automationScript: JSON.parse(text).automationScript };
        }
      } catch (err: any) {
        console.error("Gemini QA Agent failed, running local scaffolder fallback:", err);
        resultData = runLocalQAGenerator(
          userStoryId,
          story.role,
          story.capability,
          story.benefit,
          story.acceptanceCriteria,
          "UI"
        );
      }
    }

    let savedItem;

    if (actionType === "test_cases" && resultData.testCases) {
      // Save manual test cases in DB
      const createdTestCases = [];
      for (const tc of resultData.testCases) {
        // Delete any existing test case with same title to avoid duplicates on regeneration
        await db.testCase.deleteMany({
          where: { userStoryId, title: tc.title }
        });

        const testCase = await db.testCase.create({
          data: {
            userStoryId,
            title: tc.title,
            preconditions: tc.preconditions,
            stepsJson: JSON.stringify(tc.steps),
            expectedResult: tc.steps[tc.steps.length - 1]?.expected || "Success",
            priority: tc.priority,
            status: "AI_Draft",
            mappedScenarioNamesJson: JSON.stringify(tc.mapped_scenario_names),
            generatedByAgentRunId: agentRunId
          }
        });
        createdTestCases.push(testCase);
      }
      savedItem = createdTestCases;
    } else if (actionType === "automation_script" && resultData.automationScript) {
      // Save Automation Script in DB
      const script = resultData.automationScript;

      // Delete existing script of same framework
      await db.automationScript.deleteMany({
        where: { userStoryId, framework: script.framework }
      });

      savedItem = await db.automationScript.create({
        data: {
          userStoryId,
          framework: script.framework,
          language: script.language,
          fileName: script.fileName,
          sourceCode: script.sourceCode,
          mappedTestCaseTitlesJson: JSON.stringify(script.mappedTestCaseTitles),
          status: "AI_Draft_Unexecuted",
          generatedByAgentRunId: agentRunId
        }
      });
    }

    // 3. Update AgentRun success status
    await db.agentRun.update({
      where: { id: agentRunId },
      data: {
        status: "Succeeded",
        outputJson: JSON.stringify(resultData),
        completedAt: new Date()
      }
    });

    // 4. Log audit log
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "Agent",
        actorId: "QA_Agent",
        action: `GENERATE_QA_${actionType.toUpperCase()}_SUCCESS`,
        entityType: "UserStory",
        entityId: userStoryId,
        afterSnapshotJson: JSON.stringify(savedItem)
      }
    });

    return NextResponse.json({ success: true, data: savedItem });

  } catch (error: any) {
    console.error("QA Agent failed:", error);

    if (agentRunId) {
      await db.agentRun.update({
        where: { id: agentRunId },
        data: {
          status: "Failed",
          errorMessage: error.message || "Unknown QA generation error",
          completedAt: new Date()
        }
      });

      if (projectId) {
        await db.auditLog.create({
          data: {
            projectId,
            actorType: "Agent",
            actorId: "QA_Agent",
            action: `GENERATE_QA_FAILED`,
            entityType: "AgentRun",
            entityId: agentRunId,
            afterSnapshotJson: JSON.stringify({ error: error.message || "Unknown error" })
          }
        });
      }
    }

    return NextResponse.json({ error: error.message || "QA generation failed" }, { status: 500 });
  }
}
