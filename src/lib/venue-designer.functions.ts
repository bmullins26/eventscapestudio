import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VenueIdInput = z.object({ venueId: z.string().uuid() });

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
    return {
      venue,
      layers: layers ?? [],
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
    const { error } = await (context.supabase.from("venues") as any)
      .update(patch)
      .eq("id", venueId);
    if (error) throw error;
    return { ok: true };
  });
