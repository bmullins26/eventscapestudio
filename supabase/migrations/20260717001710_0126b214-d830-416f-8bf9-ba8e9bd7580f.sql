
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
