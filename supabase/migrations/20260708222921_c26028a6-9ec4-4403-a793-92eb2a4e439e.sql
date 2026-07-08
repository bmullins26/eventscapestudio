CREATE OR REPLACE FUNCTION public.create_vendor_with_link(_org_id uuid, _profile jsonb, _link jsonb, _existing_profile_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT id INTO _ov_id FROM public.organization_vendors
    WHERE organization_id = _org_id AND vendor_profile_id = _vp_id;

  IF _ov_id IS NULL THEN
    INSERT INTO public.organization_vendors(
      organization_id, vendor_profile_id, account_status, internal_notes, is_favorite
    ) VALUES (
      _org_id, _vp_id,
      COALESCE((_link->>'account_status')::vendor_account_status, 'no_account'::vendor_account_status),
      _link->>'internal_notes',
      COALESCE((_link->>'is_favorite')::boolean, false)
    )
    RETURNING id INTO _ov_id;
  END IF;

  RETURN jsonb_build_object('vendor_profile_id', _vp_id, 'organization_vendor_id', _ov_id);
END;
$function$;