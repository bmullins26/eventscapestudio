
-- Event Venue Snapshots: freeze a venue's design into an event
CREATE TABLE public.event_venue_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  venue_template_id UUID REFERENCES public.venue_templates(id) ON DELETE SET NULL,
  label TEXT,
  model JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_venue_snapshots TO authenticated;
GRANT ALL ON public.event_venue_snapshots TO service_role;

ALTER TABLE public.event_venue_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage event snapshots"
ON public.event_venue_snapshots FOR ALL
TO authenticated
USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)))
WITH CHECK (public.is_org_member(auth.uid(), public.event_org_id(event_id)));

CREATE INDEX idx_event_venue_snapshots_event ON public.event_venue_snapshots(event_id);
CREATE INDEX idx_event_venue_snapshots_venue ON public.event_venue_snapshots(venue_id);

CREATE TRIGGER trg_event_venue_snapshots_updated_at
BEFORE UPDATE ON public.event_venue_snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
