## Goal

Let the user reposition (drag), resize/rotate, and crop **any** background — satellite maps as well as uploaded images / PDFs — inside the v2 designer.

## Current state

- `SatelliteMapLayer` already supports `interactive` mode: the Google Map itself becomes draggable/zoomable and reports new `{ lat, lng, zoom }` via `onViewportChange`. Not wired into v2 yet.
- Uploaded `image` backgrounds render as a static `<img>` in `canvas.tsx`. There is no drag/resize/rotate UI for the background — only opacity, rotation number field, lock and calibrate in the Inspector.
- Backgrounds store `{ x, y, w, h, rotation, opacity, locked, calibrated }` in world feet. Satellite adds `{ lat, lng, zoom, meta }`. There is no crop field.

## Plan

### 1. Unified "Adjust background" mode (drag + resize + rotate)

Works for **both** `google-satellite` and `image` (uploaded PNG / JPG / PDF-rasterized) backgrounds.

- Add `adjustingBackground: boolean` state in `src/components/venue-designer-v2/designer.tsx`, plus an **Adjust** button in the Inspector's `BackgroundSection` (replaces the current lock/unlock toggle when enabled).
- While adjusting, canvas element hit-testing is suspended and the background renders with a selection frame + 8 resize handles + a rotate handle, using the same interaction model already implemented for elements in `canvas.tsx` (reuse the resize/rotate math from `store.ts`).
- **Satellite specifics**: in adjust mode, also render `SatelliteMapLayer` with `interactive={true}` so the user can pan/zoom the tiles inside the frame. `onViewportChange` updates `{ lat, lng, zoom }` on the background. Zooming rescales `widthFeet`/`heightFeet` using the same meters-per-pixel formula used server-side in `fetchSatelliteBackground`, so ground truth stays accurate — venue elements keep their real-world size relative to the map.
- **Uploaded image/PDF specifics**: dragging the frame moves `{x,y}`; corner handles resize (preserving aspect by default, Shift to free-scale); edge handles free-scale one axis; rotate handle updates `rotation`. This effectively replaces the old "Calibrate" workflow for the common case of "just make this fit"; Calibrate stays available for precise two-point scale.
- **History**: single undo entry committed on **Done**, not per drag frame. **Cancel** restores the pre-mode snapshot without touching history.

### 2. Unified Crop mode

Works for both background kinds.

- Extend `BackgroundLayer` in `src/components/venue-designer/types.ts` with an optional `crop?: { x: number; y: number; w: number; h: number }` in world feet, relative to the background's own `{x,y,w,h}` box (so moving/rotating the background moves the crop with it).
- Add a **Crop** button to the `BackgroundSection`. Entering crop mode overlays a draggable/resizable rectangle with 8 handles on top of the background in `canvas.tsx`. **Apply** commits `crop`; **Cancel** discards; **Reset crop** clears an existing crop.
- Rendering: when `bg.crop` is set, wrap the background in a clipping container (`clipPath: inset(...)` computed from the crop rect in screen space). For satellite, this masks the scaled tile host inside `SatelliteMapLayer` — the map keeps rendering full-resolution, we just mask it. For uploaded images/PDFs, same clip approach around the `<img>`.
- Crop is **non-destructive**: the underlying image/tiles are untouched; only the visible region changes. Undo restores instantly.

### 3. Inspector wiring

- `BackgroundSection` (both v1 and v2 share this component via `inspector.tsx`) gains three actions: **Adjust**, **Crop**, **Reset crop** (visible only when a crop exists). Adjust / Crop / Calibrate are mutually exclusive.
- A thin hint bar renders at the top of the canvas while a mode is active:
  - Adjust satellite: "Drag the map to pan · scroll to zoom · drag the frame handles to resize — Done / Cancel"
  - Adjust image/PDF: "Drag to move · handles to resize · top handle to rotate — Done / Cancel"
  - Crop: "Drag the handles to crop — Apply / Cancel"

### 4. Files touched

- `src/components/venue-designer/types.ts` — add `crop` to `BackgroundLayer`.
- `src/components/venue-designer/inspector.tsx` — Adjust / Crop / Reset crop buttons + callbacks; accept a `mode` prop from the parent so buttons reflect active state.
- `src/components/venue-designer/canvas.tsx` — background selection frame with resize/rotate handles when adjusting; crop overlay with handles when cropping; clip-path when `crop` set; suspend element hit-testing during either mode; hint bar.
- `src/components/venue-designer/satellite-map-layer.tsx` — no code change needed (already supports `interactive`); the canvas wraps it in the clipping container.
- `src/components/venue-designer-v2/designer.tsx` — `mode: 'idle' | 'adjust' | 'crop'` state, viewport-change handler that recomputes world size from zoom, single-entry history commits on Done/Apply, pass mode + callbacks to Inspector and canvas.

## Questions

1. In Adjust mode for **satellite**, when the user zooms the tiles, should the map's world size (feet) **rescale** so ground truth stays accurate (recommended — keeps elements to scale) or **stay locked** (map just shows more/less detail inside the same rectangle)?
2. Crop as **non-destructive mask** (my default — easy to reset, no data lost) or physically **shrink** the background's `{x,y,w,h}` to the crop region on Apply?
