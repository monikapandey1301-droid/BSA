"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/lib/AppContext";
import {
  History,
  Activity,
  DollarSign,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Clock,
  RefreshCw,
  Cpu
} from "lucide-react";

interface AuditLog {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeSnapshotJson: string | null;
  afterSnapshotJson: string | null;
  createdAt: string;
}

interface AgentRun {
  id: string;
  agentType: string;
  modelName: string;
  modelVersion: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  tokenUsage: number;
  errorMessage: string | null;
}

interface AuditData {
  logs: AuditLog[];
  agentRuns: AgentRun[];
  stats: {
    totalRuns: number;
    failedRuns: number;
    successRuns: number;
    errorRatePercent: number;
    avgLatencySec: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export default function AuditLogsPage() {
  const { currentProject } = useApp();
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "agents">("logs");
  
  // Snapshot preview modal state
  const [viewSnapshot, setViewSnapshot] = useState<{ before: string | null; after: string | null; action: string } | null>(null);

  const fetchAuditData = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/audit?projectId=${currentProject.id}`);
      if (res.ok) {
        const auditData = await res.json();
        setData(auditData);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [currentProject]);

  const getStatusIcon = (status: string) => {
    if (status === "Succeeded") {
      return <CheckCircle2 size={16} style={{ color: "#10b981" }} />;
    } else if (status === "Failed") {
      return <XCircle size={16} style={{ color: "#ef4444" }} />;
    } else {
      return <Clock size={16} style={{ color: "var(--accent-secondary)" }} />;
    }
  };

  const getLatency = (run: AgentRun) => {
    if (!run.completedAt) return "Running...";
    const diff = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
    return `${(diff / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
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
            <h1>Audit & Observability</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Track multi-agent runs, monitor token costs, and review structural audit logs of all project activities.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={fetchAuditData} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spinner" : ""} /> Refresh
          </button>
        </div>

        {!currentProject ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px" }}>
            <AlertTriangle size={36} style={{ color: "var(--accent-secondary)", marginBottom: "12px" }} />
            <p>Please select an active project to view audit and cost records.</p>
          </div>
        ) : (
          <>
            {/* Observability Cards */}
            <div className="grid-3">
              {/* Cost Card */}
              <div className="glass-panel" style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div style={{
                  background: "rgba(16, 185, 129, 0.05)",
                  border: "1px solid rgba(16, 185, 129, 0.15)",
                  borderRadius: "10px",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981"
                }}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Estimated Model Cost</span>
                  <h3 style={{ fontSize: "1.4rem", color: "#ffffff", fontWeight: "700", marginTop: "2px" }}>
                    ${data?.stats.estimatedCost.toFixed(4) || "0.0000"}
                  </h3>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                    ({data?.stats.totalTokens.toLocaleString() || 0} tokens consumed)
                  </span>
                </div>
              </div>

              {/* Executions Card */}
              <div className="glass-panel" style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div style={{
                  background: "rgba(102, 252, 241, 0.05)",
                  border: "1px solid rgba(102, 252, 241, 0.15)",
                  borderRadius: "10px",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-primary)"
                }}>
                  <Cpu size={20} />
                </div>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Total Agent Executions</span>
                  <h3 style={{ fontSize: "1.4rem", color: "#ffffff", fontWeight: "700", marginTop: "2px" }}>
                    {data?.stats.totalRuns || 0} Runs
                  </h3>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                    ({data?.stats.avgLatencySec || 0}s avg duration)
                  </span>
                </div>
              </div>

              {/* Error Rate Card */}
              <div className="glass-panel" style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div style={{
                  background: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.15)",
                  borderRadius: "10px",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444"
                }}>
                  <AlertOctagon size={20} />
                </div>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Agent Failure Rate</span>
                  <h3 style={{ fontSize: "1.4rem", color: "#ffffff", fontWeight: "700", marginTop: "2px" }}>
                    {data?.stats.errorRatePercent || 0}%
                  </h3>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                    ({data?.stats.failedRuns || 0} failed / {data?.stats.successRuns || 0} successful)
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <button
                className={`btn ${activeTab === "logs" ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                onClick={() => setActiveTab("logs")}
              >
                <History size={14} /> Audit Trail logs
              </button>
              <button
                className={`btn ${activeTab === "agents" ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                onClick={() => setActiveTab("agents")}
              >
                <Cpu size={14} /> Agent Runs History
              </button>
            </div>

            {/* Lists Table */}
            <div className="glass-panel" style={{ padding: 0, overflowX: "auto" }}>
              {loading && !data ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                  <div className="spinner"></div>
                </div>
              ) : activeTab === "logs" ? (
                /* Audit Trail Logs Table */
                data?.logs && data.logs.length > 0 ? (
                  <table className="trace-table">
                    <thead>
                      <tr>
                        <th style={{ width: "25%" }}>Timestamp</th>
                        <th style={{ width: "25%" }}>Action Executed</th>
                        <th style={{ width: "15%" }}>Actor (ID)</th>
                        <th style={{ width: "20%" }}>Target (Entity ID)</th>
                        <th style={{ width: "15%" }}>State Snapshots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.logs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            {formatDate(log.createdAt)}
                          </td>
                          <td style={{ fontWeight: "600", color: "#ffffff" }}>
                            {log.action.replace(/_/g, " ")}
                          </td>
                          <td style={{ fontSize: "0.8rem" }}>
                            {log.actorType} ({log.actorId})
                          </td>
                          <td style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                            {log.entityType} ({log.entityId.substring(0, 8)}...)
                          </td>
                          <td>
                            {(log.beforeSnapshotJson || log.afterSnapshotJson) ? (
                              <button
                                onClick={() => setViewSnapshot({
                                  before: log.beforeSnapshotJson,
                                  after: log.afterSnapshotJson,
                                  action: log.action
                                })}
                                className="btn btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "0.7rem", height: "24px" }}
                              >
                                <Eye size={10} /> View Diff
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic" }}>None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: "var(--text-secondary)", padding: "40px", textAlign: "center", fontStyle: "italic" }}>
                    No audit log events captured yet.
                  </p>
                )
              ) : (
                /* Agent Runs Table */
                data?.agentRuns && data.agentRuns.length > 0 ? (
                  <table className="trace-table">
                    <thead>
                      <tr>
                        <th style={{ width: "10%" }}>Verdict</th>
                        <th style={{ width: "15%" }}>Agent Type</th>
                        <th style={{ width: "25%" }}>Model & Version</th>
                        <th style={{ width: "20%" }}>Started At</th>
                        <th style={{ width: "10%" }}>Duration</th>
                        <th style={{ width: "20%" }}>Status & Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.agentRuns.map((run) => (
                        <tr key={run.id}>
                          <td>
                            {getStatusIcon(run.status)}
                          </td>
                          <td style={{ fontWeight: "600", color: "#ffffff" }}>
                            {run.agentType} Agent
                          </td>
                          <td style={{ fontSize: "0.8rem" }}>
                            {run.modelName} ({run.modelVersion})
                          </td>
                          <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            {formatDate(run.startedAt)}
                          </td>
                          <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            {getLatency(run)}
                          </td>
                          <td style={{ fontSize: "0.75rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ fontWeight: "600", color: run.status === "Failed" ? "#ef4444" : "#10b981" }}>
                                {run.status}
                              </span>
                              {run.errorMessage && (
                                <span style={{ color: "#ef4444", fontSize: "0.7rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={run.errorMessage}>
                                  {run.errorMessage}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: "var(--text-secondary)", padding: "40px", textAlign: "center", fontStyle: "italic" }}>
                    No agent runs recorded yet.
                  </p>
                )
              )}
            </div>
          </>
        )}

        {/* Snapshot View Modal */}
        {viewSnapshot && (
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
            <div className="glass-panel animate-fade-in" style={{ width: "900px", maxWidth: "90%", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <div>
                  <h3 style={{ color: "#ffffff" }}>State Snapshot Viewer</h3>
                  <span style={{ fontSize: "0.8rem", color: "var(--accent-secondary)" }}>Action: {viewSnapshot.action}</span>
                </div>
                <button className="btn btn-secondary" onClick={() => setViewSnapshot(null)}>Close</button>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: viewSnapshot.before ? "1fr 1fr" : "1fr", gap: "16px", flexGrow: 1, overflow: "hidden" }}>
                {viewSnapshot.before && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f87171" }}>Before State</span>
                    <pre style={{
                      flexGrow: 1,
                      overflowY: "auto",
                      background: "rgba(239, 68, 68, 0.02)",
                      border: "1px solid rgba(239, 68, 68, 0.15)",
                      padding: "16px",
                      borderRadius: "6px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      whiteSpace: "pre-wrap"
                    }}>
                      {JSON.stringify(JSON.parse(viewSnapshot.before), null, 2)}
                    </pre>
                  </div>
                )}
                
                {viewSnapshot.after && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#10b981" }}>After State</span>
                    <pre style={{
                      flexGrow: 1,
                      overflowY: "auto",
                      background: "rgba(16, 185, 129, 0.02)",
                      border: "1px solid rgba(16, 185, 129, 0.15)",
                      padding: "16px",
                      borderRadius: "6px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      whiteSpace: "pre-wrap"
                    }}>
                      {JSON.stringify(JSON.parse(viewSnapshot.after), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
