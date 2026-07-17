
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
