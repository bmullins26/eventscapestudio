## Problem

The managed Google Maps connector key isn't authorized for the **Maps Static API** — that's what the 403 is telling us. The connector's supported sub-APIs (see the `google_maps` knowledge) list Geocoding, Places, Routes, Air Quality, Weather, etc., but **not** Static Maps. Geocoding works; Static Maps doesn't, and we can't enable it on the managed key.

## Fix: use the Map Tiles API through the gateway

Google's **Map Tiles API** (`tiles.googleapis.com`) is designed exactly for this — it serves 256×256 satellite raster tiles that we stitch server-side into one PNG, giving the same result as Static Maps.

We already have the gateway credentials and Geocoding works. The Map Tiles API is a standard Maps Platform API that the managed connection supports — we just need to add a `tiles/` prefix route (same pattern as `places/`, `routes/`, `airquality/` in the connector knowledge). If the prefix isn't recognized by the gateway, the fallback is to ask the user to add a Static Maps-authorized custom Google Maps connection (the same flow the connector knowledge documents for custom domains).

## Changes

**`src/lib/venue-designer.functions.ts` — `fetchSatelliteBackground`**

1. Keep geocoding via `${GATEWAY}/maps/api/geocode/json` (already working).
2. Replace the single Static Maps call with a tile-stitching step:
   - Choose zoom `z = 19` and compute the center tile from `(lat, lng)` using standard Web Mercator tile math.
   - Fetch a 5×5 grid of 256px tiles (1280×1280 final image, same coverage as before) from:
     ```
     ${GATEWAY}/tiles/v1/2dtiles/{z}/{x}/{y}?session=<session>&mapType=satellite
     ```
     First call `POST ${GATEWAY}/tiles/v1/createSession` with `{ mapType: "satellite", language: "en-US", region: "US" }` to get a session token (required by the Tiles API).
   - Stitch tiles into one PNG server-side. **Constraint:** no `sharp`/`canvas` in the Worker runtime (per `server-runtime` knowledge). Use the pure-JS `upng-js` + `pako` combo, or simpler: use `@napi-rs/canvas`? No — native. Use `pngjs` (pure JS) to decode each tile and re-encode the stitched buffer. `pngjs` is pure JS and Worker-safe.
3. Compute real-world size the same way (meters/pixel at latitude & zoom × 1280 px), so calibration stays automatic.
4. Upload the stitched PNG to `venue-assets` exactly as today.

**Dependency add:** `pngjs` (pure JS, Worker-compatible).

**Error handling:** if the `tiles/` prefix returns 404/403 from the gateway (meaning the managed connection doesn't cover Map Tiles either), surface a clear message telling the user to connect a custom Google Maps key with Map Tiles API + Static Maps API enabled — same custom-connection flow described in the connector knowledge.

## Out of scope

- No UI/inspector changes; the "Add satellite from address" button and calibration flow stay identical.
- No changes to `background.ts`, canvas, or types — the return shape (`url`, `widthFeet`, `heightFeet`, `meta`) is unchanged.

## Technical notes

- Web Mercator tile math:
  ```
  n = 2^z
  xtile = ((lng + 180) / 360) * n
  ytile = (1 - ln(tan(lat_rad) + sec(lat_rad)) / π) / 2 * n
  ```
- Ground coverage of the stitched image: `1280 * (156543.03392 * cos(lat)) / 2^z` meters — identical to the current Static Maps `size=640, scale=2` math, so calibration keeps working.
- Tiles API session tokens are valid for ~2 weeks; we mint a fresh one per request for simplicity (single extra POST, ~50ms).