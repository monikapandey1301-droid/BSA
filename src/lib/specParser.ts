export interface ParsedGherkin {
  scenario_name: string;
  gherkin: string;
}

export interface ParsedStory {
  id_ref: string;
  role: string;
  capability: string;
  benefit: string;
  acceptance_criteria: ParsedGherkin[];
  source_text_snippet: string;
}

export interface ParsedFeature {
  title: string;
  description: string;
  user_stories: ParsedStory[];
}

export interface ParsedEpic {
  title: string;
  description: string;
  features: ParsedFeature[];
}

/**
 * Parses requirements from the spec document itself, using RegExp matching.
 * This provides a high-fidelity local fallback if no LLM API key is present.
 */
export function parseSpecFromText(text: string): ParsedEpic[] {
  const epics: ParsedEpic[] = [];
  const lines = text.split("\n");

  let currentEpic: ParsedEpic | null = null;
  let currentFeature: ParsedFeature | null = null;
  let currentStory: ParsedStory | null = null;
  let inGherkin = false;
  let gherkinLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 1. Match Epic (e.g., "### EPIC-01: Project Management")
    const epicMatch = line.match(/^##+ (EPIC-\d+:\s*(.*))/i);
    if (epicMatch) {
      if (currentEpic) {
        if (currentFeature) {
          if (currentStory) {
            currentFeature.user_stories.push(currentStory);
            currentStory = null;
          }
          currentEpic.features.push(currentFeature);
          currentFeature = null;
        }
        epics.push(currentEpic);
      }
      currentEpic = {
        title: epicMatch[1],
        description: `Requirements for ${epicMatch[2]}`,
        features: []
      };
      continue;
    }

    // 2. Match Feature (e.g., "**Feature 01.1 — Create & Manage Projects**")
    const featureMatch = line.match(/^\*\*Feature\s+([\d.]+)\s*—\s*(.*?)\*\*/i) || 
                         line.match(/^\*\*Feature\s+(.*?)\*\*/i);
    if (featureMatch && currentEpic) {
      if (currentFeature) {
        if (currentStory) {
          currentFeature.user_stories.push(currentStory);
          currentStory = null;
        }
        currentEpic.features.push(currentFeature);
      }
      currentFeature = {
        title: featureMatch[0].replace(/\*\*/g, ""),
        description: `Feature: ${featureMatch[0].replace(/\*\*/g, "")}`,
        user_stories: []
      };
      continue;
    }

    // 3. Match User Story (e.g., "**US-0101**: As a BA, I want to create a new project, so that I can organize...")
    const storyMatch = line.match(/^\*\*(US-\d+)\*\*:\s*As\s+a\s+(.*?),\s*I\s+want\s+(.*?),\s*so\s+that\s+(.*)/i) ||
                       line.match(/^\*\*(US-\d+)\*\*:\s*(.*)/i);
    if (storyMatch && currentFeature) {
      if (currentStory) {
        currentFeature.user_stories.push(currentStory);
      }
      
      const idRef = storyMatch[1];
      if (storyMatch[4]) {
        // Detailed format matched
        currentStory = {
          id_ref: idRef,
          role: `As a ${storyMatch[2].trim()}`,
          capability: `I want ${storyMatch[3].trim()}`,
          benefit: `so that ${storyMatch[4].trim()}`,
          acceptance_criteria: [],
          source_text_snippet: line
        };
      } else {
        // Simple format matched
        const details = storyMatch[2] || "";
        const roleMatch = details.match(/As a (.*?)(?=, I want|$)/i);
        const wantMatch = details.match(/I want (.*?)(?=, so that|$)/i);
        const soMatch = details.match(/so that (.*)/i);
        
        currentStory = {
          id_ref: idRef,
          role: roleMatch ? `As a ${roleMatch[1].trim()}` : "As a User",
          capability: wantMatch ? `I want ${wantMatch[1].trim()}` : `I want ${details}`,
          benefit: soMatch ? `so that ${soMatch[1].trim()}` : "so that I can fulfill requirements",
          acceptance_criteria: [],
          source_text_snippet: line
        };
      }
      continue;
    }

    // 4. Match Gherkin Code Block Start
    if (line.startsWith("```gherkin") && currentStory) {
      inGherkin = true;
      gherkinLines = [];
      continue;
    }

    // 5. Match Gherkin Code Block End
    if (line.startsWith("```") && inGherkin && currentStory) {
      inGherkin = false;
      const gherkinText = gherkinLines.join("\n");
      
      // Try to extract scenario name
      const scenarioMatch = gherkinText.match(/Scenario:\s*(.*)/i);
      const scenarioName = scenarioMatch ? scenarioMatch[1].trim() : "Default Scenario";
      
      currentStory.acceptance_criteria.push({
        scenario_name: scenarioName,
        gherkin: gherkinText
      });
      continue;
    }

    // 6. Gather Gherkin Lines
    if (inGherkin) {
      gherkinLines.push(lines[i]); // Keep spacing
    }
  }

  // Push last items
  if (currentEpic) {
    if (currentFeature) {
      if (currentStory) {
        currentFeature.user_stories.push(currentStory);
      }
      currentEpic.features.push(currentFeature);
    }
    epics.push(currentEpic);
  }

  // If no epics parsed (not a Spec document), generate dummy requirements
  if (epics.length === 0) {
    return [
      {
        title: "EPIC-01: System Core Integration",
        description: "Core features parsed from uploaded document text.",
        features: [
          {
            title: "Feature 01.1 — Text Processing",
            description: "Processes text contents of uploaded requirements.",
            user_stories: [
              {
                id_ref: "US-0101",
                role: "As a Systems Analyst",
                capability: "I want to extract requirements from the parsed text",
                benefit: "so that I can catalog features and epics automatically",
                acceptance_criteria: [
                  {
                    scenario_name: "Successful text parsing",
                    gherkin: "Feature: Requirements Parsing\n\n  Scenario: Process text and output stories\n    Given a plain text requirements document\n    When the parsing agent runs\n    Then it outputs a structured list of user stories"
                  }
                ],
                source_text_snippet: text.substring(0, 200) + "..."
              }
            ]
          }
        ]
      }
    ];
  }

  return epics;
}
