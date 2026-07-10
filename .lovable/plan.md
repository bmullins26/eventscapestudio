# OnePlan-style Venue Designer

Reshape the designer so it feels like OnePlan: a satellite map you draw on, with minimal floating chrome — instead of an Adobe-style multi-panel CAD app.

## Visual direction

- **Base canvas** = real Esri World Imagery satellite tiles via Leaflet (no API key required, attribution shown).
- **Chrome** floats over the map, not fixed rails eating the viewport.
- Light, airy, minimal — matches OnePlan. Uses current EventScape `--primary` for accents (buttons, selection stroke, active tool state).
- Kill the giant top MenuBar, the vertical ToolStrip, and the bottom tabs drawer. Everything relocates.

## New layout

```text
┌──────────────────────────────────────────────────────────────┐
│  ← Venue name         ↶ ↷        [Export] [ Share ]  [avatar]│  floating top bar
├──┬───────────────────────────────────────────────────────────┤
│▸ │                                                            │
│  │              [ satellite map + drawn objects ]             │
│  │                                                            │
│L │                                             ┌────────────┐ │
│i │                                             │ Properties │ │  floating card (only when selection)
│b │                                             └────────────┘ │
│  │                                                            │
│  │   [ ▢ ▷ ✋ ]                            [ − % + ][🗺][?]   │  bottom-left tools · bottom-right zoom/basemap
└──┴───────────────────────────────────────────────────────────┘
```

- **Top bar** (floating, rounded, shadow): back → venue name (left) · undo/redo (center) · Export + Share buttons (right). No menu-heavy dropdowns; a small ⋯ hides the rare actions (rename, versions, presentation).
- **Left library rail**: collapsible via a single chevron. Same object catalog content, tighter grid, sticky search. Collapsed = 40px strip with a chevron.
- **Right Properties panel**: floats as a card, mounts only when an object/reference is selected. Not a permanent rail.
- **Bottom-left tools cluster**: select · pan · draw-shape trio. Placing objects still happens by clicking a library tile.
- **Bottom-right cluster**: zoom −, zoom %, zoom +, basemap toggle (satellite ↔ street ↔ blank), help.
- **Everything else** (layers, history, AI, versions, org assets) moves into a `⋯ More` popover from the top bar — accessible but out of the way.

## Map integration

- **Library:** `leaflet` + `react-leaflet`, plus `leaflet/dist/leaflet.css` loaded via a `<link>` in `__root.tsx` head (Tailwind v4 can't `@import` remote in `styles.css`).
- **SSR:** Leaflet is browser-only, so the whole map component is `React.lazy` + `<ClientOnly>`. Fallback = neutral map-toned placeholder.
- **CRS:** `L.CRS.EPSG3857` with Esri World Imagery tile URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
- **Geo-anchor per venue:** add `center_lat`, `center_lng`, `map_zoom` to `venues`. If null on load, the map opens at a friendly default (e.g. `[0, 0]` zoom 2 with a "Search for this venue's address" prompt) and calling `Save map location` writes the current map center/zoom back to the venue.
- **Object coordinates stay pixel-based** in the DB (no destructive schema change). At runtime we anchor pixels to lat/lng: `anchorPoint = map.project(center, REF_ZOOM)`, `objectPoint = anchorPoint + (obj.x, obj.y)`, `objectLatLng = map.unproject(objectPoint, REF_ZOOM)`. `REF_ZOOM` is a per-venue constant (default 20) that fixes the "1 canvas unit = N pixels at reference zoom" relationship. Objects re-project on every map `move`/`zoom` event.
- **Draw/edit** stays SVG-based, but the SVG lives inside a Leaflet overlay pane so it pans/zooms with the map for free.
- **Address search:** small OpenStreetMap Nominatim search box top-left of the map (no key), used once per venue to set the center. Rate-limit friendly for the "set my venue" flow.

## Files

Create:
- `src/components/venue-designer/map-canvas.tsx` — the Leaflet + SVG overlay component (client-only).
- `src/components/venue-designer/floating-topbar.tsx` — new slim top bar.
- `src/components/venue-designer/floating-tools.tsx` — bottom-left tool trio.
- `src/components/venue-designer/floating-zoom.tsx` — bottom-right zoom + basemap.
- `src/components/venue-designer/properties-card.tsx` — floating card wrapper reusing the existing `Inspector` / `ReferenceInspector` / `VenueInspector`.
- `src/components/venue-designer/more-menu.tsx` — popover for layers/history/AI/versions/library.
- Migration: add nullable `center_lat float8`, `center_lng float8`, `map_zoom int` on `public.venues`.

Rewrite:
- `src/routes/_authenticated/studio.venues.$venueId.designer.tsx` — new shell, mounts `MapCanvas`, wires floating chrome to existing mutations. Existing state, mutations, and `panels.tsx` inspectors are preserved.
- `src/routes/__root.tsx` — add Leaflet CSS `<link>` in `head()`.

Delete usage of (files stay for now, unimported):
- `menu-bar.tsx`, `tool-strip.tsx`, `bottom-drawer.tsx`.

## Verification

- Playwright: navigate to `/studio/venues/<id>/designer`, screenshot — expect satellite tiles + floating chrome, no dark CAD panels.
- Place a booth, drag it, zoom the map — booth stays glued to its geographic spot.
- Toggle basemap to blank — chrome unchanged, canvas still usable.
- Existing venue directory route unaffected.

## Out of scope this pass

- Draw-on-map for polylines/polygons (roads, fences) still uses SVG rectangles/shapes; native map polyline tool is a follow-up.
- Storing objects as GeoJSON. Pixel coords with per-venue anchor keeps existing data valid.
- Real-time collaboration cursors.
