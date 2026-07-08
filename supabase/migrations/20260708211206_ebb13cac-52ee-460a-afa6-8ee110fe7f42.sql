
-- 1. layout_template_objects: editable vector features that live alongside booths
CREATE TABLE IF NOT EXISTS public.layout_template_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_template_id UUID NOT NULL REFERENCES public.layout_templates(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT,
  geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  layer_index INT NOT NULL DEFAULT 0,
  z_order INT NOT NULL DEFAULT 0,
  locked BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'manual',
  ai_confidence TEXT,
  ai_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layout_template_objects TO authenticated;
GRANT ALL ON public.layout_template_objects TO service_role;
ALTER TABLE public.layout_template_objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "layout_template_objects: org members" ON public.layout_template_objects;
CREATE POLICY "layout_template_objects: org members" ON public.layout_template_objects
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.layout_template_org_id(layout_template_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.layout_template_org_id(layout_template_id)));

DROP TRIGGER IF EXISTS trg_layout_template_objects_updated ON public.layout_template_objects;
CREATE TRIGGER trg_layout_template_objects_updated
  BEFORE UPDATE ON public.layout_template_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_layout_template_objects_template ON public.layout_template_objects(layout_template_id);

-- 2. Extend layout_template_booths with metadata + AI provenance
ALTER TABLE public.layout_template_booths
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ai_confidence TEXT,
  ADD COLUMN IF NOT EXISTS ai_status TEXT;
