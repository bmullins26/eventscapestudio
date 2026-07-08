import { useEffect, useState } from "react";

export type DeviceClass = "desktop" | "tablet" | "phone";

/**
 * Classifies the current device based on viewport width and pointer coarseness.
 * - phone: <768px
 * - tablet: 768–1023px OR coarse pointer at any width up to 1279px
 * - desktop: everything else (fine pointer + ≥1024px)
 */
export function useDeviceClass(): DeviceClass {
  const [cls, setCls] = useState<DeviceClass>(() => classify());

  useEffect(() => {
    const update = () => setCls(classify());
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    window.addEventListener("resize", update);
    mqCoarse.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      mqCoarse.removeEventListener?.("change", update);
    };
  }, []);

  return cls;
}

function classify(): DeviceClass {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (w < 768) return "phone";
  if (w < 1024 || coarse) return "tablet";
  return "desktop";
}
