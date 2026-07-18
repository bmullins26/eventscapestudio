## Goal
Turn the SDK preview into a real, data-backed workspace at
`/studio/events/$eventId/workspace-sdk`, running side-by-side with today's
v2 designer. When you're happy we can swap the routes.

Answers baked in:
- **Keep both** — v2 stays; SDK route becomes fully functional.
- **Event-scoped** entry — all three tabs (Design / Reservations / Operations) live.
- **New unified geometry table** — `workspace_objects`.

---

## Phase 1 · Schema (single migration, awaits your approval)

New table `public.workspace_objects`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `venue_id` | uuid FK → `venues` | required |
| `event_id` | uuid FK → `events` | nullable — event overrides on venue base |
| `layer_id` | uuid FK → `venue_layers` | nullable |
| `kind` | text | `booth\|road\|walkway\|fence\|building\|parking\|stage\|tree\|shape\|text\|image\|measure` |
| `geometry` | jsonb | `{x,y,w,h,rotation,points?}` in feet |
| `props` | jsonb | kind-specific (row/col/size/category/electric/water/corner/premium/color/label…) |
| `z_index` | int |  |
| `locked` / `visible` | bool |  |
| `created_by` / timestamps | | standard |

RLS: org-members of the venue's org can CRUD; policies scoped via
`venue_org_id(venue_id)` and `is_org_member`. Full GRANTs for `authenticated`
+ `service_role`. Bridge column `event_booth_id` (nullable FK →
`event_booths`) so a booth object binds to its live row.

**Backfill NOT run** — SDK route reads/writes `workspace_objects` only. v2
keeps using `venue_layouts.elements`. Later we can port v2 over.

---

## Phase 2 · Server functions (`src/lib/workspace-sdk.functions.ts`)

- `getEventWorkspaceSdk({eventId})` — returns event, venue, layers,
  `workspace_objects` (event overlay + venue base merged), event_booths joined
  with vendor/application/payment.
- `upsertWorkspaceObject`, `deleteWorkspaceObject`, `bulkPatchWorkspaceObjects`
  (move/resize/duplicate/align).
- `setBoothStatus`, `assignVendorToBooth`, `checkInBooth`, `checkOutBooth`
  (event mode). Reuse existing `event-workspace.functions.ts` where sensible.
- `generateBoothGrid({rows, cols, size, origin, prefix})` — mirrors SDK's row/col naming.
- All `requireSupabaseAuth`; validated with Zod.

---

## Phase 3 · Refactor SDK into wired components

Copy `SdkApp.tsx` into `src/components/venue-workspace-sdk/` and split:
- `WorkspaceShell.tsx` — layout, top bar, mode tabs, breakpoints.
- `Canvas.tsx` — SVG canvas + pan/zoom + tool handlers, now bound to
  `workspace_objects`.
- `Toolbar.tsx`, `ObjectsPanel.tsx`, `LayersPanel.tsx`, `Inspector.tsx`,
  `BoothHover.tsx`, `ReservationsSheet.tsx`, `OperationsSheet.tsx`.
- Replace hardcoded `makeBooth` demo data with a `useWorkspaceData(eventId)`
  hook (TanStack Query + `getEventWorkspaceSdk`).
- Inspector fields write via `useMutation(upsertWorkspaceObject)`;
  invalidate `["workspace", eventId]` on success.
- Booth status colors derived from `deriveBoothState` (existing) — SDK
  palette stays but statuses come from live data (application/payment/checked-in).
- Undo/redo: local optimistic stack that batches server writes on commit.

---

## Phase 4 · Route + navigation

- New route `src/routes/_authenticated/studio.events.$eventId.workspace-sdk.tsx`
  under the auth gate; loader `ensureQueryData(workspaceQueryOptions(eventId))`.
- Add "Open workspace (new)" button on `/studio/events` list and event detail
  next to the existing "Venue" button. v2 designer link stays.
- Keep the preview route `/studio/venue-workspace-preview` as a static demo.

---

## Phase 5 · Feature parity checklist per mode

**Design**: create/move/resize/rotate booths + shapes, snap-to-grid, layers
visibility/lock, generate grid, image/pdf background layer (reuses existing
`add-background-dialog`), satellite background layer (reuses
`satellite-map-layer`).
**Reservations**: filter by status/category, drag vendor from dock onto
booth, bulk price/traits edit, waitlist column.
**Operations**: check-in/out, staff notes, live status colors, quick jump to
booth on canvas.

---

## What we're NOT doing this round
- Not deleting or rewriting `venue-designer-v2/`.
- Not migrating `venue_layouts.elements` → `workspace_objects` yet.
- Not touching public vendor portal reservation surface.
- Not adding AI layer 2 (Gemini) — Phase 6+.

---

## Rollout
Phase 1 migration → I stop for your approval. On approval I ship Phases 2–4
in one batch, then walk you through Phase 5 parity gaps so we can prioritize.

Say go and I'll draft the migration.
