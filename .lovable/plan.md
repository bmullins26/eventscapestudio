## Problem

`/studio/venue-workspace-preview` renders `src/components/venue-workspace-preview/SdkApp.tsx` — the original 1,227-line upload with **no drag/move/resize logic**. All the interactive work (drag, marquee, resize handles, alignment, shortcuts, Save/Undo/Publish, library drop) lives in a different file: `src/components/venue-workspace-sdk/App.tsx`, used only by the event-scoped route `/studio/events/$eventId/workspace-sdk`.

So on the preview route, nothing is moveable because that code literally isn't there.

## Fix

Point the preview route at the interactive `venue-workspace-sdk/App.tsx` and feed it a demo data context (no event/venue in the DB required), so every button, drag, and shortcut works in preview exactly like in the wired route.

### Changes

1. **`src/components/venue-workspace-sdk/App.tsx`**
   - Make `onPatchBooth` / `onLayerToggle` in `WorkspaceCtx` optional (no-ops when absent).
   - Export a `DEMO_WORKSPACE_CTX` built from the original hardcoded booth grid (rows A–F × 1–12, sample statuses/vendors/prices) and demo layers (Booths, Roads, Utilities, Landscape, Sponsors), matching the current SdkApp demo.

2. **`src/routes/_authenticated/studio.venue-workspace-preview.tsx`**
   - Swap the import from `SdkApp` to the interactive `WorkspaceApp` + `WorkspaceDataProvider`, wrapped with `DEMO_WORKSPACE_CTX`.
   - Title stays "Venue Workspace Preview".

3. **`src/components/venue-workspace-preview/SdkApp.tsx`**
   - Delete. No other route imports it.

### Result

- `/studio/venue-workspace-preview` — fully interactive demo (drag, resize, marquee, alignment, shortcuts, Save toasts) backed by in-memory demo data. Nothing persists — refresh resets.
- `/studio/events/$eventId/workspace-sdk` — unchanged; still writes through to `event_booths` / `venue_layers`.
- v2 designer at `/studio/venues/$venueId/designer` — untouched.

### Not doing

- No schema changes.
- No changes to the event-scoped wired route.
- No removal of v2 designer.
