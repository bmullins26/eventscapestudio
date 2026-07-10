
CREATE TABLE IF NOT EXISTS public.venue_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE UNIQUE,
  name text NOT NULL DEFAULT 'Untitled layout',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_layouts TO authenticated;
GRANT ALL ON public.venue_layouts TO service_role;

ALTER TABLE public.venue_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view venue layouts"
  ON public.venue_layouts FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can insert venue layouts"
  ON public.venue_layouts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can update venue layouts"
  ON public.venue_layouts FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can delete venue layouts"
  ON public.venue_layouts FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE TRIGGER venue_layouts_updated_at
  BEFORE UPDATE ON public.venue_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
