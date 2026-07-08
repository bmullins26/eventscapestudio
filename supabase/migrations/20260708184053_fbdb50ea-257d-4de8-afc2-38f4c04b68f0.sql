
-- Lock SECURITY DEFINER helpers to authenticated callers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.venue_org_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.layout_template_org_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.event_org_id(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.venue_org_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.layout_template_org_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.event_org_id(uuid) TO authenticated, service_role;

-- Tighten loose vendor_profiles policies
DROP POLICY IF EXISTS "vendor_profiles: org members insert" ON public.vendor_profiles;
DROP POLICY IF EXISTS "vendor_profiles: org members update linked" ON public.vendor_profiles;

CREATE POLICY "vendor_profiles: org members insert" ON public.vendor_profiles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

CREATE POLICY "vendor_profiles: org members update linked" ON public.vendor_profiles FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_vendors ov
    WHERE ov.vendor_profile_id = vendor_profiles.id
      AND public.is_org_member(auth.uid(), ov.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_vendors ov
    WHERE ov.vendor_profile_id = vendor_profiles.id
      AND public.is_org_member(auth.uid(), ov.organization_id)
  ));
