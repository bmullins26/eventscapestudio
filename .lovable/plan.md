## Phase 6 — Touch-first Venue Designer (Desktop / Tablet / Phone)

Make the Booth Layout Builder work on all three form factors with a shared canvas, pointer-based input, responsive chrome, and gesture support. Same data model everywhere — no sync/convert steps. Split into small, verifiable steps.

### 6.1 Canvas input rewrite (pointer + gestures)

- Replace ad-hoc mouse handling in `studio.booths.tsx` with a single `useCanvasInput` hook using **Pointer Events** (unifies mouse / touch / pen).
- Add gesture engine (`@use-gesture/react`) handling:
  - Pinch → zoom around focal point
  - Two-finger drag → pan
  - Two-finger rotate → rotate selection (tablet)
  - Single tap → select
  - Double tap → edit / zoom-to-object
  - Long press (500 ms) → context menu
  - Three-finger tap → undo, three-finger swipe → redo
- Wheel + trackpad pinch preserved on desktop; Ctrl/Shift/Alt modifiers preserved.
- `touch-action: none` on canvas; passive-listener safe.

### 6.2 Selection model

- New `useSelection` Zustand store: `ids: Set<string>`, `mode: 'single' | 'multi' | 'lasso'`.
- Desktop: Click / Ctrl+Click / Shift+Click / drag-rectangle.
- Touch: Tap / Long-press enters multi-select / Lasso tool.
- Larger hit-slop on touch (`pointerType !== 'mouse'` → +12 px).

### 6.3 Handles & touch targets

- Resize / rotate handles: 12 px mouse, 28 px touch; rotation handle offset +16 px on touch.
- All toolbar buttons ≥ 44×44 (`min-h-11 min-w-11`), ≥ 48 on `pointer:coarse`.
- Aria-labels on every icon-only button.

### 6.4 Responsive chrome

`useDeviceClass()` hook (media queries + `pointer:coarse`):

- **Desktop (≥1024 px, fine pointer):** top toolbar, right docked property sidebar, left layers panel.
- **Tablet:** floating collapsible toolbar (draggable, edge-dockable); property panel = shadcn `Sheet` slide-over; layers in second sheet.
- **Phone (<768 px):** FAB with expandable tool menu; property panel = `Drawer` (Vaul) bottom sheet with peek/half/full snap points.
- Safe-area insets; chrome never overlaps working area.

### 6.5 Phone-optimized workflows

- Booth search sheet → cameras to booth.
- Tap booth → bottom sheet: status cycler, lock/unlock, assign vendor, notes.
- AI Assist reachable from FAB.
- Complex creation tools live behind a "More tools" FAB submenu.

### 6.6 Snapping & drag feel

- Reuse existing grid/booth snap logic; rAF-driven drag; commit on `pointerup`.
- Snap guides only while dragging.
- Haptic (`navigator.vibrate(10)`) on snap + long-press open (touch only).

### 6.7 Performance

- Virtualized SVG rendering with viewport culling — target 500+ booths at 60 fps on iPad.
- Debounce reference re-renders; `React.memo` per object.
- Rendered-PDF PNG capped at 4096 px, downsample above.
- Batch pointermove through single rAF (`useLatestPointer`).

### 6.8 Undo / redo

- Command stack in Zustand (add/move/resize/rotate/delete/property-edit).
- Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z on desktop; three-finger tap/swipe on touch; toolbar buttons everywhere.

### 6.9 Touch context menu

- Right-click (desktop) and long-press (touch) both open the **same** shadcn `ContextMenu` — one action list shared across input modes.
- Menu items sized for touch (≥44 px rows).

### 6.10 Touch-first interaction principles

**Stylus:**
- Detect `pointerType === 'pen'`; treat as high-precision pointer.
- Palm rejection: ignore concurrent `touch` pointers while a `pen` pointer is active for ~200 ms after last pen event.
- Snapping threshold tightened for pen (2 px vs 8 px on finger).
- Pressure captured in state (unused today, wired for future draw tools).

**Drag vs pan disambiguation (critical UX rule):**
- If one-finger pointerdown hits a **selected** object → drag object.
- If one-finger pointerdown hits **empty canvas** → pan.
- If pointerdown hits **unselected** object → select on down, drag on move (>4 px threshold), tap-to-select if no movement.
- Two fingers → **always** pan/zoom, regardless of what's underneath. Cancels any in-progress single-finger drag.

**Field Mode vs Edit Mode toggle (top-level app mode, persisted per-user in `user_org_prefs`):**

- **Field Mode** — read-mostly, phone/tablet in the field:
  - Booth search, assign vendor, check-in vendor, payment status, booth notes, booth photos, directions.
  - Advanced tools (create/delete/trace/AI import/layers/relationships/template editing) hidden.
  - Default mode on phone.
- **Edit Mode** — full designer:
  - All Phase 1–5 tools available.
  - Default mode on tablet + desktop.
- Toggle in top-right; mode persists across devices via existing prefs table.

**Device continuity:**
- Single canonical data model already lives in Supabase (`layout_templates`, `layout_template_booths`, `layout_template_objects`, `venue_map_references`, `layout_template_relationships`).
- No local-only state that would break cross-device editing; all edits go through server functions on save.
- Autosave debounce (2 s) and explicit Save button both write the same payload — desktop → tablet → phone flow "just works" on reload.

### 6.11 Files touched / added

- `src/routes/_authenticated/studio.booths.tsx` — swap input layer, wire chrome + mode gate.
- `src/components/booth-builder/canvas/` — new: `CanvasStage.tsx`, `useCanvasInput.ts`, `useSelection.ts`, `useHistory.ts`, `useDeviceClass.ts`, `useAppMode.ts`, `hitTest.ts`, `snapping.ts`, `palmRejection.ts`.
- `src/components/booth-builder/chrome/` — new: `Toolbar.desktop.tsx`, `Toolbar.floating.tsx`, `Toolbar.fab.tsx`, `PropertyPanel.docked.tsx`, `PropertyPanel.sheet.tsx`, `PropertyPanel.drawer.tsx`, `LayersPanel.tsx`, `ModeSwitch.tsx`, `CanvasContextMenu.tsx`.
- `src/components/booth-builder/field/` — new: `FieldModeShell.tsx`, `BoothSearchSheet.tsx`, `AssignVendorSheet.tsx`, `CheckInSheet.tsx`, `PaymentStatusSheet.tsx`, `BoothPhotosSheet.tsx`, `DirectionsSheet.tsx`.
- `package.json` — add `@use-gesture/react`, `zustand`, `vaul`.

### Non-goals

- No offline / PWA / local sync (future).
- No native app.
- No schema, server function, RLS, or vendor-table changes.
- No new AI features beyond exposing existing Assist through FAB.

### Rollout

1. 6.1 pointer input + 6.3 targets + 6.4 chrome + 6.9 shared context menu — usable on tablet/phone.
2. 6.2 selection + 6.10 stylus/palm/drag-vs-pan + Field/Edit mode toggle.
3. 6.5 phone flows / Field Mode sheets.
4. 6.6 snap polish, 6.7 perf, 6.8 undo-redo.

Each sub-step ships independently and typechecks clean.