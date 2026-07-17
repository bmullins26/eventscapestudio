/* -------------------------------------------------------------------------
 * Event Workspace server functions (Phase 3+4)
 *
 * These functions power the workspace when it's opened in **event mode** —
 * i.e. `/studio/events/$eventId/workspace`. They read/write the event's
 * live operational state (event_booths + reservations + applications +
 * payments + activity) alongside the frozen event snapshot geometry.
 *
 * All fns run as the caller under RLS via `requireSupabaseAuth`. No admin
 * client. No public API surface.
 * ---------------------------------------------------------------------- */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EventIdInput = z.object({ eventId: z.string().uuid() });

/**
 * Returns everything the workspace needs to render event mode in a single
 * round-trip: the event, its venue + live layout elements (source of truth
 * for geometry until Phase 9's live snapshot editor lands), and every
 * `event_booths` row joined with vendor/application/payment/reservation
 * data. Keyed downstream by `event_object_id` so the canvas can look up
 * live state per booth object without further queries.
 */
export const getEventWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: event, error: eErr } = await supabase
      .from("events")
      .select("id, name, organization_id, venue_id, start_date, end_date, is_public")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!event) throw new Error("Event not found");

    // Venue + live layout — geometry source of truth in event mode until
    // Phase 9 introduces per-event geometry editing. Booth objects are keyed
    // by their persistent objectId in the layout.
    let venue: { id: string; name: string; organization_id: string } | null = null;
    let layoutElements: Array<Record<string, unknown>> = [];
    let layoutBackground: Record<string, unknown> | null = null;
    let layoutName = event.name ?? "Event";
    if (event.venue_id) {
      const { data: v } = await supabase
        .from("venues")
        .select("id, name, organization_id")
        .eq("id", event.venue_id)
        .maybeSingle();
      venue = v ?? null;
      const { data: layout } = await (supabase.from("venue_layouts" as never) as any)
        .select("name, settings, elements")
        .eq("venue_id", event.venue_id)
        .maybeSingle();
      layoutName = (layout?.name as string | undefined) ?? layoutName;
      layoutElements = (layout?.elements ?? []) as Array<Record<string, unknown>>;
      const settings = (layout?.settings ?? {}) as Record<string, unknown>;
      layoutBackground = (settings.background ?? null) as Record<string, unknown> | null;
    }

    // Event booths + linked vendor.
    const { data: booths } = await (supabase.from("event_booths" as never) as any)
      .select(`
        id, event_id, event_object_id, code, price, category, status, notes,
        is_electric, is_water, is_premium, is_corner, is_reserved,
        vendor_profile_id, assigned_application_id,
        checked_in_at, checked_out_at, staff_notes, vendor_notes,
        vendor_profiles:vendor_profile_id(id, business_name, contact_name, email, phone)
      `)
      .eq("event_id", data.eventId);

    // Applications for this event.
    const { data: applications } = await supabase
      .from("applications")
      .select("id, event_id, vendor_profile_id, status, category, size_requested, needs_electricity, business_name, contact_name, applicant_email, applied_at, decided_at, assigned_booth_id, payment_amount")
      .eq("event_id", data.eventId);

    // Payments for this event.
    const { data: payments } = await supabase
      .from("payments")
      .select("id, event_id, application_id, vendor_profile_id, amount, status, method, paid_at, created_at")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false });

    // Reservations.
    const { data: reservations } = await (supabase.from("event_booth_reservations" as never) as any)
      .select("id, event_id, booth_element_id, vendor_profile_id, status, reserved_at, created_at")
      .eq("event_id", data.eventId);

    return {
      event,
      venue,
      layout: {
        name: layoutName,
        elements: layoutElements,
        background: layoutBackground,
      },
      booths: (booths ?? []) as Array<Record<string, any>>,
      applications: (applications ?? []) as Array<Record<string, any>>,
      payments: (payments ?? []) as Array<Record<string, any>>,
      reservations: (reservations ?? []) as Array<Record<string, any>>,
    };
  });

/* ------------------------------ Mutations ------------------------------ */

const CheckInInput = z.object({ eventBoothId: z.string().uuid() });

export const checkInBooth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CheckInInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("event_booths" as never) as any)
      .update({ checked_in_at: new Date().toISOString(), checked_out_at: null })
      .eq("id", data.eventBoothId);
    if (error) throw error;
    return { ok: true };
  });

export const checkOutBooth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CheckInInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("event_booths" as never) as any)
      .update({ checked_out_at: new Date().toISOString() })
      .eq("id", data.eventBoothId);
    if (error) throw error;
    return { ok: true };
  });

const UpdateBoothOpsInput = z.object({
  eventBoothId: z.string().uuid(),
  staff_notes: z.string().nullable().optional(),
  vendor_notes: z.string().nullable().optional(),
  is_electric: z.boolean().optional(),
  is_water: z.boolean().optional(),
});

export const updateBoothOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateBoothOpsInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.staff_notes !== undefined) patch.staff_notes = data.staff_notes;
    if (data.vendor_notes !== undefined) patch.vendor_notes = data.vendor_notes;
    if (data.is_electric !== undefined) patch.is_electric = data.is_electric;
    if (data.is_water !== undefined) patch.is_water = data.is_water;
    if (Object.keys(patch).length === 0) return { ok: true, noop: true };
    const { error } = await (context.supabase.from("event_booths" as never) as any)
      .update(patch)
      .eq("id", data.eventBoothId);
    if (error) throw error;
    return { ok: true };
  });

const AssignVendorInput = z.object({
  eventBoothId: z.string().uuid(),
  vendorProfileId: z.string().uuid().nullable(),
});

/** Assign or clear the vendor on an event booth. Used by the Vendor tab and
 * (in Batch B) the drag-and-drop dock. */
export const assignVendorToBooth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssignVendorInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("event_booths" as never) as any)
      .update({
        vendor_profile_id: data.vendorProfileId,
        status: data.vendorProfileId ? "assigned" : "available",
      })
      .eq("id", data.eventBoothId);
    if (error) throw error;
    return { ok: true };
  });

/* ------------------------------ History ------------------------------ */

const HistoryInput = z.object({
  eventId: z.string().uuid(),
  vendorProfileId: z.string().uuid().nullable(),
  applicationId: z.string().uuid().nullable(),
});

/**
 * Cross-source history for a booth: application_activity rows for the
 * assigned application, vendor_timeline_events for the assigned vendor,
 * plus this vendor's booth history across past events.
 */
export const getBoothHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HistoryInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const appActivity = data.applicationId
      ? (await supabase
          .from("application_activity")
          .select("id, event_type, from_value, to_value, created_at")
          .eq("application_id", data.applicationId)
          .order("created_at", { ascending: false })
          .limit(20)).data ?? []
      : [];

    const vendorTimeline = data.vendorProfileId
      ? (await supabase
          .from("vendor_timeline_events")
          .select("id, event_type, payload, occurred_at")
          .eq("vendor_profile_id", data.vendorProfileId)
          .order("occurred_at", { ascending: false })
          .limit(20)).data ?? []
      : [];

    // Past events this vendor participated in (by any application).
    let pastEvents: Array<Record<string, any>> = [];
    if (data.vendorProfileId) {
      const { data: rows } = await supabase
        .from("applications")
        .select("id, event_id, status, applied_at, events:events(id, name, start_date)")
        .eq("vendor_profile_id", data.vendorProfileId)
        .neq("event_id", data.eventId)
        .order("applied_at", { ascending: false })
        .limit(10);
      pastEvents = (rows ?? []) as Array<Record<string, any>>;
    }

    return { appActivity, vendorTimeline, pastEvents };
  });
