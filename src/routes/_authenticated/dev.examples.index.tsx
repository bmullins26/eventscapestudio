import { createFileRoute, Link } from "@tanstack/react-router";
import { DEMO_EXAMPLES } from "@/components/venue-workspace-sdk/demo-data";
import { PageHeader } from "@/components/shared/page-header";

export const Route = createFileRoute("/_authenticated/dev/examples/")({
  head: () => ({
    meta: [
      { title: "Developer Examples · EventScape" },
      { name: "description", content: "Read-only Venue Workspace demonstration layouts." },
      { property: "og:title", content: "Developer Examples · EventScape" },
      { property: "og:description", content: "Read-only Venue Workspace demonstration layouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevExamplesIndex,
});

function DevExamplesIndex() {
  const entries = Object.entries(DEMO_EXAMPLES);
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <PageHeader
        eyebrow="Developer"
        title="Venue Workspace Examples"
        description="These layouts are for demonstration only. Nothing saves to the database."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {entries.map(([id, ex]) => (
          <li key={id}>
            <Link
              to="/dev/examples/$exampleId"
              params={{ exampleId: id }}
              className="block rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="text-sm font-semibold text-foreground">{ex.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{ex.blurb}</div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                {(ex.booths?.length ?? 0)} booths · {(ex.objects?.length ?? 0)} objects
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
