"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/lib/AppContext";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit2,
  Check,
  AlertTriangle,
  Play,
  RotateCw,
  Clock,
  UserCheck,
  XCircle,
  HelpCircle,
  FileCode2,
  Trash2
} from "lucide-react";

interface AcceptanceCriterion {
  id: string;
  scenarioName: string;
  gherkinText: string;
}

interface ValidationResult {
  id: string;
  verdict: string;
  issuesJson: string;
  createdAt: string;
}

interface UserStory {
  id: string;
  role: string;
  capability: string;
  benefit: string;
  status: string;
  currentVersion: number;
  acceptanceCriteria: AcceptanceCriterion[];
  validationResults: ValidationResult[];
}

interface Feature {
  id: string;
  title: string;
  description: string | null;
  status: string;
  userStories: UserStory[];
}

interface Epic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  features: Feature[];
}

export default function RequirementsPage() {
  const { currentProject, currentRole } = useApp();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(false);

  // Tree states
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Active Story selection
  const [selectedStory, setSelectedStory] = useState<UserStory | null>(null);
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  
  // Panel modes: "view" | "edit" | "create"
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "create">("view");

  // Edit / Create Form states
  const [formRole, setFormRole] = useState("");
  const [formCapability, setFormCapability] = useState("");
  const [formBenefit, setFormBenefit] = useState("");
  const [formCriteria, setFormCriteria] = useState<Array<{ id?: string; scenarioName: string; gherkinText: string }>>([]);
  const [formError, setFormError] = useState("");
  const [savingForm, setSavingForm] = useState(false);

  // Validation execution state
  const [validatingStoryId, setValidatingStoryId] = useState<string | null>(null);
  
  // Change request comment
  const [changeComment, setChangeComment] = useState("");
  const [showChangeComment, setShowChangeComment] = useState(false);

  const fetchRequirements = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/requirements?projectId=${currentProject.id}`);
      if (res.ok) {
        const data = await res.json();
        setEpics(data);
        
        // Auto-expand first epic
        if (data.length > 0) {
          setExpandedNodes(prev => ({
            ...prev,
            [data[0].id]: true
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load requirements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
    setSelectedStory(null);
    setPanelMode("view");
  }, [currentProject]);

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleStorySelect = (story: UserStory) => {
    setSelectedStory(story);
    setPanelMode("view");
    setShowChangeComment(false);
    setChangeComment("");
  };

  const handleStartEdit = () => {
    if (!selectedStory) return;
    setFormRole(selectedStory.role);
    setFormCapability(selectedStory.capability);
    setFormBenefit(selectedStory.benefit);
    setFormCriteria((selectedStory.acceptanceCriteria || []).map(ac => ({
      id: ac.id,
      scenarioName: ac.scenarioName,
      gherkinText: ac.gherkinText
    })));
    setFormError("");
    setPanelMode("edit");
  };

  const handleStartCreate = (featureId: string) => {
    setActiveFeatureId(featureId);
    setFormRole("As a [Persona]");
    setFormCapability("I want [Capability]");
    setFormBenefit("so that [Benefit]");
    setFormCriteria([
      {
        scenarioName: "Successful execution",
        gherkinText: "Feature: Feature description\n\n  Scenario: Successful execution\n    Given some precondition\n    When some action is taken\n    Then verify the outcome"
      }
    ]);
    setFormError("");
    setPanelMode("create");
  };

  const handleAddCriteria = () => {
    setFormCriteria(prev => [
      ...prev,
      {
        scenarioName: "New Scenario",
        gherkinText: "Feature: Feature description\n\n  Scenario: New Scenario\n    Given some precondition\n    When some action is taken\n    Then verify the outcome"
      }
    ]);
  };

  const handleRemoveCriteria = (index: number) => {
    setFormCriteria(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCriteriaChange = (index: number, key: "scenarioName" | "gherkinText", value: string) => {
    setFormCriteria(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRole.trim() || !formCapability.trim() || !formBenefit.trim()) {
      setFormError("All fields (Role, Capability, Benefit) are required.");
      return;
    }
    if (formCriteria.length === 0) {
      setFormError("At least one Acceptance Gherkin Scenario is required.");
      return;
    }

    setFormError("");
    setSavingForm(true);

    try {
      const url = panelMode === "edit" 
        ? `/api/requirements/story/${selectedStory?.id}`
        : `/api/requirements/story`;

      const method = panelMode === "edit" ? "PUT" : "POST";
      const payload = panelMode === "edit"
        ? {
            role: formRole.trim(),
            capability: formCapability.trim(),
            benefit: formBenefit.trim(),
            acceptanceCriteria: formCriteria,
            editorRole: currentRole
          }
        : {
            featureId: activeFeatureId,
            role: formRole.trim(),
            capability: formCapability.trim(),
            benefit: formBenefit.trim(),
            acceptanceCriteria: formCriteria,
            editorRole: currentRole
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save story");
      }

      const updated = await res.json();
      await fetchRequirements();
      setSelectedStory(updated);
      setPanelMode("view");
    } catch (err: any) {
      setFormError(err.message || "An error occurred");
    } finally {
      setSavingForm(false);
    }
  };

  const handleTriggerValidation = async () => {
    if (!selectedStory || validatingStoryId) return;
    setValidatingStoryId(selectedStory.id);

    try {
      const res = await fetch("/api/agents/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userStoryId: selectedStory.id,
          role: currentRole
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Validation failed");
      }

      const data = await res.json();
      await fetchRequirements();
      setSelectedStory(data.story);
    } catch (err: any) {
      alert(err.message || "Validation execution failed");
    } finally {
      setValidatingStoryId(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedStory) return;
    
    // Role Check
    if (currentRole !== "PO" && currentRole !== "Admin") {
      alert("Only Product Owners or Admins can approve stories.");
      return;
    }

    try {
      const res = await fetch(`/api/requirements/story/${selectedStory.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: currentRole })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to approve");
      }

      const data = await res.json();
      await fetchRequirements();
      setSelectedStory(data.story);
    } catch (err: any) {
      alert(err.message || "Approval failed");
    }
  };

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStory) return;
    if (!changeComment.trim()) {
      alert("Please provide a comment explaining the requested changes.");
      return;
    }

    // Role Check
    if (currentRole !== "PO" && currentRole !== "Admin") {
      alert("Only Product Owners or Admins can request changes.");
      return;
    }

    try {
      const res = await fetch(`/api/requirements/story/${selectedStory.id}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: currentRole,
          comment: changeComment.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to request changes");
      }

      const data = await res.json();
      await fetchRequirements();
      setSelectedStory(data.story);
      setShowChangeComment(false);
      setChangeComment("");
    } catch (err: any) {
      alert(err.message || "Request changes failed");
    }
  };

  const getStatusClass = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes("AI_DRAFT")) return "status-badge status-ai-draft";
    if (s.includes("MANUAL_DRAFT")) return "status-badge status-manual-draft";
    if (s.includes("APPROVED")) return "status-badge status-validated";
    if (s.includes("WARNINGS")) return "status-badge status-validated-warnings";
    if (s.includes("FAILED")) return "status-badge status-failed";
    if (s.includes("PENDING")) return "status-badge status-pending";
    if (s.includes("CHANGES")) return "status-badge status-changes-requested";
    return "status-badge status-manual-draft";
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict.toUpperCase()) {
      case "PASS":
        return <Check size={16} style={{ color: "#10b981" }} />;
      case "PASS_WITH_WARNINGS":
        return <AlertTriangle size={16} style={{ color: "#fbbf24" }} />;
      case "FAIL":
        return <XCircle size={16} style={{ color: "#ef4444" }} />;
      default:
        return <HelpCircle size={16} />;
    }
  };

  // Re-fetch latest story data when selectedStory updates
  useEffect(() => {
    if (selectedStory && epics.length > 0) {
      // Find matching story from freshly loaded epics list
      let matched: UserStory | null = null;
      for (const epic of epics) {
        for (const feature of epic.features) {
          const match = feature.userStories.find(s => s.id === selectedStory.id);
          if (match) {
            matched = match;
            break;
          }
        }
      }
      if (matched) {
        setSelectedStory(matched);
      }
    }
  }, [epics]);

  return (
    <DashboardLayout>
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px", height: "calc(100vh - 120px)" }}>
        
        {/* Header */}
        <div>
          <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-secondary)" }}>
            Module
          </span>
          <h1>Requirements Repository</h1>
        </div>

        {!currentProject ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px" }}>
            <AlertTriangle size={36} style={{ color: "var(--accent-secondary)", marginBottom: "12px" }} />
            <p>Please select an active project to view the requirements repository.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "24px", flexGrow: 1, overflow: "hidden" }}>
            
            {/* Left Column: Requirements Tree */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
              <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>Hierarchy Tree</h3>
              
              {loading && epics.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                  <div className="spinner"></div>
                </div>
              ) : epics.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                  No requirement Epics generated yet. Please upload a requirements document first.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {epics.map((epic) => {
                    const isEpicExpanded = expandedNodes[epic.id];
                    return (
                      <div key={epic.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        
                        {/* Epic Header Row */}
                        <div 
                          onClick={() => toggleNode(epic.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            cursor: "pointer",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            background: "rgba(102, 252, 241, 0.03)",
                            border: "1px solid rgba(102, 252, 241, 0.05)"
                          }}
                        >
                          {isEpicExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <FolderOpen size={16} style={{ color: "var(--text-primary)" }} />
                          <span style={{ fontWeight: "700", fontSize: "0.9rem", color: "#ffffff" }}>{epic.title}</span>
                        </div>

                        {/* Epic Features container */}
                        {isEpicExpanded && (
                          <div className="tree-node" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {epic.features.map((feat) => {
                              const isFeatExpanded = expandedNodes[feat.id];
                              return (
                                <div key={feat.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  
                                  {/* Feature Header Row */}
                                  <div 
                                    onClick={() => toggleNode(feat.id)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      cursor: "pointer",
                                      padding: "6px 8px",
                                      borderRadius: "6px",
                                      background: "rgba(255, 255, 255, 0.02)"
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      {isFeatExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      <Folder size={14} style={{ color: "var(--accent-secondary)" }} />
                                      <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                        {feat.title}
                                      </span>
                                    </div>
                                    
                                    {/* Add Story trigger */}
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartCreate(feat.id);
                                      }}
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--accent-primary)",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center"
                                      }}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>

                                  {/* User Stories list */}
                                  {isFeatExpanded && (
                                    <div className="tree-node" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                      {feat.userStories.map((story) => {
                                        const isSelected = selectedStory?.id === story.id;
                                        return (
                                          <div
                                            key={story.id}
                                            onClick={() => handleStorySelect(story)}
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "space-between",
                                              cursor: "pointer",
                                              padding: "6px 12px",
                                              borderRadius: "6px",
                                              background: isSelected ? "rgba(102, 252, 241, 0.08)" : "transparent",
                                              border: isSelected ? "1px solid rgba(102, 252, 241, 0.2)" : "1px solid transparent",
                                              transition: "all 0.15s ease"
                                            }}
                                          >
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                                              <FileText size={12} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                                              <span style={{
                                                fontSize: "0.8rem",
                                                color: isSelected ? "#ffffff" : "var(--text-secondary)",
                                                textOverflow: "ellipsis",
                                                overflow: "hidden",
                                                whiteSpace: "nowrap"
                                              }}>
                                                {story.capability}
                                              </span>
                                            </div>
                                            <span 
                                              className={getStatusClass(story.status)} 
                                              style={{ fontSize: "0.55rem", padding: "1px 6px", flexShrink: 0, marginLeft: "8px" }}
                                            >
                                              {story.status.replace(/_/g, " ")}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                </div>
                              );
                            })}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Story Detail / Forms */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
              
              {/* Viewing state */}
              {panelMode === "view" && selectedStory && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  
                  {/* Header Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                    <div>
                      <h3 style={{ color: "#ffffff" }}>User Story Detail</h3>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Version v{selectedStory.currentVersion}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span className={getStatusClass(selectedStory.status)}>
                        {selectedStory.status.replace(/_/g, " ")}
                      </span>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={handleStartEdit}>
                        <Edit2 size={12} /> Edit
                      </button>
                    </div>
                  </div>

                  {/* Story Description */}
                  <div style={{ padding: "16px", background: "rgba(11, 12, 16, 0.4)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <span style={{ color: "var(--accent-primary)", fontWeight: "600", fontSize: "0.85rem" }}>Structured Story</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "12px" }}>
                        <p style={{ color: "#ffffff", fontSize: "0.95rem" }}>
                          <strong>Role:</strong> {selectedStory.role}
                        </p>
                        <p style={{ color: "#ffffff", fontSize: "0.95rem" }}>
                          <strong>Capability:</strong> {selectedStory.capability}
                        </p>
                        <p style={{ color: "#ffffff", fontSize: "0.95rem" }}>
                          <strong>Benefit:</strong> {selectedStory.benefit}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Gherkin Criteria */}
                  <div>
                    <h4 style={{ color: "#ffffff", marginBottom: "10px" }}>Gherkin Acceptance Criteria</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {(selectedStory.acceptanceCriteria || []).map((ac, idx) => (
                        <div key={ac.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--accent-secondary)" }}>
                            Scenario {idx + 1}: {ac.scenarioName}
                          </span>
                          <pre style={{
                            background: "rgba(11, 12, 16, 0.6)",
                            border: "1px solid var(--border-color)",
                            padding: "12px",
                            borderRadius: "6px",
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                            overflowX: "auto"
                          }}>
                            {ac.gherkinText}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Agent Validation Verdict */}
                  <div>
                    <h4 style={{ color: "#ffffff", marginBottom: "10px" }}>Validation Review (Senior Dev Agent)</h4>
                    {selectedStory.validationResults && selectedStory.validationResults.length > 0 ? (
                      <div style={{
                        padding: "16px",
                        background: "rgba(11, 12, 16, 0.4)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {getVerdictIcon(selectedStory.validationResults[0].verdict)}
                          <span style={{ fontWeight: "700", color: "#ffffff", textTransform: "uppercase", fontSize: "0.85rem" }}>
                            Verdict: {selectedStory.validationResults[0].verdict.replace(/_/g, " ")}
                          </span>
                          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginLeft: "auto" }}>
                            Validated on {new Date(selectedStory.validationResults[0].createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {/* Validation issues list */}
                        {selectedStory.validationResults[0].issuesJson && JSON.parse(selectedStory.validationResults[0].issuesJson).length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#ef4444" }}>Identified Issues:</span>
                            {JSON.parse(selectedStory.validationResults[0].issuesJson).map((issue: any, iIdx: number) => (
                              <div key={iIdx} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", paddingLeft: "8px", borderLeft: "2px solid #ef4444" }}>
                                <strong>[{issue.severity.toUpperCase()}] {issue.category.replace(/_/g, " ")}</strong>: {issue.message}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <button
                          onClick={handleTriggerValidation}
                          className="btn btn-secondary"
                          disabled={validatingStoryId !== null}
                          style={{ alignSelf: "flex-start", marginTop: "8px", padding: "6px 12px", fontSize: "0.8rem" }}
                        >
                          <RotateCw size={12} className={validatingStoryId === selectedStory.id ? "spinner" : ""} /> Re-Run Validation
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        padding: "16px",
                        border: "1px dashed var(--border-color)",
                        borderRadius: "8px",
                        textAlign: "center"
                      }}>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>This story has not been validated by the Senior Dev Agent yet.</p>
                        <button
                          onClick={handleTriggerValidation}
                          className="btn btn-primary"
                          disabled={validatingStoryId !== null}
                          style={{ marginTop: "12px", padding: "6px 16px", fontSize: "0.85rem" }}
                        >
                          {validatingStoryId === selectedStory.id ? (
                            <>
                              <RotateCw size={14} className="spinner" /> Analyzing Story...
                            </>
                          ) : (
                            <>
                              <Play size={14} /> Run AI Validation Critique
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* PO Human Gate Approvals */}
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h4 style={{ color: "#ffffff" }}>Product Owner Approval Gate</h4>
                    
                    {showChangeComment ? (
                      <form onSubmit={handleRequestChanges} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <textarea
                          className="form-input"
                          placeholder="Provide detailed feedback on what needs to be fixed..."
                          value={changeComment}
                          onChange={(e) => setChangeComment(e.target.value)}
                          style={{ minHeight: "80px" }}
                        />
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button type="button" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setShowChangeComment(false)}>Cancel</button>
                          <button type="submit" className="btn btn-danger" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>Submit Feedback</button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button
                          onClick={handleApprove}
                          className="btn btn-primary"
                          style={{
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.2)",
                            flexGrow: 1
                          }}
                        >
                          <Check size={16} /> Approve User Story
                        </button>
                        <button
                          onClick={() => setShowChangeComment(true)}
                          className="btn btn-danger"
                          style={{ flexGrow: 1 }}
                        >
                          <XCircle size={16} /> Request Changes
                        </button>
                      </div>
                    )}
                    
                    {/* Role notification note */}
                    {currentRole !== "PO" && currentRole !== "Admin" && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.75rem",
                        color: "var(--accent-secondary)",
                        background: "rgba(102, 252, 241, 0.02)",
                        padding: "8px",
                        borderRadius: "6px",
                        border: "1px solid rgba(102, 252, 241, 0.1)"
                      }}>
                        <Clock size={12} />
                        <span>Acting role: <strong>{currentRole}</strong>. To test approvals, switch role in header to <strong>Product Owner</strong> or <strong>Admin</strong>.</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Editing / Creating state */}
              {(panelMode === "edit" || panelMode === "create") && (
                <form onSubmit={handleSaveForm} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", color: "#ffffff" }}>
                    {panelMode === "edit" ? "Edit User Story" : "Create Manual User Story"}
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      placeholder="e.g. As a Business Analyst"
                      disabled={savingForm}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Capability</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formCapability}
                      onChange={(e) => setFormCapability(e.target.value)}
                      placeholder="e.g. I want to create a new project"
                      disabled={savingForm}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Benefit</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formBenefit}
                      onChange={(e) => setFormBenefit(e.target.value)}
                      placeholder="e.g. so that I can organize requirements"
                      disabled={savingForm}
                    />
                  </div>

                  {/* Acceptance Criteria Gherkin form section */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ color: "#ffffff" }}>Gherkin Acceptance Criteria</h4>
                      <button
                        type="button"
                        onClick={handleAddCriteria}
                        className="btn btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                        disabled={savingForm}
                      >
                        <Plus size={12} /> Add Scenario
                      </button>
                    </div>

                    {formCriteria.map((ac, idx) => (
                      <div key={idx} style={{
                        padding: "16px",
                        background: "rgba(11, 12, 16, 0.4)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--accent-secondary)" }}>
                            Scenario {idx + 1}
                          </span>
                          {formCriteria.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCriteria(idx)}
                              style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer" }}
                              disabled={savingForm}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="form-group" style={{ marginBottom: "10px" }}>
                          <label className="form-label" style={{ fontSize: "0.75rem" }}>Scenario Title</label>
                          <input
                            type="text"
                            className="form-input"
                            value={ac.scenarioName}
                            onChange={(e) => handleCriteriaChange(idx, "scenarioName", e.target.value)}
                            placeholder="e.g. Successful creation"
                            disabled={savingForm}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: "0.75rem" }}>Gherkin Block</label>
                          <textarea
                            className="form-input"
                            value={ac.gherkinText}
                            onChange={(e) => handleCriteriaChange(idx, "gherkinText", e.target.value)}
                            style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", minHeight: "120px" }}
                            placeholder="Feature: ...&#10;  Scenario: ...&#10;    Given ...&#10;    When ...&#10;    Then ..."
                            disabled={savingForm}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {formError && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#ef4444",
                      fontSize: "0.85rem",
                      background: "rgba(239, 68, 68, 0.1)",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(239, 68, 68, 0.2)"
                    }}>
                      <AlertTriangle size={16} />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setPanelMode("view");
                        if (panelMode === "create") setSelectedStory(null);
                      }}
                      disabled={savingForm}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingForm}
                    >
                      {savingForm ? "Saving..." : "Save Story"}
                    </button>
                  </div>

                </form>
              )}

              {/* Default empty state */}
              {!selectedStory && panelMode === "view" && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: "12px", color: "var(--text-secondary)", opacity: 0.8, textAlign: "center", padding: "40px" }}>
                  <FileCode2 size={48} style={{ color: "var(--accent-secondary)" }} />
                  <h3>No User Story Selected</h3>
                  <p style={{ fontSize: "0.9rem" }}>Select a user story from the requirements tree on the left to view validation results, approve criteria, or edit details.</p>
                </div>
              )}

            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
