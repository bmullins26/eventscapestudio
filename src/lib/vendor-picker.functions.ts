import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ organizationId: z.string().uuid() });

export type PickerVendor = {
  vendor_profile_id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  categories: string[];
  is_favorite: boolean;
  account_status: string;
  status: string;
};

export const listOrgVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<PickerVendor[]> => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("is_org_member", {
      _user_id: userId,
      _org_id: data.organizationId,
    });
    if (!ok) throw new Error("Not authorized");

    const { data: rows, error } = await supabase
      .from("organization_vendors")
      .select(
        "vendor_profile_id, is_favorite, account_status, status, vendor_profiles(id, business_name, contact_name, email, phone, product_categories, categories)",
      )
      .eq("organization_id", data.organizationId)
      .neq("status", "archived");
    if (error) throw error;

    return (rows ?? [])
      .map((r: any) => {
        const p = r.vendor_profiles;
        if (!p) return null;
        const cats: string[] = Array.isArray(p.product_categories) && p.product_categories.length
          ? p.product_categories
          : Array.isArray(p.categories) ? p.categories : [];
        return {
          vendor_profile_id: r.vendor_profile_id,
          business_name: p.business_name,
          contact_name: p.contact_name,
          email: p.email,
          phone: p.phone,
          categories: cats,
          is_favorite: !!r.is_favorite,
          account_status: r.account_status ?? "no_account",
          status: r.status ?? "prospect",
        } as PickerVendor;
      })
      .filter(Boolean) as PickerVendor[];
  });
