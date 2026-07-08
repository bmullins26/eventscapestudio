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
