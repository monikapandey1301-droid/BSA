"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/lib/AppContext";
import {
  FileText,
  GitMerge,
  ShieldCheck,
  Zap,
  Activity,
  Upload,
  PlusCircle,
  FileCheck,
  Archive,
  Trash2,
  AlertTriangle,
  RefreshCw,
  TrendingUp
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  stats: {
    documents: number;
    epics: number;
    features: number;
    stories: number;
    testCases: number;
    scripts: number;
    statusCounts: Record<string, number>;
    coveragePercent: number;
    totalScenarios: number;
  };
  recentLogs: Array<{
    id: string;
    actorType: string;
    actorId: string;
    action: string;
    entityType: string;
    createdAt: string;
  }>;
  epics: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    features: Array<{
      id: string;
      title: string;
      _count: {
        userStories: number;
      };
    }>;
  }>;
}

export default function Home() {
  const { currentProject, loadingProjects, currentRole, refreshProjects, setCurrentProject } = useApp();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDashboardData = async () => {
    if (!currentProject) return;
    try {
      setLoadingMetrics(true);
      const res = await fetch(`/api/projects/${currentProject.id}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentProject]);

  const handleArchiveProject = async () => {
    if (!currentProject || archiving) return;
    if (!confirm("Are you sure you want to archive this project? It will become read-only.")) return;
    
    setArchiving(true);
    try {
      const newStatus = currentProject.status === "Archived" ? "Active" : "Archived";
      const res = await fetch(`/api/projects/${currentProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          userId: currentRole
        })
      });

      if (res.ok) {
        await refreshProjects();
      }
    } catch (err) {
      console.error("Failed to archive project:", err);
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!currentProject || deleting) return;
    if (!confirm("Are you sure you want to soft-delete this project? It will be hidden from your default list.")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}?userId=${currentRole}`, {
        method: "DELETE"
      });

      if (res.ok) {
        await refreshProjects();
        setCurrentProject(null);
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ");
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

  // Helper to format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Render when loading projects
  if (loadingProjects) {
    return (
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "70vh", flexDirection: "column", gap: "16px" }}>
          <div className="spinner"></div>
          <p style={{ color: "var(--accent-secondary)" }}>Loading Workspace...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Render when no projects exist
  if (!currentProject) {
    return (
      <DashboardLayout>
        <div className="animate-fade-in" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "70vh" }}>
          <div className="glass-panel" style={{ maxWidth: "550px", textAlign: "center", padding: "40px" }}>
            <Zap size={48} style={{ color: "var(--accent-primary)", marginBottom: "20px" }} />
            <h1 style={{ fontSize: "1.8rem", marginBottom: "12px" }}>Welcome to SpecFlow BA</h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.95rem" }}>
              An AI-Native Requirements Engine. To get started, select an existing project from the switcher or create a new project.
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button 
                onClick={() => {
                  const select = document.querySelector("select");
                  if (select) {
                    select.value = "_new";
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }} 
                className="btn btn-primary"
              >
                <PlusCircle size={16} /> Create Your First Project
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        
        {/* Header Widget */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-secondary)" }}>
              Project Context
            </span>
            <h1 style={{ margin: "4px 0" }}>{currentProject.name}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: "600px" }}>
              {currentProject.description || "No description provided."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn btn-secondary" onClick={fetchDashboardData} disabled={loadingMetrics}>
              <RefreshCw size={14} className={loadingMetrics ? "spinner" : ""} /> Refresh
            </button>
            {currentRole === "Admin" && (
              <>
                <button className="btn btn-secondary" onClick={handleArchiveProject} disabled={archiving}>
                  <Archive size={14} /> {currentProject.status === "Archived" ? "Activate" : "Archive"}
                </button>
                <button className="btn btn-danger" onClick={handleDeleteProject} disabled={deleting}>
                  <Trash2 size={14} /> Soft-Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid-3">
          {/* Card 1: Requirements Tree */}
          <div className="glass-panel glass-panel-hover" style={{ display: "flex", gap: "20px" }}>
            <div style={{
              background: "rgba(102, 252, 241, 0.05)",
              border: "1px solid rgba(102, 252, 241, 0.15)",
              borderRadius: "12px",
              width: "56px",
              height: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-primary)"
            }}>
              <GitMerge size={24} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Scope & Stories</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "1.8rem", fontWeight: "700", color: "#ffffff" }}>
                  {loadingMetrics ? "..." : dashboardData?.stats.stories || 0}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--accent-secondary)" }}>
                  ({dashboardData?.stats.epics || 0} Epics, {dashboardData?.stats.features || 0} Features)
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: QA Test Cases */}
          <div className="glass-panel glass-panel-hover" style={{ display: "flex", gap: "20px" }}>
            <div style={{
              background: "rgba(69, 162, 158, 0.1)",
              border: "1px solid rgba(69, 162, 158, 0.2)",
              borderRadius: "12px",
              width: "56px",
              height: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-secondary)"
            }}>
              <ShieldCheck size={24} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Manual Test Cases</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "1.8rem", fontWeight: "700", color: "#ffffff" }}>
                  {loadingMetrics ? "..." : dashboardData?.stats.testCases || 0}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  derived from {dashboardData?.stats.totalScenarios || 0} scenarios
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: QA Automation Scripts */}
          <div className="glass-panel glass-panel-hover" style={{ display: "flex", gap: "20px" }}>
            <div style={{
              background: "rgba(96, 165, 250, 0.05)",
              border: "1px solid rgba(96, 165, 250, 0.15)",
              borderRadius: "12px",
              width: "56px",
              height: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#60a5fa"
            }}>
              <FileCheck size={24} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Playwright Scripts</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "1.8rem", fontWeight: "700", color: "#ffffff" }}>
                  {loadingMetrics ? "..." : dashboardData?.stats.scripts || 0}
                </span>
                <span style={{ fontSize: "0.8rem", color: "#60a5fa" }}>
                  {dashboardData?.stats.coveragePercent || 0}% story coverage
                </span>
              </div>
              <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", height: "4px", borderRadius: "2px", marginTop: "8px" }}>
                <div style={{
                  width: `${dashboardData?.stats.coveragePercent || 0}%`,
                  background: "#60a5fa",
                  height: "100%",
                  borderRadius: "2px",
                  transition: "width 0.5s ease"
                }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Panel Grid */}
        <div className="grid-2">
          
          {/* Recent Epics Summary */}
          <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.2rem", color: "#ffffff" }}>Recent Requirement Epics</h3>
              <Link href="/requirements" style={{ fontSize: "0.8rem", color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                View All Epics &rarr;
              </Link>
            </div>
            
            {loadingMetrics ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading epics...</p>
            ) : dashboardData?.epics && dashboardData.epics.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {dashboardData.epics.map((epic) => (
                  <div key={epic.id} style={{
                    padding: "16px",
                    background: "rgba(11, 12, 16, 0.4)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "600", color: "#ffffff" }}>{epic.title}</span>
                      <span className="status-badge status-manual-draft" style={{ fontSize: "0.65rem" }}>
                        {epic.status}
                      </span>
                    </div>
                    {epic.description && (
                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {epic.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--accent-secondary)", borderTop: "1px solid rgba(102,252,241,0.05)", paddingTop: "8px" }}>
                      <span>Features: {epic.features.length}</span>
                      <span>
                        Stories: {epic.features.reduce((sum, f) => sum + f._count.userStories, 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                padding: "30px",
                border: "1px dashed var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-secondary)"
              }}>
                <AlertTriangle size={24} style={{ color: "var(--accent-secondary)", marginBottom: "8px" }} />
                <p style={{ fontSize: "0.9rem" }}>No requirements found in this project.</p>
                <div style={{ marginTop: "12px" }}>
                  <Link href="/documents" className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                    <Upload size={12} /> Upload Requirement Doc
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Audit Logs and Story Status Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* User Story Status Counts */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ fontSize: "1.2rem", color: "#ffffff" }}>Story Status Breakdown</h3>
              {loadingMetrics ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading breakdown...</p>
              ) : dashboardData?.stats.statusCounts && Object.keys(dashboardData.stats.statusCounts).length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {Object.entries(dashboardData.stats.statusCounts).map(([status, count]) => (
                    <div key={status} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "rgba(11, 12, 16, 0.5)",
                      border: "1px solid var(--border-color)",
                      padding: "8px 16px",
                      borderRadius: "8px"
                    }}>
                      <span className={getStatusClass(status)} style={{ fontSize: "0.65rem", padding: "2px 8px" }}>
                        {getStatusLabel(status)}
                      </span>
                      <span style={{ fontWeight: "700", color: "#ffffff" }}>{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>
                  No user stories created yet.
                </p>
              )}
            </div>

            {/* Audit Logs */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px", flexGrow: 1 }}>
              <h3 style={{ fontSize: "1.2rem", color: "#ffffff" }}>Project Activity</h3>
              {loadingMetrics ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading activity...</p>
              ) : dashboardData?.recentLogs && dashboardData.recentLogs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {dashboardData.recentLogs.map((log) => (
                    <div key={log.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: "10px",
                      borderBottom: "1px solid rgba(102, 252, 241, 0.05)",
                      fontSize: "0.85rem"
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ color: "#ffffff", fontWeight: "500" }}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                          By {log.actorType} ({log.actorId})
                        </span>
                      </div>
                      <span style={{ color: "var(--accent-secondary)", fontSize: "0.75rem" }}>
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>
                  No activity recorded yet.
                </p>
              )}
            </div>

          </div>
        </div>

        {/* SDD Methodology Walkthrough / Quick start */}
        <div className="glass-panel" style={{ borderLeft: "4px solid var(--accent-primary)" }}>
          <h3 style={{ color: "var(--accent-primary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingUp size={18} /> Spec-Driven Development (SDD) Workflow
          </h3>
          <div className="grid-3" style={{ marginTop: "16px", gap: "20px" }}>
            <div style={{ fontSize: "0.85rem" }}>
              <strong style={{ color: "#ffffff" }}>1. Ingestion</strong>
              <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                Upload PDFs, Word docs, or Text files. The system parses text and runs the **BSA Agent** to extract Epics, Features, Stories, and Gherkin scenarios.
              </p>
            </div>
            <div style={{ fontSize: "0.85rem" }}>
              <strong style={{ color: "#ffffff" }}>2. Critique & Validate</strong>
              <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                Run the **Validation Agent** to review stories for ambiguity. Product Owners approve stories to declare them ready for development.
              </p>
            </div>
            <div style={{ fontSize: "0.85rem" }}>
              <strong style={{ color: "#ffffff" }}>3. QA Automation</strong>
              <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                The **QA Agent** translates approved Gherkin scenarios into manual test cases and functional **Playwright UI/Postman API** test scripts.
              </p>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
