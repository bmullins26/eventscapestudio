import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getVenueLayout, saveVenueLayout } from "@/lib/venue-designer.functions";
import { VenueDesignerV2 } from "@/components/venue-designer-v2/designer";
import type { AnyElement, Layout, LayoutSettings } from "@/components/venue-designer/types";

export const Route = createFileRoute("/_authenticated/studio/venues/$venueId/designer")({
  head: () => ({ meta: [{ title: "Layout Designer · EventScape Studio" }] }),
  component: VenueDesignerPage,
});

function VenueDesignerPage() {
  const { venueId } = Route.useParams();
  const fetchLayout = useServerFn(getVenueLayout);
  const save = useServerFn(saveVenueLayout);

  const { data, isLoading, error } = useQuery({
    queryKey: ["venue-layout", venueId],
    queryFn: () => fetchLayout({ data: { venueId } }),
  });

  const onSave = useCallback(async (layout: Layout) => {
    await save({
      data: {
        venueId,
        name: layout.name,
        settings: layout.settings as Record<string, unknown>,
        elements: layout.elements as unknown as Array<Record<string, unknown>>,
      },
    });
  }, [save, venueId]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-8 w-64" /></div>;
  if (error) return <div className="p-6 text-sm text-destructive">Failed to load venue.</div>;
  if (!data) return null;

  const initial: Layout = data.layout
    ? {
        name: data.layout.name,
        settings: (data.layout.settings ?? {}) as LayoutSettings,
        elements: (data.layout.elements ?? []) as unknown as AnyElement[],
      }
    : { name: data.venue.name ?? "Untitled layout", settings: {}, elements: [] };

  return <VenueDesignerV2 venueId={venueId} organizationId={data.venue.organization_id} venueName={data.venue.name} initial={initial} onSave={onSave} />;
}
