
# EventScape Studio — v1 Foundation Plan

Prioritize a clean, extensible architecture over feature completeness. This build establishes the multi-tenant foundation (auth, database, RLS, routing, brand system, reusable primitives) and wires up the highest-value organizer surfaces. Every module is composed from shared primitives so later features slot in without refactors.

## Guiding Principles

- **Architecture first, features second.** Ship the skeleton for all four roles and every route, but leave secondary screens as clean empty-states with the right data shape rather than half-built UIs.
- **One primitive per pattern.** Every card, table, dialog, form, and page shell has a single canonical component. No ad-hoc alternatives.
- **Server-owned data access.** All reads/writes go through `createServerFn` in `src/lib/*.functions.ts`. Components never call `supabase` directly except for auth and realtime subscriptions.
- **RLS is the source of truth.** Client role checks are UX only; every table enforces isolation via policies.

## Brand & Design System

Tokens live in `src/styles.css` via `@theme` (oklch), inspired by the logo:

- **Dusty Rose** primary (`oklch(0.74 0.09 20)`) + deep rose hover
- **Ivory Cream** background (`oklch(0.985 0.008 80)`)
- **Charcoal** foreground
- **Sage Green** success
- **Warm gray** borders/muted
- **Rounded-2xl** cards, soft rose-tinted shadows, thin rose dividers echoing the logo's outer ring

Typography via `<link>` in `__root.tsx`: **Cormorant Garamond** (display) + **Inter** (UI). Wordmark component reuses the display face.

## Reusable UI Primitives (`src/components/ui/` and `src/components/shared/`)

Built once, used everywhere:

- `AppShell` — sidebar + topbar layout for authenticated app
- `PageHeader` — title, description, breadcrumbs, action slot
- `StatCard` — dashboard metric card (icon, label, value, trend)
- `QuickActionCard` — icon + label CTA card
- `DataTable` — generic sortable/filterable table (TanStack Table) with empty/loading/error states baked in
- `FormDialog` — modal wrapper around `react-hook-form` + zod + shadcn Dialog
- `ConfirmDialog` — destructive-action confirmation
- `EntityForm` — schema-driven form generator (field configs → inputs)
- `EmptyState` — icon, title, description, CTA — used by every list
- `StatusBadge` — semantic badges (pending/approved/paid/etc.)
- `SectionCard` — titled card wrapper with optional actions
- `RoleGate` — conditional render by role/permission
- `PermissionGate` — conditional render by staff permission
- `Brand` — logo + wordmark component

Every list route uses `DataTable + EmptyState`. Every create/edit uses `FormDialog + EntityForm`. Every destructive action uses `ConfirmDialog`.

## Backend (Lovable Cloud)

### Auth
- Email/password + Google (via `lovable.auth.signInWithOAuth`)
- Managed `_authenticated/route.tsx` gate
- Bearer middleware in `src/start.ts`
- Post-signup trigger creates `profiles` row + assigns default role

### Migrations (all with GRANTs + RLS)

**Enums:** `app_role` (`super_admin | organizer | staff | vendor`), `application_status`, `payment_status`, `booth_status`, `event_status`.

**Tables:**
- `profiles` — id (FK auth.users), full_name, avatar_url, phone
- `user_roles` — user_id, role (separate table per security rules)
- `organizations` — id, name, slug, owner_id, subscription_tier, suspended, created_at
- `organization_members` — organization_id, user_id, permissions (jsonb flags: check_in, edit_booths, chat, payments, reports, view_vendors)
- `events` — id, organization_id, name, slug, description, venue, address, starts_at, ends_at, setup_start, setup_end, status, cover_image_url
- `vendor_categories` — id, event_id, name, color
- `booth_sizes` — id, event_id, label, width_ft, depth_ft, price
- `booths` — id, event_id, code, size_id, category_id, x, y, width, height, rotation, status, assigned_application_id
- `vendors` — id, business_name, contact_name, email, phone, website, logo_url, user_id (nullable)
- `applications` — id, event_id, vendor_id, category_id, status, notes, applied_at
- `application_documents` — id, application_id, name, url, kind
- `payments` — id, application_id, amount, status, method, note, paid_at, marked_paid_by
- `sponsors` — id, event_id, name, tier, logo_url, contribution, contact_name, contact_email
- `announcements` — id, event_id, title, body, audience, created_by, created_at
- `messages` — id, event_id, vendor_id, sender_id, body, read_at, created_at
- `support_requests` — id, organization_id, subject, body, status, created_by, created_at

### Security Definer Functions
- `has_role(_user_id uuid, _role app_role) → boolean`
- `is_org_member(_user_id uuid, _org_id uuid) → boolean` — owner OR row in `organization_members`
- `has_org_permission(_user_id uuid, _org_id uuid, _perm text) → boolean`
- `event_org_id(_event_id uuid) → uuid` — for policies on event-scoped tables

### RLS Pattern
Every event-scoped table: `USING (is_org_member(auth.uid(), event_org_id(event_id)))` for organizer/staff reads; vendor reads scoped to their own `vendor_id`. Super admins bypass via `has_role(auth.uid(), 'super_admin')`.

### Storage Buckets
- `event-covers` (public)
- `vendor-logos` (public)
- `application-documents` (private, signed URLs via server fn)

## Routing (`src/routes/`)

```text
__root.tsx                       brand shell, providers, head defaults
index.tsx                        public landing (hero + value props + CTA)
auth.tsx                         sign in / sign up / Google
_authenticated/
  route.tsx                      managed gate (ssr: false)
  dashboard.tsx                  role-aware redirect to correct home
  # Organizer / Staff surfaces
  events.index.tsx               events list (DataTable + EmptyState)
  events.new.tsx                 create event (FormDialog reused as full page)
  events.$eventId.tsx            event layout (sidebar tabs, <Outlet/>)
    events.$eventId.index.tsx    overview + StatCards
    events.$eventId.applications.tsx
    events.$eventId.vendors.tsx
    events.$eventId.booths.tsx   drag-and-drop map
    events.$eventId.sponsors.tsx
    events.$eventId.payments.tsx
    events.$eventId.announcements.tsx
    events.$eventId.messages.tsx
    events.$eventId.documents.tsx
    events.$eventId.reports.tsx
    events.$eventId.settings.tsx
  vendors.tsx                    org-wide vendor directory
  staff.tsx                      invite + permissions matrix
  settings.tsx                   organization profile
  # Vendor portal
  vendor/
    dashboard.tsx
    events.tsx                   browse & apply
    applications.tsx
    profile.tsx
    messages.tsx
  # Super admin
  admin/
    index.tsx                    platform metrics
    organizations.tsx
    subscriptions.tsx
    support.tsx
```

Every route with a loader gets `errorComponent` + `notFoundComponent`. Every shareable route has its own `head()`.

## Server Function Modules (`src/lib/`)

Each module exports typed server fns; all mutating fns use `.middleware([requireSupabaseAuth])` + role/permission checks:

- `auth.functions.ts` — bootstrap user (create org on first organizer login)
- `organizations.functions.ts`
- `events.functions.ts`
- `applications.functions.ts`
- `vendors.functions.ts`
- `booths.functions.ts`
- `sponsors.functions.ts`
- `payments.functions.ts`
- `announcements.functions.ts`
- `messages.functions.ts`
- `staff.functions.ts`
- `documents.functions.ts` (signed URL issuance)
- `admin.functions.ts` (super admin only)

Query keys and `queryOptions` factories co-located per module in `src/lib/queries/*.ts` for `ensureQueryData` + `useSuspenseQuery`.

## What Ships Wired End-to-End in v1

Given the "architecture over completeness" priority, these surfaces are fully functional:

1. Auth (email + Google), profile bootstrap, role assignment
2. Organization creation on first login
3. Events: create, list, view overview, edit settings, delete
4. Vendor categories & booth sizes management (per event)
5. Vendors: add, list, edit
6. Applications: submit (vendor portal), list (organizer), approve/waitlist/reject
7. Booth map: **drag-and-drop editor + assignment** (dnd-kit + SVG canvas) — this is the flagship v1 feature
8. Payments: manual mark paid/unpaid, revenue rollup
9. Sponsors: CRUD
10. Announcements: compose + list
11. Staff: invite by email, toggle permission flags
12. Super admin: organization list, suspend toggle

## Scaffolded (empty state + shape, wired later)

- Messages / chat (schema + route + empty state; realtime later)
- Documents (schema + upload wired; viewer polish later)
- Reports (route + CSV export stub)
- Support requests (super admin route + schema)
- Dark mode (tokens ready, toggle later)
- Stripe payments (deferred)
- Email delivery (deferred; in-app announcements only)

## Landing Page

Real content: hero with wordmark, tagline "Plan · Organize · Create · Celebrate" (from the logo), 4 feature blocks (Applications, Booth Map, Vendors, Payments), CTA to sign up. Route-specific `head()` metadata.

## Deliverables Checklist

- Cloud enabled, all migrations + GRANTs + RLS + security-definer fns
- `_authenticated/route.tsx` managed gate; bearer middleware in `src/start.ts`
- Brand tokens + fonts + Wordmark
- All primitives in `src/components/shared/`
- Route tree per above with head() on shareable routes
- Server fn modules with typed inputs (zod) and `useSuspenseQuery` reads
- Organizer dashboard w/ 9 StatCards + 6 QuickActionCards
- Drag-and-drop booth map (editor + assign modes)
- Vendor portal apply flow end-to-end
- Super admin organization list
