"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp, UserRole, Project } from "@/lib/AppContext";
import {
  LayoutDashboard,
  FileUp,
  GitFork,
  CheckSquare,
  Activity,
  UserCheck,
  Plus,
  Briefcase,
  AlertCircle,
  LogOut,
  FolderOpen,
  History
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentProject,
    setCurrentProject,
    projects,
    currentRole,
    setCurrentRole,
    loadingProjects,
    refreshProjects
  } = useApp();

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [projectError, setProjectError] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentRole(e.target.value as UserRole);
  };

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projId = e.target.value;
    if (projId === "_new") {
      setShowProjectModal(true);
      // Reset dropdown select to current project id if any
      e.target.value = currentProject?.id || "";
    } else {
      const match = projects.find(p => p.id === projId);
      setCurrentProject(match || null);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setProjectError("Project name is required");
      return;
    }
    setProjectError("");
    setCreatingProject(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
          ownerId: "user_1" // hardcoded owner for v1
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();
      await refreshProjects();
      setCurrentProject(project);
      setShowProjectModal(false);
      setNewProjectName("");
      setNewProjectDesc("");
    } catch (err: any) {
      setProjectError(err.message || "An error occurred");
    } finally {
      setCreatingProject(false);
    }
  };

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Ingestion", href: "/documents", icon: FileUp },
    { name: "Requirements", href: "/requirements", icon: GitFork },
    { name: "QA & Automation", href: "/qa", icon: CheckSquare },
    { name: "Traceability", href: "/traceability", icon: Activity },
    { name: "Audit Logs", href: "/audit", icon: History }
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <div style={{
            background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            color: "#0b0c10"
          }}>
            SF
          </div>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#ffffff" }}>SpecFlow BA</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--accent-secondary)" }}>Agentic Requirements</span>
          </div>
        </div>

        {/* Project Switcher */}
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Briefcase size={14} /> Active Project
          </label>
          {loadingProjects ? (
            <div style={{ height: "42px", display: "flex", alignItems: "center", color: "var(--accent-secondary)" }}>
              Loading...
            </div>
          ) : (
            <select
              className="form-select"
              value={currentProject?.id || ""}
              onChange={handleProjectChange}
              style={{ width: "100%", background: "rgba(31, 40, 51, 0.8)", border: "1px solid var(--border-color)" }}
            >
              <option value="" disabled>-- Select Project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.status === "Archived" ? "(Archived)" : ""}
                </option>
              ))}
              <option value="_new" style={{ color: "var(--accent-primary)", fontWeight: "600" }}>
                + Create New Project
              </option>
            </select>
          )}
        </div>

        {/* Navigation Menu */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1 }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? "active" : ""}`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Info & Footer */}
        <div style={{ padding: "10px", background: "rgba(102,252,241,0.03)", borderRadius: "8px", border: "1px solid rgba(102,252,241,0.05)" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
            Current Persona
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ffffff", fontWeight: "600", fontSize: "0.85rem" }}>
            <UserCheck size={14} style={{ color: "var(--accent-primary)" }} />
            <span>
              {currentRole === "BA" && "Business Analyst"}
              {currentRole === "PO" && "Product Owner"}
              {currentRole === "Developer" && "Developer"}
              {currentRole === "QA" && "QA Engineer"}
              {currentRole === "Admin" && "Administrator"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FolderOpen size={16} style={{ color: "var(--accent-secondary)" }} />
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {currentProject ? currentProject.name : "No Project Selected"}
            </span>
            {currentProject?.status === "Archived" && (
              <span className="status-badge" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "2px 8px", fontSize: "0.65rem", marginLeft: "8px" }}>
                Archived
              </span>
            )}
          </div>

          {/* User Persona / Role Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label className="form-label" style={{ marginBottom: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Acting Role:
            </label>
            <select
              className="form-select"
              value={currentRole}
              onChange={handleRoleChange}
              style={{
                padding: "6px 12px",
                fontSize: "0.85rem",
                height: "36px",
                background: "rgba(11, 12, 16, 0.9)",
                borderColor: "var(--border-color)",
                minWidth: "150px"
              }}
            >
              <option value="BA">Business Analyst</option>
              <option value="PO">Product Owner</option>
              <option value="Developer">Developer</option>
              <option value="QA">QA Engineer</option>
              <option value="Admin">Administrator</option>
            </select>
          </div>
        </header>

        {/* Content Pane */}
        <main className="content-pane">
          {children}
        </main>
      </div>

      {/* New Project Modal */}
      {showProjectModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: "480px", maxWidth: "90%" }}>
            <h2 style={{ marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
              Create New Project
            </h2>
            <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Order Management Revamp"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={creatingProject}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: "100px", resize: "vertical" }}
                  placeholder="Summarize the project goals..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  disabled={creatingProject}
                />
              </div>

              {projectError && (
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
                  <AlertCircle size={16} />
                  <span>{projectError}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowProjectModal(false)}
                  disabled={creatingProject}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingProject}
                >
                  {creatingProject ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
