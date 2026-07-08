ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_source_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_org_status_idx
  ON public.events (organization_id, status)
  WHERE is_template = false;

CREATE INDEX IF NOT EXISTS events_org_templates_idx
  ON public.events (organization_id)
  WHERE is_template = true;
