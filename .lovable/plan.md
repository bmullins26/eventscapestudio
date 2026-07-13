
# Venue Designer v2 — Phase 1 Plan

Complete rewrite of the Venue Designer as a canvas-first workspace. The map fills the screen; every panel slides over it. Existing designer keeps working during the build; v2 replaces it when Phase 1 is signed off.

## Scope of Phase 1

In:
- New canvas-first workspace shell (desktop / tablet / phone).
- Full drawing toolset + expanded object library (~40 categories).
- Touch, pen, and gesture support (pinch, two-finger pan, rotate, long-press).
- Layers system with visibility / lock / opacity / reorder.
- Contextual right inspector (venue / booth / road / building / object).
- Bottom status bar (zoom, coords, units, snapshot state).
- New data tables for layers and reservations foundation; migration path from `venue_layouts.elements` JSON.
- Viewport culling + memoized rendering to handle 1000+ booths.
- Google Satellite background retained as one reference layer type.

Out (Phase 2, tracked separately):
- AI import (upload → editable objects). UI slot stubbed, endpoint not built.
- Vendor booth reservation portal.
- CAD import, real-time multi-user editing, comments/mentions.

## Route strategy

Build v2 at `/_authenticated/studio/venues/$venueId/designer` (replaces the current page). Old code moved to `.legacy.tsx` on disk during the build so we can diff; deleted at Phase 1 sign-off. Existing `venue_layouts` rows load into the new engine via a compatibility adapter — no data migration required for Phase 1 to render.

## Workspace layout

```text
Desktop / Tablet
┌───────────────────────────────────────────────────────────────┐
│ Top toolbar: venue name · save · undo/redo · zoom · view menu │
├─┬───────────────────────────────────────────────────────┬─────┤
│L│                                                       │  R  │
│e│                     CANVAS (80-90%)                   │  i  │
│f│                                                       │  g  │
│t│      floating contextual toolbar hovers over canvas   │  h  │
│ │                                                       │  t  │
├─┴───────────────────────────────────────────────────────┴─────┤
│ Status bar: zoom % · cursor XY · units · selection count      │
└───────────────────────────────────────────────────────────────┘

Phone
┌────────────────────────┐
│  slim top bar          │
├────────────────────────┤
│                        │
│      CANVAS (95%)      │
│                        │
│              ● FAB     │
├────────────────────────┤
│  bottom sheet on demand│
└────────────────────────┘
```

Docks are overlays with backdrop blur — they never resize the canvas. Left dock collapses to a 48px icon rail. Right dock auto-opens on selection, closes on empty click.

## Left dock (tabbed, slide-over)

Tabs: Objects · Layers · Assets · Templates · References · AI (stub) · Vendors · Comments (stub) · Search. Each tab is a lazy component; only Objects, Layers, Templates, References, and Search are functional in Phase 1. AI, Vendors, Comments render "coming soon" panels.

## Right dock (contextual inspector)

Renders one of: `NoSelectionInspector`, `MultiSelectionInspector`, `BoothInspector`, `ShapeInspector`, `TextInspector`, `IconInspector`, `RoadInspector`, `BuildingInspector`, `ReferenceInspector`. Each is a dedicated file so future categories don't bloat one component.

## Object library

Categories (each an entry in a static registry file, expandable at runtime from `org_object_library`): Booths, Buildings, Roads, Walkways, Parking Lots, Trees, Bushes, Landscape, Food Trucks, Tents, Stages, Pavilions, Restrooms, ATMs, Generators, Water, Electric Panels, Benches, Tables, Chairs, Trash, Signs, Banners, Sponsor Areas, Kids Area, Beer Garden, Food Court, Registration, Info Booth, Security, First Aid, Fence, Utilities, Custom Objects, Favorites, Recent.

Each object has: id, category, display name, default size (feet), default rotation, SVG glyph component, default layer, metadata schema (capacity, power, water, etc.). Drag from library → dropped onto canvas at world coords under cursor.

## Drawing tools

Select · Pan · Rectangle · Circle · Polygon · Polyline · Text · Measurement (dimension line with feet) · Road (thick polyline w/ width) · Walkway (thin polyline) · Building (rect w/ metadata) · Parking (rect w/ stall lines) · Booth · Table · Tree · Utility marker · Fence (polyline) · Custom shape · SVG import · Image import.

Tool state is a single top-level enum in the store. Keyboard shortcut per tool (V, H, R, C, P, L, T, M, etc.). On tablet/phone, tools are on the floating toolbar.

## Touch / pen / gesture

- Hammer.js-style gesture handler on the canvas root: pinch → zoom around center, two-finger pan, two-finger rotate (world, when unlocked), long press → context menu, single tap → select, double tap → edit label / enter polygon vertex edit.
- Pointer Events API for pen: pressure ignored for now; palm rejection via `pointerType === 'pen'` priority.
- Handles (resize, rotate) are 24px visual / 48px hit target on touch.

## Rendering / performance

- SVG canvas stays (matches current stack), but with viewport culling: only render elements whose AABB intersects the current viewport plus 10% margin.
- `React.memo` on every element renderer keyed by element id + version hash.
- Transform via a single `<g transform="matrix(...)">` wrapper; RAF-throttled pan/zoom.
- Elements > 500 → switch to a chunked layer render (group by 200-element buckets so React reconciliation stays cheap).

## Data model changes

New tables (SQL in the Technical section):
- `venue_layers` — one row per layer per layout. Columns: id, layout_id, name, kind, z_index, visible, locked, opacity, color.
- `venue_object_library` (org-scoped) — for saved custom objects and favorites.
- `event_booth_reservations` — scaffolded now (empty of UI) so Phase 2 vendor flow drops in.

Kept as-is: `venue_layouts` (still holds elements JSON as the fast path). New `layer_id` field added to each element. A migration script backfills a default set of layers per existing layout.

## File plan

Delete on cutover: existing `src/components/venue-designer/*` (kept as `.legacy` during build).

New tree:

```text
src/components/venue-designer-v2/
  designer.tsx                 # top-level component
  workspace-shell.tsx          # layout skeleton (responsive)
  top-toolbar.tsx
  floating-toolbar.tsx
  bottom-status-bar.tsx
  left-dock/
    dock.tsx
    tab-objects.tsx
    tab-layers.tsx
    tab-templates.tsx
    tab-references.tsx
    tab-search.tsx
    tab-ai-stub.tsx
    tab-vendors-stub.tsx
    tab-comments-stub.tsx
  right-dock/
    dock.tsx
    inspector-none.tsx
    inspector-multi.tsx
    inspector-booth.tsx
    inspector-shape.tsx
    inspector-text.tsx
    inspector-icon.tsx
    inspector-road.tsx
    inspector-building.tsx
    inspector-reference.tsx
  canvas/
    canvas-root.tsx            # SVG root + gesture handler
    viewport.tsx               # zoom/pan/rotate math
    culling.ts                 # AABB intersection
    element-renderer.tsx       # switch on kind → renderer
    renderers/
      booth.tsx
      shape.tsx
      road.tsx
      building.tsx
      table.tsx
      chair.tsx
      tree.tsx
      fence.tsx
      food-truck.tsx
      ...
    handles.tsx                # resize/rotate handles
    marquee.tsx                # multi-select box
    background-reference.tsx
    background-satellite.tsx   # ports current SatelliteMapLayer
  tools/
    tool-state.ts
    tool-select.ts
    tool-draw-rect.ts
    tool-draw-circle.ts
    tool-draw-polygon.ts
    tool-draw-polyline.ts
    tool-draw-road.ts
    tool-measure.ts
    tool-text.ts
    tool-pan.ts
  library/
    registry.ts                # canonical categories & defaults
    glyphs/                    # one SVG per object type
  store/
    store.ts                   # Zustand store; elements + layers + selection + tool + viewport
    history.ts                 # undo/redo (command pattern)
    persistence.ts             # debounced save to venue_layouts
    types.ts
  gestures/
    use-canvas-gestures.ts
    use-pointer.ts
    use-keyboard-shortcuts.ts
  responsive/
    use-form-factor.ts         # 'phone' | 'tablet' | 'desktop'
    bottom-sheet.tsx           # phone-only selection sheet
    fab.tsx                    # phone-only floating action button
  adapters/
    from-legacy-elements.ts    # v1 elements JSON → v2 model
    to-legacy-elements.ts      # v2 → JSON (write-through for Phase 1)
```

Server functions (`src/lib/venue-designer.functions.ts`) get:
- `getVenueLayoutV2` — returns layout + layers + org library summary in one call.
- `saveVenueLayoutV2` — writes elements JSON + upserts layer rows in a transaction.
- `saveOrgLibraryObject` — persist a custom object to `venue_object_library`.

Existing `fetchSatelliteBackground`, `createEventVenueSnapshot`, etc. stay untouched.

## Build phases (in order, each independently reviewable)

1. **Schema + data adapter.** Migration for `venue_layers`, `venue_object_library`, `event_booth_reservations` (empty scaffold). Adapter that reads current `venue_layouts.elements` into the v2 model with a default layer set.
2. **Workspace shell.** Route, top toolbar, floating toolbar, bottom status bar, left dock with Objects + Layers tabs only, right dock with none/booth/shape inspectors. Canvas renders existing elements read-only.
3. **Interaction layer.** Zustand store + history + persistence. Select / move / resize / rotate. Keyboard shortcuts. Undo/redo. Save round-trips through adapter.
4. **Drawing tools.** All shape tools, road, walkway, building, measurement, text. Snapping (grid + object).
5. **Expanded library + glyphs.** All 40 object categories with real SVG glyphs. Drag-drop from library. Favorites, Recent, org custom objects.
6. **Layers UX.** Full layers panel: reorder, opacity slider, lock, visibility, color, per-layer z-index.
7. **Touch + gesture.** Pinch/pan/rotate, long-press context menu, 48px handles, phone bottom sheet + FAB.
8. **Performance.** Viewport culling, bucketed rendering, RAF throttling. Measure with a 1500-booth synthetic layout.
9. **Cutover.** Delete `.legacy` files, update snapshot viewer for v2 model, remove old designer route.

Each phase ends with a working, mergeable state.

---

## Technical details

Database (all one migration in step 1):

```sql
create table public.venue_layers (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references public.venue_layouts(id) on delete cascade,
  name text not null,
  kind text not null,          -- 'reference'|'buildings'|'roads'|'parking'|'utilities'|'landscape'|'booths'|'sponsors'|'labels'|'custom'
  z_index int not null default 0,
  visible boolean not null default true,
  locked boolean not null default false,
  opacity numeric not null default 1 check (opacity between 0 and 1),
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (layout_id, name)
);
grant select, insert, update, delete on public.venue_layers to authenticated;
grant all on public.venue_layers to service_role;
alter table public.venue_layers enable row level security;
create policy "layers via org membership" on public.venue_layers for all
  using (exists (
    select 1 from public.venue_layouts vl
    join public.venues v on v.id = vl.venue_id
    where vl.id = venue_layers.layout_id
      and public.is_org_member(auth.uid(), v.organization_id)
  ))
  with check (exists (
    select 1 from public.venue_layouts vl
    join public.venues v on v.id = vl.venue_id
    where vl.id = venue_layers.layout_id
      and public.is_org_member(auth.uid(), v.organization_id)
  ));

create table public.venue_object_library (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  name text not null,
  glyph_svg text,
  default_w numeric not null,
  default_h numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.venue_object_library to authenticated;
grant all on public.venue_object_library to service_role;
alter table public.venue_object_library enable row level security;
create policy "org library via membership" on public.venue_object_library for all
  using (public.is_org_member(auth.uid(), organization_id))
  with check (public.is_org_member(auth.uid(), organization_id));

create table public.event_booth_reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  booth_element_id text not null,           -- element id inside the snapshot
  vendor_profile_id uuid references public.vendor_profiles(id) on delete set null,
  status text not null default 'available', -- available|pending|reserved|paid|unavailable
  reserved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, booth_element_id)
);
grant select, insert, update, delete on public.event_booth_reservations to authenticated;
grant all on public.event_booth_reservations to service_role;
alter table public.event_booth_reservations enable row level security;
-- policies fleshed out in Phase 2; Phase 1 ships table+RLS-locked with an org-member policy:
create policy "reservations via event org" on public.event_booth_reservations for all
  using (public.is_org_member(auth.uid(), public.event_org_id(event_id)))
  with check (public.is_org_member(auth.uid(), public.event_org_id(event_id)));
```

State container: Zustand + immer, one store per designer mount (not global). Selectors memoized with `useShallow`.

Element schema v2 (superset of current `AnyElement`): adds `layer_id`, `metadata` (jsonb-shaped free record), and new kinds `road | walkway | building | parking | table | chair | fence | measurement`. Legacy elements without `layer_id` get bucketed into the default layer for their kind by the adapter.

Persistence: elements array still written to `venue_layouts.elements` (unchanged column) so snapshots keep working; layers written to `venue_layers`. `saveVenueLayoutV2` runs both in a single server function using an RPC that wraps them in a transaction (or sequential writes if the transaction adds friction — layers table is small and idempotent).

Touch: use `pointerdown/move/up` with `setPointerCapture`; track active pointers in a Map. Two active pointers → pinch/pan/rotate math on midpoint; one pointer → tool-driven behavior. Long-press = 500 ms without movement > 6 px.

Culling: maintain viewport rect in world coords; each element's AABB pre-computed and cached in the store keyed by version. Renderer filters at the parent so React only reconciles visible nodes.

Snapshot viewer at `studio.events.$eventId.venue.tsx` is updated in the final cutover phase to read v2 elements (kinds like `road`, `building` render correctly). Legacy shape/circle/rect paths stay for old snapshots.

Rollback plan: v1 files stay on disk as `.legacy` until step 9. Reverting is a rename + route swap; no destructive DB changes (all new tables are additive).
