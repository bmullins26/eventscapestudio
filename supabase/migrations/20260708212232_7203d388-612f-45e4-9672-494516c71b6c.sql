
CREATE OR REPLACE FUNCTION public.vendor_profile_belongs_to_org_member(_vendor_profile_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_vendors ov
    WHERE ov.vendor_profile_id = _vendor_profile_id
      AND public.is_org_member(_user_id, ov.organization_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.vendor_profile_owned_by(_vendor_profile_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.id = _vendor_profile_id AND vp.user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "vendor_profiles: org members with link" ON public.vendor_profiles;
CREATE POLICY "vendor_profiles: org members with link"
ON public.vendor_profiles FOR SELECT
USING (public.vendor_profile_belongs_to_org_member(id, auth.uid())
       OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "vendor_profiles: org members update linked" ON public.vendor_profiles;
CREATE POLICY "vendor_profiles: org members update linked"
ON public.vendor_profiles FOR UPDATE
USING (public.vendor_profile_belongs_to_org_member(id, auth.uid()))
WITH CHECK (public.vendor_profile_belongs_to_org_member(id, auth.uid()));

DROP POLICY IF EXISTS "org_vendors: vendor sees own links" ON public.organization_vendors;
CREATE POLICY "org_vendors: vendor sees own links"
ON public.organization_vendors FOR SELECT
USING (public.vendor_profile_owned_by(vendor_profile_id, auth.uid()));
