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

// ==================== References (Phase 3) ====================

const CreateReferenceInput = z.object({
  venueId: z.string().uuid(),
  layer_id: z.string().uuid().nullable().optional(),
  file_url: z.string().min(1), // storage path within venue-assets bucket
  mime_type: z.string(),
  label: z.string().optional(),
  page: z.number().int().optional(),
  transform: z.object({
    x: z.number(), y: z.number(),
    width: z.number(), height: z.number(),
    rotation: z.number().default(0),
  }),
  opacity: z.number().min(0).max(1).default(0.5),
});

export const createVenueReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateReferenceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { venueId, ...row } = data;
    // Attach to the reference-kind layer if not specified
    let layer_id = row.layer_id;
    if (!layer_id) {
      const { data: layer } = await context.supabase
        .from("venue_layers" as never).select("id").eq("venue_id", venueId).eq("kind", "reference").maybeSingle();
      layer_id = (layer as any)?.id ?? null;
    }
    const { data: ref, error } = await (context.supabase.from("venue_references" as never) as any)
      .insert({ venue_id: venueId, ...row, layer_id }).select().single();
    if (error) throw error;
    return ref;
  });

const UpdateReferenceInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    label: z.string().optional(),
    transform: z.record(z.string(), z.any()).optional(),
    opacity: z.number().min(0).max(1).optional(),
    visible: z.boolean().optional(),
  }),
});

export const updateVenueReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateReferenceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("venue_references" as never) as any)
      .update(data.patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteVenueReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Try to delete storage object too
    const { data: ref } = await context.supabase.from("venue_references" as never)
      .select("file_url").eq("id", data.id).maybeSingle();
    const path = (ref as any)?.file_url as string | undefined;
    if (path) {
      await context.supabase.storage.from("venue-assets").remove([path]).catch(() => {});
    }
    const { error } = await (context.supabase.from("venue_references" as never) as any).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getReferenceSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("venue-assets").createSignedUrl(data.path, 60 * 60);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

// ==================== AI Import (Phase 3) ====================

const AI_OBJECT_TYPES = [
  "booth","building","road","walkway","parking","utility","tree","fence","stage",
  "pavilion","food_court","beer_garden","restroom","table","bench","trash","sign",
  "sponsor_banner","registration","info","ticket","first_aid","atm","kids_area","petting_zoo",
] as const;

const AiObjectSchema = z.object({
  type: z.enum(AI_OBJECT_TYPES),
  shape: z.enum(["rect","circle"]).default("rect"),
  name: z.string().optional(),
  // normalized 0..1 coordinates against the reference image
  nx: z.number().min(0).max(1),
  ny: z.number().min(0).max(1),
  nw: z.number().min(0).max(1),
  nh: z.number().min(0).max(1),
  rotation: z.number().default(0),
  confidence: z.number().min(0).max(1).default(0.5),
});

const AiResponseSchema = z.object({
  objects: z.array(AiObjectSchema).max(500),
  notes: z.string().optional(),
});

export const analyzeVenueDrawing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    venueId: z.string().uuid(),
    referenceId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Load reference + venue for scaling
    const { data: refRow } = await context.supabase
      .from("venue_references" as never).select("*").eq("id", data.referenceId).maybeSingle();
    if (!refRow) throw new Error("Reference not found");
    const ref: any = refRow;

    const { data: venueRow } = await context.supabase
      .from("venues").select("canvas_width, canvas_height").eq("id", data.venueId).maybeSingle();
    if (!venueRow) throw new Error("Venue not found");
    const canvasW = (venueRow as any).canvas_width ?? 2000;
    const canvasH = (venueRow as any).canvas_height ?? 1500;

    // Signed URL for the image so Gemini can fetch it
    const { data: signed, error: signErr } = await context.supabase.storage
      .from("venue-assets").createSignedUrl(ref.file_url, 60 * 10);
    if (signErr || !signed) throw new Error("Could not sign reference URL");

    // Call Lovable AI Gateway (Gemini 2.5 Pro vision) with JSON output
    const systemPrompt = `You analyze event venue drawings (site plans, maps, sketches).
Identify visible objects: booths, buildings, stages, restrooms, roads, walkways, parking, trees, food courts, fences, utilities, signs, first_aid, ticket, info, atm, kids_area.
Return coordinates NORMALIZED to the image bounds (0..1) as {nx, ny, nw, nh} where (nx,ny) is the top-left and (nw,nh) is width/height. Use shape "circle" for round objects (trees, ATMs, trash), otherwise "rect".
Return ONLY strict JSON matching this shape:
{"objects":[{"type":"booth","shape":"rect","name":"B12","nx":0.1,"ny":0.2,"nw":0.05,"nh":0.05,"rotation":0,"confidence":0.8}],"notes":"..."}
Prefer high-confidence detections. If unsure of a type, use "building".`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: "Detect all venue objects in this drawing. Return JSON only." },
            { type: "image_url", image_url: { url: signed.signedUrl } },
          ]},
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted — add credits in workspace settings.");
      throw new Error(`AI request failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { throw new Error("AI returned invalid JSON"); }
    const validated = AiResponseSchema.safeParse(parsed);
    if (!validated.success) throw new Error(`AI output schema mismatch: ${validated.error.message.slice(0, 200)}`);

    // Ensure an "AI Import" layer exists
    const { data: existing } = await context.supabase
      .from("venue_layers" as never).select("id").eq("venue_id", data.venueId).eq("kind", "custom").eq("name", "AI Import").maybeSingle();
    let aiLayerId = (existing as any)?.id;
    if (!aiLayerId) {
      const { data: created } = await (context.supabase.from("venue_layers" as never) as any)
        .insert({ venue_id: data.venueId, name: "AI Import", kind: "custom", order_index: 99 })
        .select().single();
      aiLayerId = created?.id;
    }

    // Scale reference transform onto the master canvas
    const t = ref.transform ?? { x: 0, y: 0, width: canvasW, height: canvasH };

    const styleFor = (type: string) => {
      const palette: Record<string, [string, string]> = {
        booth: ["hsl(var(--primary) / 0.2)", "hsl(var(--primary))"],
        building: ["#e5e7eb", "#4b5563"],
        stage: ["#c7d2fe", "#4338ca"],
        tree: ["#86efac", "#166534"],
        road: ["#d1d5db", "#6b7280"],
        walkway: ["#e5e7eb", "#9ca3af"],
        parking: ["#f3f4f6", "#6b7280"],
        restroom: ["#e0f2fe", "#0369a1"],
        food_court: ["#fed7aa", "#c2410c"],
      };
      const [fill, stroke] = palette[type] ?? ["#f3f4f6", "#6b7280"];
      return { fill, stroke };
    };

    const rows = validated.data.objects.map((o) => {
      const x = t.x + o.nx * t.width;
      const y = t.y + o.ny * t.height;
      const w = Math.max(1, o.nw * t.width);
      const h = Math.max(1, o.nh * t.height);
      return {
        venue_id: data.venueId,
        layer_id: aiLayerId,
        type: o.type,
        shape: o.shape,
        name: o.name ?? null,
        geometry: { x, y, w, h, rotation: o.rotation ?? 0 },
        style: styleFor(o.type),
        metadata: { ai_confidence: o.confidence, ai_source_ref: data.referenceId },
      };
    });

    if (rows.length === 0) return { count: 0, notes: validated.data.notes ?? "No objects detected." };

    const { error: insErr } = await (context.supabase.from("venue_objects" as never) as any).insert(rows);
    if (insErr) throw insErr;

    return { count: rows.length, notes: validated.data.notes ?? null, layerId: aiLayerId };
  });
