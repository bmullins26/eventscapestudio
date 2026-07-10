import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Camera, Loader2, LayoutTemplate, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  listVenueTemplates,
  createEventVenueSnapshot,
  getEventVenueSnapshot,
} from "@/lib/venue-designer.functions";

export const Route = createFileRoute("/_authenticated/studio/events/$eventId/venue")({
  head: () => ({ meta: [{ title: "Event Venue Map · EventScape Studio" }] }),
  component: EventVenueMapPage,
});

function EventVenueMapPage() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const fetchSnapshot = useServerFn(getEventVenueSnapshot);
  const fetchTemplates = useServerFn(listVenueTemplates);
  const createSnapshot = useServerFn(createEventVenueSnapshot);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("__current");

  const { data: event } = useQuery({
    queryKey: ["event-basic", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, venue_id, venues:venues(id, name)")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const venueId = (event as any)?.venue_id ?? null;
  const venueName = (event as any)?.venues?.name ?? "";

  const snapshotKey = ["event-venue-snapshot", eventId];
  const { data: snapshot, isLoading: loadingSnapshot } = useQuery({
    queryKey: snapshotKey,
    queryFn: () => fetchSnapshot({ data: { eventId } }),
  });

  const templatesKey = ["venue-templates", venueId];
  const { data: templates = [] } = useQuery({
    queryKey: templatesKey,
    enabled: !!venueId,
    queryFn: () => fetchTemplates({ data: { venueId: venueId! } }),
  });

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error("Event has no venue linked");
      const templateId = selectedTemplateId === "__current" ? null : selectedTemplateId;
      return createSnapshot({ data: { eventId, venueId, templateId } });
    },
    onSuccess: (res: any) => {
      toast.success(res?.updated ? "Snapshot refreshed" : "Venue snapshot captured");
      qc.invalidateQueries({ queryKey: snapshotKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Snapshot failed"),
  });

  const model: any = (snapshot as any)?.model ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/studio/events" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to events
        </Link>
      </div>

      <PageHeader
        eyebrow="Event"
        title={(event as any)?.name ?? "Event venue map"}
        description={venueName ? `Venue: ${venueName}` : "Snapshot the venue design so this event has its own frozen copy of the map."}
        actions={
          venueId ? (
            <Link
              to="/studio/venues/$venueId/designer"
              params={{ venueId }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Open designer <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null
        }
      />

      {!venueId ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No venue linked"
          description="Assign this event to a venue first (from the event edit sheet)."
        />
      ) : (
        <>
          <div className="card-soft space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <Label className="text-xs">Snapshot source</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__current">Current live venue design</SelectItem>
                    {(templates as any[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        v{t.version} · {t.label ?? "Untitled"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Snapshots freeze the venue layout for this event so later changes to the venue don't affect it.
                </p>
              </div>
              <Button onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
                {snapshotMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Capturing…</>
                ) : (
                  <><Camera className="mr-2 h-4 w-4" />{snapshot ? "Refresh snapshot" : "Capture snapshot"}</>
                )}
              </Button>
            </div>
            {snapshot ? (
              <p className="text-xs text-muted-foreground">
                Last snapshot: {new Date((snapshot as any).updated_at).toLocaleString()}
                {(snapshot as any).venue_template_id ? " · from published version" : " · from live design"}
              </p>
            ) : null}
          </div>

          {loadingSnapshot ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !model ? (
            <EmptyState
              icon={Camera}
              title="No snapshot yet"
              description="Capture a snapshot to freeze this event's venue map."
            />
          ) : (
            <SnapshotViewer model={model} />
          )}
        </>
      )}
    </div>
  );
}

function SnapshotViewer({ model }: { model: any }) {
  const width = model.venue?.canvas_width ?? 2000;
  const height = model.venue?.canvas_height ?? 1500;
  const layersById = useMemo(
    () => Object.fromEntries((model.layers ?? []).map((l: any) => [l.id, l])),
    [model.layers]
  );

  return (
    <div className="card-soft overflow-hidden">
      <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        {model.venue?.name} · {width} × {height} {model.venue?.units ?? "ft"} · {(model.objects ?? []).length} objects
      </div>
      <div className="relative aspect-[4/3] w-full bg-muted/20">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
        >
          <rect x={0} y={0} width={width} height={height} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={2} />
          {(model.objects ?? []).map((o: any) => {
            const layer = o.layer_id ? layersById[o.layer_id] : null;
            if (layer && layer.visible === false) return null;
            if (o.hidden) return null;
            const g = o.geometry ?? {};
            const style = o.style ?? {};
            const fill = style.fill ?? "#e5e7eb";
            const stroke = style.stroke ?? "#4b5563";
            const opacity = layer?.opacity ?? 1;
            if (o.shape === "circle") {
              const r = Math.max(g.w ?? 0, g.h ?? 0) / 2;
              return (
                <g key={o.id} opacity={opacity}>
                  <circle cx={(g.x ?? 0) + r} cy={(g.y ?? 0) + r} r={r} fill={fill} stroke={stroke} strokeWidth={0.5} />
                </g>
              );
            }
            return (
              <g key={o.id} opacity={opacity} transform={g.rotation ? `rotate(${g.rotation} ${(g.x ?? 0) + (g.w ?? 0) / 2} ${(g.y ?? 0) + (g.h ?? 0) / 2})` : undefined}>
                <rect x={g.x ?? 0} y={g.y ?? 0} width={g.w ?? 0} height={g.h ?? 0} fill={fill} stroke={stroke} strokeWidth={0.5} />
                {o.name ? (
                  <text
                    x={(g.x ?? 0) + (g.w ?? 0) / 2}
                    y={(g.y ?? 0) + (g.h ?? 0) / 2}
                    fontSize={Math.min(g.w ?? 12, g.h ?? 12) * 0.35}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="hsl(var(--foreground))"
                    style={{ pointerEvents: "none" }}
                  >
                    {o.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
