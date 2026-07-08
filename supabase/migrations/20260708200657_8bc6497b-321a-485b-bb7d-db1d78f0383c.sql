
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
