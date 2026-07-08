import { useEffect, useState } from "react";
import type { DeviceClass } from "./use-device-class";

export type AppMode = "edit" | "field";

const KEY = "eventscape.venue-designer.mode";

/**
 * Field Mode = read-mostly event management (default on phone).
 * Edit Mode  = full designer (default on tablet + desktop).
 * Persists to localStorage so the choice follows the user across devices.
 */
export function useAppMode(device: DeviceClass): [AppMode, (m: AppMode) => void] {
  const [mode, setMode] = useState<AppMode>(() => {
    if (typeof window === "undefined") return device === "phone" ? "field" : "edit";
    const stored = window.localStorage.getItem(KEY);
    if (stored === "field" || stored === "edit") return stored;
    return device === "phone" ? "field" : "edit";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, mode);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [mode]);

  return [mode, setMode];
}
