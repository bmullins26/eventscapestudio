CREATE TABLE public.workspace_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  layer_id uuid REFERENCES public.venue_layers(id) ON DELETE SET NULL,
  event_booth_id uuid REFERENCES public.event_booths(id) ON DELETE SET NULL,
  kind text NOT NULL,
  geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  z_index integer NOT NULL DEFAULT 0,
  locked boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workspace_objects_venue_id_idx ON public.workspace_objects(venue_id);
CREATE INDEX workspace_objects_event_id_idx ON public.workspace_objects(event_id);
CREATE INDEX workspace_objects_layer_id_idx ON public.workspace_objects(layer_id);
CREATE INDEX workspace_objects_event_booth_id_idx ON public.workspace_objects(event_booth_id);
CREATE INDEX workspace_objects_kind_idx ON public.workspace_objects(kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_objects TO authenticated;
GRANT ALL ON public.workspace_objects TO service_role;

ALTER TABLE public.workspace_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workspace objects"
  ON public.workspace_objects
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can insert workspace objects"
  ON public.workspace_objects
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can update workspace objects"
  ON public.workspace_objects
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can delete workspace objects"
  ON public.workspace_objects
  FOR DELETE
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE TRIGGER set_updated_at_workspace_objects
  BEFORE UPDATE ON public.workspace_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();