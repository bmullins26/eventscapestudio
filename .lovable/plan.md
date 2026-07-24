# Venue Workspace SDK → Production Venue Designer

## Goal
Promote the interactive Workspace SDK (currently at `/studio/venue-workspace-preview`) to the production Venue Designer at `/studio/venues/:venueId/designer`. Blank canvas on new venues. Demo layouts live only under `/dev/examples`. Backend, IDs, routes, and server functions untouched.

## Architecture Addendum — Production Migration Rules

1. **Workspace Adapter Layer** — `src/lib/workspace-adapter.ts` is the only bridge between EventScape (`AnyElement[]`, `venue_layouts`, `event_booths`) and the SDK. The SDK never imports Supabase, server functions, or `AnyElement`.
2. **Internal Object Model** — Externally, the adapter presents everything as `WorkspaceObject { id, type, geometry, style, metadata, layer, rotation, locked, hidden }`. Internally the SDK still keeps separate `Booth[]` + `PlacedObj[]` collections (deep refactor deferred); the adapter derives/reconciles both directions and the round-trip contract holds via stable `objectId`.
3. **Initialization** — Loading a workspace only renders saved objects/layers/viewport. Never creates booths, roads, trees, etc. Objects can only appear via user action, import, AI import, template insertion, paste, or a `/dev/examples/*` route.
4. **Save/Reload Contract** — `saveVenueLayout()` is authoritative. Adapter serialization is deterministic: same IDs, same order, same properties in → identical Workspace out.
5. **Empty Workspace** — Zero objects renders grid + reference layers + empty-state card ("Add Object · Import Drawing · AI Import · Start From Template · Recent Templates").
6. **Rentable Spaces** — Booth, Table, Food Truck Space, Trailer Space, Sponsor Space, Pavilion Space, Vendor Tent, Indoor/Outdoor/Premium Booth all share inspector, vendor assignment, reservations, applications, payments, pricing, dimensions, rotation, status, check-in, documents. Rendering + default metadata differ. Adapter tags them with `metadata.rentable = true`.
7. **Developer Examples** — `/dev/examples/*` only. Read-only. Never saves. Production never imports `demo-data.ts`.
8. **Future Compatibility** — Backend can evolve; only the adapter changes.
9. **Session Protection** — Unsaved changes trigger a beforeunload prompt; save indicator shows Saved / Saving… / Unsaved Changes; save is debounced.

## Changes

### 1. `src/lib/workspace-adapter.ts` (new)
- `WorkspaceObject` type (unified).
- `fromLayout(elements)` → `{ booths, objects, background }` for SDK ctx.
- `toLayout({ booths, objects, background })` → `AnyElement[]` + `LayoutSettings` for `saveVenueLayout`. Preserves `objectId`, ordering, and metadata.

### 2. `src/routes/_authenticated/studio.venues.$venueId.designer.tsx`
- Loads via `getVenueLayout`.
- Passes SDK ctx with adapter output. Empty venue → empty ctx (no fallback).
- `onSave` writes back via `saveVenueLayout` (adapter serializes).

### 3. `src/components/venue-workspace-sdk/App.tsx`
- `WorkspaceCtx` extended: `objects?`, `initialBackground?`, `onSave?`.
- No demo fallback (already removed).
- `hasChanges` tracker + `beforeunload` guard + debounced save.
- Save indicator: Saved / Saving… / Unsaved Changes.
- Empty state card when 0 booths + 0 objects + no background.

### 4. `src/components/venue-workspace-sdk/demo-data.ts`
- Export `DEMO_EXAMPLES: Record<string, WorkspaceCtx>` with `county-fair`, `christmas-market`, `farmers-market`, `trade-show`, `music-festival` (existing sample becomes `farmers-market`; others are small distinct stubs).
- Production code does not import this file (grep-enforced).

### 5. `/dev/examples/*`
- `src/routes/_authenticated/dev.examples.index.tsx` — lists examples.
- `src/routes/_authenticated/dev.examples.$exampleId.tsx` — renders workspace with the picked example (read-only banner; no save).

### 6. Cleanup
- Delete `src/routes/_authenticated/studio.venue-workspace-preview.tsx`.
- Event-scoped route `studio.events.$eventId.workspace-sdk.tsx` unchanged.
- Old `venue-designer-v2/*` + `venue-designer/*` component trees kept in place (no imports) — removal is a follow-up.

## Acceptance
- Existing venue opens with only its saved objects.
- New venue opens empty with the onboarding card.
- Save round-trip is deterministic (same IDs/order/props).
- `/dev/examples/*` renders demos without persisting.
- All existing venue/event/vendor/application/payment/template APIs untouched.

## Not doing (this pass)
- Full internal unification of SDK state into one `WorkspaceObject[]` collection.
- Deleting legacy v2 designer component tree.
- Auth/schema/server-fn changes.
