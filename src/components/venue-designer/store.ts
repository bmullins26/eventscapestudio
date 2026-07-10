import { useReducer, useCallback, useMemo } from "react";
import type { AnyElement, Layout, LayoutSettings } from "./types";

interface State {
  name: string;
  settings: LayoutSettings;
  elements: AnyElement[];
  selection: string[];
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
}
interface Snapshot {
  name: string;
  settings: LayoutSettings;
  elements: AnyElement[];
}

type Action =
  | { type: "add"; element: AnyElement; select?: boolean }
  | { type: "addMany"; elements: AnyElement[] }
  | { type: "update"; id: string; patch: Partial<AnyElement> }
  | { type: "updateMany"; ids: string[]; patch: Partial<AnyElement> }
  | { type: "delete"; ids: string[] }
  | { type: "select"; ids: string[] }
  | { type: "reorder"; id: string; delta: number }
  | { type: "zto"; id: string; to: "front" | "back" | "forward" | "backward" }
  | { type: "setName"; name: string }
  | { type: "setSettings"; patch: Partial<LayoutSettings> }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "markSaved" }
  | { type: "hydrate"; layout: Layout };

const HISTORY_LIMIT = 100;

function snap(s: State): Snapshot {
  return { name: s.name, settings: s.settings, elements: s.elements };
}
function pushHistory(s: State): { past: Snapshot[]; future: Snapshot[] } {
  const past = [...s.past, snap(s)].slice(-HISTORY_LIMIT);
  return { past, future: [] };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return {
        name: a.layout.name,
        settings: a.layout.settings,
        elements: a.layout.elements,
        selection: [],
        past: [],
        future: [],
        dirty: false,
      };
    case "add": {
      const hist = pushHistory(s);
      return {
        ...s,
        ...hist,
        elements: [...s.elements, a.element],
        selection: a.select === false ? s.selection : [a.element.id],
        dirty: true,
      };
    }
    case "addMany": {
      const hist = pushHistory(s);
      return { ...s, ...hist, elements: [...s.elements, ...a.elements], dirty: true };
    }
    case "update": {
      const hist = pushHistory(s);
      return {
        ...s,
        ...hist,
        elements: s.elements.map((e) => (e.id === a.id ? ({ ...e, ...a.patch } as AnyElement) : e)),
        dirty: true,
      };
    }
    case "updateMany": {
      const hist = pushHistory(s);
      const set = new Set(a.ids);
      return {
        ...s,
        ...hist,
        elements: s.elements.map((e) => (set.has(e.id) ? ({ ...e, ...a.patch } as AnyElement) : e)),
        dirty: true,
      };
    }
    case "delete": {
      const hist = pushHistory(s);
      const set = new Set(a.ids);
      return {
        ...s,
        ...hist,
        elements: s.elements.filter((e) => !set.has(e.id)),
        selection: s.selection.filter((id) => !set.has(id)),
        dirty: true,
      };
    }
    case "select":
      return { ...s, selection: a.ids };
    case "zto": {
      const hist = pushHistory(s);
      const idx = s.elements.findIndex((e) => e.id === a.id);
      if (idx < 0) return s;
      const arr = [...s.elements];
      const [el] = arr.splice(idx, 1);
      if (a.to === "front") arr.push(el);
      else if (a.to === "back") arr.unshift(el);
      else if (a.to === "forward") arr.splice(Math.min(arr.length, idx + 1), 0, el);
      else arr.splice(Math.max(0, idx - 1), 0, el);
      return { ...s, ...hist, elements: arr, dirty: true };
    }
    case "reorder": {
      const hist = pushHistory(s);
      const idx = s.elements.findIndex((e) => e.id === a.id);
      if (idx < 0) return s;
      const to = Math.max(0, Math.min(s.elements.length - 1, idx + a.delta));
      if (to === idx) return s;
      const arr = [...s.elements];
      const [el] = arr.splice(idx, 1);
      arr.splice(to, 0, el);
      return { ...s, ...hist, elements: arr, dirty: true };
    }
    case "setName": {
      if (s.name === a.name) return s;
      const hist = pushHistory(s);
      return { ...s, ...hist, name: a.name, dirty: true };
    }
    case "setSettings": {
      const hist = pushHistory(s);
      return { ...s, ...hist, settings: { ...s.settings, ...a.patch }, dirty: true };
    }
    case "undo": {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        ...s,
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future],
        name: prev.name,
        settings: prev.settings,
        elements: prev.elements,
        dirty: true,
      };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return {
        ...s,
        past: [...s.past, snap(s)],
        future: s.future.slice(1),
        name: next.name,
        settings: next.settings,
        elements: next.elements,
        dirty: true,
      };
    }
    case "markSaved":
      return { ...s, dirty: false };
    default:
      return s;
  }
}

export function useDesignerStore(initial: Layout) {
  const [state, dispatch] = useReducer(reducer, {
    name: initial.name,
    settings: initial.settings,
    elements: initial.elements,
    selection: [],
    past: [],
    future: [],
    dirty: false,
  });

  const actions = useMemo(
    () => ({
      add: (element: AnyElement) => dispatch({ type: "add", element }),
      update: (id: string, patch: Partial<AnyElement>) => dispatch({ type: "update", id, patch }),
      updateMany: (ids: string[], patch: Partial<AnyElement>) =>
        dispatch({ type: "updateMany", ids, patch }),
      remove: (ids: string[]) => dispatch({ type: "delete", ids }),
      select: (ids: string[]) => dispatch({ type: "select", ids }),
      z: (id: string, to: "front" | "back" | "forward" | "backward") =>
        dispatch({ type: "zto", id, to }),
      reorder: (id: string, delta: number) => dispatch({ type: "reorder", id, delta }),
      setName: (name: string) => dispatch({ type: "setName", name }),
      setSettings: (patch: Partial<LayoutSettings>) => dispatch({ type: "setSettings", patch }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      markSaved: () => dispatch({ type: "markSaved" }),
      hydrate: (layout: Layout) => dispatch({ type: "hydrate", layout }),
    }),
    [],
  );

  const selectedElements = useCallback(
    () => state.elements.filter((e) => state.selection.includes(e.id)),
    [state.elements, state.selection],
  );

  return { state, actions, selectedElements };
}

export type DesignerActions = ReturnType<typeof useDesignerStore>["actions"];
