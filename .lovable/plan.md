
# Background layer + reference import for the Layout Designer

Add a persistent "background reference layer" to the designer canvas, sourced from either Google Static Maps (address search) or a user-uploaded image/PDF. Both flows share the same underlying reference model, opacity/lock controls, and a 2-point scale calibration so booths measured in feet snap to real-world dimensions.

## Data model

Extend `LayoutSettings` (`src/components/venue-designer/types.ts`) with an optional `background` block:

```ts
background?: {
  kind: "satellite" | "image";
  url: string;                // signed URL (image) or Google Static Maps URL
  // world-space placement (feet):
  x: number; y: number; w: number; h: number;
  rotation: number;
  opacity: number;            // 0..1
  locked: boolean;
  // Satellite-only metadata for re-fetch / attribution:
  meta?: { lat: number; lng: number; zoom: number; address?: string };
}
```

Persisted through the existing `venue_layouts.settings` jsonb — no schema change.

## Storage

Reuse the existing `venue-assets` bucket for uploads. Path: `venue-backgrounds/{venueId}/{uuid}.{ext}`. Signed URLs (1 year) written into `settings.background.url`. PDFs are rasterized in the browser via existing `src/lib/pdf-render.ts` (page 1 → PNG blob) then uploaded as PNG.

## Google Static Maps integration

- Ask user to store `GOOGLE_MAPS_API_KEY` as a runtime secret (via `add_secret`). Not exposed to the client.
- New server function `fetchSatelliteBackground` in `src/lib/venue-designer.functions.ts`:
  - input: `{ venueId, address }`
  - geocode via Google Geocoding API → `{ lat, lng }`
  - build Static Maps URL: `maptype=satellite`, `size=1280x1280`, `scale=2`, `zoom=19` (auto-fit heuristic based on viewport bounds returned by geocoder).
  - fetch image, upload to `venue-assets`, return `{ url, meta: { lat, lng, zoom, address } }`.
  - Compute world-space width/height in feet using Web Mercator meters-per-pixel at that lat/zoom → multiply by pixel size → convert meters→feet.
- Attribution: render "Imagery ©Google" label on canvas near background.

## Hand-drawn / PDF upload

New server function `uploadReferenceBackground`:
- input: `{ venueId, filename, contentType, base64 }` (small helper; large files go via signed upload URL — see below).
- Actually: use direct client upload with the existing signed-upload pattern (a `getReferenceUploadUrl` server fn returns a signed upload URL, client PUTs, then calls `commitReferenceBackground` with the object path).
- Client (in the designer):
  - Accept `image/*` and `application/pdf`.
  - For PDFs: `loadPdf` + `renderPdfPageToBlob(pdf, 1, 2)` from `src/lib/pdf-render.ts`.
  - For images: use as-is; read natural size via `loadImageNaturalSize`.
  - Initial world placement: default to 100 ft wide, aspect preserved, centered on origin (until calibrated).

## Calibration (2-point scale)

New "Calibrate scale" mode in the toolbar:
1. User clicks two points on the background.
2. Prompt for real-world distance in feet.
3. Compute uniform scale factor = (target ft) / (current world distance between the two points), then scale background `w`/`h` around its center. Rotation is not adjusted (users can rotate the background from the Inspector).

Store nothing extra — the background rect itself is the calibrated reference.

## Auto-detect rectangles → booths

Client-only image processing (no server cost). New util `src/components/venue-designer/detect-rects.ts`:
- Draw the background image to an offscreen canvas at ~1200px wide.
- Use a lightweight pure-JS pipeline (no OpenCV wasm to keep bundle small): grayscale → adaptive threshold → connected-components → bounding boxes → filter by min area / aspect / max count (cap 500).
- Convert each pixel-space rect to world-space using the calibrated background transform.
- Emit `BoothElement`s via `makeBooth`, sequentially numbered, added in a single `actions.add` batch to one history entry.

Trigger: Inspector button "Detect booths from image" appears when a background is present AND calibration has been performed. Confirmation dialog warns results are approximate and appends to the current layout.

## UI changes

**Toolbar (`designer-shell.tsx`):**
- Add a "Background" dropdown between icon picker and undo:
  - "Add satellite from address…" → opens address dialog → calls `fetchSatelliteBackground`.
  - "Upload image or PDF…" → opens file picker.
  - "Calibrate scale (2 points)" (enabled when background present).
  - "Remove background" (enabled when background present).

**Canvas (`canvas.tsx`):**
- New render pass BEFORE the grid: draw `settings.background` as a rotated, opacity-adjusted `<image>` in world coordinates. When `locked`, ignore pointer events; otherwise selectable with the same 8-handle transform frame as elements (special-cased since it lives in settings, not `elements`).
- New pointer tool `"calibrate"` handled inline: two clicks → distance prompt → mutate `settings.background`.

**Inspector (`inspector.tsx`):**
- New "Background" section (visible when `settings.background` set):
  - Opacity slider (0–100).
  - Locked toggle.
  - Rotation input.
  - Width/height (feet) numeric inputs (kept aspect-linked by a chain toggle).
  - "Detect booths from image" button.
  - "Remove background".

**Object Explorer:**
- Add a pinned top row "Background (locked)" when present, with eye + lock toggles wired to `settings.background`.

## Server functions

Add to `src/lib/venue-designer.functions.ts`:
- `fetchSatelliteBackground({ venueId, address })`
- `getReferenceUploadUrl({ venueId, contentType })` → returns `{ path, uploadUrl }` (signed upload URL from `venue-assets`)
- `commitReferenceBackground({ venueId, path })` → returns `{ url }` (long-lived signed URL)

All three use `requireSupabaseAuth`, check `is_org_member` via the venue's `organization_id`, and cap file paths under `venue-backgrounds/{venueId}/`.

## Secret to request

`GOOGLE_MAPS_API_KEY` (server-only). Required for the satellite flow; upload/PDF flow works without it. Explain in chat before calling `add_secret`, and only if the user proceeds with satellite import.

## Out of scope

- Multiple stacked backgrounds (only one at a time).
- Live/interactive Google Maps tiles (a static image is sufficient and cheaper).
- Server-side OCR / hand-writing recognition.
- OpenCV / heavy CV — the rectangle detector is intentionally simple and labeled "experimental" in the UI.

## Phasing

1. **Phase 1 – Reference layer core**: types, storage helpers, upload (image + PDF), canvas render, inspector controls, remove. Ships a working "trace on top of your sketch" flow.
2. **Phase 2 – Calibration**: 2-point scale tool + inspector width/height sync.
3. **Phase 3 – Satellite**: request `GOOGLE_MAPS_API_KEY`, add address search dialog, `fetchSatelliteBackground`, auto-fit sizing from Mercator math, attribution label.
4. **Phase 4 – Auto-detect**: `detect-rects.ts` util + Inspector button + confirmation dialog + batched add.

Each phase persists via existing `venue_layouts.settings` auto-save.
