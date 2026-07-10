Remove the legacy `/studio/booths` section since the new Venue Designer replaces it.

**Files to change**
- Delete `src/routes/_authenticated/studio.booths.tsx` (the old booth builder page, ~817 lines).
- Delete `src/components/booth-builder/` folder (`pdf-page-picker.tsx`, `use-app-mode.ts`, `use-canvas-input.ts`, `use-device-class.ts`) — only used by the removed route.
- `src/routes/_authenticated/studio.tsx`: remove the `{ label: "Booths", to: "/studio/booths", ... }` nav entry.
- `src/routes/_authenticated/studio.index.tsx`: remove the `Booth Map → /studio/booths` QuickActionCard.
- `src/routes/_authenticated/studio.venues.index.tsx`: change the layout-template row link from `/studio/booths?template=…` to open the Venue Designer for that template's venue (falls back to the venues list if no venue is linked).

**Kept intact**
- `event_booths` DB reads on the dashboard (Booths Sold / Available stats) — those describe event booth inventory, not the old builder page.
- All Venue Designer code under `src/routes/_authenticated/studio.venues.$venueId.designer.tsx` and `src/components/venue-designer/*`.

`src/routeTree.gen.ts` regenerates automatically.
