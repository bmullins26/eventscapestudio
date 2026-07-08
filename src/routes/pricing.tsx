import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/routes/features";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing · EventScape" },
      { name: "description", content: "Simple pricing built for craft shows, markets, and festivals of every size." },
      { property: "og:title", content: "Pricing · EventScape" },
      { property: "og:description", content: "Transparent tiers for organizers of every size." },
    ],
  }),
  component: PricingPage,
});

const TIERS = [
  { name: "Starter", price: "Free", period: "forever", features: ["1 active event", "Up to 25 vendors", "Basic booth map", "Manual payment tracking"], cta: "Start free" },
  { name: "Studio", price: "$49", period: "per month", features: ["Unlimited events", "Unlimited vendors", "Drag-and-drop booth designer", "Sponsors, staff, permissions", "Priority support"], cta: "Start Studio", highlight: true },
  { name: "Enterprise", price: "Custom", period: "annual", features: ["Multiple organizations", "Dedicated success manager", "Custom integrations", "SLA & DPA"], cta: "Contact sales" },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-primary">Pricing</p>
        <h1 className="mt-5 font-display text-5xl font-semibold sm:text-6xl">Priced for real event businesses.</h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground">Start free. Upgrade when your show grows. No per-vendor fees.</p>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.name} className={`card-soft p-6 ${t.highlight ? "ring-2 ring-primary" : ""}`}>
              <h3 className="font-display text-xl font-semibold">{t.name}</h3>
              <p className="mt-3"><span className="text-4xl font-semibold">{t.price}</span> <span className="text-sm text-muted-foreground">{t.period}</span></p>
              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-sage" /><span>{f}</span></li>
                ))}
              </ul>
              <Link to="/auth" className="mt-6 block"><Button className="w-full" variant={t.highlight ? "default" : "outline"}>{t.cta}</Button></Link>
            </div>
          ))}
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
