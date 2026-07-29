import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";
import WorkspaceApp, {
  WorkspaceDataProvider,
  type WorkspaceCtx,
  type WorkspaceSaveState,
} from "@/components/venue-workspace-sdk/App";
import { getVenueLayout, saveVenueLayout } from "@/lib/venue-designer.functions";
import { fromLayout, toLayout } from "@/lib/workspace-adapter";

const layoutQuery = (venueId: string) =>
  queryOptions({
    queryKey: ["venue-layout", venueId],
    queryFn: () => getVenueLayout({ data: { venueId } }),
  });

export const Route = createFileRoute("/_authenticated/studio/venues/$venueId/designer")({
  head: () => ({
    meta: [
      { title: "Venue Workspace · EventScape Studio" },
      { name: "description", content: "Build an empty, production venue workspace with saved objects, layers, and reference backgrounds." },
      { property: "og:title", content: "Venue Workspace · EventScape Studio" },
      { property: "og:description", content: "Build an empty, production venue workspace with saved objects, layers, and reference backgrounds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(layoutQuery(params.venueId)),
  component: VenueDesignerPage,
});

function VenueDesignerPage() {
  const { venueId } = Route.useParams();
  const { data } = useSuspenseQuery(layoutQuery(venueId));
  const qc = useQueryClient();
  const save = useServerFn(saveVenueLayout);

  const { booths, objects, background, canvas } = useMemo(
    () => fromLayout(data.layout?.elements ?? [], data.layout?.settings ?? {}),
    [data.layout],
  );

  const onSave = useCallback(
    async (state: WorkspaceSaveState) => {
      const { elements, settings } = toLayout({
        booths: state.booths,
        objects: state.objects,
        background: state.background,
        canvas: state.canvas,
      });
      await save({
        data: {
          venueId,
          name: data.layout?.name ?? data.venue.name ?? "Venue layout",
          settings,
          elements,
        },
      });
      qc.invalidateQueries({ queryKey: ["venue-layout", venueId] });
    },
    [save, venueId, data.layout?.name, data.venue.name, qc],
  );

  const ctx: WorkspaceCtx = {
    venueName: data.venue.name ?? "Venue",
    eventName: "", // venue mode — vendor assignments persist as Venue Assignments
    organizationId: data.venue.organization_id,
    booths,
    objects,
    initialBackground: background,
    initialCanvas: canvas,
    workspaceMode: "blank",
    layers: [],
    onSave,
  };

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background">
      <WorkspaceDataProvider value={ctx}>
        <WorkspaceApp />
      </WorkspaceDataProvider>
    </div>
  );
}
