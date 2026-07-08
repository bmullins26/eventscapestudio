
-- 1. Application status enum additions (must run before any usage of new values)
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'booth_assigned';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'archived';

-- 2. New enums
DO $$ BEGIN
  CREATE TYPE public.application_entry_method AS ENUM ('manual','ai_scan','public_form','vendor_portal','imported');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vendor_account_status AS ENUM ('no_account','invited','registered','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. venues archived flag
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- 4. vendor_profiles: relax email so paper/walk-in vendors don't need real addresses
ALTER TABLE public.vendor_profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_email_key;

-- 5. organization_vendors: account_status
ALTER TABLE public.organization_vendors
  ADD COLUMN IF NOT EXISTS account_status public.vendor_account_status NOT NULL DEFAULT 'no_account';

-- Backfill: rows whose vendor_profile is claimed → 'registered'
UPDATE public.organization_vendors ov
  SET account_status = 'registered'
  FROM public.vendor_profiles vp
  WHERE ov.vendor_profile_id = vp.id AND vp.claimed = true AND ov.account_status = 'no_account';

-- 6. applications: entry method, snapshot fields, ai payload, internal notes
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS entry_method public.application_entry_method NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS applicant_email TEXT,
  ADD COLUMN IF NOT EXISTS applicant_phone TEXT,
  ADD COLUMN IF NOT EXISTS products_sold TEXT,
  ADD COLUMN IF NOT EXISTS requested_location TEXT,
  ADD COLUMN IF NOT EXISTS special_requests TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_extraction JSONB;

CREATE INDEX IF NOT EXISTS applications_event_status_idx ON public.applications(event_id, status);
CREATE INDEX IF NOT EXISTS applications_org_status_idx ON public.applications(organization_id, status);

-- 7. venue_maps
CREATE TABLE IF NOT EXISTS public.venue_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_maps TO authenticated;
GRANT ALL ON public.venue_maps TO service_role;
ALTER TABLE public.venue_maps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "venue_maps: org members" ON public.venue_maps;
CREATE POLICY "venue_maps: org members" ON public.venue_maps
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));
DROP TRIGGER IF EXISTS trg_venue_maps_updated ON public.venue_maps;
CREATE TRIGGER trg_venue_maps_updated BEFORE UPDATE ON public.venue_maps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. venue_map_references (reference layer under a layout template)
CREATE TABLE IF NOT EXISTS public.venue_map_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_template_id UUID NOT NULL REFERENCES public.layout_templates(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  original_filename TEXT,
  scale NUMERIC NOT NULL DEFAULT 1,
  rotation NUMERIC NOT NULL DEFAULT 0,
  opacity NUMERIC NOT NULL DEFAULT 0.5,
  offset_x NUMERIC NOT NULL DEFAULT 0,
  offset_y NUMERIC NOT NULL DEFAULT 0,
  locked BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_map_references TO authenticated;
GRANT ALL ON public.venue_map_references TO service_role;
ALTER TABLE public.venue_map_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "venue_map_refs: org members" ON public.venue_map_references;
CREATE POLICY "venue_map_refs: org members" ON public.venue_map_references
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.layout_template_org_id(layout_template_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.layout_template_org_id(layout_template_id)));
DROP TRIGGER IF EXISTS trg_venue_map_refs_updated ON public.venue_map_references;
CREATE TRIGGER trg_venue_map_refs_updated BEFORE UPDATE ON public.venue_map_references
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. user_org_prefs: per-user active event per org
CREATE TABLE IF NOT EXISTS public.user_org_prefs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_org_prefs TO authenticated;
GRANT ALL ON public.user_org_prefs TO service_role;
ALTER TABLE public.user_org_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_org_prefs: own" ON public.user_org_prefs;
CREATE POLICY "user_org_prefs: own" ON public.user_org_prefs
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_user_org_prefs_updated ON public.user_org_prefs;
CREATE TRIGGER trg_user_org_prefs_updated BEFORE UPDATE ON public.user_org_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. application_activity
CREATE TABLE IF NOT EXISTS public.application_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_activity_app_idx ON public.application_activity(application_id, created_at DESC);
GRANT SELECT, INSERT ON public.application_activity TO authenticated;
GRANT ALL ON public.application_activity TO service_role;
ALTER TABLE public.application_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_activity: org members read" ON public.application_activity;
CREATE POLICY "app_activity: org members read" ON public.application_activity
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_activity.application_id
      AND public.is_org_member(auth.uid(), a.organization_id)
    )
  );
DROP POLICY IF EXISTS "app_activity: org members insert" ON public.application_activity;
CREATE POLICY "app_activity: org members insert" ON public.application_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_activity.application_id
      AND public.is_org_member(auth.uid(), a.organization_id)
    )
  );

-- 11. Trigger: log application status changes automatically
CREATE OR REPLACE FUNCTION public.log_application_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.application_activity(application_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_app_status_activity ON public.applications;
CREATE TRIGGER trg_app_status_activity AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_status_change();

-- 12. Public applications: allow anon SELECT on events that are public + open
DROP POLICY IF EXISTS "events: public read when open" ON public.events;
CREATE POLICY "events: public read when open" ON public.events
  FOR SELECT TO anon
  USING (is_public = true AND applications_open = true AND is_template = false);
GRANT SELECT ON public.events TO anon;

-- Public form insert: allow anonymous inserts constrained to open events
DROP POLICY IF EXISTS "applications: anon public form" ON public.applications;
CREATE POLICY "applications: anon public form" ON public.applications
  FOR INSERT TO anon
  WITH CHECK (
    entry_method = 'public_form'
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = applications.event_id
        AND e.organization_id = applications.organization_id
        AND e.is_public = true
        AND e.applications_open = true
        AND e.is_template = false
    )
  );
GRANT INSERT ON public.applications TO anon;
