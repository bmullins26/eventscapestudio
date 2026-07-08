import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Map, Store, DollarSign, Megaphone, Heart } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features · EventScape" },
      { name: "description", content: "Applications, booth maps, vendor CRM, sponsors, payments, and messaging — designed for craft shows, markets, and festivals." },
      { property: "og:title", content: "Features · EventScape" },
      { property: "og:description", content: "Every tool you need to run beautiful events." },
    ],
  }),
  component: FeaturesPage,
});

const FEATURES = [
  { icon: ClipboardCheck, title: "Vendor Applications", body: "One clean queue to review documents, approve, waitlist, or reject." },
  { icon: Map, title: "Drag-and-Drop Booth Map", body: "Design floors once per venue, reuse across every event, assign visually." },
  { icon: Store, title: "Vendor Directory (CRM)", body: "Notes, ratings, preferred booths, favorites, blacklist — your history in one place." },
  { icon: Heart, title: "Sponsor Management", body: "Tiers, contributions, and contacts organized per event." },
  { icon: DollarSign, title: "Manual Payment Tracking", body: "Mark invoices paid, partial, or refunded. Roll up revenue instantly." },
  { icon: Megaphone, title: "Announcements & Chat", body: "Reach every approved vendor or reply to a single message thread." },
];

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-primary">Features</p>
        <h1 className="mt-5 font-display text-5xl font-semibold sm:text-6xl">Every event, elegantly organized.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground">
          EventScape unifies applications, booths, vendors, sponsors, payments, and communication into one calm workspace.
        </p>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card-soft p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-deep"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

export function PublicHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link to="/"><Brand size="sm" /></Link>
      <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
        <Link to="/features" className="hover:text-foreground">Features</Link>
        <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
        <Link to="/about" className="hover:text-foreground">About</Link>
        <Link to="/contact" className="hover:text-foreground">Contact</Link>
      </nav>
      <div className="flex items-center gap-2">
        <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
        <Link to="/auth"><Button size="sm">Get started</Button></Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <p className="text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} EventScape · Plan · Organize · Create · Celebrate
      </p>
    </footer>
  );
}
