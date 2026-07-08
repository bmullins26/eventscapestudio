
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
