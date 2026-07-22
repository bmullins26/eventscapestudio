/* -------------------------------------------------------------------------
 * Workspace background: geocode an address and return a Static Maps satellite
 * image as a base64 data URL, plus the world-space size in feet so the
 * canvas can drop it in at the right scale. No venueId required — usable
 * from the standalone workspace preview and the event-scoped workspace.
 * ---------------------------------------------------------------------- */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ address: z.string().min(2).max(500) });

export const fetchSatelliteImageForWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{
    dataUrl: string; widthFeet: number; heightFeet: number; address: string;
    lat: number; lng: number; zoom: number;
  }> => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !connKey) throw new Error("Google Maps connector is not configured.");
    const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
    const gwHeaders = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
    };

    // 1. Geocode
    const geoRes = await fetch(
      `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`,
      { headers: gwHeaders },
    );
    if (!geoRes.ok) throw new Error(`Geocoding failed (${geoRes.status})`);
    const geoJson = (await geoRes.json()) as {
      status: string; error_message?: string;
      results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>;
    };
    if (geoJson.status !== "OK" || !geoJson.results.length) {
      const detail = geoJson.error_message ? `: ${geoJson.error_message}` : "";
      throw new Error(`Geocoding failed (${geoJson.status})${detail}`);
    }
    const { lat, lng } = geoJson.results[0].geometry.location;
    const address = geoJson.results[0].formatted_address;

    // 2. Static satellite image (640x640 @ scale=2 → 1280x1280 effective)
    const zoom = 19;
    const size = 640;
    const scale = 2;
    const mapRes = await fetch(
      `${GATEWAY}/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}x${size}&scale=${scale}&maptype=satellite`,
      { headers: gwHeaders },
    );
    if (!mapRes.ok) {
      const body = await mapRes.text();
      throw new Error(`Static Maps failed (${mapRes.status}): ${body.slice(0, 200)}`);
    }
    const buf = new Uint8Array(await mapRes.arrayBuffer());
    // Base64 encode without Node Buffer (Worker-safe)
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const dataUrl = `data:image/png;base64,${b64}`;

    // 3. Ground size at this latitude / zoom (Web Mercator).
    const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
    const effectivePx = size * scale;
    const feet = effectivePx * mpp * 3.28084;

    return { dataUrl, widthFeet: feet, heightFeet: feet, address, lat, lng, zoom };
  });
