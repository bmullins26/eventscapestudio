# Make Events Editable

Currently the Event Library lists events but the "Open" action just re-navigates to the same page — there is no way to edit an event after creation. This plan adds a full edit experience without introducing new routes or redesigning the page.

## What you'll be able to do

- Click an event row (or the "Edit" action in its menu) to open an **Edit Event** side sheet
- Change core fields: name, description, dates (starts/ends), status (draft / published / in_progress / completed / cancelled / archived), venue, and public application toggle + slug
- Save changes with immediate feedback; the list refreshes
- Delete an event (with confirmation) when it has no applications/payments; otherwise it's archived instead
- Continue using existing Clone / Save as template / Archive / Restore actions unchanged

## Where the changes go

**`src/routes/_authenticated/studio.events.tsx`** (only file touched on the UI side)
- Replace the current `onOpen` no-op navigation with opening an `EditEventSheet`
- Add a top-level "Edit" item to the row dropdown so it's discoverable
- New `EditEventSheet` component (in-file) using shadcn `Sheet` + form fields already used elsewhere (Input, Textarea, Select, Switch, date inputs)
- On save → call new server fn `updateEvent`; on delete → call new server fn `deleteEvent`
- Invalidate `["studio-events", orgId]` after mutations

**`src/lib/studio.functions.ts`** — add two server functions:
- `updateEvent({ eventId, patch })` — `requireSupabaseAuth`, validates the caller belongs to the event's organization, updates whitelisted columns (`name`, `description`, `status`, `starts_at`, `ends_at`, `venue_id`, `public_applications_enabled`, `public_slug`), writes an `application_activity`-style note is **not** needed (events don't have that log); simply returns the updated row
- `deleteEvent({ eventId })` — same auth check; if the event has any `applications`, `payments`, or `event_booths` with assignments, refuse and suggest archive; otherwise cascade-delete `event_booths` then the event

Both use the org-scoped RLS-aware client from `requireSupabaseAuth`.

## Non-goals

- No new routes, no dedicated `/studio/events/$id` page — keep the flat library + side sheet pattern already used elsewhere in Studio
- No changes to booth layout editing (that already lives under Booths / Venues)
- No changes to clone / template / archive flows
- No schema migration — all fields already exist on `events`

## Technical notes

- The Sheet uses the same visual pattern as the Application Workspace side sheet so it feels consistent
- Venue select is populated from the existing `events-venues-select` query (already cached)
- Date inputs use native `type="date"` matching the New Event dialog
- Public slug field only shows when `public_applications_enabled` is on; validated as lowercase-kebab client-side
- Row click opens edit; the dropdown "Open" item is renamed to "Edit" to match
