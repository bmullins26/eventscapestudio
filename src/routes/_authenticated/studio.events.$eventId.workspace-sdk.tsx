import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import WorkspaceApp, { WorkspaceDataProvider, type WorkspaceCtx } from "@/components/venue-workspace-sdk/App";
import { getEventWorkspaceSdk, patchEventBooth, patchVenueLayer } from "@/lib/workspace-sdk.functions";

const wsQueryOptions = (eventId: string) =>
  queryOptions({
    queryKey: ["workspace-sdk", eventId],
    queryFn: () => getEventWorkspaceSdk({ data: { eventId } }),
  });

export const Route = createFileRoute("/_authenticated/studio/events/$eventId/workspace-sdk")({
  head: () => ({ meta: [{ title: "Workspace — EventScape Studio" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(wsQueryOptions(params.eventId)),
  component: WorkspaceRoute,
});

// Map real event_booths → SDK Booth shape (row/col derived from code, positions from x/y/width/height).
function toSdkBooth(b: any, applications: any[], payments: any[]): any {
  const m = /^([A-Za-z]+)(\d+)/.exec(b.code ?? "");
  const row = m?.[1] ?? "?";
  const col = m ? Number(m[2]) : 0;

  const app = applications.find((a) => a.assigned_booth_id === b.id);
  const pay = app ? payments.find((p) => p.application_id === app.id) : null;

  let status: "available" | "reserved" | "paid" | "pending" | "sponsor" | "unavailable" = "available";
  if (b.status === "blocked") status = "unavailable";
  else if (pay?.status === "paid") status = "paid";
  else if (b.status === "assigned" || b.vendor_profile_id) status = "reserved";
  else if (app && (app.status === "pending" || app.status === "awaiting_payment")) status = "pending";
  if (b.category === "Sponsor" || b.is_premium && b.category?.toLowerCase().includes("sponsor")) status = "sponsor";

  return {
    id: b.code ?? b.id,
    row, col,
    x: Number(b.x ?? 0), y: Number(b.y ?? 0),
    w: Number(b.width ?? 72), h: Number(b.height ?? 58),
    status,
    vendor: b.vendor_profiles?.business_name ?? undefined,
    category: b.category ?? undefined,
    price: Number(b.price ?? 0),
    electric: !!b.is_electric,
    water: !!b.is_water,
    corner: !!b.is_corner,
    premium: !!b.is_premium,
    size: b.size_label ?? `${Math.round(Number(b.width ?? 0))}×${Math.round(Number(b.height ?? 0))}`,
    __dbId: b.id,
  };
}

function WorkspaceRoute() {
  const { eventId } = Route.useParams();
  const { data } = useSuspenseQuery(wsQueryOptions(eventId));
  const qc = useQueryClient();
  const patchBooth = useServerFn(patchEventBooth);
  const patchLayer = useServerFn(patchVenueLayer);

  const boothMut = useMutation({
    mutationFn: patchBooth,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-sdk", eventId] }),
  });
  const layerMut = useMutation({
    mutationFn: patchLayer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-sdk", eventId] }),
  });

  const booths = useMemo(
    () => (data.booths ?? []).map((b: any) => toSdkBooth(b, data.applications ?? [], data.payments ?? [])),
    [data.booths, data.applications, data.payments],
  );

  const layers = useMemo(
    () =>
      (data.layers ?? []).map((l: any) => ({
        id: l.id,
        name: l.name,
        color: l.color ?? "#888",
        visible: !!l.visible,
        locked: !!l.locked,
        kind: l.kind ?? "custom",
      })),
    [data.layers],
  );

  const ctx: WorkspaceCtx = {
    venueName: data.venue?.name ?? "Venue",
    eventName: data.event?.name ?? "Event",
    booths,
    layers,
    onPatchBooth: (sdkId, patch) => {
      const src = (data.booths ?? []).find((b: any) => (b.code ?? b.id) === sdkId);
      if (!src) return;
      boothMut.mutate({
        data: {
          id: src.id,
          ...(patch.price !== undefined ? { price: patch.price as number | null } : {}),
          ...(patch.category !== undefined ? { category: patch.category as string | null } : {}),
          ...(patch.electric !== undefined ? { is_electric: !!patch.electric } : {}),
          ...(patch.water !== undefined ? { is_water: !!patch.water } : {}),
          ...(patch.premium !== undefined ? { is_premium: !!patch.premium } : {}),
          ...(patch.corner !== undefined ? { is_corner: !!patch.corner } : {}),
          ...(patch.staff_notes !== undefined ? { staff_notes: patch.staff_notes } : {}),
          ...(patch.vendor_notes !== undefined ? { vendor_notes: patch.vendor_notes } : {}),
        },
      });
    },
    onLayerToggle: (id, patch) => layerMut.mutate({ data: { id, ...patch } }),
  };

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background">
      <WorkspaceDataProvider value={ctx}>
        <WorkspaceApp />
      </WorkspaceDataProvider>
    </div>
  );
}
