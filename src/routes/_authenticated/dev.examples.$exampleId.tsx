import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import WorkspaceApp, { WorkspaceDataProvider } from "@/components/venue-workspace-sdk/App";
import { DEMO_EXAMPLES } from "@/components/venue-workspace-sdk/demo-data";

export const Route = createFileRoute("/_authenticated/dev/examples/$exampleId")({
  head: ({ params }) => ({
    meta: [
      { title: `${(DEMO_EXAMPLES as any)[params.exampleId]?.title ?? "Example"} · Developer Examples` },
      { name: "description", content: "Read-only Venue Workspace example layout for development review." },
      { property: "og:title", content: `${(DEMO_EXAMPLES as any)[params.exampleId]?.title ?? "Example"} · Developer Examples` },
      { property: "og:description", content: "Read-only Venue Workspace example layout for development review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevExamplePage,
});

function DevExamplePage() {
  const { exampleId } = Route.useParams();
  const ex = (DEMO_EXAMPLES as any)[exampleId];
  if (!ex) throw notFound();
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background">
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 rounded-full bg-amber-500/90 text-white text-[11px] font-medium px-3 py-1 shadow-lg pointer-events-none">
        Developer Example — read-only, no save
      </div>
      <div className="absolute top-14 right-3 z-50">
        <Link to="/dev/examples" className="rounded bg-card border border-border text-xs px-2 py-1 text-foreground hover:bg-muted">← All examples</Link>
      </div>
      <WorkspaceDataProvider value={ex}>
        <WorkspaceApp />
      </WorkspaceDataProvider>
    </div>
  );
}
