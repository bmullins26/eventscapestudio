
# Venue Workspace → Event Operating System: Phased Roadmap

The current Venue Workspace UI stays. Every phase is an additive layer. Nothing is rewritten to look different; the surface just becomes plugin-driven so it can carry the next dozen features without turning into one giant component.

Terminology: rename references from "Venue Designer" to **Venue Workspace** (and **Event Workspace** in event mode) in labels, page titles, and headings only. File paths stay for now to avoid churn.

---

## Guiding architecture

- **Plugin-based workspace, not a growing React component.** Panels, toolbar actions, hover renderers, drag targets, and side docks all register with a workspace registry instead of being hard-coded in `designer.tsx`.
- **Schema-driven objects.** Every object kind (booth, road, fence, building, stage, tree, parking, sign, custom) declares an `ObjectSchema` — inspector fields, badges, hover fields, validation rules, intelligence rules. The Context Panel renders from the schema, never from `if (kind === "booth")`.
- **Persistent Venue Objects.** Every element carries a stable UUID (`objectId`) that survives label changes, renumbering, and copies.
- **Event snapshot.** Creating/opening an event deep-copies the venue layout into the event model and upserts an `event_booths` row per booth object, keyed by `event_object_id` (the copied object UUID) — never by label.
- **Two modes, one canvas:** `venue` (edit layout defaults) and `event` (edit event geometry + overlay live operational state).
- **Derived state, single source.** `deriveObjectState(object, context)` returns `{ status, color, border, badges, warnings, tooltip, priority, icons }`. Colors, badges, hover cards, and Context Panel headers all read from this.
- **Two-layer Venue Intelligence.** Layer 1 is deterministic rules over DB + geometry + business rules, evaluated locally/synchronously; results appear instantly. Layer 2 is Lovable AI Gateway, invoked only for reasoning/forecasting/natural-language explanations. Rules first, AI only when it earns its keep.

---

## Phase 0 — Workspace Foundation (no user-visible feature, sets everything up)

Goal: build the operating system for the workspace before adding features.

- **Workspace registry** (`src/components/venue-designer/workspace/`):
  - `panelRegistry` — panels register `{ id, when(selection, mode), render, priority }`.
  - `toolbarRegistry` — toolbar actions register `{ id, group, when, icon, label, run }`.
  - `dockRegistry` — left/right/bottom docks register with the same shape.
  - `hoverRegistry` — hover-card content providers per object kind.
  - `commandRegistry` — keyboard/command-palette entries with `when` guards.
- **Selection manager** — one hook exposing `selection`, `selected`, `kinds`, `isMulti`, plus subscription. Everything else consumes this.
- **Mode provider** — `WorkspaceModeProvider` exposing `{ mode: 'venue' | 'event', eventId, event, snapshotModel }`. Route decides which; child components never branch on route.
- **Object metadata registry** — `registerObjectKind(kind, ObjectSchema)`. Schemas declare:
  - `inspectorFields` (typed field list rendered dynamically)
  - `hoverFields`
  - `badges` (predicates over state)
  - `derive(object, ctx)` (contributes to `deriveObjectState`)
  - `intelligenceRules` (Layer 1 rules)
- **Context Panel shell** rendered entirely from `panelRegistry`; existing inspector becomes the first registered panel with zero visual change.
- **No behavior change** for the user this phase — just the plumbing.

Verification: existing designer still works pixel-identical; tabs/panels are now registry-driven.

## Phase 1 — Persistent IDs + event snapshot wiring

Goal: every object is addressable; event snapshots create durable `event_booths` rows.

- Add `objectId: string` (UUID) to `BaseElement`. Backfill on layout load; `factory.ts` mints on create.
- Migration:
  - Add `event_object_id uuid` to `event_booths` with unique index on `(event_id, event_object_id)`. Grants + RLS via existing helpers.
  - No changes to auth/storage/other managed schemas.
- Server fn `snapshotVenueForEvent(eventId)` — idempotent upsert of `event_booths` rows for every booth object in the copied event model.
- Fix the current root-route hydration warning (`wihost0192` mismatch) quietly in this phase.

Verification: open designer → confirm rows exist per booth, second call is a no-op.

## Phase 2 — Dynamic Object Properties (schema-driven Properties tab)

Goal: the "Properties" tab renders from `ObjectSchema.inspectorFields`, not from booth-specific code.

- Move existing booth fields into `boothSchema.inspectorFields`. Do the same for text/icon in placeholder form.
- Add new booth toggles: premium, corner, electric, water — declared as schema fields, not hard-coded controls.
- **Empty selection** → Dashboard panel (empty shell now; wired in Phase 8).
- **Single selection** → tab strip: Properties · Vendor · Application · Reservation · Operations · Venue Intelligence · History. Only Properties is wired; others render "No data yet" so the shape ships.
- Tab strip + panel content animate with existing `animate-fade-in` / `scale-in`.

Zero regression: legacy inspector controls all present, now generated from schema.

## Phase 3 — Live state + hover cards + badges (event mode)

Goal: booths reflect reality automatically; every visual reads from one derivation.

- Toolbar mode switch: **Venue** ↔ **Event**. Event mode requires an event (via `/studio/events/$eventId/workspace`, added this phase; reuses `VenueDesignerV2`).
- Load `event_booths` + reservations + applications + payments; join into a Map keyed by `event_object_id`.
- Implement `deriveObjectState(object, ctx)` returning `{ status, color, border, badges, warnings, tooltip, priority }`.
  - Colors: Available `#D1D5DB` · Application `#F59E0B` · Reserved `#3B82F6` · Paid `#10B981` · Checked-in `#065F46` · Sponsor `#8B5CF6` · Unavailable `#EF4444` · Cancelled `#9CA3AF`.
- Event mode overrides manual booth fill with derived color; venue mode keeps manual colors.
- Hover card: floating card near cursor with fields from `hoverRegistry` for that kind (booth #, vendor, category, reservation, payment, price). Debounced show, fade in/out.
- Badges layer inside booth: ⚡ 💧 ⭐ 👑 ✓ 🏆 — driven by `schema.badges` predicates. Toggle set persisted in View Settings.

## Phase 4 — Complete the seven booth tabs

Goal: full Context Panel content for a selected booth in event mode.

- **Vendor** — `event_booths.vendor_profile_id`; deep-link to vendors route.
- **Application** — `applications` + `application_documents`; deep-link to application detail.
- **Reservation** — status timeline; invoice + `payments` history.
- **Operations** — Check In / Out server fns; staff & vendor notes on `event_booths`; power/water toggles; message thread launcher.
- **History** — union across `application_activity`, `vendor_timeline_events`, `payments`, past events (previous booth locations per vendor via `event_object_id` chain).
- **Venue Intelligence** (renamed from AI) — Layer 1 only this phase: median price of same-category booths this event, overlap detection, category-clustering warnings, unpriced/underpriced flags.

All reads via `createServerFn` + `requireSupabaseAuth`. Mutations invalidate the exact query keys the panels subscribe to.

## Phase 5 — Multi-select Batch Edit

Goal: Context Panel morphs into Batch Edit when ≥2 selected.

- Batch header with count + kinds.
- Actions: Assign Electric/Water, Change Pricing, Toggle Premium, Change Category, Mark Sponsor, Duplicate, Delete, Align, Distribute, Move (nudge), Lock/Unlock.
- Marquee-select 15 booths → one click applies to all.
- Each batch action is one server call; each registered via `commandRegistry` so shortcuts get them for free.

## Phase 6 — Vendor drag-and-drop assignment

Goal: assign vendors visually.

- Collapsible left dock: Vendor list from `organization_vendors`, filter/search, styled to match Object Explorer.
- HTML5 drag → drop on booth in event mode → `assignVendorToBooth(eventBoothId, vendorProfileId)`.
- Animation on drop: vendor card shrinks → flies to booth centroid → booth color transitions to Reserved/Paid → Context Panel updates. Optimistic + invalidate.
- Also a keyboard-friendly "Assign vendor…" combobox in the booth Vendor tab.

## Phase 7 — Metadata-driven object types

Goal: adding a new object kind means "register a schema" — no `if (kind === …)` anywhere.

- Author schemas: Road (surface, width, emergency access, utilities), Parking (capacity, audience: vendor/customer/ADA, overflow), Building (capacity, utilities, notes), Tree (species, protected), Fence (material, height), Stage (power, lighting, schedule, sponsor), Sign, Custom.
- Metadata stored under `el.meta: Record<string, unknown>` validated against the schema on write.
- Inspector renders any registered kind automatically. Hover cards, badges, and intelligence rules follow suit.

## Phase 8 — Event Dashboard (empty-selection state)

Goal: when nothing is selected, the right side is the Event Dashboard — not an empty inspector.

- Server fn `getEventVenueSummary(eventId)`: totals (available/reserved/paid), pending applications, pending payments, revenue, upcoming tasks, recent activity (last 20 across applications/payments/check-ins).
- Layer 1 suggestions surface here: "5 booths still unpriced", "2 vendors overdue on payment", "Corner booth #12 available and premium-eligible".
- Quick actions: Snapshot venue · Open applications · Open payments · Add sponsor.

## Phase 9 — Realtime + polish

Goal: the workspace is truly live.

- Enable `supabase_realtime` on `event_booths`, `applications`, `payments`, and the check-in table.
- One channel per open event, torn down on unmount. Incoming rows patch the joined map → status/badges/panel update with color-transition animation.
- Polish pass: selection ring transition, panel tab crossfade, badge pop-in on state change, hover card fade timing, vendor-drop animation.

## Phase 10 — Workspace Intelligence (Layer 2, contextual AI)

Goal: AI only where it beats rules.

- Two-layer architecture, formalized:
  - **Layer 1 (deterministic)** runs on every selection/state change. Sources: DB joins, geometry, business rules. Instant. Rendered as bullet insights + warnings in the Venue Intelligence tab and Dashboard. Owns: pricing suggestions from history, overlap/adjacency conflicts, capacity vs expected usage, emergency-lane checks, category clustering, unpaid/expired-doc flags, ADA/parking rollups.
  - **Layer 2 (Lovable AI Gateway, `openai/gpt-5.5`)** invoked only on explicit user intent ("Explain this suggestion", "Optimize this row", "Draft vendor outreach", "Forecast demand for stage location"). Server-side via `createServerFn` in `src/lib/workspace-intelligence.functions.ts`; provider setup in `src/lib/ai-gateway.server.ts`. Never used for the always-on strip.
- Contextual outputs per kind:
  - **Booth** — sold 3 years running · avg revenue · suggested price · similar vendors nearby · electric available · demand level.
  - **Road** — emergency-lane clearance · recommended width · traffic estimate.
  - **Parking** — capacity · expected usage · ADA count · overflow suggestion.
  - **Stage** — power draw vs supply · lighting coverage · sponsor pairing hint.
- All Layer-2 responses are cached per `(eventId, objectId, promptId)` so opening the same booth twice doesn't re-bill.

---

## Technical notes

- **Files touched most:** `types.ts`, `factory.ts`, `store.ts`, `canvas.tsx`, `inspector.tsx` (becomes Context Panel host), `designer.tsx`, plus new `workspace/` registries, `schemas/*`, `intelligence/` (rules + gateway), `venue-designer.functions.ts`, new `event-workspace.functions.ts`.
- **No breaking changes** to the venue-mode workspace at any phase.
- **RLS**: all new server fns use `requireSupabaseAuth` + existing `is_org_member` / `has_permission`. No public API routes.
- **Realtime cost**: single channel per open event, filtered by `event_id`.
- **AI cost**: Layer 2 is user-triggered and cached; no ambient polling.
- **Rename to "Venue/Event Workspace"** happens in Phase 2 (UI copy only). File paths and DB names stay to keep the diff small.

## What we build first if you approve

Phases 0 + 1 + 2 in one implementation pass:
1. Workspace registries (panels, toolbar, dock, hover, commands) + selection & mode providers.
2. `objectId` UUIDs everywhere; migration for `event_booths.event_object_id`; idempotent snapshot fn.
3. Convert Inspector into schema-driven Context Panel with Properties tab wired, placeholder tabs, Dashboard empty state.

Everything after that ships as independent, reviewable phases.
