import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { parseSpecFromText } from "@/lib/specParser";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  let agentRunId = "";
  let projectId = "";
  try {
    const body = await req.json();
    const { documentId, role } = body;
    projectId = body.projectId;

    if (!documentId || !projectId) {
      return NextResponse.json({ error: "documentId and projectId are required" }, { status: 400 });
    }

    // 1. Fetch document text
    const doc = await db.document.findUnique({
      where: { id: documentId }
    });

    if (!doc || !doc.parsedText) {
      return NextResponse.json({ error: "Document text has not been parsed yet." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isLocalFallback = !apiKey;

    // 2. Create AgentRun entry
    const agentRun = await db.agentRun.create({
      data: {
        projectId,
        agentType: "BSA",
        modelName: isLocalFallback ? "RegExp Spec Parser" : "gemini-2.5-flash",
        modelVersion: isLocalFallback ? "v1.0-local" : "latest",
        promptTemplateVersion: "bsa.generate.v1",
        status: "Running",
        inputJson: JSON.stringify({ documentId, role, documentLength: doc.parsedText.length })
      }
    });
    agentRunId = agentRun.id;

    // 3. Log Audit Log for Agent Trigger
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "User",
        actorId: role,
        action: "TRIGGER_BSA_AGENT",
        entityType: "AgentRun",
        entityId: agentRunId
      }
    });

    let generatedData;

    if (isLocalFallback) {
      // Run high-fidelity RegExp parser fallback
      console.warn("GEMINI_API_KEY is not configured. Falling back to local RegExp Spec Parser.");
      const parsedEpics = parseSpecFromText(doc.parsedText);
      generatedData = { epics: parsedEpics };
    } else {
      // Call Gemini API
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: {
            responseMimeType: "application/json"
          }
        });

        const prompt = `You are a Senior Business/Systems Analyst (BSA Agent). 
Your task is to analyze the provided raw requirement document and extract a structured hierarchy of Epics -> Features -> User Stories -> Gherkin Acceptance Criteria.

Format your output EXACTLY matching this JSON schema:
{
  "epics": [
    {
      "title": "string",
      "description": "string",
      "features": [
        {
          "title": "string",
          "description": "string",
          "user_stories": [
            {
              "id_ref": "string (e.g. US-0101)",
              "role": "string (e.g. As a Business Analyst)",
              "capability": "string (e.g. I want to create a new project)",
              "benefit": "string (e.g. so that I can organize requirements)",
              "acceptance_criteria": [
                {
                  "scenario_name": "string",
                  "gherkin": "Feature: ...\\n  Scenario: ...\\n    Given ...\\n    When ...\\n    Then ..."
                }
              ],
              "source_text_snippet": "string (brief sentence from source doc containing this requirement)"
            }
          ]
        }
      ]
    }
  ]
}

Provide Gherkin format for each Acceptance Criterion. Ensure it is complete Gherkin syntax.
Do not invent requirements not traceable to the source document text.

Document Text to parse:
---
${doc.parsedText}
---`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        generatedData = JSON.parse(responseText);
      } catch (err: any) {
        console.error("Gemini API call failed, running RegExp parser fallback:", err);
        const parsedEpics = parseSpecFromText(doc.parsedText);
        generatedData = { epics: parsedEpics };
      }
    }

    // 4. Persist Epics, Features, User Stories in database
    for (const epicData of generatedData.epics) {
      // Create Epic
      const epic = await db.epic.create({
        data: {
          projectId,
          title: epicData.title,
          description: epicData.description,
          sourceDocumentId: documentId,
          createdBy: "BSA_Agent"
        }
      });

      for (const featData of epicData.features) {
        // Create Feature
        const feature = await db.feature.create({
          data: {
            epicId: epic.id,
            title: featData.title,
            description: featData.description
          }
        });

        for (const storyData of featData.user_stories) {
          // Create UserStory
          const story = await db.userStory.create({
            data: {
              featureId: feature.id,
              role: storyData.role,
              capability: storyData.capability,
              benefit: storyData.benefit,
              status: "AI_Draft",
              sourceSpanRef: JSON.stringify({ snippet: storyData.source_text_snippet, id_ref: storyData.id_ref }),
              generatedByAgentRunId: agentRunId
            }
          });

          // Create AcceptanceCriteria
          for (const acData of storyData.acceptance_criteria) {
            await db.acceptanceCriterion.create({
              data: {
                userStoryId: story.id,
                scenarioName: acData.scenario_name,
                gherkinText: acData.gherkin
              }
            });
          }

          // Create initial StoryVersion snapshot
          await db.storyVersion.create({
            data: {
              userStoryId: story.id,
              versionNo: 1,
              contentSnapshot: JSON.stringify({
                role: story.role,
                capability: story.capability,
                benefit: story.benefit,
                acceptanceCriteria: storyData.acceptance_criteria
              }),
              editedBy: "BSA_Agent",
              editType: "AI"
            }
          });
        }
      }
    }

    // 5. Update AgentRun success status
    const completedAgentRun = await db.agentRun.update({
      where: { id: agentRunId },
      data: {
        status: "Succeeded",
        outputJson: JSON.stringify(generatedData),
        completedAt: new Date()
      }
    });

    // 6. Log audit log
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "Agent",
        actorId: "BSA_Agent",
        action: "GENERATE_REQUIREMENTS_SUCCESS",
        entityType: "Document",
        entityId: documentId,
        afterSnapshotJson: JSON.stringify({ agentRunId, status: "Succeeded" })
      }
    });

    return NextResponse.json({ success: true, agentRun: completedAgentRun });

  } catch (error: any) {
    console.error("BSA Agent generation failed:", error);
    
    if (agentRunId) {
      await db.agentRun.update({
        where: { id: agentRunId },
        data: {
          status: "Failed",
          errorMessage: error.message || "Unknown error occurred",
          completedAt: new Date()
        }
      });

      if (projectId) {
        await db.auditLog.create({
          data: {
            projectId,
            actorType: "Agent",
            actorId: "BSA_Agent",
            action: "GENERATE_REQUIREMENTS_FAILED",
            entityType: "AgentRun",
            entityId: agentRunId,
            afterSnapshotJson: JSON.stringify({ error: error.message || "Unknown error occurred" })
          }
        });
      }
    }

    return NextResponse.json({ error: error.message || "Requirement generation failed" }, { status: 500 });
  }
}
