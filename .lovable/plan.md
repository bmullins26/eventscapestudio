
# Venue Designer — Rewrite Plan

This replaces the existing Booth Builder with a new **Venue Designer** module. The Venue Designer becomes EventScape's foundational primitive: a structured Venue Model drives design, templates, event snapshots, applications, interactive reservations, live event management, and reporting.

Because the scope is very large, this plan delivers it in **six phased milestones**. Each phase is shippable on its own; we stop and confirm before starting the next.

---

## Guiding Architecture

```text
Venue (master, editable)
  └── VenueTemplate v1, v2, v3 ...   (versioned snapshots of the Venue Model)
        └── Event (frozen snapshot copied from a chosen VenueTemplate version)
              ├── EventObjects  (booths + all other objects, per-event state)
              ├── Applications  (per event; link to org-wide VendorProfile)
              └── Reservations  (vendor → booth, timers, payments, check-in)
```

- **Venue Model = source of truth.** Every visible thing (booth, road, tree, stage, sign) is a typed object with metadata. SVG is just the render layer.
- Editing a Venue never mutates existing Events. Events hold their own copy.
- One map surface is reused across: design → publish → apply → reserve → check-in → report.

## Phased Delivery

### Phase 1 — Foundation (data model + empty designer shell)
- New DB tables (structured, replacing per-booth-only tables for new work; old booth tables stay until Phase 6 migration):
  - `venues` (already exists — extended with `canvas_width`, `canvas_height`, `units`, `default_view`)
  - `venue_objects` — polymorphic object rows: `id`, `venue_id`, `layer_id`, `type` (enum: booth, building, road, walkway, parking, utility, tree, fence, stage, pavilion, food_court, beer_garden, restroom, table, bench, trash, sign, sponsor_banner, registration, info, ticket, first_aid, atm, kids_area, custom), `shape` (rect/polygon/line/circle/text), `geometry` jsonb (points/x/y/w/h/rotation), `style` jsonb, `metadata` jsonb, `locked`, `hidden`, `z_index`, `group_id`
  - `venue_layers` — `id`, `venue_id`, `name`, `kind` (reference/buildings/roads/utilities/booths/labels/custom), `visible`, `locked`, `opacity`, `order`
  - `venue_references` — imported PDFs/images/drone/Google Maps snapshots (`file_url`, `page`, `transform`, `opacity`)
  - `venue_templates` — versioned snapshots of a Venue: `id`, `venue_id`, `version`, `label`, `model` jsonb (denormalized objects+layers+references at publish time), `published_at`, `created_by`
  - `org_object_library` — reusable custom objects/assets per organization
  - RLS: org-member read/write via existing `is_org_member`/`has_permission('venues.manage')`; anon read only for published event maps in Phase 4.
- New route: `/studio/venues/$venueId/designer` (replaces `/studio/booths` for authoring; old route kept as read-only redirect until Phase 6).
- Shell UI only in this phase: top toolbar, left sidebar (Objects / Layers / Templates / Search tabs — empty state), canvas center (SVG + pan/zoom via existing `use-canvas-input`), right inspector, bottom status bar.

### Phase 2 — Objects, Layers, Editing
- Object Library sidebar with all categories from the brief; drag/tap-to-place onto canvas.
- Per-object ops: move, resize, rotate, duplicate, delete, rename, lock, hide, bring-forward/send-back, group/ungroup, snap, layer assignment, metadata editing in right inspector.
- Manual tracing tools: rectangle, polygon, line, circle, text, booth (each writes a `venue_objects` row with the right `type` + `shape`).
- Layers panel: reorder, visibility, lock, opacity.
- Smart-object metadata schemas per type (booth: size/price/category/electric/water/premium/corner; building: capacity/indoor/electric; road: width/emergency; parking: kind/capacity; tree: species/protected; sponsor: assigned vendor).
- Bottom status bar wired: zoom %, cursor coords, grid toggle, snap toggle, selection count.
- Touch/stylus: builds on existing `use-canvas-input` (pinch zoom, two-finger pan, palm rejection). Long-press = context menu on tablet/phone. Phone gets a stripped "quick edit" mode; tablet gets full editor.

### Phase 3 — Reference Import + AI Import
- Reference import: PDF (pdf.js render, page picker already exists), PNG/JPG/WEBP, drone photos, map screenshots. Reference stored as `venue_references` row with adjustable transform + opacity, sits on its own layer.
- AI Import server function (`createServerFn`, Lovable AI Gateway, Gemini 2.5 Pro vision):
  - Input: uploaded image/PDF page.
  - Prompt asks the model to return a structured JSON Venue Model: detected buildings, roads, parking, walkways, trees, utilities, booths, labels, dimensions with approximate normalized coordinates.
  - Server converts the JSON into `venue_objects` rows on a new "AI Import" layer for the organizer to accept/edit.
  - Organizer can then manually trace anything the model missed.

### Phase 4 — Venue Templates + Event Snapshots
- Templates tab in left sidebar: "Publish current design as template v(N)". Stored in `venue_templates.model` as a frozen jsonb snapshot.
- Version history: view / restore / duplicate / diff (visual overlay).
- Event creation wired to the new flow:
  1. Create Event → pick Venue → pick Template version → server copies the template's `model` into event-scoped tables (`event_venue_objects`, `event_venue_layers`) so subsequent edits to the Venue never touch the Event.
  2. Old `event_booths` continues to be populated for backwards compatibility during this phase; Phase 6 migrates it out.
- Vendor Profiles remain org-wide (already implemented). Applications continue to be per-Event and link `vendor_profile_id`.

### Phase 5 — Interactive Booth Reservation + Live Event Map
- Public reservation experience at `/apply/$eventSlug/reserve` (approved vendors only, gated by application status):
  - Concert-ticket-style map with booth states: available / reserved / pending payment / assigned / sponsor / unavailable.
  - Zoom, pan, search, filter (size / electric / water / premium / ADA / price range).
  - Booth detail panel: number, price, dimensions, amenities. Occupied booths show business name + category + optional logo only — never private contact info. Visibility per field is org-controlled.
  - Reserve action creates a `booth_reservation` row with a countdown timer (configurable); expiring reservations auto-release.
  - Smart reservations: warn on nearby same-category vendor, suggest alternatives, enforce organizer rules (recommendation / warning / restriction).
  - Priority windows (sponsors first, returning vendors next, general last) via reservation `opens_at` per role.
- Live Event Map for organizer at `/studio/events/$id/map`:
  - Same canvas. Clicking a booth opens: vendor, application, payment status, check-in, notes, messages, products, power requirements, status.
  - Check-in toggle updates status live.

### Phase 6 — Migration + Cleanup
- Migrate existing `layout_templates` / `layout_template_booths` / `event_booths` into `venues` + `venue_objects` + `venue_templates` + event-scoped object tables. One-time server function; organizer confirms per venue.
- Remove old Booth Builder routes and components; redirect `/studio/booths` to venue list.
- Add "AI Assist" server functions (natural-language queries against the Venue Model: "show electrical booths", "find empty space", "suggest sponsor locations", "check ADA routes", "check emergency access"). These operate on structured `venue_objects`, not SVG.

---

## Technical Section (for engineers)

- **Data**: Postgres jsonb geometry + metadata gives us a single polymorphic `venue_objects` table without an explosion of type-specific tables. Indexed on `(venue_id, layer_id, type)`. RLS via `is_org_member(auth.uid(), (SELECT organization_id FROM venues WHERE id = venue_id))`. Anon read only through a `TO anon` policy scoped to published event snapshots.
- **Rendering**: SVG with a virtualized viewport (`getBBox` culling) so large venues stay smooth. Reuse `useCanvasInput` for pointer/pinch/pan and `useLongPress` for touch context menus.
- **Server functions**: all mutations via `createServerFn` + `requireSupabaseAuth` (never client-direct writes for cross-table transactions like publish-template or create-event-from-template).
- **AI**: single `analyzeVenueDrawing` server fn calling `google/gemini-2.5-pro` on the Lovable AI Gateway, returning strict JSON validated with Zod, then inserted as `venue_objects` on an "AI Import" layer.
- **Compatibility**: Phases 1–5 add new tables alongside existing ones. Phase 6 does the destructive migration and removes the old builder. This lets us ship value incrementally without breaking the current app.
- **Routes**:
  - `/studio/venues` (list — extended)
  - `/studio/venues/$venueId/designer` (new — the Venue Designer)
  - `/studio/venues/$venueId/templates` (versions)
  - `/studio/events/$id/map` (live event map — Phase 5)
  - `/apply/$eventSlug/reserve` (public reservation — Phase 5)

---

## What I Need from You Before Starting

1. **Start with Phase 1?** (foundation + empty designer shell + DB migration). This is a ~1-message build and unblocks everything else.
2. **Keep old Booth Builder live during Phases 1–5**, then migrate + remove in Phase 6 — confirm this is acceptable (versus a hard cutover on day one).
3. **Units**: feet or meters as the default for the Venue Model? (Affects inspector display; storage is unit-agnostic floats.)

Reply "go" and I'll begin Phase 1.
