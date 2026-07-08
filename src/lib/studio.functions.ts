import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "event";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Create event from a layout template ----
const CreateFromTemplateInput = z.object({
  organizationId: z.string().uuid(),
  venueId: z.string().uuid(),
  layoutTemplateId: z.string().uuid(),
  name: z.string().min(1).max(200),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const createEventFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateFromTemplateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: canWrite } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _org_id: data.organizationId,
      _permission: "events.write",
    });
    if (!canWrite) throw new Error("Not authorized to create events for this organization");

    const { data: tpl, error: tplErr } = await supabase
      .from("layout_templates")
      .select("id, venue_id, canvas_width, canvas_height")
      .eq("id", data.layoutTemplateId)
      .maybeSingle();
    if (tplErr) throw tplErr;
    if (!tpl) throw new Error("Layout template not found");

    const { data: created, error: insErr } = await supabase
      .from("events")
      .insert({
        organization_id: data.organizationId,
        venue_id: data.venueId,
        layout_template_id: data.layoutTemplateId,
        name: data.name,
        slug: slugify(data.name),
        description: data.description ?? null,
        status: "draft",
        is_template: false,
        is_public: false,
        applications_open: false,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    // Copy template booths into event_booths
    const { data: tplBooths } = await supabase
      .from("layout_template_booths")
      .select("*")
      .eq("layout_template_id", data.layoutTemplateId);

    if (tplBooths && tplBooths.length > 0) {
      const rows = tplBooths.map((b) => ({
        event_id: created.id,
        template_booth_id: b.id,
        code: b.code,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        rotation: b.rotation,
        category: b.category,
        size_label: b.size_label,
        price: b.price,
        status: "available" as const,
      }));
      const { error: bErr } = await supabase.from("event_booths").insert(rows);
      if (bErr) throw bErr;
    }

    return { id: created.id };
  });

// ---- AI Application Scanner ----
const ScanApplicationInput = z.object({
  fileDataUrl: z.string().min(1), // "data:<mime>;base64,..."
});

const ExtractionSchema = z.object({
  business_name: z.string().nullable(),
  contact_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  products_sold: z.string().nullable(),
  size_requested: z.string().nullable(),
  needs_electricity: z.boolean().nullable(),
  special_requests: z.string().nullable(),
  payment_amount: z.number().nullable(),
  notes: z.string().nullable(),
});

export const scanApplicationImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScanApplicationInput.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const [meta] = data.fileDataUrl.split(",");
    const mime = meta.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
    const isPdf = mime === "application/pdf";
    const isImage = mime.startsWith("image/");
    if (!isPdf && !isImage) throw new Error("Unsupported file type");

    const userContent = [
      {
        type: "text",
        text: `You are extracting information from a vendor event application. Return ONLY valid JSON matching this exact shape (use null for unknown fields):
{"business_name":string|null,"contact_name":string|null,"email":string|null,"phone":string|null,"products_sold":string|null,"size_requested":string|null,"needs_electricity":boolean|null,"special_requests":string|null,"payment_amount":number|null,"notes":string|null}`,
      },
      isImage
        ? { type: "image_url", image_url: { url: data.fileDataUrl } }
        : { type: "file", file: { filename: "application.pdf", file_data: data.fileDataUrl } },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: userContent }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`AI extraction failed (${resp.status}): ${errText.slice(0, 400)}`);
    }
    const body = await resp.json();
    const text = body?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));
    } catch {
      throw new Error("AI response was not valid JSON");
    }
    const result = ExtractionSchema.safeParse(parsed);
    if (!result.success) {
      return { business_name: null, contact_name: null, email: null, phone: null, products_sold: null, size_requested: null, needs_electricity: null, special_requests: null, payment_amount: null, notes: null };
    }
    return result.data;
  });

// ---- Update event ----
const UpdateEventInput = z.object({
  eventId: z.string().uuid(),
  patch: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(["draft", "published", "in_progress", "completed", "cancelled", "archived"]).optional(),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
    venue_id: z.string().uuid().nullable().optional(),
    applications_open: z.boolean().optional(),
    is_public: z.boolean().optional(),
    slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, dashes").optional(),
  }),
});

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateEventInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev, error: evErr } = await supabase.from("events").select("id, organization_id").eq("id", data.eventId).maybeSingle();
    if (evErr) throw evErr;
    if (!ev) throw new Error("Event not found");
    const { data: canWrite } = await supabase.rpc("has_permission", { _user_id: userId, _org_id: ev.organization_id, _permission: "events.write" });
    if (!canWrite) throw new Error("Not authorized");
    const patch = { ...data.patch, updated_at: new Date().toISOString() };
    const { data: updated, error } = await supabase.from("events").update(patch).eq("id", data.eventId).select().single();
    if (error) throw error;
    return updated;
  });

// ---- Delete event ----
const DeleteEventInput = z.object({ eventId: z.string().uuid() });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteEventInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ev, error: evErr } = await supabase.from("events").select("id, organization_id").eq("id", data.eventId).maybeSingle();
    if (evErr) throw evErr;
    if (!ev) throw new Error("Event not found");
    const { data: canWrite } = await supabase.rpc("has_permission", { _user_id: userId, _org_id: ev.organization_id, _permission: "events.write" });
    if (!canWrite) throw new Error("Not authorized");

    const [{ count: appCount }, { count: payCount }] = await Promise.all([
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("event_id", data.eventId),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("event_id", data.eventId),
    ]);
    if ((appCount ?? 0) > 0 || (payCount ?? 0) > 0) {
      throw new Error("This event has applications or payments. Archive it instead to preserve history.");
    }
    await supabase.from("event_booths").delete().eq("event_id", data.eventId);
    const { error } = await supabase.from("events").delete().eq("id", data.eventId);
    if (error) throw error;
    return { ok: true };
  });

// ---- Scan Vendor Intake form (paper) with AI ----
const VendorIntakeExtractionSchema = z.object({
  business_name: z.string().nullable(),
  contact_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  business_description: z.string().nullable(),
  product_categories: z.array(z.string()).nullable(),
  emergency_contact_name: z.string().nullable(),
  emergency_contact_phone: z.string().nullable(),
  social_links: z.object({
    facebook: z.string().nullable(),
    instagram: z.string().nullable(),
    tiktok: z.string().nullable(),
  }).nullable(),
  notes: z.string().nullable(),
});

export const scanVendorIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScanApplicationInput.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const [meta] = data.fileDataUrl.split(",");
    const mime = meta.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
    const isPdf = mime === "application/pdf";
    const isImage = mime.startsWith("image/");
    if (!isPdf && !isImage) throw new Error("Unsupported file type");

    const userContent = [
      {
        type: "text",
        text: `You are extracting information from a vendor intake form (permanent vendor profile). Return ONLY valid JSON matching this exact shape (use null for unknown fields, empty array [] for product_categories if none):
{"business_name":string|null,"contact_name":string|null,"email":string|null,"phone":string|null,"website":string|null,"business_description":string|null,"product_categories":string[]|null,"emergency_contact_name":string|null,"emergency_contact_phone":string|null,"social_links":{"facebook":string|null,"instagram":string|null,"tiktok":string|null}|null,"notes":string|null}`,
      },
      isImage
        ? { type: "image_url", image_url: { url: data.fileDataUrl } }
        : { type: "file", file: { filename: "vendor-intake.pdf", file_data: data.fileDataUrl } },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: userContent }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`AI extraction failed (${resp.status}): ${errText.slice(0, 400)}`);
    }
    const body = await resp.json();
    const text = body?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));
    } catch {
      throw new Error("AI response was not valid JSON");
    }
    const result = VendorIntakeExtractionSchema.safeParse(parsed);
    if (!result.success) {
      return { business_name: null, contact_name: null, email: null, phone: null, website: null, business_description: null, product_categories: null, emergency_contact_name: null, emergency_contact_phone: null, social_links: null, notes: null };
    }
    return result.data;
  });
