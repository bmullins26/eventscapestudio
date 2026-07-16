
# Map as a layer + prune primitives (OnePlan-style)

Two focused changes to the Venue Designer, no data-model churn.

## 1. Map/background becomes a first-class movable layer

Today the background lives in `settings.background` and only becomes movable when you enter "Adjust" mode. OnePlan treats the plan/map as a base layer you can freely position on the canvas at any time (and lock when done). We match that:

- **Layers panel promotion** — in the left "Layers" tab (`ObjectExplorer`), add a pinned top row "Base map" when `settings.background` exists, with:
  - visibility toggle (drives a new `background.hidden` flag)
  - lock toggle (uses existing `background.locked`)
  - opacity slider (existing `background.opacity`)
  - "Select" action that puts the background into a **selected** state (new `bgSelected` state on the designer, not part of element selection so it doesn't conflict with elements)
  - "Remove" action
- **Direct manipulation on canvas** — when the base map is selected and unlocked:
  - drag anywhere on the map body to move it (updates `background.x/y`)
  - 8 resize handles + 1 rotate handle (already exist for image backgrounds in adjust mode) — reuse that overlay for both `image` and `google-satellite` kinds
  - for `google-satellite`, dragging the layer moves the whole tile block in world space (translating `x/y`); the internal Google pan/zoom stays under "Adjust map view" sub-mode toggled from the inspector, so the two gestures don't fight
- **Click-to-select** — clicking on empty canvas with the `select` tool now hit-tests the background rect too. Clicking an element still selects the element (elements take priority). Escape or clicking outside deselects.
- **Retire `bgMode` "adjust"/"crop" modal states** — replace with the always-on selection model above. Keep "Crop" as an inspector button on the selected base map that toggles a transient crop overlay (existing SVG crop UI); "Apply" writes to `background.crop` and exits. Removes the current modal-hint bar.
- **Inspector panel for base map** — when the base map is the selected thing, right inspector shows: opacity, rotation, x/y/w/h numeric fields, calibrate button (existing), crop toggle, lock, remove. Mirrors OnePlan's "Base plan" panel.

Types change: add `hidden?: boolean` to `BackgroundLayer` in `src/components/venue-designer/types.ts`. Everything else is state on the designer component.

## 2. Prune primitive tools

Remove from the top toolbar and factory dispatch: Rectangle, Circle, Triangle, Line. Keep Select, Booth, Text, Icon, plus the semantic presets (Road, Walkway, Building, Parking, Measure, Table, Chair, Fence) and Background.

- Toolbar buttons removed in `designer.tsx`.
- Keyboard shortcuts `R / C / L` unbound; `B / T / M / F / V` retained.
- `installFactory` no longer dispatches to `makeShape` for `rect/circle/triangle/line`. `makeShape` stays in the codebase so existing saved layouts still render — we only stop creating new ones. Old primitives already in a layout continue to display and remain editable via the Layers panel/inspector, matching OnePlan's "we don't offer generic shapes, but respect what's there."
- `CanvasTool` union in `canvas.tsx` narrows accordingly; the drag-to-create branches for those four kinds are dead code paths but left in place for safety in this pass.

## Files touched

- `src/components/venue-designer/types.ts` — add `BackgroundLayer.hidden`
- `src/components/venue-designer-v2/designer.tsx` — new `bgSelected` state, remove `bgMode` modal flow, drop primitive tool buttons + shortcuts, pass base-map selection to canvas + inspector
- `src/components/venue-designer/canvas.tsx` — always-on background overlay when `bgSelected && !bg.locked`, hit-test background on background-plane click, render nothing for `hidden`, remove modal `bgMode` prop
- `src/components/venue-designer/inspector.tsx` — new "Base map" panel branch driven by `bgSelected`; retire the "Adjust / Crop" toggle buttons
- `src/components/venue-designer/object-explorer.tsx` — pinned "Base map" row with vis/lock/opacity/select/remove
- `src/components/venue-designer/factory.ts` — `installFactory` in designer stops routing to primitives (no code change here; done in designer)

Not touched: `store.ts`, `satellite-map-layer.tsx` (already accepts `crop`), server functions, data schema, saved-layout compatibility.

## Out of scope (say the word and I'll add)

- Multiple stacked base maps / layer groups
- Snap-to-map-edge for elements
- OnePlan-style "sheets" (multi-page plans)
- Reworking the left rail into an OnePlan category tree
