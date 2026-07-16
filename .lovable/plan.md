## Problem

The label under each icon is rendering as a thin horizontal line instead of readable text. Two bugs in `ElementLabel` (canvas.tsx ~lines 695–733):

1. **Font size is clamped too small in world units.** `worldFont = clamp(el.w * 0.14, 1.4, 3.5)` ft. For a ~110 ft food truck at 55% zoom this is ~3.5 ft tall on a wide box — the text ends up shorter than one screen pixel of stroke, so it disappears.
2. **`textLength` always stretches to the full box width.** With a short name like "Pizza" and `lengthAdjust="spacingAndGlyphs"`, glyphs get stretched horizontally to fill the whole element width while remaining tiny in height — that's the "line under the icon" the user sees.

## Fix

Rewrite `ElementLabel` so the label is sized in **screen space** (constant on-screen readability) and only shrinks when the name is too long:

- Compute `worldFont = 12 / vpScale` (≈12 px on screen regardless of zoom), floor at a small world minimum.
- Estimate natural text width from character count (`name.length * worldFont * 0.55`). 
  - If it fits inside the element width, render normally (no `textLength`).
  - If it overflows, apply `textLength={boxW}` + `lengthAdjust="spacingAndGlyphs"` **only then**, so short names stay proportional and long names shrink to fit.
- Recompute pill background rect from the actual text width (not always full element width) so short labels get a tight pill.
- Keep the "hide when screen size < 24 px" guard, but base it on screen width in px, not world units.
- Apply the same screen-space font approach to the booth's secondary `name` line inside `renderBooth` so booth names are legible too, and pass `vpScale` into `renderBooth` (currently it uses a placeholder `1`).

## Files

- `src/components/venue-designer/canvas.tsx` — rewrite `ElementLabel`, thread `vpScale` into `renderBooth`, update the inside-booth secondary name to use screen-space font sizing with conditional `textLength`.

No other files change. No type or API changes.