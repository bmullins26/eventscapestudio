## Changes

**1. Remove the pill background around labels**
- In `ElementLabel` (canvas.tsx), delete the `<rect>` behind the text.
- Add a text stroke/halo for legibility over map imagery instead: render the `<text>` twice — first as a thick outline stroke (`stroke="hsl(var(--background))"`, `strokeWidth` ≈ `worldFont * 0.35`, `paintOrder="stroke"`), then the fill on top. This is the standard "map label" treatment (crisp text with a soft outline, no box).
- Apply the same outline treatment to the booth's in-body secondary name line.

**2. Per-element label color**
- `types.ts` — add optional `labelColor?: string` on `BaseElement` (applies to booth name, icon label, preset label). Text elements already have `color`.
- `factory.ts` — default `labelColor` to `hsl(var(--foreground))` equivalent (store as a concrete hex like `#111827` so the color input works; fallback in the renderer if absent).
- `canvas.tsx` — `ElementLabel` and booth secondary-name text read `el.labelColor ?? "hsl(var(--foreground))"`.
- `inspector.tsx` — add a **"Label color"** color input in the shared section (right under the Name field) for booth and icon kinds. Text kind keeps its existing "Color" control (unchanged).

## Files

- `src/components/venue-designer/canvas.tsx` — remove pill rect, add stroke halo, use `labelColor`.
- `src/components/venue-designer/types.ts` — add `labelColor?: string` to `BaseElement`.
- `src/components/venue-designer/factory.ts` — set a default `labelColor` on newly-created booth/icon/preset elements.
- `src/components/venue-designer/inspector.tsx` — add "Label color" field for booth + icon.

No other files change.