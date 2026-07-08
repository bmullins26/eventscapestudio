## Vendor architecture fix + org CRM foundation

### Root cause of the RLS failure

Current `vendor_profiles` INSERT policy passes only when either:
- `user_id = auth.uid()` (fails — organizer-created vendors have `user_id = null`), **or**
- the caller owns *any* organization (fails for staff members and even for org owners on some paths since the vendor row's org isn't referenced).

Staff/permission-based creation is not covered, and duplicate/link creation happens as two independent client inserts, so a partial failure leaves an orphan `vendor_profiles` row.

### Fix (server-side, single transaction)

1. **New server function `createVendor`** (`src/lib/vendors.functions.ts`) with `requireSupabaseAuth`:
   - Input: `{ organizationId, profile: {...}, link: {...}, allowDuplicate?: boolean, matchedProfileId?: string }`.
   - Verify caller is an org member with `has_permission(user, org, 'vendor.create')` (fallback to `is_org_member` when the perm key isn't seeded).
   - **Dedupe scan** by exact `business_name`, `email`, `phone`, `website` (case-insensitive, normalized) via the auth'd client scoped to `organization_vendors → vendor_profiles`. Returns `{ status: 'duplicates', matches: [...] }` on hits unless `allowDuplicate` is true or `matchedProfileId` is passed.
   - `matchedProfileId` path: reuse existing profile, just create the `organization_vendors` link (no new profile row).
   - Otherwise: load `supabaseAdmin` inside the handler and run **profile insert + link insert** as one transaction via a new SQL function `public.create_vendor_with_link(...)` (SECURITY DEFINER, transactional). Rolls back both rows if either fails.
   - Returns `{ status: 'created' | 'linked', vendorId, organizationVendorId }`.

2. **New RPC** `public.create_vendor_with_link(_org_id uuid, _profile jsonb, _link jsonb, _existing_profile_id uuid default null)`:
   - SECURITY DEFINER, `SET search_path=public`.
   - Re-checks `is_org_member(auth.uid(), _org_id)` inside the function body (defense in depth) — server fn already verified, but the function is safe against misuse.
   - Inserts vendor_profiles when `_existing_profile_id IS NULL`; otherwise uses that id.
   - Inserts `organization_vendors` row.
   - Wrapped in `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE` so a failure rolls back the whole call.

3. **Tighten RLS on `vendor_profiles`**:
   - Drop the loose "org members insert" policy (unbounded org-owner check).
   - Keep owner self-service (`user_id = auth.uid()`) and org-member read/update via existing helper.
   - Add narrow INSERT policy `TO authenticated` with `WITH CHECK (user_id = auth.uid())` for the self-signup case only; **all organizer-created rows go through the SECURITY DEFINER RPC**, so no permissive org-side INSERT policy is needed anymore.
   - Audit `is_org_member`, `has_role`, `has_permission`, `vendor_profile_belongs_to_org_member`, `vendor_profile_owned_by` — already `SECURITY DEFINER STABLE SET search_path=public`, no recursion. No changes.

4. **Client rewrite (`src/routes/_authenticated/studio.vendors.tsx`)**:
   - Replace the two direct `supabase.from("vendor_profiles").insert(...)` + `organization_vendors.insert(...)` calls with a single `useServerFn(createVendor)` call.
   - On `status === 'duplicates'`: open a shadcn `AlertDialog` listing matches with three actions: **Use existing vendor** (calls `createVendor` again with `matchedProfileId`), **Create new vendor anyway** (`allowDuplicate: true`), **Cancel**.
   - Existing update path (`.update(...).eq("id", row.vendor_profile_id)`) stays — organizers can update linked profiles via existing RLS.
   - Success toast + `qc.invalidateQueries({ queryKey: ["org-vendors", orgId] })`.

5. **Draft vendor profiles**:
   - Client-side localStorage draft keyed `eventscape.vendor-draft.<orgId>` for the intake form; auto-save on every change; **Save & Close** and **Continue Later** buttons; **Discard draft** in overflow menu.
   - No server-side draft table (matches "permanent profile" rule — drafts are only in the browser until Save creates the real row).

6. **Permission seed**:
   - Migration inserts `('vendor.create')` into `public.permissions` if the table is used; safe upsert. Existing `has_permission` returns true for owners and super_admin regardless.

### Part 2 — Vendor CRM (foundation only, UI in a later pass)

Only structural pieces here so the intake work already writes CRM-ready data. Full UI (timeline pages, per-vendor documents view, portal linkage) is a separate ticket.

1. **`vendor_timeline_events` table** (`vendor_profile_id`, `organization_id`, `event_type` enum: `note | application | invitation | payment | status_change | document | assignment`, `payload jsonb`, `actor_user_id`, `occurred_at`), RLS scoped to `is_org_member(auth.uid(), organization_id)`, GRANTs to `authenticated` + `service_role`.
2. **Backfill triggers**:
   - On `applications` insert/update → timeline row (`application`, `status_change`).
   - On `payments` insert → timeline row (`payment`).
   - On `vendor_invitations` insert → timeline row (`invitation`).
   - On `organization_vendors` insert → timeline row (`assignment`).
3. **`vendor_profile_documents` table** already effectively lives as columns on `vendor_profiles` (insurance, food license, tax, resale, photos) — leave as-is for now; add a follow-up ticket for a normalized doc table if requested. Events reference the profile-level docs by joining through `organization_vendors → vendor_profiles`, so returning vendors don't re-upload.

### Files touched / added

- `supabase/migrations/*` — new SQL: RPC `create_vendor_with_link`, RLS tightening on `vendor_profiles`, `vendor_timeline_events` table + trigger functions + GRANTs, optional `permissions` seed.
- `src/lib/vendors.functions.ts` — new `createVendor` server function (uses `requireSupabaseAuth` + admin import inside handler for the transactional RPC).
- `src/routes/_authenticated/studio.vendors.tsx` — replace inline inserts with server fn; wire duplicate dialog; add draft persistence.
- `src/components/vendors/DuplicateMatchDialog.tsx` — new.
- `src/components/vendors/useVendorDraft.ts` — new (localStorage draft hook).

### Non-goals

- No full CRM UI (timeline page, aggregated views) in this pass — only the schema + triggers so data starts collecting.
- No vendor portal account creation flow changes.
- No document upload UX rework.
- No changes to booth builder, applications page, or events.

### Rollout order

1. Migration: RPC + RLS tightening.
2. `createVendor` server fn + client rewrite + duplicate dialog.
3. Draft persistence.
4. `vendor_timeline_events` table + triggers.
5. Verify by creating a vendor as a non-owner staff member and as an owner; assert no `vendor_profiles` orphan on forced failure.