
-- =========================================
-- 20260708175508_99847379-2cfb-4b2b-a4d7-ae0961abdff1.sql
-- =========================================

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin', 'organizer', 'staff', 'vendor');
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'in_progress', 'completed', 'archived');
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'waitlisted', 'rejected', 'withdrawn');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');
CREATE TYPE public.booth_status AS ENUM ('available', 'held', 'assigned', 'paid');
CREATE TYPE public.subscription_tier AS ENUM ('trial', 'starter', 'pro', 'enterprise');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, avatar_url TEXT, phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_super_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier subscription_tier NOT NULL DEFAULT 'trial',
  suspended BOOLEAN NOT NULL DEFAULT false,
  logo_url TEXT, contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{"check_in":false,"edit_booths":false,"chat":false,"payments":false,"reports":false,"view_vendors":true}'::jsonb,
  invited_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id);
$$;

CREATE POLICY "orgs_select_member" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "orgs_insert_own" ON public.organizations FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "orgs_update_owner" ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "orgs_delete_owner" ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "org_members_select" ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "org_members_mutate_owner" ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_org_owner(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'));

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, slug TEXT, description TEXT,
  venue TEXT, address TEXT,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  setup_start TIMESTAMPTZ, setup_end TIMESTAMPTZ,
  status event_status NOT NULL DEFAULT 'draft',
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.event_org_id(_event_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.events WHERE id = _event_id;
$$;

CREATE POLICY "events_select_member" ON public.events FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin') OR status IN ('published','in_progress'));
CREATE POLICY "events_mutate_member" ON public.events FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'));

-- VENDOR CATEGORIES / BOOTH SIZES
CREATE TABLE public.vendor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#c9968c',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_categories TO authenticated;
GRANT ALL ON public.vendor_categories TO service_role;
ALTER TABLE public.vendor_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vcat_select" ON public.vendor_categories FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "vcat_mutate" ON public.vendor_categories FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.booth_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  width_ft NUMERIC, depth_ft NUMERIC,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booth_sizes TO authenticated;
GRANT ALL ON public.booth_sizes TO service_role;
ALTER TABLE public.booth_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsize_select" ON public.booth_sizes FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "bsize_mutate" ON public.booth_sizes FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));

-- VENDORS (simple policies; org visibility added after applications exists)
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT, email TEXT, phone TEXT, website TEXT,
  logo_url TEXT, description TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "vendors_insert_self" ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "vendors_update_own" ON public.vendors FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "vendors_delete_own" ON public.vendors FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- APPLICATIONS
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.vendor_categories(id) ON DELETE SET NULL,
  booth_size_id UUID REFERENCES public.booth_sizes(id) ON DELETE SET NULL,
  status application_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, vendor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_apps_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "apps_select" ON public.applications FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), public.event_org_id(event_id))
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  );
CREATE POLICY "apps_insert" ON public.applications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
    OR public.is_org_member(auth.uid(), public.event_org_id(event_id))
  );
CREATE POLICY "apps_update_org" ON public.applications FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "apps_delete_org" ON public.applications FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));

-- Now add the cross-referencing vendors SELECT policy
CREATE POLICY "vendors_select" ON public.vendors FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.vendor_id = vendors.id
        AND public.is_org_member(auth.uid(), public.event_org_id(a.event_id))
    )
  );

CREATE TABLE public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  name TEXT NOT NULL, url TEXT NOT NULL, kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO authenticated;
GRANT ALL ON public.application_documents TO service_role;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appdocs_all" ON public.application_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND (
    public.is_org_member(auth.uid(), public.event_org_id(a.event_id))
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = a.vendor_id AND v.user_id = auth.uid())
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND (
    public.is_org_member(auth.uid(), public.event_org_id(a.event_id))
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = a.vendor_id AND v.user_id = auth.uid())
  )));

-- BOOTHS
CREATE TABLE public.booths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  size_id UUID REFERENCES public.booth_sizes(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.vendor_categories(id) ON DELETE SET NULL,
  x NUMERIC NOT NULL DEFAULT 0, y NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 80, height NUMERIC NOT NULL DEFAULT 80,
  rotation NUMERIC NOT NULL DEFAULT 0,
  status booth_status NOT NULL DEFAULT 'available',
  assigned_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booths TO authenticated;
GRANT ALL ON public.booths TO service_role;
ALTER TABLE public.booths ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_booths_updated BEFORE UPDATE ON public.booths FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "booths_select" ON public.booths FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), public.event_org_id(event_id))
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.applications a JOIN public.vendors v ON v.id = a.vendor_id WHERE a.id = booths.assigned_application_id AND v.user_id = auth.uid())
  );
CREATE POLICY "booths_mutate" ON public.booths FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'unpaid',
  method TEXT, note TEXT,
  paid_at TIMESTAMPTZ,
  marked_paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pay_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "pay_select" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND (
    public.is_org_member(auth.uid(), public.event_org_id(a.event_id))
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = a.vendor_id AND v.user_id = auth.uid())
  )));
CREATE POLICY "pay_mutate" ON public.payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND (
    public.is_org_member(auth.uid(), public.event_org_id(a.event_id)) OR public.has_role(auth.uid(), 'super_admin')
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND (
    public.is_org_member(auth.uid(), public.event_org_id(a.event_id)) OR public.has_role(auth.uid(), 'super_admin')
  )));

-- SPONSORS
CREATE TABLE public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL, tier TEXT, logo_url TEXT,
  contribution NUMERIC DEFAULT 0,
  contact_name TEXT, contact_email TEXT, website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sponsors_select" ON public.sponsors FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "sponsors_mutate" ON public.sponsors FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));

-- ANNOUNCEMENTS
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_select" ON public.announcements FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), public.event_org_id(event_id))
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.applications a JOIN public.vendors v ON v.id = a.vendor_id WHERE a.event_id = announcements.event_id AND v.user_id = auth.uid())
  );
CREATE POLICY "ann_mutate" ON public.announcements FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_org_member(auth.uid(), public.event_org_id(event_id)) OR public.has_role(auth.uid(), 'super_admin'));

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select" ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), public.event_org_id(event_id))
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  );
CREATE POLICY "msg_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      public.is_org_member(auth.uid(), public.event_org_id(event_id))
      OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
    )
  );

-- SUPPORT
CREATE TABLE public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  subject TEXT NOT NULL, body TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup_select" ON public.support_requests FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "sup_insert" ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "sup_update_admin" ON public.support_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX idx_events_org ON public.events(organization_id);
CREATE INDEX idx_apps_event ON public.applications(event_id);
CREATE INDEX idx_apps_vendor ON public.applications(vendor_id);
CREATE INDEX idx_booths_event ON public.booths(event_id);
CREATE INDEX idx_payments_app ON public.payments(application_id);
CREATE INDEX idx_sponsors_event ON public.sponsors(event_id);
CREATE INDEX idx_ann_event ON public.announcements(event_id);
CREATE INDEX idx_msg_event_vendor ON public.messages(event_id, vendor_id);

-- =========================================
-- 20260708175527_5a85a9e3-766d-4f05-a1f1-7f76d7538e64.sql
-- =========================================

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_org_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- =========================================
-- 20260708183915_502a7b92-5037-48f7-8fd1-4b02c38ddb29.sql
-- =========================================

-- ============================================================
-- EventScape Studio — Platform Foundation (Phase 1 rebuild)
-- ============================================================

-- Drop existing tables from prior iteration
DROP TABLE IF EXISTS public.support_requests CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.sponsors CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.application_documents CASCADE;
DROP TABLE IF EXISTS public.applications CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.booths CASCADE;
DROP TABLE IF EXISTS public.booth_sizes CASCADE;
DROP TABLE IF EXISTS public.vendor_categories CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.event_org_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.event_status CASCADE;
DROP TYPE IF EXISTS public.application_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.booth_status CASCADE;

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('super_admin','organizer','staff','vendor');
CREATE TYPE public.event_status AS ENUM ('draft','published','in_progress','completed','cancelled','archived');
CREATE TYPE public.application_status AS ENUM ('pending','approved','waitlisted','rejected','withdrawn');
CREATE TYPE public.payment_status AS ENUM ('unpaid','partial','paid','refunded');
CREATE TYPE public.booth_status AS ENUM ('available','held','assigned','occupied','blocked');
CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','expired','revoked');
CREATE TYPE public.org_vendor_status AS ENUM ('prospect','invited','active','blacklisted','archived');
CREATE TYPE public.message_channel AS ENUM ('direct','event','announcement');
CREATE TYPE public.task_status AS ENUM ('open','in_progress','done','cancelled');

-- ============================================================
-- Shared: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: read own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles: insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- user_roles (global platform role — SEPARATE table by security rule)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles: read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- Security-definer helpers (declared early — referenced by policies below)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============================================================
-- organizations
-- ============================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  logo_url TEXT,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'starter',
  suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- organization_members
-- ============================================================
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Now define membership helpers
CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org_id AND user_id = _user_id);
$$;

-- Policies for organizations / members
CREATE POLICY "orgs: members read" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "orgs: owner update" ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "orgs: authenticated create" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "orgs: owner delete" ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "org_members: members read" ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "org_members: owner manage" ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_org_owner(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- permissions catalog + grants
-- ============================================================
CREATE TABLE public.permissions (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions: read all authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);

INSERT INTO public.permissions (key, category, description) VALUES
  ('events.read','Events','View events'),
  ('events.create','Events','Create events'),
  ('events.update','Events','Edit events'),
  ('events.delete','Events','Delete events'),
  ('venues.manage','Venues','Manage venues and layouts'),
  ('vendors.read','Vendors','View vendor directory'),
  ('vendors.invite','Vendors','Invite vendors'),
  ('vendors.manage','Vendors','Edit vendor relationships'),
  ('applications.review','Applications','Approve, waitlist, or reject applications'),
  ('booths.manage','Booths','Design and assign booths'),
  ('payments.manage','Payments','Record and edit payments'),
  ('sponsors.manage','Sponsors','Manage sponsors'),
  ('messages.send','Messaging','Send messages and announcements'),
  ('reports.view','Reports','View reports'),
  ('staff.manage','Staff','Invite and manage staff members'),
  ('settings.manage','Settings','Edit organization settings');

CREATE TABLE public.member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_member_id, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_permissions TO authenticated;
GRANT ALL ON public.member_permissions TO service_role;
ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _org_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_org_owner(_user_id, _org_id)
    OR public.has_role(_user_id, 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.member_permissions mp
      JOIN public.organization_members om ON om.id = mp.organization_member_id
      WHERE om.user_id = _user_id AND om.organization_id = _org_id AND mp.permission_key = _permission
    );
$$;

CREATE POLICY "member_permissions: members read" ON public.member_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.id = organization_member_id AND public.is_org_member(auth.uid(), om.organization_id)));
CREATE POLICY "member_permissions: owner manage" ON public.member_permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.id = organization_member_id AND public.is_org_owner(auth.uid(), om.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.id = organization_member_id AND public.is_org_owner(auth.uid(), om.organization_id)));

-- ============================================================
-- venues
-- ============================================================
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  latitude NUMERIC,
  longitude NUMERIC,
  parking_info TEXT,
  utilities_info TEXT,
  emergency_info TEXT,
  notes TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_venues_updated BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.venue_org_id(_venue_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.venues WHERE id = _venue_id;
$$;

CREATE POLICY "venues: org members read" ON public.venues FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "venues: org members manage" ON public.venues FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.venue_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_documents TO authenticated;
GRANT ALL ON public.venue_documents TO service_role;
ALTER TABLE public.venue_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venue_documents: org members" ON public.venue_documents FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

-- ============================================================
-- layout_templates + template booths (reusable per venue)
-- ============================================================
CREATE TABLE public.layout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  canvas_width INTEGER NOT NULL DEFAULT 1200,
  canvas_height INTEGER NOT NULL DEFAULT 800,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layout_templates TO authenticated;
GRANT ALL ON public.layout_templates TO service_role;
ALTER TABLE public.layout_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lt_updated BEFORE UPDATE ON public.layout_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "layout_templates: org members" ON public.layout_templates FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE TABLE public.layout_template_booths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_template_id UUID NOT NULL REFERENCES public.layout_templates(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  x NUMERIC NOT NULL DEFAULT 0,
  y NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 80,
  height NUMERIC NOT NULL DEFAULT 80,
  rotation NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  size_label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layout_template_booths TO authenticated;
GRANT ALL ON public.layout_template_booths TO service_role;
ALTER TABLE public.layout_template_booths ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.layout_template_org_id(_template_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.organization_id FROM public.layout_templates lt JOIN public.venues v ON v.id = lt.venue_id WHERE lt.id = _template_id;
$$;
CREATE POLICY "layout_template_booths: org members" ON public.layout_template_booths FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.layout_template_org_id(layout_template_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.layout_template_org_id(layout_template_id)));

-- ============================================================
-- events
-- ============================================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  layout_template_id UUID REFERENCES public.layout_templates(id) ON DELETE SET NULL,
  cloned_from_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  setup_start TIMESTAMPTZ,
  setup_end TIMESTAMPTZ,
  status public.event_status NOT NULL DEFAULT 'draft',
  cover_image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  applications_open BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.event_org_id(_event_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.events WHERE id = _event_id;
$$;

CREATE POLICY "events: public read published" ON public.events FOR SELECT TO anon, authenticated
  USING (is_public = true AND status IN ('published','in_progress','completed'));
CREATE POLICY "events: org members read all" ON public.events FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "events: org members manage" ON public.events FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================
-- event_booths (per-event copy)
-- ============================================================
CREATE TABLE public.event_booths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  template_booth_id UUID REFERENCES public.layout_template_booths(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  x NUMERIC NOT NULL DEFAULT 0,
  y NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 80,
  height NUMERIC NOT NULL DEFAULT 80,
  rotation NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  size_label TEXT,
  price NUMERIC(10,2),
  status public.booth_status NOT NULL DEFAULT 'available',
  assigned_application_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_booths TO authenticated;
GRANT ALL ON public.event_booths TO service_role;
ALTER TABLE public.event_booths ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_event_booths_updated BEFORE UPDATE ON public.event_booths FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "event_booths: org members" ON public.event_booths FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.event_org_id(event_id)));

-- ============================================================
-- vendor_profiles (one master account per vendor)
-- ============================================================
CREATE TABLE public.vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  bio TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_profiles TO authenticated;
GRANT ALL ON public.vendor_profiles TO service_role;
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_vp_updated BEFORE UPDATE ON public.vendor_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- organization_vendors (Organizer CRM relationship)
-- ============================================================
CREATE TABLE public.organization_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  status public.org_vendor_status NOT NULL DEFAULT 'prospect',
  internal_notes TEXT,
  preferred_booth_code TEXT,
  preferred_size_label TEXT,
  needs_electricity BOOLEAN NOT NULL DEFAULT false,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  years_participated INTEGER NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, vendor_profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_vendors TO authenticated;
GRANT ALL ON public.organization_vendors TO service_role;
ALTER TABLE public.organization_vendors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ov_updated BEFORE UPDATE ON public.organization_vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "org_vendors: org members" ON public.organization_vendors FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_vendors: vendor sees own links" ON public.organization_vendors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_profile_id AND vp.user_id = auth.uid()));

-- vendor_profiles policies (need organization_vendors first)
CREATE POLICY "vendor_profiles: own" ON public.vendor_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "vendor_profiles: org members with link" ON public.vendor_profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_vendors ov
    WHERE ov.vendor_profile_id = vendor_profiles.id
      AND public.is_org_member(auth.uid(), ov.organization_id)
  ) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "vendor_profiles: org members insert" ON public.vendor_profiles FOR INSERT TO authenticated
  WITH CHECK (true); -- organizer flows go through server fn; server fn creates OV link atomically
CREATE POLICY "vendor_profiles: org members update linked" ON public.vendor_profiles FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_vendors ov
    WHERE ov.vendor_profile_id = vendor_profiles.id
      AND public.is_org_member(auth.uid(), ov.organization_id)
  ))
  WITH CHECK (true);

-- ============================================================
-- vendor_invitations (email + token + short code, strict)
-- ============================================================
CREATE TABLE public.vendor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  vendor_profile_id UUID REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_invitations TO authenticated;
GRANT ALL ON public.vendor_invitations TO service_role;
ALTER TABLE public.vendor_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_invitations: org members manage" ON public.vendor_invitations FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================
-- applications
-- ============================================================
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'pending',
  category TEXT,
  size_requested TEXT,
  needs_electricity BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_booth_id UUID REFERENCES public.event_booths(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, vendor_profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_apps_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "applications: org members" ON public.applications FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "applications: vendor own" ON public.applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_profile_id AND vp.user_id = auth.uid()));
CREATE POLICY "applications: vendor create own" ON public.applications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_profile_id AND vp.user_id = auth.uid()));

CREATE TABLE public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO authenticated;
GRANT ALL ON public.application_documents TO service_role;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_docs: org members" ON public.application_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND public.is_org_member(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND public.is_org_member(auth.uid(), a.organization_id)));
CREATE POLICY "app_docs: vendor own" ON public.application_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a JOIN public.vendor_profiles vp ON vp.id = a.vendor_profile_id
    WHERE a.id = application_id AND vp.user_id = auth.uid()
  ));

-- ============================================================
-- sponsors
-- ============================================================
CREATE TABLE public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier TEXT,
  logo_url TEXT,
  contribution NUMERIC(12,2),
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sponsors_updated BEFORE UPDATE ON public.sponsors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "sponsors: org members" ON public.sponsors FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================
-- payments
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  vendor_profile_id UUID REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'unpaid',
  method TEXT,
  reference TEXT,
  note TEXT,
  paid_at TIMESTAMPTZ,
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "payments: org members" ON public.payments FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "payments: vendor own" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = vendor_profile_id AND vp.user_id = auth.uid()));

-- ============================================================
-- announcements + messages
-- ============================================================
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all_vendors',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements: org members" ON public.announcements FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "announcements: vendors with link" ON public.announcements FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_vendors ov JOIN public.vendor_profiles vp ON vp.id = ov.vendor_profile_id
    WHERE ov.organization_id = announcements.organization_id AND vp.user_id = auth.uid()
  ));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  thread_id UUID NOT NULL,
  channel public.message_channel NOT NULL DEFAULT 'direct',
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_vendor_profile_id UUID REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages: org members" ON public.messages FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "messages: vendor own" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = recipient_vendor_profile_id AND vp.user_id = auth.uid()));
CREATE POLICY "messages: vendor send own" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid());

-- ============================================================
-- documents (generic, attached to org/event/venue/vendor)
-- ============================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  vendor_profile_id UUID REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT,
  visibility TEXT NOT NULL DEFAULT 'org',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents: org members" ON public.documents FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "documents: vendor visible" ON public.documents FOR SELECT TO authenticated
  USING (visibility IN ('vendors','public') AND EXISTS (
    SELECT 1 FROM public.organization_vendors ov JOIN public.vendor_profiles vp ON vp.id = ov.vendor_profile_id
    WHERE ov.organization_id = documents.organization_id AND vp.user_id = auth.uid()
  ));

-- ============================================================
-- tasks
-- ============================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.task_status NOT NULL DEFAULT 'open',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "tasks: org members" ON public.tasks FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================
-- reports (saved report metadata)
-- ============================================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  url TEXT,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports: org members" ON public.reports FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============================================================
-- support_requests
-- ============================================================
CREATE TABLE public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sr_updated BEFORE UPDATE ON public.support_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "support: creator or super admin" ON public.support_requests FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "support: authenticated create" ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "support: super admin update" ON public.support_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- Auto-create profile on signup (roles are assigned explicitly)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- 20260708184053_fbdb50ea-257d-4de8-afc2-38f4c04b68f0.sql
-- =========================================

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

-- =========================================
-- 20260708185823_275c38b7-c3f8-4731-a30f-22d04194aea1.sql
-- =========================================
-- Extend handle_new_user to auto-provision organizer role + default org for every new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
  _base_slug text;
  _slug text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Studio');

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, _name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'organizer')
  ON CONFLICT (user_id, role) DO NOTHING;

  _base_slug := regexp_replace(lower(_name), '[^a-z0-9]+', '-', 'g');
  _base_slug := trim(both '-' from _base_slug);
  IF _base_slug = '' THEN _base_slug := 'studio'; END IF;
  _slug := _base_slug || '-' || substr(replace(NEW.id::text, '-', ''), 1, 6);

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE owner_id = NEW.id) THEN
    INSERT INTO public.organizations (name, slug, owner_id)
    VALUES (_name || '''s Studio', _slug, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is attached (it may not exist yet per db-triggers listing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: provision roles + orgs for existing users who are missing them
INSERT INTO public.profiles (id, full_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'organizer'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.organizations (name, slug, owner_id)
SELECT
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) || '''s Studio',
  regexp_replace(lower(COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))), '[^a-z0-9]+', '-', 'g')
    || '-' || substr(replace(u.id::text, '-', ''), 1, 6),
  u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.owner_id = u.id);

-- =========================================
-- 20260708190724_276e7a50-ace1-4bfc-80c8-aab6cb7ddd38.sql
-- =========================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_source_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_org_status_idx
  ON public.events (organization_id, status)
  WHERE is_template = false;

CREATE INDEX IF NOT EXISTS events_org_templates_idx
  ON public.events (organization_id)
  WHERE is_template = true;

-- =========================================
-- 20260708193130_c20cb28e-f913-4970-85ab-42a4a6517b84.sql
-- =========================================

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

-- =========================================
-- 20260708193203_b83c5d58-ec2f-4c72-bbf5-9e27c365b7a5.sql
-- =========================================

-- Storage RLS: files stored under path "<org_id>/..."; only org members can read/write.
DROP POLICY IF EXISTS "venue-assets: org members read" ON storage.objects;
CREATE POLICY "venue-assets: org members read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'venue-assets'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "venue-assets: org members write" ON storage.objects;
CREATE POLICY "venue-assets: org members write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'venue-assets'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "venue-assets: org members update" ON storage.objects;
CREATE POLICY "venue-assets: org members update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'venue-assets'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "venue-assets: org members delete" ON storage.objects;
CREATE POLICY "venue-assets: org members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'venue-assets'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "application-uploads: org members read" ON storage.objects;
CREATE POLICY "application-uploads: org members read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'application-uploads'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "application-uploads: org members write" ON storage.objects;
CREATE POLICY "application-uploads: org members write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'application-uploads'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "application-uploads: org members delete" ON storage.objects;
CREATE POLICY "application-uploads: org members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'application-uploads'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- =========================================
-- 20260708193412_7f9da409-3a6e-493f-8074-f46ce6808382.sql
-- =========================================

ALTER TABLE public.layout_template_booths
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS is_electric BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_reserved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.event_booths
  ADD COLUMN IF NOT EXISTS is_electric BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_reserved BOOLEAN NOT NULL DEFAULT false;

-- =========================================
-- 20260708200657_8bc6497b-321a-485b-bb7d-db1d78f0383c.sql
-- =========================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS product_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS business_photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS insurance_doc_url text,
  ADD COLUMN IF NOT EXISTS tax_doc_url text,
  ADD COLUMN IF NOT EXISTS food_license_url text,
  ADD COLUMN IF NOT EXISTS resale_cert_url text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS intake_completed_at timestamptz;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS booth_size text,
  ADD COLUMN IF NOT EXISTS bringing_products text,
  ADD COLUMN IF NOT EXISTS sponsor_interest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS volunteer_interest boolean NOT NULL DEFAULT false;

-- =========================================
-- 20260708210907_95c750e1-2be6-459f-a9b5-e325392e783c.sql
-- =========================================

ALTER TABLE public.venue_map_references
  ADD COLUMN IF NOT EXISTS source_file_url TEXT,
  ADD COLUMN IF NOT EXISTS source_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS source_page INT,
  ADD COLUMN IF NOT EXISTS natural_width INT,
  ADD COLUMN IF NOT EXISTS natural_height INT,
  ADD COLUMN IF NOT EXISTS crop_x NUMERIC,
  ADD COLUMN IF NOT EXISTS crop_y NUMERIC,
  ADD COLUMN IF NOT EXISTS crop_w NUMERIC,
  ADD COLUMN IF NOT EXISTS crop_h NUMERIC;

-- =========================================
-- 20260708211206_ebb13cac-52ee-460a-afa6-8ee110fe7f42.sql
-- =========================================

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

-- =========================================
-- 20260708212232_7203d388-612f-45e4-9672-494516c71b6c.sql
-- =========================================

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

-- =========================================
-- 20260708214647_4c2dad3b-699f-45a6-bb4b-6c83d230f68b.sql
-- =========================================

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

-- =========================================
-- 20260708222921_c26028a6-9ec4-4403-a793-92eb2a4e439e.sql
-- =========================================
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

-- =========================================
-- 20260708233720_53e14816-c173-41b9-934f-219f568a54b3.sql
-- =========================================

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

-- =========================================
-- 20260710125148_7120199b-06fa-4649-9522-93b11c183103.sql
-- =========================================

-- Event Venue Snapshots: freeze a venue's design into an event
CREATE TABLE public.event_venue_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  venue_template_id UUID REFERENCES public.venue_templates(id) ON DELETE SET NULL,
  label TEXT,
  model JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_venue_snapshots TO authenticated;
GRANT ALL ON public.event_venue_snapshots TO service_role;

ALTER TABLE public.event_venue_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage event snapshots"
ON public.event_venue_snapshots FOR ALL
TO authenticated
USING (public.is_org_member(auth.uid(), public.event_org_id(event_id)))
WITH CHECK (public.is_org_member(auth.uid(), public.event_org_id(event_id)));

CREATE INDEX idx_event_venue_snapshots_event ON public.event_venue_snapshots(event_id);
CREATE INDEX idx_event_venue_snapshots_venue ON public.event_venue_snapshots(venue_id);

CREATE TRIGGER trg_event_venue_snapshots_updated_at
BEFORE UPDATE ON public.event_venue_snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- 20260710141524_4c83d15b-6f0c-4e25-8fdc-79e52703f235.sql
-- =========================================
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision,
  ADD COLUMN IF NOT EXISTS map_zoom integer;

-- =========================================
-- 20260710152859_4a121b0c-b2fd-4342-bd3e-b34972973ac2.sql
-- =========================================
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'food_truck';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'trailer';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'picnic_area';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'tent';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'security';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'playground';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'gate';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'generator';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'electrical';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'water';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'hydrant';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'dumpster';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'bush';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'arrow';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'measurement';
ALTER TYPE public.venue_object_type ADD VALUE IF NOT EXISTS 'chair';

-- =========================================
-- 20260710154708_16c72e72-ed2e-4e1b-b080-31fdeb858a5f.sql
-- =========================================

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

-- =========================================
-- 20260710165313_8ed18f3f-9a95-470f-aa81-ae8b7be13818.sql
-- =========================================

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

-- =========================================
-- 20260713024736_5f284b1c-f314-4d83-bda5-9882b729465e.sql
-- =========================================

-- Extend venue_layer_kind enum ------------------------------------------------
alter type public.venue_layer_kind add value if not exists 'parking';
alter type public.venue_layer_kind add value if not exists 'landscape';
alter type public.venue_layer_kind add value if not exists 'sponsors';

-- Extend venue_layers --------------------------------------------------------
alter table public.venue_layers add column if not exists color text;

-- Extend org_object_library --------------------------------------------------
alter table public.org_object_library add column if not exists is_favorite boolean not null default false;

-- event_booth_reservations ---------------------------------------------------
create table public.event_booth_reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  booth_element_id text not null,
  vendor_profile_id uuid references public.vendor_profiles(id) on delete set null,
  status text not null default 'available'
    check (status in ('available','pending','reserved','paid','unavailable')),
  reserved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, booth_element_id)
);

grant select, insert, update, delete on public.event_booth_reservations to authenticated;
grant all on public.event_booth_reservations to service_role;

alter table public.event_booth_reservations enable row level security;

create policy "event_booth_reservations via event org"
  on public.event_booth_reservations for all
  using (public.is_org_member(auth.uid(), public.event_org_id(event_id)))
  with check (public.is_org_member(auth.uid(), public.event_org_id(event_id)));

create trigger set_updated_at_event_booth_reservations
  before update on public.event_booth_reservations
  for each row execute function public.set_updated_at();

-- =========================================
-- 20260717000347_a0b07f23-9f07-4e43-acab-b9510eb9daec.sql
-- =========================================

ALTER TABLE public.event_booths
  ADD COLUMN IF NOT EXISTS event_object_id uuid,
  ADD COLUMN IF NOT EXISTS is_water boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_corner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES public.vendor_profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_booths_event_object_unique
  ON public.event_booths (event_id, event_object_id)
  WHERE event_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_booths_vendor_profile_idx
  ON public.event_booths (vendor_profile_id)
  WHERE vendor_profile_id IS NOT NULL;

-- =========================================
-- 20260717001710_0126b214-d830-416f-8bf9-ba8e9bd7580f.sql
-- =========================================

-- Phase 3+4: Event Workspace operations state on event_booths.
-- Additive columns for check-in workflow and staff/vendor notes.
ALTER TABLE public.event_booths
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_notes text,
  ADD COLUMN IF NOT EXISTS vendor_notes text;

-- Index to speed up event-scoped joins used by the workspace.
CREATE INDEX IF NOT EXISTS event_booths_event_idx
  ON public.event_booths (event_id);

-- =========================================
-- 20260718012027_1df64712-09cc-4857-b60b-41617b4d8fe5.sql
-- =========================================
CREATE TABLE public.workspace_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  layer_id uuid REFERENCES public.venue_layers(id) ON DELETE SET NULL,
  event_booth_id uuid REFERENCES public.event_booths(id) ON DELETE SET NULL,
  kind text NOT NULL,
  geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  z_index integer NOT NULL DEFAULT 0,
  locked boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workspace_objects_venue_id_idx ON public.workspace_objects(venue_id);
CREATE INDEX workspace_objects_event_id_idx ON public.workspace_objects(event_id);
CREATE INDEX workspace_objects_layer_id_idx ON public.workspace_objects(layer_id);
CREATE INDEX workspace_objects_event_booth_id_idx ON public.workspace_objects(event_booth_id);
CREATE INDEX workspace_objects_kind_idx ON public.workspace_objects(kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_objects TO authenticated;
GRANT ALL ON public.workspace_objects TO service_role;

ALTER TABLE public.workspace_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workspace objects"
  ON public.workspace_objects
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can insert workspace objects"
  ON public.workspace_objects
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can update workspace objects"
  ON public.workspace_objects
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)))
  WITH CHECK (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE POLICY "Org members can delete workspace objects"
  ON public.workspace_objects
  FOR DELETE
  TO authenticated
  USING (public.is_org_member(auth.uid(), public.venue_org_id(venue_id)));

CREATE TRIGGER set_updated_at_workspace_objects
  BEFORE UPDATE ON public.workspace_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- 20260804182952_new-migration.sql
-- =========================================
