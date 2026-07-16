# OnePlan-style framed workspace for the Venue Designer

Right now `VenueDesignerV2` renders `DesignerCanvas` full-bleed (`absolute inset-0`) behind floating toolbars. OnePlan instead puts the map/plan inside a clearly bounded, rounded "stage" that sits centered on screen with breathing room, so all drawing, panning, zooming happens *inside a frame* while chrome (toolbars, side panels, inspector) surrounds it.

This plan reshapes the designer shell to match that feel, without touching drawing logic or data.

## What changes visually

```text
┌──────────────────────────────────────────────────────────────┐
│  [toolbar]         [center tools]              [save]        │
│                                                              │
│  ┌──┐   ┌──────────────────────────────────────┐  ┌────────┐ │
│  │◧ │   │                                      │  │ Insp.  │ │
│  │◨ │   │        FRAMED WORKSPACE              │  │ panel  │ │
│  │◪ │   │        (canvas + map inside)         │  │        │ │
│  └──┘   │                                      │  └────────┘ │
│         └──────────────────────────────────────┘             │
│                     [zoom pill · % · fit]                    │
└──────────────────────────────────────────────────────────────┘
```

- Neutral app background behind the workspace (soft muted tone, very subtle grid or dot pattern) so the frame reads as a distinct "sheet on a desk".
- The workspace is a centered card: rounded-2xl, 1px border, soft outer shadow, `overflow: hidden` so tiles/elements are clipped by the frame edge.
- A small header strip on the workspace shows plan name + status pill (Saved / Unsaved / Saving) — echoes OnePlan's top bar on the plan itself.
- Floating toolbars keep their current pill styling but sit *outside* the frame, gaining padding so they never overlap the frame corners.
- The zoom / fit / percentage cluster moves to a floating pill anchored to the bottom of the frame (OnePlan pattern).

## Layout math

Replace the `fixed inset-0` + `absolute inset-0 canvas` structure in `src/components/venue-designer-v2/designer.tsx` with a CSS grid:

- Row 1: top toolbar (auto height)
- Row 2: `1fr` — contains a flex row of [left rail + optional slide-over] · [framed workspace] · [inspector]
- Row 3: bottom status/zoom bar (auto height)

The framed workspace is the middle grid cell with:
```
className="relative m-4 flex-1 min-w-0 min-h-0 rounded-2xl border border-border/70 bg-card shadow-[0_10px_40px_-15px_hsl(var(--foreground)/0.25)] overflow-hidden"
```
`DesignerCanvas` fills that container with `absolute inset-0`, so nothing about its internal SVG / pan-zoom math changes — it just becomes framed instead of full-bleed.

## Zoom-to-fit correction

`zoomToFit()` currently sizes to `window.innerWidth - 120` / `window.innerHeight - 120`. That was correct for full-bleed but overshoots inside the new frame. Fix: measure the workspace element via a ref (`workspaceRef.current.getBoundingClientRect()`) and fit to that rect (minus a small padding), so "Fit" centers the plan inside the frame exactly like OnePlan's fit control.

## Side panels

- Left rail and its slide-over stay as floating pills but are re-anchored to the outer shell (outside the frame's left edge) instead of `absolute` inside the canvas layer. Same for the top toolbar.
- Inspector (`rightOpen`) becomes a real grid column when open (width 320px), pushing the frame narrower rather than overlapping it — matches OnePlan's docked right panel behavior. When closed, only the toggle button remains.

## Background modes hint bar

The "Drag the map… / Drag the crop handles…" hint (lines 239–253) currently floats at `top-16`. Move it to be anchored to the top of the framed workspace (absolute inside the frame, `top-2`), so instructions live with the stage, not with the app shell.

## Files touched

- `src/components/venue-designer-v2/designer.tsx` — restructure JSX from fixed/absolute layers into a grid shell; add `workspaceRef`; update `zoomToFit`; re-anchor bg-mode hint bar; move zoom controls into a bottom-of-frame pill.
- `src/styles.css` — one small utility for the subtle dotted desk background behind the frame (`.designer-desk` with `background-image: radial-gradient(...)`).

No changes to `canvas.tsx`, `store.ts`, `inspector.tsx`, `satellite-map-layer.tsx`, or any data model — just shell/chrome.

## Out of scope (say so if you want them next)

- Reworking the tool palette into OnePlan's left-side category tree
- OnePlan-style layers panel with drag-reorder
- Sharing / export toolbar cluster on the right
- Locking pan so you can't scroll the canvas *outside* the frame (currently drawings can live off-frame; OnePlan clips visually but still allows off-canvas work — I'd keep current behavior unless you want a hard boundary)

## Question

One decision to confirm before I build:

**When the inspector is open, should the framed workspace shrink to fit the remaining space (OnePlan-style docked panel), or should the inspector float over the frame like the toolbars do today?** I'd recommend docked/shrink — feels more like a proper workspace and avoids the inspector covering the map.
