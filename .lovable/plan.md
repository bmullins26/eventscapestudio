
# AI Venue Layout Import, Conversion & Intelligence

Turn any uploaded map (PDF, image, sketch) into a **structured, editable, queryable** venue dataset — not a drawing. The Booth Layout Builder becomes a lightweight CAD-style editor with:

1. Real PDF/image reference layers with transform controls
2. A vector object model with manual tracing tools
3. AI vision import with reviewable detections
4. Reusable venue-layout templates
5. Smart-object metadata + spatial relationships + AI Assist

Ships in 5 phases; each phase is independently usable.

---

## Phase 1 — Real reference layers (PDF rendering + transform controls)

Fixes the current bug where PDFs render as the generic file icon and makes reference layers first-class.

- Add `pdfjs-dist`; wire the worker via `?url` for Vite.
- Rewrite `uploadReference` in `studio.booths.tsx`:
  - **Images** (`png/jpg/jpeg/webp`) — upload as-is.
  - **PDFs** — load in the browser; if `numPages > 1`, open a **Page Picker dialog** with thumbnails so the organizer picks the page. Render at ~2× DPR to PNG. Upload BOTH the rendered PNG (`image_url`, what the canvas shows and what AI consumes) and the original PDF (`source_file_url`, preserved forever).
- Extend `venue_map_references`:
  - `source_file_url`, `source_mime_type`, `source_page`
  - `natural_width`, `natural_height` (fixes today's hardcoded 800×600 sizing)
  - `crop_x, crop_y, crop_w, crop_h` (nullable)
- Reference-layer side panel: Scale, Rotation, Opacity, X/Y offset, Crop, Lock, Show/Hide, Reorder, Delete, Download original. Multiple layers per template supported.

Deliverable: any supported file becomes a usable reference layer. No AI yet.

---

## Phase 2 — Vector object model + manual tracing tools

Introduces the CAD-style editable object system that AI results and manual tracing both write into.

New table `layout_template_objects`:

```
id UUID PK
layout_template_id UUID FK
kind TEXT            -- building | road | parking | walkway | fence | tree
                     -- restroom | entrance | exit | pavilion | stage
                     -- utility | food_area | text | polygon | rectangle
                     -- line | circle
label TEXT
geometry JSONB       -- {x,y,w,h,rotation} | {points:[[x,y],...]} | {cx,cy,r} | {x1,y1,x2,y2}
style JSONB          -- {fill, stroke, strokeWidth, dash, textStyle}
metadata JSONB       -- kind-specific fields (see Phase 5)
layer_index INT
locked BOOLEAN
visible BOOLEAN
z_order INT
source TEXT          -- 'manual' | 'ai'
ai_confidence TEXT   -- 'high' | 'medium' | 'low' | null
ai_status TEXT       -- 'pending' | 'accepted' | 'edited' | 'rejected' | null
created_at, updated_at
```

Booths keep `layout_template_booths` (they already carry event/pricing fields). Add `source`, `ai_confidence`, `ai_status`, and `metadata JSONB` there.

Toolbar tools: Select, Rectangle, Polygon, Line, Circle, Text, Booth. Every object supports move, resize, rotate, rename, delete, duplicate, lock, hide, layer/z-order, color. Right-side inspector edits properties for the selected object.

Canvas layers (bottom→top): Grid → Reference layers → Non-booth objects → Booths → AI review overlays.

Deliverable: full manual tracing workflow works standalone.

---

## Phase 3 — AI Vision analysis + review

Server function `analyzeVenueMap` (`src/lib/venue-map-ai.functions.ts`):

- Input: `{ referenceId }`; loads the rendered PNG via signed URL.
- Middleware: `requireSupabaseAuth` + org-membership check via `layout_template_org_id`.
- Model: `google/gemini-2.5-pro` through the Lovable AI Gateway, using `generateText` + `Output.object` with a Zod schema:

```
detections: [{
  kind, label, confidence,
  geometry: { shape: "rect|polygon|line|circle|text", coords: number[] (normalized 0-1) },
  booth: { code, category, size_label, price, is_electric, is_premium, is_reserved } | null,
  metadata: object | null    // proposed smart-object fields (see Phase 5)
}],
image_size: { width, height },
notes
```

- Prompt asks the model to identify buildings, roads, parking, walkways, fences, trees, restrooms, entrances, exits, pavilions, stages, utilities/electrical panels, permanent structures, existing booths (numbers/sizes/orientation), text labels — and to fill any obvious metadata fields (e.g. "Parking → customer/vendor", "Restroom → ADA").
- Normalized coords → canvas coords using reference's `natural_width/height` + current transform.
- Rows written with `source='ai'`, `ai_status='pending'`, and reported `ai_confidence`.

Review UI:

- "Import with AI" button on the reference.
- AI Review mode overlays pending detections color-coded by confidence (green/amber/red) and opens a Review panel grouped by kind.
- Per detection: Accept / Edit / Delete; multi-select for Merge/Split; "Add missing object" jumps to the right tracing tool.
- Bulk: Accept all high-confidence, Reject all low-confidence.
- Nothing enters the final layout without an explicit Accept.

Deliverable: upload → render → analyze → review → accept → editable layout.

---

## Phase 4 — Reusable templates + polish

- Original uploaded file stays attached forever via `venue_map_references.source_file_url`.
- Layouts already ARE templates (venue-scoped). Ensure event creation snapshots both `layout_template_booths` (already happens via `event_booths`) and any objects events need. Decision at start of phase: do events override non-booth objects (e.g. move a food-area label for one event)? If no, skip `event_layout_objects`. If yes, mirror the snapshot pattern.
- Expand history stack to cover object CRUD + reference-layer changes (not just booth moves).
- Export final layout to PNG (canvas → toBlob) for print / share.

---

## Phase 5 — Venue Intelligence (smart objects + relationships + AI Assist)

Turns the layout from a drawing into a queryable dataset.

### 5a. Smart-object metadata

Every object kind gets a typed metadata schema (stored in the `metadata JSONB` column added in Phase 2 / booths). Zod schemas in `src/lib/venue-schema.ts` drive both the Inspector UI and AI validation:

- **Building** — name, capacity, indoor/outdoor, has_electricity, notes
- **Road** — width, one_way, emergency_access
- **Parking** — vendor / customer / handicap flags, capacity
- **Walkway** — width, ada_route (bool)
- **Restroom** — ada, family, portable
- **Entrance / Exit** — main, emergency, service, ada
- **Pavilion / Stage** — name, capacity, has_electricity, has_water
- **Utility** — utility_type (electrical | water | sewer | gas), voltage, capacity_amps
- **Tree / Fence / Text** — minimal (label, notes)
- **Booth** (already partly modeled; extend `metadata` with) — category, electric, water, premium, sponsor, corner, adjacency_notes

Inspector renders the correct field set based on `kind`. Unknown/legacy fields preserved passthrough.

### 5b. Relationships

New table `layout_template_relationships`:

```
id UUID PK
layout_template_id UUID FK
from_kind TEXT, from_id UUID     -- refs either layout_template_objects or layout_template_booths
to_kind TEXT,   to_id UUID
relationship TEXT                -- 'connects_to' | 'serves' | 'powers' | 'ada_route_to'
                                 -- 'loading_zone_for' | 'adjacent_to'
distance_m NUMERIC | null        -- optional computed distance
metadata JSONB
source TEXT                      -- 'manual' | 'ai' | 'inferred'
created_at
```

- Because rows can point at two tables, use `from_kind`/`to_kind` columns instead of FKs; enforce integrity with a trigger. Cascade-delete via that trigger too.
- Two ways to create relationships:
  1. **Manual** — right-click an object → Connect → click target.
  2. **Auto-infer** — a "Compute connections" action runs a client-side pass over object geometry using simple heuristics (bounding-box adjacency, walkway endpoints touching entrances, utilities within N meters of electric booths). Writes rows with `source='inferred'`.
- Relationship panel: filter by type; overlay dashed lines between related objects on the canvas.

### 5c. Scale calibration

AI Assist and distance-based inference need real-world units. Add to `layout_templates`:

- `scale_pixels_per_meter NUMERIC | null`
- `scale_origin_x, scale_origin_y NUMERIC | null`
- `north_rotation NUMERIC DEFAULT 0`

New builder tool: **Calibrate scale** — click two points on a reference layer and enter their real-world distance. Persists on the template. Without calibration, distance queries degrade gracefully to pixel-space.

### 5d. AI Assist (query interface)

Server function `askVenue({ templateId, question })`:

- Auth via `requireSupabaseAuth` + org check.
- Loads the template's objects, booths, and relationships from the DB and passes a structured summary (kind, id, metadata, bbox center, area) — NOT pixels — to `openai/gpt-5-mini` via the AI Gateway.
- The model returns a structured response schema (`generateText` + `Output.object`):
  ```
  answer: string
  highlight_ids: string[]        -- objects to highlight in the canvas
  suggested_actions: [{ kind: 'move'|'add'|'flag', target_id, params }]
  ```
- Chat panel in the builder: canned examples ("Show all electrical booths", "Find booths too close together", "Where are ADA routes?", "Suggest locations for 15 more booths", "Check emergency access"). Free-form question box.
- Highlights render as a dashed selection over matching objects; "Apply" runs the suggested action (safe ones only — move/flag; adds go through the normal review flow).
- No pixel input to the model; keeps cost low and reasoning grounded in the structured dataset.

### 5e. Migration + backfill

- Add `metadata JSONB DEFAULT '{}'` to `layout_template_objects` and `layout_template_booths` (booth-side maps existing boolean columns into it lazily; existing columns remain for compat).
- Create `layout_template_relationships` with GRANTs + RLS via `layout_template_org_id`.

---

## Files touched (across phases)

- `src/routes/_authenticated/studio.booths.tsx` — toolbar, tools, canvas layers, panels.
- New `src/components/booth-builder/*` — Toolbar, Inspector (metadata forms per kind), ReferenceLayerPanel, AIReviewPanel, RelationshipsPanel, AssistPanel, PagePickerDialog, CalibrateTool.
- New `src/lib/venue-map-ai.functions.ts` — `analyzeVenueMap`, `askVenue`.
- New `src/lib/ai-gateway.server.ts` — shared Gateway helper (per knowledge).
- New `src/lib/pdf-render.ts` — pdf.js render helper.
- New `src/lib/venue-schema.ts` — Zod schemas for object metadata + relationship kinds.
- Migrations: extend `venue_map_references`; create `layout_template_objects`; add `source`/`ai_*`/`metadata` to `layout_template_booths`; create `layout_template_relationships` + integrity trigger; scale-calibration columns on `layout_templates`.
- `package.json` — add `pdfjs-dist`.

## Non-goals

- No DWG/DXF import.
- No on-device / offline vision.
- No 3D or elevation data.
- No changes to Applications, Vendors, or the portal.
- AI Assist can highlight and propose, but destructive edits still require organizer confirmation.
