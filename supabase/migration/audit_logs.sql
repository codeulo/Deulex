create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  event_type text not null,
  event_category text not null,
  severity text not null,
  ip_address text,
  user_agent text,
  event_data jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),

  constraint event_category_check check (
    event_category in (
      'auth', 'wallet', 'trade', 'payment', 'bills',
      'withdrawal', 'admin', 'fiat_transactions', 'security'
    )
  ),

  constraint severity_check check (
    severity in ('info', 'warning', 'critical')
  )
);

-- Optional optimization:
create index audit_logs_user_id_idx on public.audit_logs (user_id);
create index audit_logs_category_idx on public.audit_logs (event_category);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
