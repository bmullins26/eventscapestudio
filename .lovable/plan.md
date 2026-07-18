## Goal
Preview the uploaded **Venue Workspace SDK** design inside the app as a standalone page, without changing or removing any existing Venue Designer / Workspace code.

## What the upload contains
- Single self-contained `src/app/App.tsx` (~1,227 lines).
- Only external deps: `react` and `lucide-react` (both already in the project).
- The `components/ui/*` shadcn files in the zip are unused by `App.tsx` — we can ignore them.
- No router, no data fetching, no backend calls — pure UI/UX demo.

## Approach
Drop the SDK's `App.tsx` into the project as a new isolated route. Nothing existing is touched.

### Files added
1. `src/components/venue-workspace-preview/SdkApp.tsx`
   - Verbatim copy of the uploaded `src/app/App.tsx` (renamed default export to `SdkApp`).
2. `src/routes/_authenticated/studio.venue-workspace-preview.tsx`
   - New TanStack route at `/studio/venue-workspace-preview`.
   - Renders `<SdkApp />` full-viewport (no AppShell chrome) so it looks identical to the SDK's own preview.
   - Sets a `head()` title "Venue Workspace Preview".

### Optional (light touch)
3. Add one entry in the Studio sidebar (`src/routes/_authenticated/studio.tsx`) labeled **"Workspace Preview (beta)"** linking to the new route. If you'd rather keep it hidden and only visit by URL, we skip this — say the word.

### Files NOT changed
- `src/components/venue-designer-v2/**`
- `src/components/venue-designer/**`
- `src/routes/_authenticated/studio.venues.$venueId.designer.tsx`
- Any workspace / event-context / server-fn code.

## Risks / notes
- The SDK file has no TypeScript strict-mode guarantees; if `tsgo` flags anything, I'll add minimal local `any` casts inside the copied file only — no behavior change.
- It's a pure design mockup: buttons don't wire to your real data. That's expected for a preview.
- If it looks good after review, we can extract patterns from it into the real designer as a follow-up.

## Verification
- Build + typecheck pass.
- Navigate to `/studio/venue-workspace-preview` → SDK UI renders full-screen.
- Existing `/studio/venues/$venueId/designer` still renders unchanged.
