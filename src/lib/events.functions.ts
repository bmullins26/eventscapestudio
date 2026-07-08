import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CloneInput = z.object({
  sourceEventId: z.string().uuid(),
  newName: z.string().min(1).max(200),
  newStartDate: z.string().optional(),
  newEndDate: z.string().optional(),
  asTemplate: z.boolean().optional(),
});

/**
 * Clone an existing event (or template) into a new draft event within the
 * same organization. Copies event_booths (unassigned) and event-scoped
 * documents. Does NOT copy applications, payments, or messages.
 */
export const cloneEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CloneInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load the source event and verify org access
    const { data: source, error: srcErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.sourceEventId)
      .maybeSingle();
    if (srcErr) throw srcErr;
    if (!source) throw new Error("Source event not found");

    // Permission check (has_permission covers owner + super_admin + granted perms)
    const { data: canWrite, error: permErr } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _org_id: source.organization_id,
      _permission: "events.write",
    });
    if (permErr) throw permErr;
    if (!canWrite) throw new Error("Not authorized to clone events in this organization");

    // Build the new event row (copy meaningful fields, reset volatile ones)
    const asTemplate = data.asTemplate ?? false;
    const newRow: Record<string, unknown> = {
      organization_id: source.organization_id,
      venue_id: source.venue_id,
      layout_template_id: source.layout_template_id,
      name: data.newName,
      description: source.description,
      status: "draft",
      is_template: asTemplate,
      template_source_id: source.id,
      start_date: data.newStartDate ?? source.start_date,
      end_date: data.newEndDate ?? source.end_date,
      setup_starts_at: source.setup_starts_at,
      setup_ends_at: source.setup_ends_at,
      teardown_starts_at: source.teardown_starts_at,
      teardown_ends_at: source.teardown_ends_at,
      timezone: source.timezone,
      currency: source.currency,
      vendor_categories: source.vendor_categories,
      created_by: userId,
    };

    const { data: created, error: insErr } = await supabase
      .from("events")
      .insert(newRow)
      .select("id")
      .single();
    if (insErr) throw insErr;

    // Copy booths (unassigned)
    const { data: booths } = await supabase
      .from("event_booths")
      .select("*")
      .eq("event_id", source.id);
    if (booths && booths.length > 0) {
      const boothRows = booths.map((b) => {
        const { id: _id, event_id: _eid, vendor_id: _vid, assigned_at: _aa, ...rest } = b as Record<string, unknown>;
        void _id; void _eid; void _vid; void _aa;
        return { ...rest, event_id: created.id, vendor_id: null, assigned_at: null };
      });
      await supabase.from("event_booths").insert(boothRows);
    }

    return { id: created.id };
  });
