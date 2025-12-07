-- ================================================
-- IDempotency System (FULL INSTALL)
-- ================================================

-- --------------------------------
-- 1) Create idempotency_keys table
-- --------------------------------
create table if not exists idempotency_keys (
  request_id text not null,
  user_scope text not null, -- email (auth) or user_id (wallet/trade)
  route text not null,      -- endpoint path
  request_hash text not null,
  status text default 'PROCESSING',
  response_status integer,
  response_body jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz not null,

  constraint idempotency_keys_pk primary key (request_id, user_scope, route)
);

-- --------------------------------
-- 2) Indexes for performance
-- --------------------------------
create index if not exists idx_idk_user_scope 
  on idempotency_keys(user_scope);

create index if not exists idx_idk_route 
  on idempotency_keys(route);

create index if not exists idx_idk_expires 
  on idempotency_keys(expires_at);

-- --------------------------------
-- 3) RPC function used by middleware
--    Fully compatible with:
--    checkIdempotency(req, userScope, route, body)
-- --------------------------------
create or replace function lock_idempotency_key(
  p_request_id text,
  p_user_scope text,
  p_route text
)
returns table (
  request_id text,
  user_scope text,
  route text,
  request_hash text,
  status text,
  response_status integer,
  response_body jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz
)
language plpgsql
as $$
begin
  return query
  select k.*
  from idempotency_keys k
  where k.request_id = p_request_id
    and k.user_scope = p_user_scope
    and k.route = p_route
  for update;
end;
$$;




-- ================================================
-- END OF FILE
-- ================================================
