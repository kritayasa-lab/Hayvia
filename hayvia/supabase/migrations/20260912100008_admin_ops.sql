-- =============================================================================
-- 20260912100008_admin_ops.sql
-- =============================================================================
-- audit_logs (section 31), backup_logs (section 45.8).
-- =============================================================================

-- -----------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null, -- nullable: system-initiated actions
  action text not null, -- e.g. 'property.created', 'owner.assigned', 'lead.status_changed', 'user.role_changed'
  entity_type text not null, -- e.g. 'property', 'lead', 'user'
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Tracks sensitive admin actions (section 31). Admin/staff read-only via RLS (Phase 11) — never client-writable except through server-side admin APIs.';

create index ix_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index ix_audit_logs_user on public.audit_logs (user_id);
create index ix_audit_logs_created_at on public.audit_logs (created_at desc);

-- -----------------------------------------------------------------------
-- backup_logs
-- -----------------------------------------------------------------------
create table public.backup_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null, -- e.g. 'property', 'customer', 'seller_lead', 'inquiry'
  entity_id uuid not null,
  action text not null, -- e.g. 'create', 'update'
  destination text not null, -- e.g. 'google_sheets:properties', 'google_sheets:leads'
  status backup_status_enum not null default 'PENDING',
  error_message text,
  retry_count integer not null default 0,
  attempted_at timestamptz not null default now(),
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.backup_logs is
  'Tracks every Supabase -> Google Sheets backup sync attempt (section 45.8). Lets admin see what has/hasn''t been backed up and retry failures without risking duplicate rows in Sheets (idempotent by entity_type + entity_id + destination).';

create index ix_backup_logs_status on public.backup_logs (status);
create index ix_backup_logs_entity on public.backup_logs (entity_type, entity_id);

-- Helps the retry job quickly find the latest log row per (entity, destination)
-- to decide whether a sync is needed and to avoid duplicate Sheets rows.
create index ix_backup_logs_entity_destination on public.backup_logs (entity_type, entity_id, destination, attempted_at desc);
