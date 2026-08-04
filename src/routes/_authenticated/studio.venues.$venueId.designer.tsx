import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";
import WorkspaceApp, {
  WorkspaceDataProvider,
  type WorkspaceCtx,
  type WorkspaceSaveState,
} from "@/components/venue-workspace-sdk/App";
import { isDevelopmentMode } from "@/lib/development-access";
import { getVenueLayout, saveVenueLayout } from "@/lib/venue-designer.functions";
import { fromLayout, toLayout } from "@/lib/workspace-adapter";

type DesignerVenue = { id: string; name: string | null; organization_id: string | null };
type DesignerLayout = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  elements: Array<Record<string, unknown>>;
  updated_at: string;
};
type DesignerPayload = { venue: DesignerVenue; layout: DesignerLayout | null };

const DEV_VENUES_STORAGE_PREFIX = "eventscape-dev-venues:";
const DEV_VENUE_LAYOUT_STORAGE_PREFIX = "eventscape-dev-venue-layout:";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readDevVenueFromStorage(venueId: string): DesignerVenue | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(DEV_VENUES_STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const venues = JSON.parse(raw) as Array<{ id: string; name?: string | null; organization_id?: string | null }>;
      const match = venues.find((venue) => venue.id === venueId);
      if (match) {
        return {
          id: match.id,
          name: match.name ?? "Venue",
          organization_id: match.organization_id ?? null,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function readDevLayoutFromStorage(venueId: string): DesignerLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${DEV_VENUE_LAYOUT_STORAGE_PREFIX}${venueId}`);
    if (!raw) return null;
    return JSON.parse(raw) as DesignerLayout;
  } catch {
    return null;
  }
}

function writeDevLayoutToStorage(venueId: string, layout: DesignerLayout) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${DEV_VENUE_LAYOUT_STORAGE_PREFIX}${venueId}`, JSON.stringify(layout));
}

function getDevDesignerPayload(venueId: string): DesignerPayload {
  const venue = readDevVenueFromStorage(venueId) ?? {
    id: venueId,
    name: "Venue",
    organization_id: null,
  };
  return {
    venue,
    layout: readDevLayoutFromStorage(venueId),
  };
}

const layoutQuery = (venueId: string) =>
  queryOptions({
    queryKey: ["venue-layout", venueId],
    queryFn: async () => {
      if (isDevelopmentMode() || !isUuid(venueId)) {
        return getDevDesignerPayload(venueId);
      }
      return getVenueLayout({ data: { venueId } });
    },
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
  loader: ({ context, params }) => {
    if (isDevelopmentMode() || !isUuid(params.venueId)) return null;
    return context.queryClient.ensureQueryData(layoutQuery(params.venueId));
  },
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

      if (isDevelopmentMode() || !isUuid(venueId)) {
        const now = new Date().toISOString();
        const existing = readDevLayoutFromStorage(venueId);
        writeDevLayoutToStorage(venueId, {
          id: existing?.id ?? `dev-layout-${venueId}`,
          name: data.layout?.name ?? data.venue.name ?? "Venue layout",
          settings,
          elements,
          updated_at: now,
        });
        qc.invalidateQueries({ queryKey: ["venue-layout", venueId] });
        return;
      }

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
    organizationId: data.venue.organization_id ?? undefined,
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
