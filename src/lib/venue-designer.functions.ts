import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VenueIdInput = z.object({ venueId: z.string().uuid() });

const OBJECT_TYPES = [
  "booth","building","road","walkway","parking","utility","tree","fence","stage",
  "pavilion","food_court","beer_garden","restroom","table","bench","trash","sign",
  "sponsor_banner","registration","info","ticket","first_aid","atm","kids_area",
  "petting_zoo","custom",
] as const;
const SHAPES = ["rect","polygon","line","circle","text","path"] as const;
const LAYER_KINDS = ["reference","buildings","roads","utilities","booths","labels","custom"] as const;

export const getVenueDesign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VenueIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: venue, error: vErr }, { data: layers }, { data: objects }, { data: refs }] = await Promise.all([
      supabase.from("venues").select("*").eq("id", data.venueId).maybeSingle(),
      supabase.from("venue_layers" as never).select("*").eq("venue_id", data.venueId).order("order_index", { ascending: true }),
      supabase.from("venue_objects" as never).select("*").eq("venue_id", data.venueId),
      supabase.from("venue_references" as never).select("*").eq("venue_id", data.venueId),
    ]);
    if (vErr) throw vErr;
    if (!venue) throw new Error("Venue not found");

    // Auto-seed default layers on first open
    let layerList = layers ?? [];
    if (layerList.length === 0) {
      const defaults = [
        { name: "Reference", kind: "reference", order_index: 0 },
        { name: "Buildings", kind: "buildings", order_index: 1 },
        { name: "Roads & Paths", kind: "roads", order_index: 2 },
        { name: "Utilities", kind: "utilities", order_index: 3 },
        { name: "Booths", kind: "booths", order_index: 4 },
        { name: "Labels", kind: "labels", order_index: 5 },
      ].map((l) => ({ ...l, venue_id: data.venueId }));
      const { data: inserted } = await (supabase.from("venue_layers" as never) as any)
        .insert(defaults).select();
      layerList = inserted ?? [];
    }

    return {
      venue,
      layers: layerList,
      objects: objects ?? [],
      references: refs ?? [],
    };
  });

const UpdateVenueCanvasInput = z.object({
  venueId: z.string().uuid(),
  canvas_width: z.number().positive().optional(),
  canvas_height: z.number().positive().optional(),
  units: z.enum(["feet", "meters"]).optional(),
  default_view: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});

export const updateVenueCanvas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateVenueCanvasInput.parse(d))
  .handler(async ({ data, context }) => {
    const { venueId, ...patch } = data;
    const { error } = await (context.supabase.from("venues") as any).update(patch).eq("id", venueId);
    if (error) throw error;
    return { ok: true };
  });

const CreateObjectInput = z.object({
  venueId: z.string().uuid(),
  layer_id: z.string().uuid().nullable().optional(),
  type: z.enum(OBJECT_TYPES),
  shape: z.enum(SHAPES),
  name: z.string().optional(),
  geometry: z.record(z.string(), z.any()),
  style: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const createVenueObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateObjectInput.parse(d))
  .handler(async ({ data, context }) => {
    const { venueId, ...row } = data;
    const { data: obj, error } = await (context.supabase.from("venue_objects" as never) as any)
      .insert({ venue_id: venueId, ...row })
      .select()
      .single();
    if (error) throw error;
    return obj;
  });

const UpdateObjectInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().optional(),
    layer_id: z.string().uuid().nullable().optional(),
    geometry: z.record(z.string(), z.any()).optional(),
    style: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    locked: z.boolean().optional(),
    hidden: z.boolean().optional(),
    z_index: z.number().int().optional(),
  }),
});

export const updateVenueObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateObjectInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("venue_objects" as never) as any)
      .update(data.patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteVenueObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("venue_objects" as never) as any).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const CreateLayerInput = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1),
  kind: z.enum(LAYER_KINDS).default("custom"),
  order_index: z.number().int().optional(),
});

export const createVenueLayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateLayerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { venueId, ...row } = data;
    const { data: layer, error } = await (context.supabase.from("venue_layers" as never) as any)
      .insert({ venue_id: venueId, ...row }).select().single();
    if (error) throw error;
    return layer;
  });

const UpdateLayerInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    order_index: z.number().int().optional(),
  }),
});

export const updateVenueLayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateLayerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("venue_layers" as never) as any)
      .update(data.patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteVenueLayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("venue_layers" as never) as any).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
