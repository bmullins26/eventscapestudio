# Fix: Designer URL renders the Venue Directory instead of the Designer

## Root cause

Both files exist under `src/routes/_authenticated/`:

- `studio.venues.tsx` — declares `/_authenticated/studio/venues` and renders `VenuesPage` (the directory list). No `<Outlet />`.
- `studio.venues.$venueId.designer.tsx` — declares `/_authenticated/studio/venues/$venueId/designer`.

In TanStack Router's flat file-based routing, because a sibling file extends `studio.venues.*`, `studio.venues.tsx` is treated as the **parent layout** for `/studio/venues/**`. Since its component returns the directory UI and no `<Outlet />`, navigating to `/studio/venues/:venueId/designer` matches the designer route but the parent layout has nowhere to render it — so the Venue Directory keeps showing and the click "does nothing". Reproduced via Playwright: navigating directly to the designer URL renders "Venue Directory" content.

## Fix

Split `studio.venues.tsx` per the documented pattern (parent-with-children must render `<Outlet />`, move page body to `*.index.tsx`):

1. **Create `src/routes/_authenticated/studio.venues.index.tsx`** — move the current `VenuesPage` component + its `VenueDetailSheet` (and any helpers) here. Route path: `/_authenticated/studio/venues/`.

2. **Rewrite `src/routes/_authenticated/studio.venues.tsx`** to be a pure layout:
   ```tsx
   import { createFileRoute, Outlet } from "@tanstack/react-router";
   export const Route = createFileRoute("/_authenticated/studio/venues")({
     component: () => <Outlet />,
   });
   ```

3. Leave `studio.venues.$venueId.designer.tsx` unchanged — it will now mount inside the layout's `<Outlet />`.

## Verification

- Playwright: navigate to `/studio/venues/<venueId>/designer` — expect Menu Bar / Tool Strip / canvas (not "Venue Directory").
- Navigate to `/studio/venues` — expect the directory list still renders.
- No hydration/route-tree errors in console.

## Out of scope

No behavior changes to the Designer itself; unrelated hydration warning about `data-tsd-source` line numbers on `<html>`/`<head>`/`<body>` is a dev-only source-map artifact.
