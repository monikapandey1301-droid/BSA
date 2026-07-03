"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "BA" | "PO" | "Developer" | "QA" | "Admin";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

interface AppContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  loadingProjects: boolean;
  refreshProjects: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [currentRole, setCurrentRoleState] = useState<UserRole>("BA");
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);

  // Load initial role from localStorage if available
  useEffect(() => {
    const savedRole = localStorage.getItem("bsa_user_role") as UserRole;
    if (savedRole) {
      setCurrentRoleState(savedRole);
    }
  }, []);

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    localStorage.setItem("bsa_user_role", role);
  };

  const setCurrentProject = (project: Project | null) => {
    setCurrentProjectState(project);
    if (project) {
      localStorage.setItem("bsa_active_project_id", project.id);
    } else {
      localStorage.removeItem("bsa_active_project_id");
    }
  };

  const refreshProjects = async () => {
    try {
      setLoadingProjects(true);
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        
        // Restore active project
        const savedProjectId = localStorage.getItem("bsa_active_project_id");
        if (savedProjectId) {
          const match = data.find((p: Project) => p.id === savedProjectId);
          if (match) {
            setCurrentProjectState(match);
          } else if (data.length > 0) {
            setCurrentProjectState(data[0]);
          } else {
            setCurrentProjectState(null);
          }
        } else if (data.length > 0) {
          setCurrentProjectState(data[0]);
        } else {
          setCurrentProjectState(null);
        }
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentProject,
        setCurrentProject,
        projects,
        setProjects,
        currentRole,
        setCurrentRole,
        loadingProjects,
        refreshProjects,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
