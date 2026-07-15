# Add "Map / Background" controls to the v2 Venue Designer

## Problem

The v2 designer (`src/components/venue-designer-v2/designer.tsx`) never exposes a way to add a background. The old v1 shell had an "Add satellite from address…" button and an "Upload reference (image/PDF)" button; neither was ported over. The Inspector only shows background controls once a background already exists, so today there is no entry point.

The earlier Static Maps 403 was a downstream symptom — that path is already retired server-side; we now just render live Google Maps satellite tiles via the browser key once a background is set. The remaining work is UI wiring.

## Plan

### 1. Add a "Background" section to the Layout-settings panel (Inspector)

In `src/components/venue-designer/inspector.tsx`, when no background exists, render an "Add background" block with two actions:

- **Satellite from address** — opens a small inline form (address input + Load button). On submit calls the existing `fetchSatelliteBackground` server function and stores the returned `{ lat, lng, zoom, widthFeet, heightFeet, meta }` as a `background` of kind `"satellite"` on `settings`.
- **Upload image / PDF** — file input that calls the existing `uploadReferenceBackground({ organizationId, venueId, file })` helper and stores the returned `BackgroundLayer`.

The existing `BackgroundSection` continues to show opacity, size, rotation, lock, calibrate, and a "Remove background" button once one exists.

To make this work the Inspector needs `organizationId` and `venueId` in props (currently absent). Thread both from `VenueDesignerV2` → `Inspector`.

### 2. Add a top-toolbar shortcut in v2

In `src/components/venue-designer-v2/designer.tsx`, add a small "Map" button (MapPin icon) next to the tool cluster or in the top-left group that opens the same address dialog directly, so users don't have to hunt through the Inspector. Reuse a shared `AddBackgroundDialog` component so the Inspector's "Satellite from address" and the toolbar shortcut share one implementation.

### 3. Error surface

Wrap both async calls with `try/catch` and surface failures via `toast.error(err.message)`. The server function already returns clean messages for `ZERO_RESULTS`, `REQUEST_DENIED`, and quota — no extra handling needed. Update the stale error string in `src/lib/venue-designer.functions.ts` (line 73) to drop the "Static Maps API" reference since only Geocoding is used.

### 4. Verify

- Open the v2 designer, confirm the Inspector's "Layout settings" view shows the new Background block when no background exists.
- Click "Satellite from address", enter an address, confirm the satellite tiles render via `SatelliteMapLayer`.
- Upload a PDF/PNG, confirm it renders as a reference layer.
- Confirm no Static Maps request appears in the network panel.

## Files touched

- `src/components/venue-designer-v2/designer.tsx` — pass `organizationId`/`venueId` to Inspector, add optional toolbar shortcut.
- `src/components/venue-designer/inspector.tsx` — new "Add background" block + address dialog + file upload, accept `organizationId`/`venueId` props.
- `src/lib/venue-designer.functions.ts` — minor error-copy cleanup.

## Question

Do you want the entry point to live only inside the Inspector's Layout-settings panel, or also as a dedicated **Map** button in the top toolbar for one-click access?
