
-- Extend venues
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS canvas_width numeric NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS canvas_height numeric NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS units text NOT NULL DEFAULT 'feet',
  ADD COLUMN IF NOT EXISTS default_view jsonb NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.venue_object_type AS ENUM (
    'booth','building','road','walkway','parking','utility','tree','fence','stage','pavilion',
    'food_court','beer_garden','restroom','table','bench','trash','sign','sponsor_banner',
    'registration','info','ticket','first_aid','atm','kids_area','petting_zoo','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.venue_object_shape AS ENUM ('rect','polygon','line','circle','text','path');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.venue_layer_kind AS ENUM ('reference','buildings','roads','utilities','booths','labels','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- venue_layers
CREATE TABLE IF NOT EXISTS public.venue_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind public.venue_layer_kind NOT NULL DEFAULT 'custom',
  visible boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  opacity numeric NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venue_layers_venue_idx ON public.venue_layers(venue_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_layers TO authenticated;
GRANT ALL ON public.venue_layers TO service_role;
ALTER TABLE public.venue_layers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venue_layers_org_members_read" ON public.venue_layers FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
CREATE POLICY "venue_layers_org_members_write" ON public.venue_layers FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
CREATE TRIGGER venue_layers_set_updated_at BEFORE UPDATE ON public.venue_layers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- venue_objects
CREATE TABLE IF NOT EXISTS public.venue_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  layer_id uuid REFERENCES public.venue_layers(id) ON DELETE SET NULL,
  type public.venue_object_type NOT NULL,
  shape public.venue_object_shape NOT NULL DEFAULT 'rect',
  name text,
  geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  z_index integer NOT NULL DEFAULT 0,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venue_objects_venue_idx ON public.venue_objects(venue_id, layer_id, type);
CREATE INDEX IF NOT EXISTS venue_objects_group_idx ON public.venue_objects(group_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_objects TO authenticated;
GRANT ALL ON public.venue_objects TO service_role;
ALTER TABLE public.venue_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venue_objects_org_members_read" ON public.venue_objects FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
CREATE POLICY "venue_objects_org_members_write" ON public.venue_objects FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
CREATE TRIGGER venue_objects_set_updated_at BEFORE UPDATE ON public.venue_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- venue_references
CREATE TABLE IF NOT EXISTS public.venue_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  layer_id uuid REFERENCES public.venue_layers(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  mime_type text,
  page integer,
  label text,
  transform jsonb NOT NULL DEFAULT '{"x":0,"y":0,"scale":1,"rotation":0}'::jsonb,
  opacity numeric NOT NULL DEFAULT 0.6,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venue_references_venue_idx ON public.venue_references(venue_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_references TO authenticated;
GRANT ALL ON public.venue_references TO service_role;
ALTER TABLE public.venue_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venue_references_org_members_read" ON public.venue_references FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
CREATE POLICY "venue_references_org_members_write" ON public.venue_references FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
CREATE TRIGGER venue_references_set_updated_at BEFORE UPDATE ON public.venue_references
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- venue_templates (versioned snapshots)
CREATE TABLE IF NOT EXISTS public.venue_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  label text,
  description text,
  model jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, version)
);
CREATE INDEX IF NOT EXISTS venue_templates_venue_idx ON public.venue_templates(venue_id, version DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_templates TO authenticated;
GRANT ALL ON public.venue_templates TO service_role;
ALTER TABLE public.venue_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venue_templates_org_members_read" ON public.venue_templates FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
CREATE POLICY "venue_templates_org_members_write" ON public.venue_templates FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
CREATE TRIGGER venue_templates_set_updated_at BEFORE UPDATE ON public.venue_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- org_object_library (reusable assets per organization)
CREATE TABLE IF NOT EXISTS public.org_object_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  type public.venue_object_type NOT NULL DEFAULT 'custom',
  shape public.venue_object_shape NOT NULL DEFAULT 'rect',
  default_geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_style jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  icon_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_object_library_org_idx ON public.org_object_library(organization_id, category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_object_library TO authenticated;
GRANT ALL ON public.org_object_library TO service_role;
ALTER TABLE public.org_object_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_object_library_members_read" ON public.org_object_library FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_object_library_members_write" ON public.org_object_library FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE TRIGGER org_object_library_set_updated_at BEFORE UPDATE ON public.org_object_library
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
