import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/routes/features";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · EventScape" },
      { name: "description", content: "EventScape is built for event organizers who care about the details." },
      { property: "og:title", content: "About · EventScape" },
      { property: "og:description", content: "Our mission: make every event beautifully organized." },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-primary">About</p>
        <h1 className="mt-5 font-display text-5xl font-semibold sm:text-6xl">Built for organizers who care about the details.</h1>
        <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
          EventScape was born out of years spent running craft shows, community markets, and festivals — and being frustrated with clunky, transactional software. We wanted a tool that felt as warm as the events themselves.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Today, EventScape powers organizations of every size. Each event, each vendor, each sponsor — thoughtfully connected, never duplicated. It's how we plan, organize, create, and celebrate.
        </p>
      </section>
      <PublicFooter />
    </div>
  ),
});
