## Problem

After signing in (Google or email), users land on `/app`, which reads `primarySurface` from `useAuth`. `primarySurface` is derived from `user_roles`. I checked the database — both existing users have **zero roles and zero organizations**:

- Google sign-in never calls `bootstrapOrganizer` (only the email signup form does).
- Even the email signup path's `bootstrapOrganizer` runs client-side after `signUp` and can fail silently under RLS before a session exists.

Result: on `/app`, `primarySurface` stays `null`, the redirect `useEffect` never fires, the page shows "Setting up your account…", and any refresh / back navigation bounces the user to `/auth` — which itself doesn't recognize the already-signed-in session and shows the login form again. That's the loop the user is seeing.

## Fix

Move bootstrap into the database so **every** signup path (email, Google, future SSO) provisions a role + default org atomically, and make `/auth` recognize an existing session.

### 1. DB trigger to auto-provision new users (migration)

On `auth.users` insert:
- Insert a `profiles` row (if that table is used — keep current behavior).
- Insert `user_roles(user_id, role='organizer')`.
- Insert a default `organizations` row owned by the new user, with a slug derived from email/name. Add a suffix for uniqueness.

Function is `SECURITY DEFINER` with `SET search_path = public` so it bypasses RLS for this trusted, one-shot provisioning.

### 2. Backfill existing users

Insert `organizer` role + default org for the two existing users (`bmullins26@gmail.com`, `kalamullins2017@gmail.com`) so they can log in immediately.

### 3. `/auth` — redirect if already signed in

Add a `beforeLoad` (or client-side effect on this `ssr:false`-safe route) that checks `supabase.auth.getUser()`; if a session exists, `redirect({ to: "/app" })`. This handles the Google flow that returns to `/` and any subsequent click on "Sign in".

### 4. Simplify `auth.tsx` bootstrap

Remove the client-side `bootstrapOrganizer` call (now handled by trigger). Keep the form; on submit just `signInWithPassword` / `signUp`, then `navigate({ to: "/app" })`.

### 5. `/app` RoleRouter safety net

If `loading === false` and `roles.length === 0` after mount, call `refresh()` once (covers the race between `SIGNED_IN` event and role rows landing). No functional change beyond that — the trigger + backfill make this rare.

## Files touched

- `supabase/migrations/<new>.sql` — trigger + backfill + necessary GRANTs
- `src/routes/auth.tsx` — add signed-in redirect; drop client bootstrap
- `src/routes/_authenticated/app.tsx` — one-shot refresh fallback

No UI/design changes.
