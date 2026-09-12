-- =============================================================================
-- 20260912100009_updated_at_triggers.sql
-- =============================================================================
-- A single reusable trigger function that keeps every table's updated_at
-- column current automatically, so application code never has to remember
-- to set it manually on every UPDATE.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One trigger per table that has an updated_at column.
create trigger trg_locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

create trigger trg_owners_updated_at
  before update on public.owners
  for each row execute function public.set_updated_at();

create trigger trg_agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_admin_users_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

create trigger trg_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create trigger trg_seller_leads_updated_at
  before update on public.seller_leads
  for each row execute function public.set_updated_at();

create trigger trg_inquiries_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create trigger trg_viewings_updated_at
  before update on public.viewings
  for each row execute function public.set_updated_at();

create trigger trg_matching_preferences_updated_at
  before update on public.matching_preferences
  for each row execute function public.set_updated_at();

create trigger trg_matching_weights_updated_at
  before update on public.matching_weights
  for each row execute function public.set_updated_at();

create trigger trg_backup_logs_updated_at
  before update on public.backup_logs
  for each row execute function public.set_updated_at();
