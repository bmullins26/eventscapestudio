import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VenueIdInput = z.object({ venueId: z.string().uuid() });

// Element shapes are validated loosely: the client is the source of truth.
const ElementSchema = z.record(z.string(), z.any());
const SaveLayoutInput = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1).max(200),
  settings: z.record(z.string(), z.any()).default({}),
  elements: z.array(ElementSchema),
});

const FetchSatelliteInput = z.object({
  venueId: z.string().uuid(),
  address: z.string().min(2).max(500),
});

/**
 * Geocode an address via Google, fetch a Static Maps satellite image, upload
 * it to venue-assets, and return a BackgroundLayer ready for the designer.
 * Requires GOOGLE_MAPS_API_KEY (server-side secret).
 */
export const fetchSatelliteBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FetchSatelliteInput.parse(d))
  .handler(async ({ data, context }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !connKey) throw new Error("Google Maps connector is not configured.");
    const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
    const gwHeaders = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
    };

    const { supabase, userId } = context;

    // Authz: the caller must be a member of the venue's organization.
    const { data: venue, error: vErr } = await supabase
      .from("venues")
      .select("id, organization_id")
      .eq("id", data.venueId)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!venue) throw new Error("Venue not found");

    const { data: isMember } = await supabase.rpc("is_org_member", {
      _user_id: userId,
      _org_id: venue.organization_id,
    });
    if (!isMember) throw new Error("Forbidden");

    // Geocode via connector gateway
    const geoRes = await fetch(
      `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`,
      { headers: gwHeaders },
    );
    if (!geoRes.ok) throw new Error(`Geocoding failed (${geoRes.status})`);
    const geoJson = (await geoRes.json()) as {
      status: string;
      error_message?: string;
      results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>;
    };
    if (geoJson.status !== "OK" || !geoJson.results.length) {
      const detail = geoJson.error_message ? `: ${geoJson.error_message}` : "";
      if (geoJson.status === "ZERO_RESULTS") {
        throw new Error(`No match for "${data.address}". Try a more specific address (street, city, state).`);
      }
      if (geoJson.status === "REQUEST_DENIED") {
        throw new Error(`Google denied the request${detail}. Enable the Geocoding API on the API key, and check key restrictions.`);
      }
      if (geoJson.status === "OVER_QUERY_LIMIT" || geoJson.status === "OVER_DAILY_LIMIT") {
        throw new Error(`Google API quota exceeded${detail}. Enable billing on the Google Cloud project.`);
      }
      throw new Error(`Geocoding failed (${geoJson.status})${detail}`);
    }
    const { lat, lng } = geoJson.results[0].geometry.location;
    const formatted = geoJson.results[0].formatted_address;

    // Compute the ground area covered by a 1024×1024 CSS-pixel Google Map
    // rendered at the chosen zoom, at this latitude, using Web Mercator.
    // meters/pixel at latitude & zoom: (156543.03392 * cos(lat)) / 2^zoom
    // The client renders the map at exactly this native size (1024×1024)
    // so the returned widthFeet/heightFeet cover the same ground area, and
    // CSS transforms handle any further visual scaling without reloading tiles.
    const zoom = 19;
    const mapPixelSize = 1024;
    const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
    const meters = mapPixelSize * mpp;
    const feet = meters * 3.28084;

    return {
      // No uploaded image — the client renders live Google Maps satellite tiles
      // using the browser key. `url` is kept empty for shape compatibility.
      url: "",
      widthFeet: feet,
      heightFeet: feet,
      meta: { lat, lng, zoom, address: formatted, mapPixelSize },
    };
  });

export const getVenueLayout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VenueIdInput.parse(d))
  .handler(async ({ data, context }): Promise<any> => {
    const { supabase } = context;
    const { data: venue, error: vErr } = await supabase
      .from("venues")
      .select("id, name, organization_id")
      .eq("id", data.venueId)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!venue) throw new Error("Venue not found");

    const { data: layout } = await (supabase.from("venue_layouts" as never) as any)
      .select("id, name, settings, elements, updated_at")
      .eq("venue_id", data.venueId)
      .maybeSingle();

    return {
      venue,
      layout: layout
        ? {
            id: layout.id,
            name: layout.name as string,
            settings: (layout.settings ?? {}) as Record<string, unknown>,
            elements: (layout.elements ?? []) as Array<Record<string, unknown>>,
            updated_at: layout.updated_at as string,
          }
        : null,
    };
  });

export const saveVenueLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveLayoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const row = {
      venue_id: data.venueId,
      name: data.name,
      settings: data.settings,
      elements: data.elements,
    };
    const { data: saved, error } = await (supabase.from("venue_layouts" as never) as any)
      .upsert(row, { onConflict: "venue_id" })
      .select("id, updated_at")
      .single();
    if (error) throw error;
    return { id: saved.id as string, updated_at: saved.updated_at as string };
  });

// Kept for other routes that reference these — snapshots and templates now
// operate on the venue_layouts table.

export const listVenueTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VenueIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase
      .from("venue_templates" as never) as any)
      .select("id, venue_id, version, label, description, published_at, created_at, created_by")
      .eq("venue_id", data.venueId)
      .order("version", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as Array<Record<string, any>>;
  });

const CreateSnapshotInput = z.object({
  eventId: z.string().uuid(),
  venueId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  label: z.string().optional(),
});

export const createEventVenueSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSnapshotInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let model: any;
    if (data.templateId) {
      const { data: tpl } = await (supabase.from("venue_templates" as never) as any)
        .select("model")
        .eq("id", data.templateId)
        .maybeSingle();
      if (!tpl) throw new Error("Template not found");
      model = tpl.model;
    } else {
      const { data: layout } = await (supabase.from("venue_layouts" as never) as any)
        .select("name, settings, elements")
        .eq("venue_id", data.venueId)
        .maybeSingle();
      model = { layout: layout ?? { name: "Untitled layout", settings: {}, elements: [] } };
    }

    const { data: existing } = await (supabase.from("event_venue_snapshots" as never) as any)
      .select("id")
      .eq("event_id", data.eventId)
      .maybeSingle();

    if (existing) {
      const { error } = await (supabase.from("event_venue_snapshots" as never) as any)
        .update({
          venue_id: data.venueId,
          venue_template_id: data.templateId ?? null,
          label: data.label ?? null,
          model,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return { id: existing.id as string, updated: true };
    }

    const { data: inserted, error } = await (supabase.from("event_venue_snapshots" as never) as any)
      .insert({
        event_id: data.eventId,
        venue_id: data.venueId,
        venue_template_id: data.templateId ?? null,
        label: data.label ?? null,
        model,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserted.id as string, updated: false };
  });

export const getEventVenueSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase
      .from("event_venue_snapshots" as never) as any)
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (error) throw error;
    return (row ?? null) as Record<string, any> | null;
  });

/* -------------------------------------------------------------------------
 * Phase 1 — Event booth materialization
 *
 * `snapshotVenueForEvent` takes a venue's layout, copies it into the event's
 * snapshot model, and upserts one `event_booths` row per booth element,
 * keyed by `event_object_id = element.objectId`. This is the durable link
 * that carries live status (reservations, applications, payments, check-in)
 * back to the geometry on the canvas.
 *
 * Idempotent: re-running against the same event reuses existing rows via
 * ON CONFLICT (event_id, event_object_id).
 * ---------------------------------------------------------------------- */

const SnapshotForEventInput = z.object({
  eventId: z.string().uuid(),
});

export const snapshotVenueForEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SnapshotForEventInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load the event → resolve its venue.
    const { data: eventRow, error: eErr } = await supabase
      .from("events")
      .select("id, venue_id, organization_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!eventRow) throw new Error("Event not found");
    if (!eventRow.venue_id) throw new Error("Event has no venue linked");

    // Authz: caller must be a member of the event's organization.
    const { data: isMember } = await supabase.rpc("is_org_member", {
      _user_id: userId,
      _org_id: eventRow.organization_id,
    });
    if (!isMember) throw new Error("Forbidden");

    // Load the venue's live layout.
    const { data: layout } = await (supabase.from("venue_layouts" as never) as any)
      .select("name, settings, elements")
      .eq("venue_id", eventRow.venue_id)
      .maybeSingle();

    const elements = (layout?.elements ?? []) as Array<Record<string, unknown>>;

    // Extract booth elements — the only kind that materializes into event_booths.
    const boothElements = elements.filter((el) => el.kind === "booth");

    // Upsert one event_booths row per booth element.
    let inserted = 0;
    let updated = 0;
    for (const el of boothElements) {
      const objectId = (el.objectId as string | undefined) ?? null;
      if (!objectId) continue; // legacy row missing id; layout load would normally backfill

      const label = (el.label as string | undefined) ?? "";
      const price = (el.price as number | undefined) ?? null;
      const category = (el.category as string | undefined) ?? null;
      const isElectric = Boolean(el.isElectric);
      const isWater = Boolean(el.isWater);
      const isPremium = Boolean(el.isPremium);
      const isCorner = Boolean(el.isCorner);

      // See if the row already exists.
      const { data: existing } = await (supabase.from("event_booths" as never) as any)
        .select("id")
        .eq("event_id", data.eventId)
        .eq("event_object_id", objectId)
        .maybeSingle();

      const geometry = {
        x: Number(el.x) || 0,
        y: Number(el.y) || 0,
        width: Number(el.w) || 0,
        height: Number(el.h) || 0,
        rotation: Number(el.rotation) || 0,
      };

      if (existing) {
        const { error: uErr } = await (supabase.from("event_booths" as never) as any)
          .update({
            code: label,
            price,
            category,
            is_electric: isElectric,
            is_water: isWater,
            is_premium: isPremium,
            is_corner: isCorner,
            ...geometry,
          })
          .eq("id", existing.id);
        if (uErr) throw uErr;
        updated += 1;
      } else {
        const { error: iErr } = await (supabase.from("event_booths" as never) as any)
          .insert({
            event_id: data.eventId,
            event_object_id: objectId,
            code: label,
            price,
            category,
            is_electric: isElectric,
            is_water: isWater,
            is_premium: isPremium,
            is_corner: isCorner,
            ...geometry,
          });
        if (iErr) throw iErr;
        inserted += 1;
      }
    }

    return {
      eventId: data.eventId,
      booths: boothElements.length,
      inserted,
      updated,
    };
  });
