import { createFileRoute } from "@tanstack/react-router";
import SdkApp from "@/components/venue-workspace-preview/SdkApp";

export const Route = createFileRoute("/_authenticated/studio/venue-workspace-preview")({
  head: () => ({
    meta: [{ title: "Venue Workspace Preview — EventScape Studio" }],
  }),
  component: VenueWorkspacePreviewPage,
});

function VenueWorkspacePreviewPage() {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background">
      <SdkApp />
    </div>
  );
}
