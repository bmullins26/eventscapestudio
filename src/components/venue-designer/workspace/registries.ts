/**
 * Workspace registries — the plugin surface for the Venue/Event Workspace.
 *
 * Instead of hard-coding every panel, toolbar action, drop target, and
 * hover-card renderer into `designer.tsx`, each capability registers here
 * and the workspace shell discovers what to show for the current
 * selection + mode. This lets us add Vendors, AI, Reservations, and
 * Operations without turning the workspace into a giant React file.
 *
 * NOTE: this is the foundation contract. Phase 0 populates the registries
 * with today's built-in capabilities so later phases can register alongside.
 */
import type { AnyElement } from "../types";

/* ------------------------ Selection + mode types ------------------------ */

export type WorkspaceMode = "venue" | "event";

export interface SelectionSnapshot {
  ids: string[];
  elements: AnyElement[];
  kinds: Set<string>;
  isMulti: boolean;
  isEmpty: boolean;
}

export interface WorkspaceContext {
  mode: WorkspaceMode;
  eventId: string | null;
  organizationId: string;
  venueId: string;
}

/* ---------------------------- Panel registry ---------------------------- */

export interface PanelDefinition {
  id: string;
  /** Higher = more specific / rendered first when multiple match. */
  priority: number;
  /** Guard — return true when this panel should render. */
  when: (sel: SelectionSnapshot, ctx: WorkspaceContext) => boolean;
  /** Renderer receives the selection + workspace context. */
  render: (sel: SelectionSnapshot, ctx: WorkspaceContext) => React.ReactNode;
}

/* -------------------------- Toolbar / commands -------------------------- */

export interface ToolbarActionDefinition {
  id: string;
  group: "file" | "edit" | "view" | "insert" | "mode" | "help";
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  when?: (sel: SelectionSnapshot, ctx: WorkspaceContext) => boolean;
  run: (sel: SelectionSnapshot, ctx: WorkspaceContext) => void | Promise<void>;
}

export interface CommandDefinition {
  id: string;
  label: string;
  keys: string[]; // e.g. ["mod+shift+p"]
  when?: (sel: SelectionSnapshot, ctx: WorkspaceContext) => boolean;
  run: (sel: SelectionSnapshot, ctx: WorkspaceContext) => void | Promise<void>;
}

/* --------------------------- Dock / hover cards ------------------------- */

export interface DockDefinition {
  id: string;
  side: "left" | "right" | "bottom";
  title: string;
  icon?: React.ReactNode;
  when?: (ctx: WorkspaceContext) => boolean;
  render: (ctx: WorkspaceContext) => React.ReactNode;
}

export interface HoverCardProvider {
  kind: string; // ElementKind
  render: (element: AnyElement, ctx: WorkspaceContext) => React.ReactNode;
}

/* --------------------------- Registry storage --------------------------- */

class Registry<T extends { id?: string; kind?: string }> {
  private items: T[] = [];
  register(item: T) {
    // Replace by id when present so hot reload doesn't stack duplicates.
    if (item.id) {
      const i = this.items.findIndex((x) => x.id === item.id);
      if (i >= 0) { this.items[i] = item; return; }
    }
    this.items.push(item);
  }
  all(): readonly T[] { return this.items; }
  byKind(kind: string): T[] { return this.items.filter((x) => x.kind === kind); }
}

export const panelRegistry = new Registry<PanelDefinition>();
export const toolbarRegistry = new Registry<ToolbarActionDefinition>();
export const commandRegistry = new Registry<CommandDefinition>();
export const dockRegistry = new Registry<DockDefinition>();
export const hoverRegistry = new Registry<HoverCardProvider>();

/* ------------------------------ Helpers -------------------------------- */

export function buildSelection(elements: AnyElement[], ids: string[]): SelectionSnapshot {
  const selected = elements.filter((e) => ids.includes(e.id));
  return {
    ids,
    elements: selected,
    kinds: new Set(selected.map((e) => e.kind)),
    isMulti: selected.length > 1,
    isEmpty: selected.length === 0,
  };
}

export function pickPanels(sel: SelectionSnapshot, ctx: WorkspaceContext): PanelDefinition[] {
  return panelRegistry
    .all()
    .filter((p) => p.when(sel, ctx))
    .slice()
    .sort((a, b) => b.priority - a.priority);
}
