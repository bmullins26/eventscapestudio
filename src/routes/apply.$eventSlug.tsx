import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CalendarDays, CheckCircle2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Brand } from "@/components/shared/brand";

// Public event fetcher — uses anon key + narrow public policy
const getPublicEvent = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: ev } = await client
      .from("events")
      .select("id, organization_id, name, description, starts_at, ends_at, slug, is_public, applications_open, is_template")
      .eq("slug", data.slug).eq("is_public", true).eq("applications_open", true).eq("is_template", false)
      .maybeSingle();
    if (!ev) return null;
    return {
      id: ev.id,
      organization_id: ev.organization_id,
      name: ev.name,
      description: ev.description,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      slug: ev.slug,
    };
  });

// Returning-vendor lookup for pre-fill (matches by email inside this organization)
const lookupVendor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ organizationId: z.string().uuid(), email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: ov } = await client
      .from("organization_vendors")
      .select("vendor_profile_id, vendor_profiles(business_name, contact_name, email, phone, website, business_description, product_categories)")
      .eq("organization_id", data.organizationId)
      .limit(200);
    const match = (ov ?? []).find((r: any) => r.vendor_profiles?.email?.toLowerCase() === data.email.toLowerCase());
    if (!match) return null;
    return { vendor_profile_id: match.vendor_profile_id, profile: match.vendor_profiles };
  });

export const Route = createFileRoute("/apply/$eventSlug")({
  loader: async ({ params }) => {
    const ev = await getPublicEvent({ data: { slug: params.eventSlug } });
    if (!ev) throw notFound();
    return { event: ev };
  },
  errorComponent: ({ error }) => <div className="p-10 text-center">{error.message}</div>,
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="font-display text-2xl">Event not found</h1>
      <p className="text-muted-foreground mt-2">This event isn't accepting applications right now.</p>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `Apply · ${loaderData.event.name}` },
      { name: "description", content: `Submit a vendor application to ${loaderData.event.name}.` },
    ] : [],
  }),
  component: ApplyPage,
});

function ApplyPage() {
  const { event } = Route.useLoaderData();
  const [returningVendorId, setReturningVendorId] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [form, setForm] = useState({
    // Vendor Profile fields (Organization Intake)
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    business_description: "",
    product_categories: "",
    // Event-specific fields
    booth_size: "",
    needs_electricity: false,
    bringing_products: "",
    special_requests: "",
    sponsor_interest: false,
    volunteer_interest: false,
    payment_amount: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runLookup = async () => {
    if (!form.email.trim()) return;
    setLookingUp(true);
    try {
      const result = await lookupVendor({ data: { organizationId: event.organization_id, email: form.email.trim() } });
      if (result?.profile) {
        setReturningVendorId(result.vendor_profile_id);
        const p: any = result.profile;
        setForm((f) => ({
          ...f,
          business_name: p.business_name ?? f.business_name,
          contact_name: p.contact_name ?? f.contact_name,
          phone: p.phone ?? f.phone,
          website: p.website ?? f.website,
          business_description: p.business_description ?? f.business_description,
          product_categories: Array.isArray(p.product_categories) ? p.product_categories.join(", ") : f.product_categories,
        }));
      } else {
        setReturningVendorId(null);
      }
    } catch {
      /* silent */
    } finally {
      setLookingUp(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!form.business_name.trim()) { setError("Business name is required"); return; }
    setSubmitting(true);
    try {
      const categories = form.product_categories.split(",").map((s) => s.trim()).filter(Boolean);
      let vendorProfileId = returningVendorId;

      if (vendorProfileId) {
        // Returning vendor — update permanent profile with any changes
        await supabase.from("vendor_profiles").update({
          business_name: form.business_name.trim(),
          contact_name: form.contact_name || null,
          email: form.email || null,
          phone: form.phone || null,
          website: form.website || null,
          business_description: form.business_description || null,
          product_categories: categories,
        }).eq("id", vendorProfileId);
      } else {
        // First-time vendor — create the permanent Organization Vendor Profile
        const { data: vp, error: vpErr } = await supabase.from("vendor_profiles").insert({
          business_name: form.business_name.trim(),
          contact_name: form.contact_name || null,
          email: form.email || null,
          phone: form.phone || null,
          website: form.website || null,
          business_description: form.business_description || null,
          product_categories: categories,
          intake_completed_at: new Date().toISOString(),
        }).select("id").single();
        if (vpErr) throw vpErr;
        vendorProfileId = vp.id;
      }

      // Always create a new Event Application record
      const { error: aErr } = await supabase.from("applications").insert({
        organization_id: event.organization_id,
        event_id: event.id,
        vendor_profile_id: vendorProfileId,
        status: "pending",
        entry_method: "public_form",
        business_name: form.business_name.trim(),
        contact_name: form.contact_name || null,
        applicant_email: form.email || null,
        applicant_phone: form.phone || null,
        booth_size: form.booth_size || null,
        size_requested: form.booth_size || null,
        needs_electricity: form.needs_electricity,
        bringing_products: form.bringing_products || null,
        products_sold: form.bringing_products || null,
        special_requests: form.special_requests || null,
        sponsor_interest: form.sponsor_interest,
        volunteer_interest: form.volunteer_interest,
        payment_amount: form.payment_amount ? Number(form.payment_amount) : null,
      });
      if (aErr) throw aErr;
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-success mb-4" />
        <h1 className="font-display text-3xl">Application received</h1>
        <p className="text-muted-foreground mt-2 max-w-md">Thanks — the organizer will be in touch. Feel free to close this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-6 py-4">
        <Brand />
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-primary">
            <CalendarDays className="h-4 w-4" /> Vendor application
          </div>
          <h1 className="mt-2 font-display text-3xl">{event.name}</h1>
          {event.starts_at && <p className="text-sm text-muted-foreground mt-1">{new Date(event.starts_at).toLocaleDateString()}{event.ends_at && ` – ${new Date(event.ends_at).toLocaleDateString()}`}</p>}
          {event.description && <p className="mt-4 whitespace-pre-wrap">{event.description}</p>}
        </div>

        <div className="card-soft p-6 space-y-6">
          {/* Returning vendor lookup */}
          <div className="rounded-lg bg-muted/40 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Applied to this organizer before?</p>
            <div className="flex gap-2">
              <Input type="email" placeholder="you@business.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Button type="button" variant="secondary" onClick={runLookup} disabled={lookingUp || !form.email}>
                <Search className="mr-2 h-4 w-4" />{lookingUp ? "Checking…" : "Look up"}
              </Button>
            </div>
            {returningVendorId && <p className="text-xs text-success">Welcome back — we pre-filled your business info.</p>}
          </div>

          {/* Organization Vendor Intake — permanent profile */}
          <section className="space-y-4">
            <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Business profile</h2>
            <Field label="Business name *"><Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact name"><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <Field label="Website"><Input placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
            <Field label="Business description"><Textarea rows={3} value={form.business_description} onChange={(e) => setForm({ ...form, business_description: e.target.value })} /></Field>
            <Field label="Product categories (comma separated)"><Input placeholder="Handmade, Food, Art" value={form.product_categories} onChange={(e) => setForm({ ...form, product_categories: e.target.value })} /></Field>
          </section>

          {/* Event-specific fields */}
          <section className="space-y-4 border-t border-border/60 pt-6">
            <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">This event</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Booth size"><Input placeholder="10x10" value={form.booth_size} onChange={(e) => setForm({ ...form, booth_size: e.target.value })} /></Field>
              <Field label="Payment amount"><Input type="number" value={form.payment_amount} onChange={(e) => setForm({ ...form, payment_amount: e.target.value })} /></Field>
            </div>
            <Field label="Products bringing to this event"><Textarea rows={2} value={form.bringing_products} onChange={(e) => setForm({ ...form, bringing_products: e.target.value })} /></Field>
            <Field label="Special requests"><Textarea rows={2} value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} /></Field>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.needs_electricity} onCheckedChange={(v) => setForm({ ...form, needs_electricity: !!v })} /> Need electricity</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.sponsor_interest} onCheckedChange={(v) => setForm({ ...form, sponsor_interest: !!v })} /> Interested in sponsorship</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.volunteer_interest} onCheckedChange={(v) => setForm({ ...form, volunteer_interest: !!v })} /> Interested in volunteering</label>
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="lg" onClick={submit} disabled={submitting} className="w-full">{submitting ? "Submitting…" : "Submit application"}</Button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
