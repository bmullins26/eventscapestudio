/* -------------------------------------------------------------------------
 * deriveObjectState — single source of truth for how an object *looks* in
 * event mode. Called by:
 *   • canvas booth renderer (fill / border override)
 *   • badge layer
 *   • hover card
 *   • context panel header
 *   • dashboard rollups
 *
 * Palette (from the phased roadmap):
 *   Available    #D1D5DB (gray)
 *   Application  #F59E0B (amber) — pending application on this booth
 *   Reserved     #3B82F6 (blue)  — assigned or held
 *   Paid         #10B981 (green) — payment.status = paid
 *   Checked-in   #065F46 (dark green)
 *   Sponsor      #8B5CF6 (violet) — sponsor booth
 *   Unavailable  #EF4444 (red)   — blocked
 *   Cancelled    #9CA3AF (mid gray)
 * ---------------------------------------------------------------------- */

export type DerivedStatus =
  | "available"
  | "application"
  | "reserved"
  | "paid"
  | "checked_in"
  | "sponsor"
  | "unavailable"
  | "cancelled";

export interface DerivedState {
  status: DerivedStatus;
  color: string;
  border: string;
  label: string;
  priority: number;
  badges: Array<{ id: string; glyph: string; label: string }>;
  tooltip: string;
}

export interface EventBoothLive {
  id: string;
  event_object_id: string | null;
  code: string;
  status: "available" | "held" | "assigned" | "occupied" | "blocked";
  price: number | null;
  category: string | null;
  is_electric: boolean;
  is_water: boolean;
  is_premium: boolean;
  is_corner: boolean;
  is_reserved: boolean;
  vendor_profile_id: string | null;
  assigned_application_id: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  staff_notes: string | null;
  vendor_notes: string | null;
  vendor_profiles: {
    id: string;
    business_name: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface EventContext {
  boothsByObjectId: Map<string, EventBoothLive>;
  applicationsByBoothId: Map<string, { id: string; status: string }>;
  paymentByApplicationId: Map<string, { status: string; amount: number | null; paid_at: string | null }>;
}

const PALETTE: Record<DerivedStatus, { color: string; border: string; label: string; priority: number }> = {
  available:    { color: "#D1D5DB", border: "#9CA3AF", label: "Available",   priority: 0 },
  application:  { color: "#F59E0B", border: "#B45309", label: "Application", priority: 1 },
  reserved:     { color: "#3B82F6", border: "#1D4ED8", label: "Reserved",    priority: 2 },
  paid:         { color: "#10B981", border: "#047857", label: "Paid",        priority: 3 },
  checked_in:   { color: "#065F46", border: "#022C22", label: "Checked in",  priority: 4 },
  sponsor:      { color: "#8B5CF6", border: "#6D28D9", label: "Sponsor",     priority: 5 },
  unavailable:  { color: "#EF4444", border: "#991B1B", label: "Unavailable", priority: 6 },
  cancelled:    { color: "#9CA3AF", border: "#6B7280", label: "Cancelled",   priority: -1 },
};

export function deriveBoothState(
  objectId: string | null | undefined,
  ctx: EventContext | null,
): DerivedState | null {
  if (!ctx || !objectId) return null;
  const booth = ctx.boothsByObjectId.get(objectId);
  if (!booth) return null;

  // Priority ladder: checked_in > paid > reserved > application > blocked >
  // sponsor tag > available.
  let status: DerivedStatus = "available";

  if (booth.status === "blocked") status = "unavailable";
  else if (booth.checked_in_at && !booth.checked_out_at) status = "checked_in";
  else {
    const app = booth.assigned_application_id
      ? ctx.applicationsByBoothId.get(booth.assigned_application_id)
      : undefined;
    const payment = app ? ctx.paymentByApplicationId.get(app.id) : undefined;

    if (payment?.status === "paid") status = "paid";
    else if (booth.status === "assigned" || booth.status === "occupied" || booth.is_reserved || booth.vendor_profile_id) {
      status = "reserved";
    } else if (app && (app.status === "pending" || app.status === "awaiting_payment" || app.status === "waitlisted")) {
      status = "application";
    } else if (booth.status === "held") {
      status = "reserved";
    } else {
      status = "available";
    }
  }

  const p = PALETTE[status];

  const badges: Array<{ id: string; glyph: string; label: string }> = [];
  if (booth.is_electric) badges.push({ id: "electric", glyph: "⚡", label: "Electric" });
  if (booth.is_water)    badges.push({ id: "water",    glyph: "💧", label: "Water" });
  if (booth.is_premium)  badges.push({ id: "premium",  glyph: "⭐", label: "Premium" });
  if (booth.is_corner)   badges.push({ id: "corner",   glyph: "◱",  label: "Corner" });
  if (status === "checked_in") badges.push({ id: "in", glyph: "✓", label: "Checked in" });

  const vendorName = booth.vendor_profiles?.business_name ?? null;
  const tooltip = `Booth ${booth.code} · ${p.label}${vendorName ? ` · ${vendorName}` : ""}`;

  return {
    status,
    color: p.color,
    border: p.border,
    label: p.label,
    priority: p.priority,
    badges,
    tooltip,
  };
}

export function buildEventContext(payload: {
  booths: Array<any>;
  applications: Array<any>;
  payments: Array<any>;
}): EventContext {
  const boothsByObjectId = new Map<string, EventBoothLive>();
  for (const b of payload.booths) {
    if (b.event_object_id) boothsByObjectId.set(b.event_object_id, b as EventBoothLive);
  }

  const applicationsByBoothId = new Map<string, { id: string; status: string }>();
  for (const a of payload.applications) {
    if (a.assigned_booth_id) {
      applicationsByBoothId.set(a.assigned_booth_id, { id: a.id, status: a.status });
    }
  }

  const paymentByApplicationId = new Map<string, { status: string; amount: number | null; paid_at: string | null }>();
  for (const p of payload.payments) {
    if (p.application_id && !paymentByApplicationId.has(p.application_id)) {
      paymentByApplicationId.set(p.application_id, {
        status: p.status,
        amount: p.amount ?? null,
        paid_at: p.paid_at ?? null,
      });
    }
  }

  return { boothsByObjectId, applicationsByBoothId, paymentByApplicationId };
}

/* --------------------- Layer-1 Venue Intelligence rules --------------------- */

export interface IntelligenceInsight {
  id: string;
  severity: "info" | "warn" | "critical";
  message: string;
}

/** Compute Layer-1 (deterministic) insights for a single selected booth. */
export function boothIntelligence(
  objectId: string | null | undefined,
  ctx: EventContext | null,
  allBooths: Array<any>,
): IntelligenceInsight[] {
  const out: IntelligenceInsight[] = [];
  if (!ctx || !objectId) return out;
  const booth = ctx.boothsByObjectId.get(objectId);
  if (!booth) return out;

  // Median price for the same category this event.
  const sameCat = allBooths.filter(
    (b) => (b.category ?? null) === (booth.category ?? null) && typeof b.price === "number",
  ) as Array<{ price: number }>;
  if (sameCat.length >= 3) {
    const prices = sameCat.map((b) => b.price).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    if (booth.price == null) {
      out.push({
        id: "unpriced",
        severity: "warn",
        message: `No price set. Median for ${booth.category ?? "this category"} is $${median}.`,
      });
    } else if (booth.price < median * 0.75) {
      out.push({
        id: "underpriced",
        severity: "info",
        message: `Priced $${booth.price} — below median $${median} for ${booth.category ?? "this category"}.`,
      });
    } else if (booth.price > median * 1.35) {
      out.push({
        id: "overpriced",
        severity: "info",
        message: `Priced $${booth.price} — above median $${median} for ${booth.category ?? "this category"}.`,
      });
    }
  } else if (booth.price == null) {
    out.push({ id: "unpriced-no-comp", severity: "warn", message: "No price set." });
  }

  if (booth.is_premium && !booth.is_corner) {
    out.push({
      id: "premium-not-corner",
      severity: "info",
      message: "Marked premium but not a corner booth — corner booths typically command a premium.",
    });
  }
  if (booth.is_corner && !booth.is_premium) {
    out.push({
      id: "corner-not-premium",
      severity: "info",
      message: "Corner booth — consider marking as premium.",
    });
  }
  if (booth.is_electric && booth.price == null) {
    out.push({
      id: "electric-unpriced",
      severity: "info",
      message: "Powered booth without a price — powered inventory usually carries a premium.",
    });
  }

  return out;
}
