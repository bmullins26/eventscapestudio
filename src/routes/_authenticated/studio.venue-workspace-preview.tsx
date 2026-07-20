import { createFileRoute } from "@tanstack/react-router";
import WorkspaceApp, { WorkspaceDataProvider } from "@/components/venue-workspace-sdk/App";
import { DEMO_WORKSPACE_CTX } from "@/components/venue-workspace-sdk/demo-data";

export const Route = createFileRoute("/_authenticated/studio/venue-workspace-preview")({
  head: () => ({
    meta: [{ title: "Venue Workspace Preview — EventScape Studio" }],
  }),
  component: VenueWorkspacePreviewPage,
});

function VenueWorkspacePreviewPage() {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background">
      <WorkspaceDataProvider value={DEMO_WORKSPACE_CTX}>
        <WorkspaceApp />
      </WorkspaceDataProvider>
    </div>
  );
}
