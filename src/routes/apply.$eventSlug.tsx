import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CalendarDays, CheckCircle2 } from "lucide-react";
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
    const { data: ev } = await client.from("events").select("id, organization_id, name, description, starts_at, ends_at, slug, is_public, applications_open, is_template").eq("slug", data.slug).eq("is_public", true).eq("applications_open", true).eq("is_template", false).maybeSingle();
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
  const [form, setForm] = useState({
    business_name: "", contact_name: "", email: "", phone: "",
    products_sold: "", size_requested: "", needs_electricity: false,
    special_requests: "", payment_amount: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!form.business_name.trim()) { setError("Business name is required"); return; }
    setSubmitting(true);
    try {
      // Create an unclaimed vendor_profile then application (all under anon key)
      const { data: vp, error: vpErr } = await supabase.from("vendor_profiles").insert({
        business_name: form.business_name.trim(),
        contact_name: form.contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
      }).select("id").single();
      if (vpErr) throw vpErr;

      const { error: aErr } = await supabase.from("applications").insert({
        organization_id: event.organization_id,
        event_id: event.id,
        vendor_profile_id: vp.id,
        status: "pending",
        entry_method: "public_form",
        business_name: form.business_name.trim(),
        contact_name: form.contact_name || null,
        applicant_email: form.email || null,
        applicant_phone: form.phone || null,
        products_sold: form.products_sold || null,
        size_requested: form.size_requested || null,
        needs_electricity: form.needs_electricity,
        special_requests: form.special_requests || null,
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

        <div className="card-soft p-6 space-y-4">
          <Field label="Business name *"><Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></Field>
          <Field label="Contact name"><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="What do you sell?"><Textarea rows={3} value={form.products_sold} onChange={(e) => setForm({ ...form, products_sold: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Booth size"><Input placeholder="10x10" value={form.size_requested} onChange={(e) => setForm({ ...form, size_requested: e.target.value })} /></Field>
            <Field label="Payment amount"><Input type="number" value={form.payment_amount} onChange={(e) => setForm({ ...form, payment_amount: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2"><Checkbox checked={form.needs_electricity} onCheckedChange={(v) => setForm({ ...form, needs_electricity: !!v })} /> Need electricity?</label>
          <Field label="Special requests"><Textarea rows={2} value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} /></Field>
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
