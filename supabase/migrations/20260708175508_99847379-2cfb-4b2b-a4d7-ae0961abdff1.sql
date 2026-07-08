
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
