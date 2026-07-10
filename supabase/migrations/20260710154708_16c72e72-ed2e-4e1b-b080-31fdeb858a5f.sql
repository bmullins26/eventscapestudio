
-- 1) Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER functions in public schema.
--    Keep EXECUTE for authenticated where needed by RLS policies / client RPCs.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END $$;

-- Trigger-only functions: no client execution needed.
-- (handle_new_user, log_application_status_change, set_updated_at) — leave revoked.

-- Re-grant EXECUTE to authenticated for functions used inside RLS policies or callable RPCs.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.venue_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.layout_template_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_profile_belongs_to_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_profile_owned_by(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_vendor_with_link(uuid, jsonb, jsonb, uuid) TO authenticated;

-- service_role retains full access implicitly via role privileges; ensure explicit grants for admin flows.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.event_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.layout_template_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vendor_profile_belongs_to_org_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vendor_profile_owned_by(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_vendor_with_link(uuid, jsonb, jsonb, uuid) TO service_role;

-- 2) Restrict internal template/linkage columns on events from anon read access.
REVOKE SELECT (layout_template_id, cloned_from_event_id, template_source_id) ON public.events FROM anon;
