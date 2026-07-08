## Rebrand + Event Library — Phase 2 architecture pass

Consolidates two directives:
1. Rename **EventScape Studio** internally to **Studio**; treat EventScape as the umbrella platform with four sibling apps.
2. Introduce **Event Library** as a permanent Organization-level object that holds active events, drafts, archived events, and reusable templates.

No route path renames, no auth/RLS surgery, no design-system rework — the Studio/Portal/Admin split, tables, and design tokens stay as-is.

---

## Part A · Brand hierarchy

**Model**

```text
EventScape (platform)
├── Public Website        → all top-level routes
├── EventScape Studio     → /studio/*
├── EventScape Vendor Portal → /portal/*
└── EventScape Admin Console → /admin/*
```

**Changes**

1. `src/components/shared/brand.tsx` — the wordmark always renders "EventScape". Add an optional `app` prop (`"studio" | "portal" | "admin"`) that drives the small sub-label under the mark:
   - `undefined` → no sub-label (or "The Event Platform" when `showTagline`)
   - `"studio"` → "Studio"
   - `"portal"` → "Vendor Portal"
   - `"admin"` → "Admin Console"

2. Wire the label per shell:
   - `studio.tsx` → `<Brand app="studio" />`
   - `portal.tsx` → `<Brand app="portal" />`
   - `admin.tsx` → `<Brand app="admin" />`
   - Public routes + `auth.tsx` → plain `<Brand />`

3. Copy sweep across `__root.tsx`, `index.tsx`, `features.tsx`, `pricing.tsx`, `about.tsx`, `contact.tsx`, `auth.tsx`, `studio.tsx`, `admin.index.tsx`:
   - Platform-level references: "EventScape Studio" → "EventScape".
   - App-specific references keep the full name ("EventScape Studio", "EventScape Vendor Portal", "EventScape Admin Console").
   - Meta titles: root default becomes "EventScape — The Event Platform"; leaves become "<Page> · EventScape"; auth becomes "Sign in · EventScape"; admin index heading becomes "Admin Console".

4. Guarantee separation:
   - Vendor Portal navigation must not reference Studio. Sidebar labels in `portal.tsx` are audited; anything named after an organizer surface is removed or reworded to vendor language.
   - Admin sidebar reads "Admin Console" in the header.

---

## Part B · Event Library (Organization-level object)

**Mental model per organization**

```text
Organization
├── Venue Directory     (existing /studio/venues)
├── Vendor Directory    (existing /studio/vendors)
├── Event Library       (renamed /studio/events)
├── Staff               (existing /studio/staff)
└── Settings            (existing /studio/settings)
```

The existing `events` table already has a `status` enum with `draft / published / in_progress / completed / cancelled / archived`. Event Library reuses this + one new flag for templates.

**Schema migration** (`supabase/migrations/<new>.sql`)

- `ALTER TABLE public.events ADD COLUMN is_template boolean NOT NULL DEFAULT false`.
- `ALTER TABLE public.events ADD COLUMN template_source_id uuid REFERENCES public.events(id) ON DELETE SET NULL` — tracks which template/prior event a row was cloned from (nullable, informational).
- Partial index: `CREATE INDEX events_org_status_idx ON public.events (organization_id, status) WHERE is_template = false;` and `events_org_templates_idx ON public.events (organization_id) WHERE is_template = true;`
- No new tables, no RLS changes (`events` policies are already org-scoped).

**Server function** (`src/lib/events.functions.ts`, new) — `cloneEvent`:

- `.middleware([requireSupabaseAuth])`, `inputValidator` = `{ sourceEventId: uuid, newName: string, newStartDate?: string, asTemplate?: boolean }`.
- Verifies the caller has `events:write` on the source event's org (`has_permission`).
- Copies the `events` row (new id, new name/date, `status='draft'`, `template_source_id = sourceEventId`, `is_template = asTemplate ?? false`).
- Copies related child rows the organizer would expect: `event_booths` (with new event_id, blank vendor assignments), event-scoped `documents`, `announcements` templates if any. Applications, payments, and messages are **not** copied.
- Returns the new event id.

**Studio → Event Library UI** (`studio.events.tsx`)

- Rename page header to "Event Library" (subtitle: "All events, drafts, archives, and templates for {organization}").
- Tabs (using existing shadcn Tabs):
  - **Active** — `status IN ('published','in_progress')` AND `is_template = false`
  - **Drafts** — `status = 'draft'` AND `is_template = false`
  - **Archived** — `status IN ('completed','cancelled','archived')` AND `is_template = false`
  - **Templates** — `is_template = true`
- Each row: name, date range, venue, status badge, and a row action menu with: **Open**, **Clone**, **Save as Template**, **Archive**, **Restore**.
- Primary actions: "New Event", "New from Template".

**Auth-context / navigation**

- Studio sidebar item "Events" renamed to "Event Library". Icon unchanged.
- Route path stays `/studio/events` — no file rename.

---

## Part C · Non-goals for this pass

- No changes to Portal / Admin data models or nav beyond Part A copy.
- No cloning of applications, payments, or messages (deliberate).
- No new recurring-event scheduler (recurring events are supported later via "New from Template" + manual date entry; a scheduler can be added without schema changes to this pass).
- No design-token or logo redesign.

---

## Files touched

- `src/components/shared/brand.tsx` — add `app` prop
- `src/routes/__root.tsx`, `index.tsx`, `features.tsx`, `pricing.tsx`, `about.tsx`, `contact.tsx`, `auth.tsx` — copy + head
- `src/routes/_authenticated/studio.tsx`, `portal.tsx`, `admin.tsx` — Brand `app` prop, audit sidebar labels
- `src/routes/_authenticated/admin.index.tsx` — "Admin Console" heading
- `src/routes/_authenticated/studio.events.tsx` — Event Library UI (tabs, row actions, clone dialog)
- `supabase/migrations/<new>.sql` — `is_template`, `template_source_id`, partial indexes
- `src/lib/events.functions.ts` — new `cloneEvent` server function
