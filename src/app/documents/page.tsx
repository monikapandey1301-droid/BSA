"use client";

import React, { useEffect, useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/lib/AppContext";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Zap,
  Clock,
  ExternalLink
} from "lucide-react";
import Link from "next/link";

interface DocumentItem {
  id: string;
  filename: string;
  fileUrl: string | null;
  status: string; // Uploaded, Parsing, Parsed, ParsingFailed
  uploadedBy: string;
  parsedText: string | null;
  createdAt: string;
}

export default function DocumentsPage() {
  const { currentProject, currentRole } = useApp();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  
  // For viewing extracted text
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);
  
  // For triggering BSA Agent
  const [generatingReqs, setGeneratingReqs] = useState<string | null>(null); // docId of running generation
  const [generationError, setGenerationError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/documents?projectId=${currentProject.id}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll documents list if any are currently Uploaded or Parsing
  useEffect(() => {
    fetchDocuments();
    
    const interval = setInterval(() => {
      const hasParsingDocs = documents.some(
        doc => doc.status === "Uploaded" || doc.status === "Parsing"
      );
      if (hasParsingDocs && currentProject) {
        // Fetch silently
        fetch(`/api/documents?projectId=${currentProject.id}`)
          .then(res => res.json())
          .then(data => setDocuments(data))
          .catch(err => console.error("Polling failed:", err));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentProject, documents.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentProject) return;

    const file = files[0];
    setUploadError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", currentProject.id);
    formData.append("uploadedBy", currentRole);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload file");
      }

      await fetchDocuments();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setUploadError(err.message || "An error occurred during upload");
    } finally {
      setUploading(false);
    }
  };

  const handleTriggerBSA = async (doc: DocumentItem) => {
    if (generatingReqs) return;
    setGeneratingReqs(doc.id);
    setGenerationError("");

    try {
      const res = await fetch("/api/agents/bsa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc.id,
          projectId: currentProject?.id,
          role: currentRole
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate requirements");
      }

      // Success, redirect to requirements tree page
      window.location.href = "/requirements";
    } catch (err: any) {
      setGenerationError(err.message || "Requirement generation failed");
    } finally {
      setGeneratingReqs(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Uploaded": return "status-badge status-pending";
      case "Parsing": return "status-badge status-ai-draft";
      case "Parsed": return "status-badge status-validated";
      case "ParsingFailed": return "status-badge status-failed";
      default: return "status-badge status-manual-draft";
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Header */}
        <div>
          <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-secondary)" }}>
            Module
          </span>
          <h1>Requirement Ingestion</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Upload raw requirement documents (PDF, DOCX, TXT, MD) to extract and map Epics, Features, and User Stories.
          </p>
        </div>

        {/* Workspace checks */}
        {!currentProject ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px" }}>
            <AlertTriangle size={36} style={{ color: "var(--accent-secondary)", marginBottom: "12px" }} />
            <p>Please select or create an active project to begin uploading documents.</p>
          </div>
        ) : (
          <div className="grid-3" style={{ gridTemplateColumns: "1fr 2fr", alignItems: "start" }}>
            
            {/* Upload form Panel */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>Upload Document</h3>
              
              <div 
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border-color)",
                  borderRadius: "8px",
                  padding: "40px 20px",
                  textAlign: "center",
                  cursor: uploading ? "not-allowed" : "pointer",
                  background: "rgba(11, 12, 16, 0.4)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  if (!uploading) e.currentTarget.style.borderColor = "var(--accent-primary)";
                }}
                onMouseOut={(e) => {
                  if (!uploading) e.currentTarget.style.borderColor = "var(--border-color)";
                }}
              >
                {uploading ? (
                  <>
                    <div className="spinner"></div>
                    <span style={{ fontSize: "0.9rem", color: "var(--accent-secondary)" }}>Uploading & storing file...</span>
                  </>
                ) : (
                  <>
                    <Upload size={32} style={{ color: "var(--accent-secondary)" }} />
                    <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      Click to browse or drop file here
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      PDF, DOCX, TXT, MD up to 25MB
                    </span>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  accept=".pdf,.docx,.txt,.md"
                  disabled={uploading}
                />
              </div>

              {uploadError && (
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
                  <span>{uploadError}</span>
                </div>
              )}

              {generationError && (
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
                  <span>{generationError}</span>
                </div>
              )}
            </div>

            {/* Document list Panel */}
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", width: "100%" }}>
                  Project Documents
                </h3>
              </div>

              {loading && documents.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                  <div className="spinner"></div>
                </div>
              ) : documents.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", padding: "40px" }}>
                  No requirement documents uploaded yet. Use the panel on the left to upload.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {documents.map((doc) => (
                    <div key={doc.id} style={{
                      padding: "16px",
                      background: "rgba(11, 12, 16, 0.4)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <FileText size={24} style={{ color: "var(--accent-secondary)" }} />
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontWeight: "600", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                            {doc.filename}
                            {doc.fileUrl && (
                              <a href={`/api${doc.fileUrl}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-secondary)" }}>
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            Uploaded by {doc.uploadedBy} on {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span className={getStatusBadgeClass(doc.status)}>
                          {doc.status}
                        </span>

                        {doc.status === "Parsed" && (
                          <>
                            <button
                              onClick={() => setViewingDoc(doc)}
                              className="btn btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            >
                              <Eye size={12} /> View Text
                            </button>
                            <button
                              onClick={() => handleTriggerBSA(doc)}
                              className="btn btn-primary"
                              disabled={generatingReqs !== null}
                              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            >
                              {generatingReqs === doc.id ? (
                                <>
                                  <RefreshCw size={12} className="spinner" /> Generating...
                                </>
                              ) : (
                                <>
                                  <Zap size={12} /> AI Generate Specs
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* View Document Extracted Text Modal */}
        {viewingDoc && (
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
                  <h3 style={{ color: "#ffffff" }}>Extracted Requirement Text</h3>
                  <span style={{ fontSize: "0.8rem", color: "var(--accent-secondary)" }}>{viewingDoc.filename}</span>
                </div>
                <button className="btn btn-secondary" onClick={() => setViewingDoc(null)}>Close</button>
              </div>
              <div style={{
                flexGrow: 1,
                overflowY: "auto",
                background: "rgba(11, 12, 16, 0.6)",
                border: "1px solid var(--border-color)",
                padding: "20px",
                borderRadius: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                lineHeight: "1.6"
              }}>
                {viewingDoc.parsedText || "No text could be extracted."}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
