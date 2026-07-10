import { supabase } from "@/integrations/supabase/client";
import { loadPdf, renderPdfPageToBlob, loadImageNaturalSize } from "@/lib/pdf-render";
import type { BackgroundLayer } from "./types";

const BUCKET = "venue-assets";

function extFromContentType(ct: string): string {
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg") return "jpg";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  if (ct === "application/pdf") return "png"; // rasterized
  return "bin";
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Upload a hand-drawn image or PDF (page 1) to venue-assets storage and return
 * a BackgroundLayer ready to store in LayoutSettings. Path layout is:
 *   <org_id>/venue-backgrounds/<venue_id>/<uuid>.<ext>
 * which satisfies the existing "org members write" RLS policy on venue-assets.
 */
export async function uploadReferenceBackground(params: {
  organizationId: string;
  venueId: string;
  file: File;
}): Promise<BackgroundLayer> {
  const { organizationId, venueId, file } = params;
  let blob: Blob = file;
  let contentType = file.type || "application/octet-stream";
  let naturalWidth = 0;
  let naturalHeight = 0;

  if (contentType === "application/pdf") {
    const pdf = await loadPdf(file);
    const rendered = await renderPdfPageToBlob(pdf, 1, 2);
    blob = rendered.blob;
    contentType = "image/png";
    naturalWidth = rendered.width;
    naturalHeight = rendered.height;
  } else if (contentType.startsWith("image/")) {
    const size = await loadImageNaturalSize(file);
    naturalWidth = size.width;
    naturalHeight = size.height;
  } else {
    throw new Error("Unsupported file type. Upload an image or PDF.");
  }

  const ext = extFromContentType(contentType);
  const path = `${organizationId}/venue-backgrounds/${venueId}/${uid()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
  if (signErr || !signed) throw signErr ?? new Error("Failed to sign background URL");

  // Default placement: 100 ft wide, aspect-preserved, centered on origin.
  // The user calibrates for accurate scale.
  const aspect = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1;
  const defaultW = 100;
  const defaultH = defaultW / aspect;

  return {
    kind: "image",
    url: signed.signedUrl,
    x: -defaultW / 2,
    y: -defaultH / 2,
    w: defaultW,
    h: defaultH,
    rotation: 0,
    opacity: 0.7,
    locked: false,
    calibrated: false,
  };
}

/**
 * Recompute background w/h so that the world-space distance between two
 * user-clicked points matches `realFeet`. Anchor scaling to the background
 * center to keep the reference visually stable.
 */
export function calibrateBackground(
  bg: BackgroundLayer,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  realFeet: number,
): BackgroundLayer {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const current = Math.hypot(dx, dy);
  if (current < 1e-6 || realFeet <= 0) return bg;
  const scale = realFeet / current;
  const cx = bg.x + bg.w / 2;
  const cy = bg.y + bg.h / 2;
  const newW = bg.w * scale;
  const newH = bg.h * scale;
  return {
    ...bg,
    w: newW,
    h: newH,
    x: cx - newW / 2,
    y: cy - newH / 2,
    calibrated: true,
  };
}
