import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProfileSchema = z.object({
  business_name: z.string().min(1).max(200),
  contact_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  business_description: z.string().nullable().optional(),
  product_categories: z.array(z.string()).default([]),
  business_photos: z.array(z.string()).default([]),
  insurance_doc_url: z.string().nullable().optional(),
  tax_doc_url: z.string().nullable().optional(),
  food_license_url: z.string().nullable().optional(),
  resale_cert_url: z.string().nullable().optional(),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  social_links: z
    .object({
      facebook: z.string().nullable().optional(),
      instagram: z.string().nullable().optional(),
      tiktok: z.string().nullable().optional(),
    })
    .default({}),
});

const LinkSchema = z.object({
  account_status: z.enum(["no_account", "invited", "registered", "disabled"]).default("no_account"),
  internal_notes: z.string().nullable().optional(),
  is_favorite: z.boolean().default(false),
});

const CreateVendorInput = z.object({
  organizationId: z.string().uuid(),
  profile: ProfileSchema,
  link: LinkSchema.default({ account_status: "no_account", is_favorite: false }),
  allowDuplicate: z.boolean().default(false),
  matchedProfileId: z.string().uuid().nullable().optional(),
});

type DuplicateMatch = {
  vendor_profile_id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  matched_on: string[];
};

function norm(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase();
}

export const createVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateVendorInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Membership check
    const { data: isMember, error: memErr } = await supabase.rpc("is_org_member", {
      _user_id: userId,
      _org_id: data.organizationId,
    });
    if (memErr) throw memErr;
    if (!isMember) throw new Error("Not authorized to create vendors for this organization");

    // Dedupe scan (skip when reusing a matched profile or user explicitly allows duplicate)
    if (!data.matchedProfileId && !data.allowDuplicate) {
      const { data: existing, error: exErr } = await supabase
        .from("organization_vendors")
        .select(
          "vendor_profile_id, vendor_profiles(id, business_name, email, phone, website)",
        )
        .eq("organization_id", data.organizationId);
      if (exErr) throw exErr;

      const bn = norm(data.profile.business_name);
      const em = norm(data.profile.email ?? null);
      const ph = norm(data.profile.phone ?? null).replace(/\D+/g, "");
      const ws = norm(data.profile.website ?? null).replace(/^https?:\/\//, "").replace(/\/+$/, "");

      const matches: DuplicateMatch[] = [];
      for (const row of existing ?? []) {
        const p = (row as unknown as { vendor_profiles: { id: string; business_name: string; email: string | null; phone: string | null; website: string | null } | null }).vendor_profiles;
        if (!p) continue;
        const reasons: string[] = [];
        if (bn && norm(p.business_name) === bn) reasons.push("business_name");
        if (em && norm(p.email) === em) reasons.push("email");
        if (ph && norm(p.phone).replace(/\D+/g, "") === ph) reasons.push("phone");
        if (ws && norm(p.website).replace(/^https?:\/\//, "").replace(/\/+$/, "") === ws) reasons.push("website");
        if (reasons.length > 0) {
          matches.push({
            vendor_profile_id: p.id,
            business_name: p.business_name,
            email: p.email,
            phone: p.phone,
            website: p.website,
            matched_on: reasons,
          });
        }
      }
      if (matches.length > 0) {
        return { status: "duplicates" as const, matches };
      }
    }

    const profilePayload = {
      ...data.profile,
      product_categories: data.profile.product_categories ?? [],
      business_photos: data.profile.business_photos ?? [],
      social_links: data.profile.social_links ?? {},
    };

    const { data: rpc, error: rpcErr } = await supabase.rpc("create_vendor_with_link", {
      _org_id: data.organizationId,
      _profile: profilePayload,
      _link: data.link,
      _existing_profile_id: data.matchedProfileId ?? null,
    });
    if (rpcErr) throw rpcErr;

    const result = rpc as { vendor_profile_id: string; organization_vendor_id: string };
    return {
      status: data.matchedProfileId ? ("linked" as const) : ("created" as const),
      vendorProfileId: result.vendor_profile_id,
      organizationVendorId: result.organization_vendor_id,
    };
  });

const UpdateVendorInput = z.object({
  organizationId: z.string().uuid(),
  vendorProfileId: z.string().uuid(),
  profile: ProfileSchema,
});

export const updateVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateVendorInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMember } = await supabase.rpc("is_org_member", {
      _user_id: userId,
      _org_id: data.organizationId,
    });
    if (!isMember) throw new Error("Not authorized");

    const { error } = await supabase
      .from("vendor_profiles")
      .update({
        ...data.profile,
        product_categories: data.profile.product_categories ?? [],
        business_photos: data.profile.business_photos ?? [],
        social_links: data.profile.social_links ?? {},
      })
      .eq("id", data.vendorProfileId);
    if (error) throw error;
    return { ok: true };
  });
