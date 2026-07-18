/* -------------------------------------------------------------------------
 * Workspace SDK server functions.
 *
 * Powers the new /studio/events/$eventId/workspace-sdk route. Reads the live
 * event snapshot (venue, layers, booths + vendor/application/payment) plus
 * any workspace_objects (unified geometry) drawn on the event canvas.
 * ---------------------------------------------------------------------- */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EventIdInput = z.object({ eventId: z.string().uuid() });

export const getEventWorkspaceSdk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventIdInput.parse(d))
  .handler(async ({ data, context }): Promise<any> => {
    const { supabase } = context;

    const { data: event, error: eErr } = await supabase
      .from("events")
      .select("id, name, organization_id, venue_id, starts_at, ends_at, is_public, status")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!event) throw new Error("Event not found");

    let venue: { id: string; name: string; organization_id: string } | null = null;
    let layers: Array<any> = [];
    let workspaceObjects: Array<any> = [];

    if (event.venue_id) {
      const { data: v } = await supabase
        .from("venues")
        .select("id, name, organization_id")
        .eq("id", event.venue_id)
        .maybeSingle();
      venue = v ?? null;

      const { data: ls } = await (supabase.from("venue_layers" as never) as any)
        .select("id, venue_id, name, color, visible, locked, sort_order, kind")
        .eq("venue_id", event.venue_id)
        .order("sort_order", { ascending: true });
      layers = (ls ?? []) as Array<any>;

      const { data: objs } = await (supabase.from("workspace_objects" as never) as any)
        .select("id, venue_id, event_id, layer_id, event_booth_id, kind, geometry, props, z_index, locked, visible, created_at, updated_at")
        .eq("venue_id", event.venue_id)
        .or(`event_id.is.null,event_id.eq.${data.eventId}`);
      workspaceObjects = (objs ?? []) as Array<any>;
    }

    const { data: booths } = await (supabase.from("event_booths" as never) as any)
      .select(`
        id, event_id, event_object_id, code, price, category, status, notes,
        is_electric, is_water, is_premium, is_corner, is_reserved,
        vendor_profile_id, assigned_application_id,
        checked_in_at, checked_out_at, staff_notes, vendor_notes,
        x_ft, y_ft, w_ft, h_ft, size_label,
        vendor_profiles:vendor_profile_id(id, business_name, contact_name, email, phone)
      `)
      .eq("event_id", data.eventId);

    const { data: applications } = await supabase
      .from("applications")
      .select("id, event_id, vendor_profile_id, status, category, business_name, contact_name, applicant_email, assigned_booth_id")
      .eq("event_id", data.eventId);

    const { data: payments } = await supabase
      .from("payments")
      .select("id, event_id, application_id, amount, status, paid_at")
      .eq("event_id", data.eventId);

    return {
      event, venue,
      layers,
      workspaceObjects,
      booths: (booths ?? []) as Array<any>,
      applications: (applications ?? []) as Array<any>,
      payments: (payments ?? []) as Array<any>,
    };
  });

/* --------------------------- Workspace objects --------------------------- */

const GeometryZ = z.object({
  x: z.number(), y: z.number(),
  w: z.number().optional(), h: z.number().optional(),
  rotation: z.number().optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
}).passthrough();

const UpsertObjectInput = z.object({
  id: z.string().uuid().optional(),
  venue_id: z.string().uuid(),
  event_id: z.string().uuid().nullable().optional(),
  layer_id: z.string().uuid().nullable().optional(),
  event_booth_id: z.string().uuid().nullable().optional(),
  kind: z.string(),
  geometry: GeometryZ,
  props: z.record(z.any()).optional(),
  z_index: z.number().optional(),
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
});

export const upsertWorkspaceObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertObjectInput.parse(d))
  .handler(async ({ data, context }): Promise<any> => {
    const table = (context.supabase.from("workspace_objects" as never) as any);
    const payload: Record<string, unknown> = {
      venue_id: data.venue_id,
      event_id: data.event_id ?? null,
      layer_id: data.layer_id ?? null,
      event_booth_id: data.event_booth_id ?? null,
      kind: data.kind,
      geometry: data.geometry,
      props: data.props ?? {},
    };
    if (data.z_index !== undefined) payload.z_index = data.z_index;
    if (data.locked !== undefined) payload.locked = data.locked;
    if (data.visible !== undefined) payload.visible = data.visible;

    if (data.id) {
      const { data: row, error } = await table.update(payload).eq("id", data.id).select().maybeSingle();
      if (error) throw error;
      return row;
    }
    payload.created_by = context.userId;
    const { data: row, error } = await table.insert(payload).select().maybeSingle();
    if (error) throw error;
    return row;
  });

export const deleteWorkspaceObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("workspace_objects" as never) as any).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* --------------------------- Event booth writes --------------------------- */

const PatchBoothInput = z.object({
  id: z.string().uuid(),
  price: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  is_electric: z.boolean().optional(),
  is_water: z.boolean().optional(),
  is_premium: z.boolean().optional(),
  is_corner: z.boolean().optional(),
  is_reserved: z.boolean().optional(),
  staff_notes: z.string().nullable().optional(),
  vendor_notes: z.string().nullable().optional(),
  status: z.enum(["available", "held", "assigned", "occupied", "blocked"]).optional(),
});

export const patchEventBooth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PatchBoothInput.parse(d))
  .handler(async ({ data, context }): Promise<any> => {
    const { id, ...patch } = data;
    const { data: row, error } = await (context.supabase.from("event_booths" as never) as any)
      .update(patch).eq("id", id).select().maybeSingle();
    if (error) throw error;
    return row;
  });

/* ------------------------------- Layers --------------------------------- */

const LayerPatch = z.object({
  id: z.string().uuid(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  name: z.string().optional(),
  color: z.string().optional(),
});

export const patchVenueLayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LayerPatch.parse(d))
  .handler(async ({ data, context }): Promise<any> => {
    const { id, ...patch } = data;
    const { data: row, error } = await (context.supabase.from("venue_layers" as never) as any)
      .update(patch).eq("id", id).select().maybeSingle();
    if (error) throw error;
    return row;
  });
