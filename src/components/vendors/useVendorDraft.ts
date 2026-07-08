import { useEffect, useRef } from "react";

const KEY_PREFIX = "eventscape.vendor-draft.";

export function useVendorDraft<T>(orgId: string | undefined, value: T | null, setValue: (v: T | null) => void) {
  const initialLoad = useRef(false);

  // Load draft on mount / org change
  useEffect(() => {
    if (!orgId || initialLoad.current) return;
    initialLoad.current = true;
    try {
      const raw = localStorage.getItem(KEY_PREFIX + orgId);
      if (raw && !value) {
        const parsed = JSON.parse(raw) as T;
        setValue(parsed);
      }
    } catch {
      // ignore
    }
  }, [orgId, value, setValue]);

  // Persist on change
  useEffect(() => {
    if (!orgId) return;
    try {
      if (value) {
        localStorage.setItem(KEY_PREFIX + orgId, JSON.stringify(value));
      }
    } catch {
      // ignore
    }
  }, [orgId, value]);

  const clear = () => {
    if (!orgId) return;
    try {
      localStorage.removeItem(KEY_PREFIX + orgId);
    } catch {
      // ignore
    }
  };

  const hasDraft = () => {
    if (!orgId) return false;
    try {
      return !!localStorage.getItem(KEY_PREFIX + orgId);
    } catch {
      return false;
    }
  };

  return { clear, hasDraft };
}
