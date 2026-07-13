
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
