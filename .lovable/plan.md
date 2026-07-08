
# Sprint 2 — Make Studio Fully Functional

Goal: replace stubs on existing Studio pages with real CRUD backed by the database. No redesign, no new top-level routes beyond the single public application page. Vendor accounts are optional throughout — Applications are the center of the workflow and never depend on them.

## Already done (verified)

- Schema: `organizations`, `venues`, `layout_templates`, `layout_template_booths`, `events`, `event_booths`, `venue_documents`, `documents`, `sponsors`, `organization_vendors`, `applications`, `payments`, RLS + permission helpers.
- Event Library UI (list, tabs, clone, archive/template) — keep.
- Studio dashboard reads some real data — extend.
- Venues, Booths pages are `SectionStub` — replace.

## Schema migration

1. `venues.archived_at timestamptz` — archive/restore.
2. New table `venue_maps` — reusable site maps per venue: `venue_id`, `name`, `description`, `image_url`, `sort_order`, timestamps.
3. New table `venue_map_references` — imported drawings used as reference layer under a layout template: `layout_template_id`, `image_url`, `original_filename`, `scale`, `rotation`, `opacity`, `offset_x`, `offset_y`, `locked`, `visible`, `sort_order`.
4. New table `user_org_prefs` (`user_id`, `organization_id`, `active_event_id`) — per-user Active Event.
5. `organization_vendors.account_status` enum `no_account | invited | registered | disabled` (default `no_account`).
6. `applications.entry_method` enum `manual | ai_scan | public_form | vendor_portal | imported` (default `manual`).
7. Extend `applications.status` to full lifecycle: `draft | pending | approved | waitlisted | rejected | awaiting_payment | booth_assigned | checked_in | completed | archived`. Migrate existing rows.
8. `applications.ai_extraction jsonb` — raw AI extraction from scans.
9. `applications.internal_notes text` — organizer-only notes (separate from applicant-facing notes).
10. New table `application_activity` — activity log: `application_id`, `actor_user_id`, `event_type` (status_change / booth_assigned / note / message / payment / invite / edit), `from_value`, `to_value`, `payload jsonb`, `created_at`. Written by triggers on `applications` status changes and by server functions for other actions.
11. New table `vendor_invitations` (if not present): `organization_vendor_id`, `email`, `code`, `token`, `expires_at`, `accepted_at`, `revoked_at`. Grants + RLS.
12. Storage buckets (private, RLS by org): `venue-assets`, `application-uploads`.

All new tables ship with GRANTs + RLS scoped through `is_org_member` / template → venue → org.

## Server functions (all `requireSupabaseAuth` unless noted)

- **Venues**: `list/get/create/update/archive/restore/deleteVenue`, `list/create/update/delete/reorderVenueMaps`, `list/add/deleteVenueDocument`.
- **Layout Templates**: `list/get/create/update/delete/cloneLayoutTemplate`, `saveTemplateBooths(templateId, booths[])` (bulk upsert+delete), `list/upload/update/deleteVenueMapReference`.
- **Events**: `createEventFromTemplate` (copies template booths → event booths), `archive/restore/deleteEvent`, `setActiveEvent`, plus existing `cloneEvent`.
- **Vendors (directory)**: `list/get/create/update/deleteOrganizationVendor`, `matchVendor({ email, phone, businessName })` returns fuzzy matches from org directory, `inviteVendor(vendorId, method)` (email/link/code) → flips `account_status` → `invited`, `revokeInvitation`, `disableVendor`, `enableVendor`. Acceptance flow in Portal links `vendor_profiles.id` and sets `registered`. Account status changes never touch applications.
- **Applications** (all entry methods produce identical rows differing only by `entry_method`):
  - `createManualApplication({ eventId, vendorFields, linkVendorId? })`.
  - `createApplicationFromScan({ eventId, uploadPath })` — Lovable AI (`google/gemini-2.5-pro`) parses the file to a Zod-validated draft; returns extraction + suggested vendor matches; does not insert.
  - `saveApplicationFromScanReview({ eventId, fields, linkVendorId?, ai_extraction })` — inserts with `entry_method="ai_scan"`.
  - `updateApplication`, `duplicateApplication`, `archiveApplication`, `deleteApplication`.
  - Status transitions: `approveApplication`, `rejectApplication`, `waitlistApplication`, `requestMoreInfo`, `markAwaitingPayment`, `markPaid`, `checkInApplication`, `completeApplication`. Each writes to `application_activity`.
  - `assignBooth({ applicationId, boothId })` / `unassignBooth` — atomically updates `event_booths.status` + `assigned_application_id`, flips application status to `booth_assigned` if approved, logs activity. Approval never forces assignment.
  - `linkApplicationToVendor(applicationId, vendorId)` / `createVendorFromApplication(applicationId)`.
  - `sendPortalInvitationFromApplication(applicationId)` — pulls vendor row (creating a directory record if none), calls `inviteVendor`.
  - `getApplicationWorkspace(applicationId)` — returns application + linked vendor + vendor's prior applications, booth history, and payments across the org, plus activity log. Powers the review screen with no navigation away.
- **Public application submission**: server route `src/routes/api/public/applications.ts` — validates event is public + open, inserts with `entry_method="public_form"`, status `pending`.
- **Dashboard / Inbox**: `getStudioDashboard(orgId, activeEventId)` returns all card counts, recent events, activity, plus **Organizer Inbox** counts: pending review, approved-needs-booth, waitlisted, awaiting payment, missing-info requests, checked-in, completed, unread messages, booth conflicts (booths with `assigned_application_id` not matching a live approved application), vendors awaiting invitation.

## Public route

- `src/routes/apply.$eventSlug.tsx` — public form. Reads event via server-publishable client with narrow `TO anon` policy on `events` where `applications_open AND is_public`. Posts to the public server route above. Only new user-facing route.

## Pages to replace (existing files only)

- **`studio.venues.tsx`** — table with search / sort / filter / pagination / empty / loading. Row → in-page tabs: Info, Maps, Layout Templates, Documents, Photos, Notes, Utilities, Parking. Archive/Restore/Delete.
- **`studio.booths.tsx`** — **Booth Layout Builder** (SVG canvas, no new deps). Layers, bottom→top:
  1. Grid
  2. Imported venue map reference (scale/rotate/opacity/lock/show-hide via per-layer controls)
  3. Roads / walkways / utilities annotations
  4. Editable booth layout
  5. Event booth assignments (only when opened from an event)
  
  Tools: create, drag-move, resize handles, rotate handle, duplicate (Cmd/Ctrl-D), delete, multi-select, snap-to-grid, zoom (wheel + buttons), pan (space-drag), undo/redo. Right panel: booth # / size / price / category / electric / premium / reserved / status. `analyzeVenueMap` scaffolded as a "Generate draft layout" button marked future.
- **`studio.events.tsx`** — keep Event Library; wire "New Event" to 3-step dialog (Venue → Layout Template → Details) → `createEventFromTemplate`.
- **`studio.vendors.tsx`** — Vendor Directory. Columns include `account_status` badge and last-application info. Row actions: Edit, Invite to Portal (email/link/code), Revoke Invite, Disable/Enable, Delete. Account status changes never touch applications.
- **`studio.applications.tsx`** — Applications, scoped to active event.
  - Toolbar: search, sort, filter by status / `entry_method` / has-booth, "Enable public applications" toggle, "Copy public link".
  - "+ Add Application" menu:
    1. Manual entry (form dialog with returning-vendor match panel).
    2. Scan with AI (upload → extract → review-and-edit prefilled form with match suggestions → Save).
    3. Invite vendor (pick or create directory row, send invitation).
  - Row shows entry_method badge, status, vendor, requested size, booth assignment, payment.
  - Row click opens **Application Workspace** as a full-height side sheet — no navigation:
    - Header: applicant/business, status, entry_method, quick action bar (Approve, Reject, Waitlist, Assign Booth, Mark Paid, Request Info, Send Portal Invite, Print, Duplicate, Archive).
    - Body tabs: Details (applicant/business/products/booth/electric/special requests), Payment, Notes (applicant vs internal), History (prior applications, booth assignments, payments across the org), Activity Log.
    - "Assign Booth" opens a booth picker over the event's booth map; approval is not required first and does not require assignment.
    - "Print" uses browser print CSS on a print-friendly template inside the sheet.
- **`studio.index.tsx`** — active-event switcher; live stat cards scoped to active event where meaningful; **Organizer Inbox** section listing the counts above, each linking to a pre-filtered Applications / Messages / Vendors view.

Every list gets the standard toolbar (search, sort, filter, page size, pagination, skeleton loading, empty state, validation).

## Active Event

Extend `auth-context` with `activeEventId` + `setActiveEvent`, persisted to `user_org_prefs`. All event-scoped queries include it in the query key.

## Event Completion

`completeApplication` and `completeEvent` (via existing status enum) flip applications to `completed`; the workspace switches to read-only mode (all mutation actions disabled, activity log still visible, search still works). Historical joins into vendor "Previous Event History" already work through `application_activity` + `applications` reads.

## AI

- Model: `google/gemini-2.5-pro` (multimodal) via Lovable AI Gateway inside a `createServerFn`.
- Returns strict JSON validated by Zod; UI shows the extraction inline in the review form with field-level "edited" indicators.
- Venue map → booth-layout AI generator scaffolded but marked future.

## Non-goals

- Stripe/Paddle payments, sponsorship management, QR check-in, advanced reporting.
- Portal / Admin / public marketing pages — untouched.
- Actual portal-side acceptance UI beyond the callback that flips `account_status` to `registered`.
- No redesign.

## Delivery order

1. Migration + storage buckets + regenerate types.
2. Server functions (studio, events, vendors, applications, AI scan, activity log triggers).
3. `auth-context` active-event extension.
4. Venues (list + detail + maps + docs).
5. Layout Templates + reference-layer import + Booth Layout Builder.
6. Event creation workflow dialog.
7. Vendor Directory + invitations.
8. Applications page + Application Workspace side sheet + public form route.
9. Studio Dashboard live stats + Organizer Inbox + active-event switcher.
10. Empty / loading / validation polish + typecheck.

## Success check

An organizer can: add a venue → import a sketch as reference → design booths tracing over it → save a Layout Template → create an event → add applications by manual entry, AI scan, public form, or vendor-portal invitation (each row displays its entry method) → run every status transition and booth assignment from the Application Workspace without leaving it → resolve duplicate vendors via the returning-vendor match panel → send optional portal invitations (account status flows `no_account → invited → registered`) → switch active event → see live counts and a live Organizer Inbox on the dashboard. No `SectionStub` remains on touched pages; no workflow requires a vendor to have an account.
