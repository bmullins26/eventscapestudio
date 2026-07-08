import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CloneInput = z.object({
  sourceEventId: z.string().uuid(),
  newName: z.string().min(1).max(200),
  newStartsAt: z.string().optional(),
  newEndsAt: z.string().optional(),
  asTemplate: z.boolean().optional(),
});

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "event";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Clone an existing event (or template) into a new draft event within the
 * same organization. Copies event_booths (unassigned) — applications,
 * payments, and messages are intentionally NOT copied.
 */
export const cloneEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CloneInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: source, error: srcErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.sourceEventId)
      .maybeSingle();
    if (srcErr) throw srcErr;
    if (!source) throw new Error("Source event not found");

    const { data: canWrite, error: permErr } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _org_id: source.organization_id,
      _permission: "events.write",
    });
    if (permErr) throw permErr;
    if (!canWrite) throw new Error("Not authorized to clone events in this organization");

    const asTemplate = data.asTemplate ?? false;

    const { data: created, error: insErr } = await supabase
      .from("events")
      .insert({
        organization_id: source.organization_id,
        venue_id: source.venue_id,
        layout_template_id: source.layout_template_id,
        name: data.newName,
        slug: slugify(data.newName),
        description: source.description,
        status: "draft",
        is_template: asTemplate,
        is_public: false,
        applications_open: false,
        cloned_from_event_id: source.id,
        template_source_id: source.id,
        starts_at: data.newStartsAt ?? source.starts_at,
        ends_at: data.newEndsAt ?? source.ends_at,
        setup_start: source.setup_start,
        setup_end: source.setup_end,
        cover_image_url: source.cover_image_url,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const { data: booths } = await supabase
      .from("event_booths")
      .select("code, x, y, width, height, rotation, category, size_label, price, notes, template_booth_id")
      .eq("event_id", source.id);

    if (booths && booths.length > 0) {
      const boothRows = booths.map((b) => ({
        event_id: created.id,
        code: b.code,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        rotation: b.rotation,
        category: b.category,
        size_label: b.size_label,
        price: b.price,
        notes: b.notes,
        template_booth_id: b.template_booth_id,
        status: "available" as const,
        assigned_application_id: null,
      }));
      const { error: boothErr } = await supabase.from("event_booths").insert(boothRows);
      if (boothErr) throw boothErr;
    }

    return { id: created.id };
  });
