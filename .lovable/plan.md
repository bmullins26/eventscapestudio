## Plan

1. **Remove the hidden SDK template from the canvas chrome**
   - Replace `CanvasChrome` with a blank workspace chrome that renders only:
     - workspace background color
     - optional grid/dot grid
     - rulers / measurement guides if currently present or add non-object rulers
   - Remove all hardcoded visual venue objects currently drawn by `CanvasChrome`: parking lots, stage, registration, info booth, main aisle, asphalt road, trees, border-as-venue-outline, and row labels.

2. **Make SDK mode explicit**
   - Add a clear SDK mode field such as `workspaceMode: "blank" | "example"`.
   - Default must be `"blank"` when no mode is passed.
   - Production designer route will pass/use blank mode and will never create or render implicit venue objects.
   - Developer example routes will pass example mode only when an example is explicitly opened.

3. **Move any retained template visuals into Developer Examples only**
   - If the old stage/parking/registration/aisle/tree layout needs to remain for reference, convert it into explicit `DEMO_EXAMPLES` data objects.
   - Keep production imports clean: production designer must not import demo/example data and must not depend on any fallback template.

4. **Tighten blank initialization contract**
   - Keep `ctx.booths ?? []`, `ctx.objects ?? []`, `ctx.layers ?? []`, and `initialBackground ?? null` behavior.
   - Ensure `fromLayout([], settings)` returns zero booths, zero objects, and only a background when one was explicitly saved in settings.
   - Ensure no localStorage fallback can create production objects; background localStorage remains only for non-persistence/demo usage.

5. **Acceptance verification**
   - Verify the production venue designer with empty persisted layout renders:
     - object count `0`
     - booth count `0`
     - layers panel says no layers / empty layers
     - canvas shows only blank background + grid/rulers
     - no Stage, Parking, Registration, Info Booth, Main Aisle, Roads, Trees, Borders, Labels, Food Court, or decorative objects
   - Verify Developer Examples still show explicit example objects only when navigating to the examples area.

## Verified current source of the issue

- The production route already passes `booths`, `objects`, `initialBackground`, and `layers: []` from the adapter.
- The SDK state already initializes empty from `ctx?.booths ?? []` and `ctx?.objects ?? []`.
- The remaining automatic visuals are hardcoded in `CanvasChrome`, which is rendered unconditionally before persisted objects/background.