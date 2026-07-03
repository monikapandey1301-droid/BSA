"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/lib/AppContext";
import {
  Activity,
  FileText,
  GitBranch,
  ShieldCheck,
  FileCode,
  Download,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter
} from "lucide-react";

interface TraceabilityRow {
  documentName: string;
  epicTitle: string;
  featureTitle: string;
  storyId: string;
  storyText: string;
  storyStatus: string;
  storySource: "AI" | "Edited" | "Manual";
  scenarioCount: number;
  testCaseCount: number;
  scriptCount: number;
  hasTestCases: boolean;
  hasScripts: boolean;
}

export default function TraceabilityMatrixPage() {
  const { currentProject } = useApp();
  const [rows, setRows] = useState<TraceabilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCoverage, setFilterCoverage] = useState<string>("ALL"); // ALL, MISSING_TESTS, MISSING_SCRIPTS

  const fetchTraceabilityData = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      // Fetch full hierarchy which contains all needed mappings
      const res = await fetch(`/api/requirements?projectId=${currentProject.id}`);
      if (res.ok) {
        const epics = await res.json();
        
        // Flatten nested structure into flat rows for the matrix table
        const flatRows: TraceabilityRow[] = [];
        
        epics.forEach((epic: any) => {
          const docName = epic.sourceDocument?.filename || "Manual Entry";
          
          epic.features.forEach((feat: any) => {
            feat.userStories.forEach((story: any) => {
              // Determine source
              let storySource: "AI" | "Edited" | "Manual" = "AI";
              if (story.status.includes("Manual")) {
                storySource = "Manual";
              } else if (story.status.includes("Edited")) {
                storySource = "Edited";
              }

              flatRows.push({
                documentName: docName,
                epicTitle: epic.title,
                featureTitle: feat.title,
                storyId: story.id,
                storyText: story.capability,
                storyStatus: story.status,
                storySource,
                scenarioCount: story.acceptanceCriteria.length,
                testCaseCount: story.testCases.length,
                scriptCount: story.automationScripts.length,
                hasTestCases: story.testCases.length > 0,
                hasScripts: story.automationScripts.length > 0
              });
            });
          });
        });
        
        setRows(flatRows);
      }
    } catch (err) {
      console.error("Failed to load traceability matrix:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraceabilityData();
  }, [currentProject]);

  const handleExportCSV = () => {
    if (rows.length === 0) return;

    // Construct CSV content
    const headers = ["Requirement Document", "Epic", "Feature", "User Story", "Status", "Origin", "Scenarios", "Manual Test Cases", "Automation Scripts"];
    const csvRows = [
      headers.join(","),
      ...filteredRows.map(r => [
        `"${r.documentName.replace(/"/g, '""')}"`,
        `"${r.epicTitle.replace(/"/g, '""')}"`,
        `"${r.featureTitle.replace(/"/g, '""')}"`,
        `"${r.storyText.replace(/"/g, '""')}"`,
        `"${r.storyStatus.replace(/_/g, " ")}"`,
        `"${r.storySource}"`,
        r.scenarioCount,
        r.testCaseCount,
        r.scriptCount
      ].join(","))
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `traceability-matrix-${currentProject?.name.replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (rows.length === 0) return;
    const blob = new Blob([JSON.stringify(filteredRows, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `traceability-matrix-${currentProject?.name.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter logic
  const filteredRows = rows.filter(r => {
    // Status Filter
    if (filterStatus !== "ALL" && r.storyStatus !== filterStatus) {
      return false;
    }
    
    // Coverage Filter
    if (filterCoverage === "MISSING_TESTS" && r.hasTestCases) return false;
    if (filterCoverage === "MISSING_SCRIPTS" && r.hasScripts) return false;
    
    return true;
  });

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

  return (
    <DashboardLayout>
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-secondary)" }}>
              Module
            </span>
            <h1>Traceability Matrix</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Verify full requirement coverage across files, user stories, scenarios, and QA automated test scripts.
            </p>
          </div>
          
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn btn-secondary" onClick={fetchTraceabilityData} disabled={loading}>
              <RefreshCw size={14} className={loading ? "spinner" : ""} /> Refresh
            </button>
            <button className="btn btn-secondary" onClick={handleExportJSON} disabled={rows.length === 0}>
              <Download size={14} /> Export JSON
            </button>
            <button className="btn btn-primary" onClick={handleExportCSV} disabled={rows.length === 0}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {!currentProject ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px" }}>
            <AlertTriangle size={36} style={{ color: "var(--accent-secondary)", marginBottom: "12px" }} />
            <p>Please select an active project to view the traceability matrix.</p>
          </div>
        ) : (
          <>
            {/* Filters panel */}
            <div className="glass-panel" style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Filter size={16} style={{ color: "var(--accent-secondary)" }} />
                <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "#ffffff" }}>Filters:</span>
              </div>

              {/* Status Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Story Status</span>
                <select 
                  className="form-select" 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ padding: "4px 10px", fontSize: "0.8rem", height: "30px", minWidth: "150px" }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AI_Draft">AI Draft</option>
                  <option value="Manual_Draft">Manual Draft</option>
                  <option value="Edited_Pending_Validation">Pending Validation</option>
                  <option value="VALIDATED">Validated (Pass)</option>
                  <option value="VALIDATED_WARNINGS">Validated (Warnings)</option>
                  <option value="VALIDATION_FAILED">Validation Failed</option>
                  <option value="Changes_Requested">Changes Requested</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>

              {/* Coverage Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>QA Coverage</span>
                <select 
                  className="form-select" 
                  value={filterCoverage} 
                  onChange={(e) => setFilterCoverage(e.target.value)}
                  style={{ padding: "4px 10px", fontSize: "0.8rem", height: "30px", minWidth: "180px" }}
                >
                  <option value="ALL">All Coverage</option>
                  <option value="MISSING_TESTS">Missing Manual Test Cases</option>
                  <option value="MISSING_SCRIPTS">Missing Playwright Scripts</option>
                </select>
              </div>

              <div style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--accent-secondary)" }}>
                Showing {filteredRows.length} of {rows.length} stories
              </div>
            </div>

            {/* Matrix Grid */}
            <div className="glass-panel" style={{ padding: 0, overflowX: "auto" }}>
              {loading && rows.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                  <div className="spinner"></div>
                </div>
              ) : filteredRows.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                  <AlertTriangle size={24} style={{ color: "var(--accent-secondary)", marginBottom: "8px" }} />
                  <p>No matching stories found with active filters.</p>
                </div>
              ) : (
                <table className="trace-table">
                  <thead>
                    <tr>
                      <th style={{ width: "15%" }}><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><FileText size={14} /> Ingestion Source</span></th>
                      <th style={{ width: "20%" }}>Epic Hierarchy</th>
                      <th style={{ width: "30%" }}>User Story Capability</th>
                      <th style={{ width: "12%" }}>Validation status</th>
                      <th style={{ width: "8%" }}>Origin</th>
                      <th style={{ width: "15%" }}><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><ShieldCheck size={14} /> QA Coverage</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: "500", color: "var(--text-secondary)" }}>
                          {row.documentName}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ color: "#ffffff", fontWeight: "600", fontSize: "0.85rem" }}>{row.epicTitle.split(":")[0]}</span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{row.featureTitle}</span>
                          </div>
                        </td>
                        <td>
                          <p style={{ color: "#ffffff", fontWeight: "500" }}>{row.storyText}</p>
                        </td>
                        <td>
                          <span className={getStatusClass(row.storyStatus)}>
                            {row.storyStatus.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            color: row.storySource === "Manual" ? "var(--accent-primary)" : "var(--text-secondary)"
                          }}>
                            {row.storySource}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: row.hasTestCases ? "#10b981" : "#ef4444"
                              }}></span>
                              <span style={{ fontSize: "0.75rem" }}>
                                {row.testCaseCount} Manual Cases
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: row.hasScripts ? "#60a5fa" : "#ef4444"
                              }}></span>
                              <span style={{ fontSize: "0.75rem" }}>
                                {row.scriptCount} Playwright Scripts
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
}
