import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ENABLE_DEV_ACCESS, isDevelopmentSuperAdminUser } from "@/lib/development-access";
import type { Json } from "@/integrations/supabase/types";

const Input = z.object({});

const DEMO_VENUE_NAME = "Community Event Center";
const DEMO_EVENT_NAME = "Spring Craft Market 2027";
const DEMO_EVENT_SLUG = "spring-craft-market-2027";

const DEMO_BOOTHS = [
  { objectId: "e4702001-7b98-4f7a-8b3e-926f9eb7a001", code: "A1", x: 150, y: 130, electric: true, corner: true },
  { objectId: "e4702002-7b98-4f7a-8b3e-926f9eb7a002", code: "A2", x: 270, y: 130, electric: false, corner: false },
  { objectId: "e4702003-7b98-4f7a-8b3e-926f9eb7a003", code: "A3", x: 390, y: 130, electric: true, corner: false },
  { objectId: "e4702004-7b98-4f7a-8b3e-926f9eb7a004", code: "B1", x: 150, y: 240, electric: false, corner: true },
  { objectId: "e4702005-7b98-4f7a-8b3e-926f9eb7a005", code: "B2", x: 270, y: 240, electric: false, corner: false },
] as const;

const DEMO_VENDORS = [
  { businessName: "Cedar & Clay", contactName: "Maya Chen", email: "maya@cedarclay.example", category: "Ceramics" },
  { businessName: "Northstar Print Co.", contactName: "Evan Cole", email: "evan@northstarprint.example", category: "Art" },
  { businessName: "Wild Fern Goods", contactName: "Riley Brooks", email: "riley@wildferngoods.example", category: "Home Goods" },
  { businessName: "Golden Thread Studio", contactName: "Avery Patel", email: "avery@goldenthread.example", category: "Textiles" },
  { businessName: "Brightside Jewelry", contactName: "Jordan Lee", email: "jordan@brightsidejewelry.example", category: "Jewelry" },
] as const;

function demoLayoutElements() {
  const booths = DEMO_BOOTHS.map((booth) => ({
    id: booth.objectId,
    objectId: booth.objectId,
    kind: "booth",
    x: booth.x,
    y: booth.y,
    w: 96,
    h: 72,
    rotation: 0,
    label: booth.code,
    name: booth.code,
    status: "available",
    price: 175,
    category: "Standard Booth",
    isElectric: booth.electric,
    isWater: false,
    isCorner: booth.corner,
    isPremium: booth.corner,
    size: "10′×10′",
    variant: "standard_booth",
    locked: false,
    hidden: false,
    tags: booth.electric ? ["Electrical"] : [],
  }));

  return [
    ...booths,
    { id: "e4702101-7b98-4f7a-8b3e-926f9eb7a001", objectId: "e4702101-7b98-4f7a-8b3e-926f9eb7a001", kind: "placed", placedKind: "building", x: 80, y: 60, w: 610, h: 340, name: "Community Event Center", locked: true, hidden: false, meta: {} },
    { id: "e4702102-7b98-4f7a-8b3e-926f9eb7a002", objectId: "e4702102-7b98-4f7a-8b3e-926f9eb7a002", kind: "placed", placedKind: "parking", x: 720, y: 70, w: 300, h: 190, name: "Visitor Parking", locked: false, hidden: false, meta: {} },
    { id: "e4702103-7b98-4f7a-8b3e-926f9eb7a003", objectId: "e4702103-7b98-4f7a-8b3e-926f9eb7a003", kind: "placed", placedKind: "walkway", x: 80, y: 410, w: 610, h: 42, name: "Main Entrance Walkway", locked: false, hidden: false, meta: {} },
    { id: "e4702104-7b98-4f7a-8b3e-926f9eb7a004", objectId: "e4702104-7b98-4f7a-8b3e-926f9eb7a004", kind: "placed", placedKind: "restroom", x: 575, y: 85, w: 65, h: 55, name: "Restrooms", locked: false, hidden: false, meta: {} },
    { id: "e4702105-7b98-4f7a-8b3e-926f9eb7a005", objectId: "e4702105-7b98-4f7a-8b3e-926f9eb7a005", kind: "placed", placedKind: "electrical", x: 110, y: 150, w: 28, h: 28, name: "Electrical Panel", locked: false, hidden: false, meta: {} },
    { id: "e4702106-7b98-4f7a-8b3e-926f9eb7a006", objectId: "e4702106-7b98-4f7a-8b3e-926f9eb7a006", kind: "placed", placedKind: "table6", x: 450, y: 300, w: 72, h: 36, name: "Info Table", locked: false, hidden: false, furniture: true, meta: {} },
  ];
}

async function requireSuccess<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

/**
 * DEVELOPMENT ONLY
 * Extends the organization provisioned by handle_new_user using the same
 * caller-scoped Supabase client as production server functions. It never
 * creates an organization, alters RLS, or runs with service-role privileges.
 */
export const ensureDevelopmentWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ context }) => {
    if (!ENABLE_DEV_ACCESS) return { seeded: false, reason: "development-access-disabled" as const };

    const { supabase, userId, claims } = context;
    const deterministicSlug = `developer-${userId.replace(/-/g, "").slice(0, 12)}`;
    const isExplicitDeveloperSuperAdmin = isDevelopmentSuperAdminUser({ email: claims?.email as string | undefined });

    let organization = await requireSuccess(await supabase
      .from("organizations")
      .select("id, name")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle());

    if (!organization) {
      try {
        organization = await requireSuccess(await supabase
          .from("organizations")
          .insert({
            name: "Developer Studio",
            slug: deterministicSlug,
            owner_id: userId,
            subscription_tier: "starter",
          })
          .select("id, name")
          .single());
      } catch (error) {
        if (error instanceof Error && error.message.includes("duplicate key")) {
          organization = await requireSuccess(await supabase
            .from("organizations")
            .select("id, name")
            .eq("owner_id", userId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle());
        } else {
          throw error;
        }
      }
    }

    if (!organization) {
      return { seeded: false, reason: "no-user-owned-organization" as const };
    }

    if (isExplicitDeveloperSuperAdmin) {
      await requireSuccess(await supabase.from("user_roles").upsert({
        user_id: userId,
        role: "super_admin",
      }, { onConflict: "user_id,role" }).select("role").maybeSingle());
    }

    await requireSuccess(await supabase.from("organization_members").upsert({
      organization_id: organization.id,
      user_id: userId,
      title: "Owner",
      joined_at: new Date().toISOString(),
    }, { onConflict: "organization_id,user_id" }).select("id").maybeSingle());

    const venue = await requireSuccess(await supabase
      .from("venues")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("name", DEMO_VENUE_NAME)
      .maybeSingle()) ?? await requireSuccess(await supabase
      .from("venues")
      .insert({
        organization_id: organization.id,
        name: DEMO_VENUE_NAME,
        address_line1: "100 Market Square",
        city: "Springfield",
        state: "IL",
        postal_code: "62701",
        parking_info: "Visitor parking is available on the east side of the building.",
        utilities_info: "Electrical service is available at designated booths.",
        notes: "Development workspace venue.",
      })
      .select("id")
      .single());

    const existingLayout = await requireSuccess(await supabase.from("venue_layouts")
      .select("id")
      .eq("venue_id", venue.id)
      .maybeSingle());
    if (!existingLayout) {
      await requireSuccess(await supabase.from("venue_layouts").insert({
        venue_id: venue.id,
        name: "Community Event Center Layout",
        elements: demoLayoutElements() as Json,
        settings: { canvas: { w: 1110, h: 560 } },
      }));
    }

    const event = await requireSuccess(await supabase
      .from("events")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("name", DEMO_EVENT_NAME)
      .maybeSingle()) ?? await requireSuccess(await supabase
      .from("events")
      .insert({
        organization_id: organization.id,
        venue_id: venue.id,
        name: DEMO_EVENT_NAME,
        slug: DEMO_EVENT_SLUG,
        description: "A fully populated development event for testing EventScape Studio.",
        starts_at: "2027-04-17T14:00:00.000Z",
        ends_at: "2027-04-18T21:00:00.000Z",
        status: "published",
        is_public: false,
        applications_open: true,
      })
      .select("id")
      .single());

    const existingBooths = await requireSuccess(await supabase.from("event_booths")
      .select("id, code, event_object_id")
      .eq("event_id", event.id));
    const boothByCode = new Map((existingBooths ?? []).map((booth: { id: string; code: string }) => [booth.code, booth]));
    const missingBooths = DEMO_BOOTHS.filter((booth) => !boothByCode.has(booth.code));
    if (missingBooths.length > 0) {
      const insertedResult = await supabase.from("event_booths")
        .insert(missingBooths.map((booth) => ({
          event_id: event.id,
          event_object_id: booth.objectId,
          code: booth.code,
          x: booth.x,
          y: booth.y,
          width: 96,
          height: 72,
          category: "Standard Booth",
          size_label: "10′×10′",
          price: 175,
          status: "available",
          is_electric: booth.electric,
          is_corner: booth.corner,
          is_premium: booth.corner,
        })))
        .select("id, code");
      const inserted = await requireSuccess(insertedResult);
      for (const booth of inserted) boothByCode.set(booth.code, booth);
    }

    const vendorLinks = await requireSuccess(await supabase
      .from("organization_vendors")
      .select("vendor_profile_id, vendor_profiles(business_name, email)")
      .eq("organization_id", organization.id));
    const vendorIdByEmail = new Map<string, string>();
    for (const link of vendorLinks ?? []) {
      const profile = Array.isArray(link.vendor_profiles) ? link.vendor_profiles[0] : link.vendor_profiles;
      if (profile?.email) vendorIdByEmail.set(profile.email, link.vendor_profile_id);
    }

    for (const vendor of DEMO_VENDORS) {
      if (vendorIdByEmail.has(vendor.email)) continue;
      const created = await requireSuccess(await supabase.rpc("create_vendor_with_link", {
        _org_id: organization.id,
        _profile: {
          business_name: vendor.businessName,
          contact_name: vendor.contactName,
          email: vendor.email,
          phone: "555-0100",
          business_description: `Development seed vendor in ${vendor.category}.`,
          product_categories: [vendor.category],
          business_photos: [],
          social_links: {},
        },
        _link: { account_status: "no_account", is_favorite: false, internal_notes: "Development seed vendor." },
      })) as { vendor_profile_id: string };
      vendorIdByEmail.set(vendor.email, created.vendor_profile_id);
    }

    const existingApplications = await requireSuccess(await supabase
      .from("applications")
      .select("id, vendor_profile_id")
      .eq("event_id", event.id));
    const applicationIdByVendor = new Map((existingApplications ?? []).map((application) => [application.vendor_profile_id, application.id]));
    for (const [index, vendor] of DEMO_VENDORS.entries()) {
      const vendorId = vendorIdByEmail.get(vendor.email);
      if (!vendorId || applicationIdByVendor.has(vendorId)) continue;
      const application = await requireSuccess(await supabase.from("applications").insert({
        organization_id: organization.id,
        event_id: event.id,
        vendor_profile_id: vendorId,
        status: index < 3 ? "approved" : "pending",
        category: vendor.category,
        size_requested: "10′×10′",
        needs_electricity: index === 0,
        notes: "Development seed application.",
      }).select("id").single());
      applicationIdByVendor.set(vendorId, application.id);
    }

    for (const [index, vendor] of DEMO_VENDORS.entries()) {
      if (index >= 3) continue;
      const vendorId = vendorIdByEmail.get(vendor.email);
      const applicationId = vendorId ? applicationIdByVendor.get(vendorId) : undefined;
      const booth = boothByCode.get(DEMO_BOOTHS[index].code);
      if (!vendorId || !applicationId || !booth) continue;
      await requireSuccess(await supabase.from("event_booths")
        .update({ vendor_profile_id: vendorId, assigned_application_id: applicationId, status: "assigned" })
        .eq("id", booth.id));
    }

    const reservationBooth = boothByCode.get("A1");
    const reservationVendorId = vendorIdByEmail.get(DEMO_VENDORS[0].email);
    if (reservationBooth && reservationVendorId) {
      const reservation = await requireSuccess(await supabase.from("event_booth_reservations")
        .select("id")
        .eq("event_id", event.id)
        .eq("booth_element_id", DEMO_BOOTHS[0].objectId)
        .maybeSingle());
      if (!reservation) {
        await requireSuccess(await supabase.from("event_booth_reservations").insert({
          event_id: event.id,
          booth_element_id: DEMO_BOOTHS[0].objectId,
          vendor_profile_id: reservationVendorId,
          status: "reserved",
          reserved_at: new Date().toISOString(),
        }));
      }
    }

    const paymentVendorId = vendorIdByEmail.get(DEMO_VENDORS[0].email);
    const paymentApplicationId = paymentVendorId ? applicationIdByVendor.get(paymentVendorId) : undefined;
    if (paymentVendorId && paymentApplicationId) {
      const payment = await requireSuccess(await supabase.from("payments")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("event_id", event.id)
        .eq("vendor_profile_id", paymentVendorId)
        .eq("reference", "DEV-SEED-A1")
        .maybeSingle());
      if (!payment) {
        await requireSuccess(await supabase.from("payments").insert({
          organization_id: organization.id,
          event_id: event.id,
          application_id: paymentApplicationId,
          vendor_profile_id: paymentVendorId,
          amount: 175,
          status: "paid",
          method: "development seed",
          reference: "DEV-SEED-A1",
          note: "Development seed payment.",
          paid_at: new Date().toISOString(),
          marked_by: userId,
        }));
      }
    }

    return { seeded: true, organizationId: organization.id, venueId: venue.id, eventId: event.id };
  });
