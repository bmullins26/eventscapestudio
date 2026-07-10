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
