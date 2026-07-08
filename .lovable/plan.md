## Fix: infinite recursion in `vendor_profiles` RLS

### Cause
Two policies reference each other, so Postgres re-enters RLS forever:

- `vendor_profiles` SELECT policy does `EXISTS (SELECT ... FROM organization_vendors ...)`
- `organization_vendors` SELECT policy does `EXISTS (SELECT ... FROM vendor_profiles ...)`

Any insert/select on `vendor_profiles` triggers the loop → "infinite recursion detected in policy for relation vendor_profiles".

### Fix
Migration that introduces two `SECURITY DEFINER` helpers (bypass RLS internally) and rewrites the offending policies to call them instead of subqueries against the sibling table:

1. `public.vendor_profile_belongs_to_org_member(_vendor_profile_id uuid, _user_id uuid) RETURNS boolean` — checks `organization_vendors` join without triggering RLS.
2. `public.vendor_profile_owned_by(_vendor_profile_id uuid, _user_id uuid) RETURNS boolean` — checks `vendor_profiles.user_id` without triggering RLS.

Then:
- Drop + recreate `vendor_profiles` SELECT policy ("org members with link") using helper #1.
- Drop + recreate `vendor_profiles` UPDATE policy ("org members update linked") using helper #1.
- Drop + recreate `organization_vendors` SELECT policy ("vendor sees own links") using helper #2.

Existing owner-scoped policies (`vendor_profiles: own`, `org_vendors: org members`) stay unchanged.

### Non-goals
No change to form UI, vendor creation server function, or grants — only RLS policy rewiring to eliminate recursion.