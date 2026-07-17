/**
 * Workspace mode provider.
 *
 * Exposes { mode, eventId, venueId, organizationId } to any component
 * inside the workspace. Route decides which mode; child components read
 * from context rather than branching on the URL.
 *
 * Phase 0 ships the provider + hook only. `venue` mode is wired in this
 * pass; `event` mode arrives in Phase 3 alongside the event route.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WorkspaceContext, WorkspaceMode } from "./registries";

const WorkspaceModeContext = createContext<WorkspaceContext | null>(null);

export function WorkspaceModeProvider({
  mode, eventId = null, venueId, organizationId, children,
}: {
  mode: WorkspaceMode;
  eventId?: string | null;
  venueId: string;
  organizationId: string;
  children: ReactNode;
}) {
  const value = useMemo<WorkspaceContext>(
    () => ({ mode, eventId, venueId, organizationId }),
    [mode, eventId, venueId, organizationId],
  );
  return (
    <WorkspaceModeContext.Provider value={value}>
      {children}
    </WorkspaceModeContext.Provider>
  );
}

export function useWorkspaceMode(): WorkspaceContext {
  const ctx = useContext(WorkspaceModeContext);
  if (!ctx) {
    // Reasonable venue-mode default so components used outside the
    // provider (e.g. legacy inspector) don't crash. Real usage always
    // wraps with WorkspaceModeProvider.
    return { mode: "venue", eventId: null, venueId: "", organizationId: "" };
  }
  return ctx;
}
