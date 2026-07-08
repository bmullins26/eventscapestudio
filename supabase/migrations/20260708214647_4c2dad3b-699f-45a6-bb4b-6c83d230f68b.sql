
-- 1. RPC to atomically create/reuse vendor profile + org link
CREATE OR REPLACE FUNCTION public.create_vendor_with_link(
  _org_id uuid,
  _profile jsonb,
  _link jsonb,
  _existing_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _vp_id uuid;
  _ov_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_org_member(_uid, _org_id) THEN
    RAISE EXCEPTION 'Not a member of organization' USING ERRCODE = '42501';
  END IF;

  IF _existing_profile_id IS NULL THEN
    INSERT INTO public.vendor_profiles(
      business_name, contact_name, email, phone, website,
      business_description, product_categories, business_photos,
      insurance_doc_url, tax_doc_url, food_license_url, resale_cert_url,
      emergency_contact_name, emergency_contact_phone,
      social_links, intake_completed_at
    ) VALUES (
      COALESCE(_profile->>'business_name', ''),
      _profile->>'contact_name',
      _profile->>'email',
      _profile->>'phone',
      _profile->>'website',
      _profile->>'business_description',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_profile->'product_categories')), ARRAY[]::text[]),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_profile->'business_photos')), ARRAY[]::text[]),
      _profile->>'insurance_doc_url',
      _profile->>'tax_doc_url',
      _profile->>'food_license_url',
      _profile->>'resale_cert_url',
      _profile->>'emergency_contact_name',
      _profile->>'emergency_contact_phone',
      COALESCE(_profile->'social_links', '{}'::jsonb),
      now()
    )
    RETURNING id INTO _vp_id;
  ELSE
    SELECT id INTO _vp_id FROM public.vendor_profiles WHERE id = _existing_profile_id;
    IF _vp_id IS NULL THEN
      RAISE EXCEPTION 'Existing profile not found';
    END IF;
  END IF;

  -- Prevent duplicate link
  SELECT id INTO _ov_id FROM public.organization_vendors
    WHERE organization_id = _org_id AND vendor_profile_id = _vp_id;

  IF _ov_id IS NULL THEN
    INSERT INTO public.organization_vendors(
      organization_id, vendor_profile_id, account_status, internal_notes, is_favorite
    ) VALUES (
      _org_id, _vp_id,
      COALESCE((_link->>'account_status')::account_status, 'no_account'::account_status),
      _link->>'internal_notes',
      COALESCE((_link->>'is_favorite')::boolean, false)
    )
    RETURNING id INTO _ov_id;
  END IF;

  RETURN jsonb_build_object('vendor_profile_id', _vp_id, 'organization_vendor_id', _ov_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_vendor_with_link(uuid, jsonb, jsonb, uuid) TO authenticated;

-- 2. Tighten vendor_profiles insert policy: only self-serve inserts via RLS,
-- organizer inserts must go through create_vendor_with_link (SECURITY DEFINER).
DROP POLICY IF EXISTS "vendor_profiles: org members insert" ON public.vendor_profiles;

-- 3. Vendor timeline events (CRM foundation)
DO $$ BEGIN
  CREATE TYPE public.vendor_timeline_event_type AS ENUM (
    'note','application','invitation','payment','status_change','document','assignment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vendor_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  event_type public.vendor_timeline_event_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vte_org_vendor ON public.vendor_timeline_events(organization_id, vendor_profile_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.vendor_timeline_events TO authenticated;
GRANT ALL ON public.vendor_timeline_events TO service_role;

ALTER TABLE public.vendor_timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vte: org members read" ON public.vendor_timeline_events;
CREATE POLICY "vte: org members read" ON public.vendor_timeline_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "vte: org members insert" ON public.vendor_timeline_events;
CREATE POLICY "vte: org members insert" ON public.vendor_timeline_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND (actor_user_id IS NULL OR actor_user_id = auth.uid()));
