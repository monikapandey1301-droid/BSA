"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/lib/AppContext";
import {
  ShieldCheck,
  FileCode,
  Zap,
  Check,
  AlertTriangle,
  Play,
  RotateCw,
  Clock,
  Download,
  Terminal,
  Eye,
  FileText,
  ChevronDown,
  ChevronRight
} from "lucide-react";

interface AcceptanceCriterion {
  id: string;
  scenarioName: string;
  gherkinText: string;
}

interface TestCase {
  id: string;
  title: string;
  preconditions: string | null;
  stepsJson: string;
  expectedResult: string | null;
  priority: string;
  status: string;
}

interface AutomationScript {
  id: string;
  framework: string;
  language: string;
  fileName: string;
  sourceCode: string;
  status: string;
}

interface ApprovedStory {
  id: string;
  role: string;
  capability: string;
  benefit: string;
  status: string;
  acceptanceCriteria: AcceptanceCriterion[];
  testCases: TestCase[];
  automationScripts: AutomationScript[];
  feature: {
    title: string;
    epic: {
      title: string;
    }
  }
}

export default function QAAutomationPage() {
  const { currentProject, currentRole } = useApp();
  const [stories, setStories] = useState<ApprovedStory[]>([]);
  const [loading, setLoading] = useState(false);

  // Expanded stories accordions
  const [expandedStories, setExpandedStories] = useState<Record<string, boolean>>({});

  // Loading states per story for generations
  const [generatingTests, setGeneratingTests] = useState<Record<string, boolean>>({});
  const [generatingScripts, setGeneratingScripts] = useState<Record<string, boolean>>({});
  const [approvingItems, setApprovingItems] = useState<Record<string, boolean>>({});

  // Code preview drawer state
  const [previewScript, setPreviewScript] = useState<AutomationScript | null>(null);

  const fetchQAData = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/qa?projectId=${currentProject.id}`);
      if (res.ok) {
        const data = await res.json();
        setStories(data);
        
        // Auto-expand first story if any
        if (data.length > 0) {
          setExpandedStories({ [data[0].id]: true });
        }
      }
    } catch (err) {
      console.error("Failed to load QA data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQAData();
  }, [currentProject]);

  const toggleStory = (id: string) => {
    setExpandedStories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGenerateTestCases = async (storyId: string) => {
    setGeneratingTests(prev => ({ ...prev, [storyId]: true }));
    try {
      const res = await fetch("/api/agents/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userStoryId: storyId,
          actionType: "test_cases",
          role: currentRole
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate test cases");
      }

      await fetchQAData();
    } catch (err: any) {
      alert(err.message || "Test Case generation failed");
    } finally {
      setGeneratingTests(prev => ({ ...prev, [storyId]: false }));
    }
  };

  const handleGenerateScript = async (storyId: string) => {
    setGeneratingScripts(prev => ({ ...prev, [storyId]: true }));
    try {
      const res = await fetch("/api/agents/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userStoryId: storyId,
          actionType: "automation_script",
          role: currentRole
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate automation script");
      }

      await fetchQAData();
    } catch (err: any) {
      alert(err.message || "Automation script generation failed");
    } finally {
      setGeneratingScripts(prev => ({ ...prev, [storyId]: false }));
    }
  };

  const handleApproveQAItem = async (itemId: string, itemType: "test_case" | "script") => {
    if (currentRole !== "QA" && currentRole !== "Admin") {
      alert("Only QA Engineers or Administrators can approve QA artifacts.");
      return;
    }

    setApprovingItems(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch("/api/qa/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          itemType,
          role: currentRole
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to approve");
      }

      await fetchQAData();
    } catch (err: any) {
      alert(err.message || "Approval failed");
    } finally {
      setApprovingItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleDownloadScript = (script: AutomationScript) => {
    const blob = new Blob([script.sourceCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = script.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Header */}
        <div>
          <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-secondary)" }}>
            Module
          </span>
          <h1>QA & Test Automation</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Review Gherkin scenarios, generate manual test steps, and scaffold Playwright/Postman functional scripts for approved user stories.
          </p>
        </div>

        {!currentProject ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px" }}>
            <AlertTriangle size={36} style={{ color: "var(--accent-secondary)", marginBottom: "12px" }} />
            <p>Please select an active project to access the QA module.</p>
          </div>
        ) : loading && stories.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
            <div className="spinner"></div>
          </div>
        ) : stories.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px" }}>
            <AlertTriangle size={24} style={{ color: "var(--accent-secondary)", marginBottom: "8px" }} />
            <p style={{ color: "var(--text-secondary)" }}>No Approved User Stories found in this project.</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
              Go to the <strong>Requirements Tree</strong> and approve stories as a <strong>Product Owner</strong> to make them available here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Role indicator warning */}
            {currentRole !== "QA" && currentRole !== "Admin" && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.8rem",
                color: "var(--accent-secondary)",
                background: "rgba(102, 252, 241, 0.03)",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid rgba(102, 252, 241, 0.1)"
              }}>
                <Clock size={14} />
                <span>
                  You are currently acting as a <strong>{currentRole}</strong>. To perform QA actions like generating test cases or approving scripts, switch your role to <strong>QA Engineer</strong> or <strong>Admin</strong>.
                </span>
              </div>
            )}

            {/* List of Approved Stories */}
            {stories.map((story) => {
              const isExpanded = expandedStories[story.id];
              return (
                <div key={story.id} className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
                  
                  {/* Story Accordion Header */}
                  <div 
                    onClick={() => toggleStory(story.id)}
                    style={{
                      padding: "20px 24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      background: "rgba(255, 255, 255, 0.01)",
                      borderBottom: isExpanded ? "1px solid var(--border-color)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--accent-secondary)", fontWeight: "600", textTransform: "uppercase" }}>
                          {story.feature.epic.title} &rarr; {story.feature.title}
                        </span>
                        <h3 style={{ fontSize: "1rem", color: "#ffffff", fontWeight: "600" }}>
                          {story.capability}
                        </h3>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", fontSize: "0.75rem", color: "var(--text-secondary)", flexShrink: 0 }}>
                      <span>Test Cases: {story.testCases.length}</span>
                      <span>•</span>
                      <span>Scripts: {story.automationScripts.length}</span>
                    </div>
                  </div>

                  {/* Story Accordion Content */}
                  {isExpanded && (
                    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                      
                      {/* Gherkin Reference */}
                      <div style={{ padding: "16px", background: "rgba(11, 12, 16, 0.4)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-primary)" }}>Gherkin Scenario Reference:</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                          {story.acceptanceCriteria.map((ac) => (
                            <pre key={ac.id} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", overflowX: "auto" }}>
                              {ac.gherkinText}
                            </pre>
                          ))}
                        </div>
                      </div>

                      {/* Manual Test Cases Section */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <h4 style={{ color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                            <ShieldCheck size={18} style={{ color: "var(--accent-primary)" }} /> Manual Test Suite
                          </h4>
                          {story.testCases.length === 0 && (
                            <button
                              onClick={() => handleGenerateTestCases(story.id)}
                              className="btn btn-primary"
                              style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                              disabled={generatingTests[story.id]}
                            >
                              {generatingTests[story.id] ? (
                                <>
                                  <RotateCw size={12} className="spinner" /> Generating...
                                </>
                              ) : (
                                <>
                                  <Zap size={12} /> Generate Test Cases
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {story.testCases.length > 0 ? (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                            {story.testCases.map((tc) => {
                              const steps: any[] = JSON.parse(tc.stepsJson);
                              const isApproved = tc.status === "Approved";
                              return (
                                <div key={tc.id} style={{
                                  padding: "16px",
                                  background: "rgba(11, 12, 16, 0.5)",
                                  border: "1px solid var(--border-color)",
                                  borderRadius: "8px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px"
                                }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontWeight: "600", color: "#ffffff", fontSize: "0.9rem" }}>
                                      {tc.title}
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <span className={isApproved ? "status-badge status-validated" : "status-badge status-ai-draft"} style={{ fontSize: "0.6rem" }}>
                                        {tc.status}
                                      </span>
                                      {!isApproved && (
                                        <button
                                          onClick={() => handleApproveQAItem(tc.id, "test_case")}
                                          className="btn btn-secondary"
                                          style={{ padding: "4px 8px", fontSize: "0.7rem", height: "24px" }}
                                          disabled={approvingItems[tc.id]}
                                        >
                                          <Check size={10} /> Approve
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {tc.preconditions && (
                                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                      <strong>Preconditions:</strong> {tc.preconditions}
                                    </span>
                                  )}

                                  {/* Steps Table */}
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                                    <thead>
                                      <tr style={{ borderBottom: "1px solid rgba(102, 252, 241, 0.1)" }}>
                                        <th style={{ textAlign: "left", padding: "6px", color: "var(--accent-secondary)" }}>#</th>
                                        <th style={{ textAlign: "left", padding: "6px", color: "var(--accent-secondary)" }}>Action</th>
                                        <th style={{ textAlign: "left", padding: "6px", color: "var(--accent-secondary)" }}>Expected Result</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {steps.map((step, sIdx) => (
                                        <tr key={sIdx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.02)" }}>
                                          <td style={{ padding: "6px", color: "#ffffff", fontWeight: "600", width: "30px" }}>{step.step_no}</td>
                                          <td style={{ padding: "6px", color: "var(--text-secondary)" }}>{step.action}</td>
                                          <td style={{ padding: "6px", color: "var(--text-secondary)" }}>{step.expected}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontStyle: "italic" }}>
                            No manual test cases generated yet. Click the button above to run the QA Agent.
                          </p>
                        )}
                      </div>

                      {/* Automated Test Scripts Section */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <h4 style={{ color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FileCode size={18} style={{ color: "var(--accent-primary)" }} /> Automation Scripts
                          </h4>
                          {story.automationScripts.length === 0 && (
                            <button
                              onClick={() => handleGenerateScript(story.id)}
                              className="btn btn-primary"
                              style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                              disabled={generatingScripts[story.id]}
                            >
                              {generatingScripts[story.id] ? (
                                <>
                                  <RotateCw size={12} className="spinner" /> Generating...
                                </>
                              ) : (
                                <>
                                  <Terminal size={12} /> Generate Playwright Script
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {story.automationScripts.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {story.automationScripts.map((script) => {
                              const isApproved = script.status === "Approved";
                              return (
                                <div key={script.id} style={{
                                  padding: "16px",
                                  background: "rgba(11, 12, 16, 0.5)",
                                  border: "1px solid var(--border-color)",
                                  borderRadius: "8px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}>
                                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                    <FileCode size={20} style={{ color: "var(--accent-secondary)" }} />
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                      <span style={{ fontWeight: "600", color: "#ffffff", fontSize: "0.85rem" }}>
                                        {script.fileName}
                                      </span>
                                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                        Framework: {script.framework} • Language: {script.language}
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span className={isApproved ? "status-badge status-validated" : "status-badge status-ai-draft"} style={{ fontSize: "0.6rem" }}>
                                      {script.status}
                                    </span>
                                    <button
                                      onClick={() => setPreviewScript(script)}
                                      className="btn btn-secondary"
                                      style={{ padding: "4px 8px", fontSize: "0.7rem", height: "24px" }}
                                    >
                                      <Eye size={10} /> Code Preview
                                    </button>
                                    <button
                                      onClick={() => handleDownloadScript(script)}
                                      className="btn btn-secondary"
                                      style={{ padding: "4px 8px", fontSize: "0.7rem", height: "24px" }}
                                    >
                                      <Download size={10} /> Download
                                    </button>
                                    {!isApproved && (
                                      <button
                                        onClick={() => handleApproveQAItem(script.id, "script")}
                                        className="btn btn-secondary"
                                        style={{ padding: "4px 8px", fontSize: "0.7rem", height: "24px", borderColor: "rgba(16, 185, 129, 0.3)" }}
                                        disabled={approvingItems[script.id]}
                                      >
                                        <Check size={10} style={{ color: "#10b981" }} /> Approve
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontStyle: "italic" }}>
                            No automated script generated yet. Click the button above to run the QA Agent.
                          </p>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              );
            })}

          </div>
        )}

        {/* Code Preview Modal Drawer */}
        {previewScript && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div className="glass-panel animate-fade-in" style={{ width: "800px", maxWidth: "90%", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <div>
                  <h3 style={{ color: "#ffffff" }}>QA Automation Script Preview</h3>
                  <span style={{ fontSize: "0.8rem", color: "var(--accent-secondary)" }}>{previewScript.fileName} ({previewScript.framework})</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn btn-secondary" onClick={() => handleDownloadScript(previewScript)}>
                    <Download size={14} /> Download
                  </button>
                  <button className="btn btn-secondary" onClick={() => setPreviewScript(null)}>Close</button>
                </div>
              </div>
              <div style={{
                flexGrow: 1,
                overflowY: "auto",
                background: "rgba(11, 12, 16, 0.6)",
                border: "1px solid var(--border-color)",
                padding: "20px",
                borderRadius: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                lineHeight: "1.5"
              }}>
                {previewScript.sourceCode}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
