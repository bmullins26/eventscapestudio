import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Map, Store, DollarSign, Megaphone, Heart } from "lucide-react";
import { isDevelopmentMode } from "@/lib/development-access";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (isDevelopmentMode()) {
      throw redirect({ to: "/app" });
    }
  },
  component: Landing,
});

const FEATURES = [
  { icon: ClipboardCheck, title: "Vendor Applications", body: "Collect applications, review documents, approve or waitlist — all in one queue." },
  { icon: Map, title: "Drag-and-Drop Booth Map", body: "Design your floor plan visually, then assign booths to approved vendors with a click." },
  { icon: Store, title: "Vendor Portal", body: "Vendors apply, upload logos and docs, view assignments, and pay invoices themselves." },
  { icon: DollarSign, title: "Manual Payment Tracking", body: "Mark invoices paid, track partial payments, and roll up revenue per event." },
  { icon: Megaphone, title: "Announcements & Chat", body: "Reach every vendor with announcements or reply to individual questions inline." },
  { icon: Heart, title: "Sponsors & Reports", body: "Curate sponsor tiers, celebrate contributors, and export the data you need." },
];

function Landing() {
  const appDestination = isDevelopmentMode() ? "/app" : "/auth";

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Brand size="sm" />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/features" className="hover:text-foreground">Features</Link>
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/about" className="hover:text-foreground">About</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to={appDestination}><Button variant="ghost" size="sm">{isDevelopmentMode() ? "Open workspace" : "Sign in"}</Button></Link>
          <Link to={appDestination}><Button size="sm">{isDevelopmentMode() ? "Open studio" : "Get started"}</Button></Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.94_0.05_20/0.6),transparent_55%)]" />
        <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-primary">Plan · Organize · Create · Celebrate</p>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-tight text-foreground sm:text-7xl">
            The elegant home <span className="italic text-primary">for every event</span> you run.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            EventScape is the all-in-one platform for craft shows, vendor markets, festivals, and community events. Manage applications, booths, vendors, and payments — beautifully.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={appDestination}><Button size="lg" className="rounded-full px-8">{isDevelopmentMode() ? "Open workspace" : "Start your studio"}</Button></Link>
            <Link to={appDestination}><Button size="lg" variant="outline" className="rounded-full px-8">{isDevelopmentMode() ? "Open portal" : "I'm a vendor"}</Button></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card-soft p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-deep">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} EventScape · Plan · Organize · Create · Celebrate
        </p>
      </footer>
    </div>
  );
}
