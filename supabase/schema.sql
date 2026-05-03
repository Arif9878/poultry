create extension if not exists pgcrypto;

create or replace function public.current_app_user_id()
returns uuid
language plpgsql
stable
as $$
declare
  auth_user_id uuid;
  jwt_claim_sub text;
  local_user_id text;
begin
  auth_user_id := auth.uid();
  if auth_user_id is not null then
    return auth_user_id;
  end if;

  jwt_claim_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
  if jwt_claim_sub is not null then
    return jwt_claim_sub::uuid;
  end if;

  local_user_id := nullif(current_setting('app.current_user_id', true), '');
  if local_user_id is not null then
    return local_user_id::uuid;
  end if;

  return null;
end;
$$;

create or replace function public.set_local_auth_context(user_id uuid)
returns void
language sql
as $$
  select set_config('app.current_user_id', coalesce(user_id::text, ''), false);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- LEGACY / BASELINE SCHEMA
-- Core schema that existed before the MVP 2 expansion.
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text not null unique,
  phone text,
  role text not null default 'operator' check (role in ('admin', 'manager', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  manager_name text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farm_memberships (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, user_id)
);

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, name)
);

create table if not exists public.flocks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  house_id uuid not null references public.houses (id) on delete restrict,
  code text not null,
  name text not null,
  flock_type text not null check (flock_type in ('layer', 'broiler')),
  start_date date not null,
  initial_chicken_count integer not null check (initial_chicken_count > 0),
  current_chicken_count integer not null check (current_chicken_count >= 0),
  strain text,
  source_vendor text,
  status text not null default 'active' check (status in ('active', 'closed')),
  last_log_date date,
  egg_price_per_kg_rp numeric(14, 2) not null default 0 check (egg_price_per_kg_rp >= 0),
  egg_weight_per_egg_kg numeric(8, 5) not null default 0.06000 check (egg_weight_per_egg_kg > 0 and egg_weight_per_egg_kg <= 0.2),
  target_hd_percent numeric(5, 2) not null default 85.00 check (target_hd_percent >= 0 and target_hd_percent <= 100),
  max_fcr numeric(6, 3) not null default 2.300 check (max_fcr > 0),
  safety_stock_days integer not null default 7 check (safety_stock_days >= 0),
  notes text,
  created_by uuid not null default public.current_app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, code)
);

create table if not exists public.flock_memberships (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.flocks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('manager', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flock_id, user_id)
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.flocks (id) on delete cascade,
  client_request_id uuid not null unique,
  log_date date not null,
  feed_used_kg numeric(10, 2) not null default 0 check (feed_used_kg >= 0),
  feed_price_per_kg_rp numeric(14, 2) not null default 0 check (feed_price_per_kg_rp >= 0),
  mortality_count integer not null default 0 check (mortality_count >= 0),
  live_population integer not null check (live_population >= 0),
  egg_count integer check (egg_count >= 0),
  egg_price_per_kg_rp numeric(14, 2) not null default 0 check (egg_price_per_kg_rp >= 0),
  egg_weight_per_egg_kg numeric(8, 5) not null default 0.06000 check (egg_weight_per_egg_kg > 0 and egg_weight_per_egg_kg <= 0.2),
  avg_weight_gram numeric(10, 2) check (avg_weight_gram >= 0),
  sample_count integer check (sample_count >= 0),
  notes text,
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending')),
  created_by uuid not null default public.current_app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flock_id, log_date)
);

create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  brand text,
  unit text not null default 'kg',
  price_per_kg_rp numeric(14, 2) not null default 0 check (price_per_kg_rp >= 0),
  opening_stock_kg numeric(12, 2) not null default 0 check (opening_stock_kg >= 0),
  current_stock_kg numeric(12, 2) not null default 0 check (current_stock_kg >= 0),
  reorder_level_kg numeric(12, 2) not null default 0 check (reorder_level_kg >= 0),
  notes text,
  created_by uuid not null default public.current_app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, name, brand)
);

create table if not exists public.feed_transactions (
  id uuid primary key default gen_random_uuid(),
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  farm_id uuid not null references public.farms (id) on delete cascade,
  transaction_type text not null check (transaction_type in ('in', 'out', 'adjustment')),
  quantity_kg numeric(12, 2) not null check (quantity_kg > 0),
  unit_cost numeric(12, 2),
  transaction_date date not null,
  notes text,
  created_by uuid not null default public.current_app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- MVP 2 SCHEMA ADDITIONS (NEW)
-- New tables added for purchasing, treatment logs, and transfers.
-- ============================================================================

create table if not exists public.feed_suppliers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  payment_term_days integer not null default 0 check (payment_term_days >= 0),
  notes text,
  created_by uuid not null default public.current_app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, name)
);

create table if not exists public.feed_purchases (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  supplier_id uuid not null references public.feed_suppliers (id) on delete restrict,
  feed_item_id uuid not null references public.feed_items (id) on delete restrict,
  feed_transaction_id uuid references public.feed_transactions (id) on delete set null,
  invoice_number text,
  purchase_date date not null,
  quantity_kg numeric(12, 2) not null check (quantity_kg > 0),
  total_cost_rp numeric(14, 2) not null check (total_cost_rp >= 0),
  price_per_kg_rp numeric(14, 2) not null check (price_per_kg_rp >= 0),
  payment_due_date date,
  notes text,
  created_by uuid not null default public.current_app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_treatment_logs (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.flocks (id) on delete cascade,
  treatment_date date not null,
  category text not null check (category in ('vaccine', 'vitamin', 'medication', 'checkup', 'other')),
  product_name text not null,
  dosage text,
  administered_by text,
  symptoms text,
  diagnosis text,
  withdrawal_until date,
  notes text,
  created_by uuid not null default public.current_app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flock_transfers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  from_flock_id uuid not null references public.flocks (id) on delete restrict,
  to_flock_id uuid not null references public.flocks (id) on delete restrict,
  transfer_date date not null,
  chicken_count integer not null check (chicken_count > 0),
  notes text,
  created_by uuid not null default public.current_app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_flock_id <> to_flock_id)
);

-- ============================================================================
-- MVP 2 COMPATIBILITY CHANGES TO EXISTING TABLES (NEW)
-- Additive columns/backfill for the legacy tables above.
-- ============================================================================

alter table public.flocks
  add column if not exists egg_price_per_kg_rp numeric(14, 2) not null default 0,
  add column if not exists egg_weight_per_egg_kg numeric(8, 5) not null default 0.06000,
  add column if not exists target_hd_percent numeric(5, 2) not null default 85.00,
  add column if not exists max_fcr numeric(6, 3) not null default 2.300,
  add column if not exists safety_stock_days integer not null default 7;

alter table public.daily_logs
  add column if not exists feed_price_per_kg_rp numeric(14, 2) not null default 0,
  add column if not exists egg_price_per_kg_rp numeric(14, 2) not null default 0,
  add column if not exists egg_weight_per_egg_kg numeric(8, 5) not null default 0.06000;

alter table public.feed_items
  add column if not exists price_per_kg_rp numeric(14, 2) not null default 0,
  add column if not exists opening_stock_kg numeric(12, 2) not null default 0;

update public.feed_items
set opening_stock_kg = current_stock_kg
where coalesce(opening_stock_kg, 0) = 0
  and coalesce(current_stock_kg, 0) > 0;

update public.daily_logs dl
set
  egg_price_per_kg_rp = f.egg_price_per_kg_rp,
  egg_weight_per_egg_kg = f.egg_weight_per_egg_kg
from public.flocks f
where dl.flock_id = f.id
  and (
    coalesce(dl.egg_price_per_kg_rp, 0) = 0
    or coalesce(dl.egg_weight_per_egg_kg, 0) <= 0
  );

create or replace view public.layer_daily_log_metrics as
select
  dl.id,
  f.farm_id,
  dl.flock_id,
  dl.log_date,
  dl.live_population,
  dl.feed_used_kg,
  dl.feed_price_per_kg_rp,
  dl.egg_count,
  dl.egg_price_per_kg_rp,
  dl.egg_weight_per_egg_kg,
  coalesce(dl.egg_count, 0) * dl.egg_weight_per_egg_kg as egg_weight_kg,
  case
    when dl.live_population > 0 then (coalesce(dl.egg_count, 0)::numeric / dl.live_population::numeric) * 100
    else 0
  end as hd_percent,
  case
    when coalesce(dl.egg_count, 0) > 0 and dl.egg_weight_per_egg_kg > 0
      then dl.feed_used_kg / (coalesce(dl.egg_count, 0) * dl.egg_weight_per_egg_kg)
    else null
  end as fcr,
  coalesce(dl.egg_count, 0) * dl.egg_weight_per_egg_kg * dl.egg_price_per_kg_rp as egg_revenue_rp,
  dl.feed_used_kg * dl.feed_price_per_kg_rp as feed_cost_rp,
  (coalesce(dl.egg_count, 0) * dl.egg_weight_per_egg_kg * dl.egg_price_per_kg_rp) - (dl.feed_used_kg * dl.feed_price_per_kg_rp) as gross_profit_rp,
  dl.sync_status
from public.daily_logs dl
join public.flocks f on f.id = dl.flock_id
where f.flock_type = 'layer';

-- ============================================================================
-- INDEXES
-- Legacy indexes first, followed by MVP 2 indexes.
-- ============================================================================

create index if not exists idx_farm_memberships_user_id on public.farm_memberships (user_id);
create index if not exists idx_flock_memberships_user_id on public.flock_memberships (user_id);
create index if not exists idx_flock_memberships_flock_id on public.flock_memberships (flock_id);
create index if not exists idx_houses_farm_id on public.houses (farm_id);
create index if not exists idx_flocks_farm_id on public.flocks (farm_id);
create index if not exists idx_daily_logs_flock_id_log_date on public.daily_logs (flock_id, log_date desc);
create index if not exists idx_feed_items_farm_id on public.feed_items (farm_id);
create index if not exists idx_feed_transactions_farm_id_date on public.feed_transactions (farm_id, transaction_date desc);
create index if not exists idx_feed_transactions_feed_item_id on public.feed_transactions (feed_item_id);

-- MVP 2 indexes (new)
create index if not exists idx_feed_suppliers_farm_id on public.feed_suppliers (farm_id);
create index if not exists idx_feed_purchases_farm_id_date on public.feed_purchases (farm_id, purchase_date desc);
create index if not exists idx_feed_purchases_supplier_id on public.feed_purchases (supplier_id);
create index if not exists idx_feed_purchases_feed_item_id on public.feed_purchases (feed_item_id);
create index if not exists idx_health_treatment_logs_flock_id_date on public.health_treatment_logs (flock_id, treatment_date desc);
create index if not exists idx_flock_transfers_farm_id_date on public.flock_transfers (farm_id, transfer_date desc);
create index if not exists idx_flock_transfers_from_flock_id on public.flock_transfers (from_flock_id);
create index if not exists idx_flock_transfers_to_flock_id on public.flock_transfers (to_flock_id);

-- ============================================================================
-- LEGACY / BASELINE BUSINESS & ACCESS FUNCTIONS
-- Shared business helpers and access-control helpers used by the original app.
-- ============================================================================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = public.current_app_user_id()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- ============================================================================
-- MVP 2 BUSINESS FUNCTIONS (NEW)
-- Domain-specific functions introduced for transfers and feed purchasing.
-- ============================================================================

create or replace function public.create_flock_transfer(
  p_from_flock_id uuid,
  p_to_flock_id uuid,
  p_transfer_date date,
  p_chicken_count integer,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_flock public.flocks%rowtype;
  destination_flock public.flocks%rowtype;
  destination_capacity integer;
  next_id uuid := gen_random_uuid();
begin
  if p_chicken_count <= 0 then
    raise exception 'Jumlah ayam mutasi harus lebih dari 0';
  end if;

  select * into source_flock
  from public.flocks
  where id = p_from_flock_id;

  if not found then
    raise exception 'Kandang asal tidak ditemukan';
  end if;

  select * into destination_flock
  from public.flocks
  where id = p_to_flock_id;

  if not found then
    raise exception 'Kandang tujuan tidak ditemukan';
  end if;

  if source_flock.farm_id <> destination_flock.farm_id then
    raise exception 'Mutasi hanya bisa dilakukan dalam peternakan yang sama';
  end if;

  if source_flock.flock_type <> destination_flock.flock_type then
    raise exception 'Mutasi hanya bisa dilakukan antar kandang dengan tipe yang sama';
  end if;

  if not public.has_farm_access(source_flock.farm_id) then
    raise exception 'Akses mutasi ditolak';
  end if;

  if source_flock.current_chicken_count < p_chicken_count then
    raise exception 'Populasi kandang asal tidak mencukupi';
  end if;

  select capacity into destination_capacity
  from public.houses
  where id = destination_flock.house_id;

  if destination_capacity is not null
    and destination_flock.current_chicken_count + p_chicken_count > destination_capacity then
    raise exception 'Mutasi melebihi kapasitas kandang tujuan';
  end if;

  update public.flocks
  set
    current_chicken_count = current_chicken_count - p_chicken_count,
    updated_at = now()
  where id = p_from_flock_id;

  update public.flocks
  set
    current_chicken_count = current_chicken_count + p_chicken_count,
    updated_at = now()
  where id = p_to_flock_id;

  insert into public.flock_transfers (
    id,
    farm_id,
    from_flock_id,
    to_flock_id,
    transfer_date,
    chicken_count,
    notes,
    created_by
  ) values (
    next_id,
    source_flock.farm_id,
    p_from_flock_id,
    p_to_flock_id,
    p_transfer_date,
    p_chicken_count,
    nullif(trim(coalesce(p_notes, '')), ''),
    public.current_app_user_id()
  );

  return next_id;
end;
$$;

create or replace function public.create_feed_purchase(
  p_farm_id uuid,
  p_supplier_id uuid,
  p_feed_item_id uuid,
  p_invoice_number text,
  p_purchase_date date,
  p_quantity_kg numeric,
  p_total_cost_rp numeric,
  p_payment_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase_id uuid := gen_random_uuid();
  transaction_id uuid := gen_random_uuid();
  normalized_price numeric(14, 2);
begin
  if not public.has_farm_access(p_farm_id) then
    raise exception 'Akses pembelian ditolak';
  end if;

  if p_quantity_kg <= 0 then
    raise exception 'Jumlah pembelian harus lebih dari 0';
  end if;

  if p_total_cost_rp < 0 then
    raise exception 'Total biaya pembelian tidak valid';
  end if;

  normalized_price := round((p_total_cost_rp / p_quantity_kg)::numeric, 2);

  insert into public.feed_transactions (
    id,
    feed_item_id,
    farm_id,
    transaction_type,
    quantity_kg,
    unit_cost,
    transaction_date,
    notes,
    created_by
  ) values (
    transaction_id,
    p_feed_item_id,
    p_farm_id,
    'in',
    p_quantity_kg,
    normalized_price,
    p_purchase_date,
    coalesce(nullif(trim(coalesce(p_notes, '')), ''), 'Pembelian pakan'),
    public.current_app_user_id()
  );

  insert into public.feed_purchases (
    id,
    farm_id,
    supplier_id,
    feed_item_id,
    feed_transaction_id,
    invoice_number,
    purchase_date,
    quantity_kg,
    total_cost_rp,
    price_per_kg_rp,
    payment_due_date,
    notes,
    created_by
  ) values (
    purchase_id,
    p_farm_id,
    p_supplier_id,
    p_feed_item_id,
    transaction_id,
    nullif(trim(coalesce(p_invoice_number, '')), ''),
    p_purchase_date,
    p_quantity_kg,
    p_total_cost_rp,
    normalized_price,
    p_payment_due_date,
    nullif(trim(coalesce(p_notes, '')), ''),
    public.current_app_user_id()
  );

  update public.feed_items
  set
    price_per_kg_rp = normalized_price,
    updated_at = now()
  where id = p_feed_item_id;

  return purchase_id;
end;
$$;

create or replace function public.has_farm_access(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.farm_memberships
      where farm_id = target_farm_id
        and user_id = public.current_app_user_id()
    )
$$;

create or replace function public.has_farm_visibility(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_farm_access(target_farm_id)
    or exists (
      select 1
      from public.flock_memberships fm
      join public.flocks f on f.id = fm.flock_id
      where f.farm_id = target_farm_id
        and fm.user_id = public.current_app_user_id()
    )
$$;

create or replace function public.has_flock_access(target_flock_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.flock_memberships
      where flock_id = target_flock_id
        and user_id = public.current_app_user_id()
    )
    or exists (
    select 1
    from public.flocks
    where id = target_flock_id
      and public.has_farm_access(farm_id)
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'operator')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;

do $$
begin
  if to_regclass('auth.users') is not null then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
    execute 'create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user()';
  end if;
end;
$$;

create or replace function public.sync_flock_from_daily_log()
returns trigger
language plpgsql
as $$
begin
  update public.flocks
  set
    current_chicken_count = case
      when coalesce(last_log_date, new.log_date) <= new.log_date then new.live_population
      else current_chicken_count
    end,
    last_log_date = greatest(coalesce(last_log_date, new.log_date), new.log_date),
    updated_at = now()
  where id = new.flock_id;

  return new;
end;
$$;

create or replace function public.sync_feed_item_stock()
returns trigger
language plpgsql
as $$
declare
  target_feed_item_id uuid;
begin
  target_feed_item_id = coalesce(new.feed_item_id, old.feed_item_id);

  update public.feed_items
  set
    current_stock_kg = greatest(
      0,
      coalesce((
        select sum(
          case transaction_type
            when 'in' then quantity_kg
            when 'out' then -quantity_kg
            when 'adjustment' then quantity_kg
          end
        )
        from public.feed_transactions
        where feed_item_id = target_feed_item_id
      ), 0)
    ),
    updated_at = now()
  where id = target_feed_item_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_flock_from_daily_log on public.daily_logs;
create trigger sync_flock_from_daily_log
  after insert or update on public.daily_logs
  for each row execute procedure public.sync_flock_from_daily_log();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_farms_updated_at on public.farms;
create trigger set_farms_updated_at before update on public.farms
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_farm_memberships_updated_at on public.farm_memberships;
create trigger set_farm_memberships_updated_at before update on public.farm_memberships
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_flock_memberships_updated_at on public.flock_memberships;
create trigger set_flock_memberships_updated_at before update on public.flock_memberships
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_houses_updated_at on public.houses;
create trigger set_houses_updated_at before update on public.houses
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_flocks_updated_at on public.flocks;
create trigger set_flocks_updated_at before update on public.flocks
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_daily_logs_updated_at on public.daily_logs;
create trigger set_daily_logs_updated_at before update on public.daily_logs
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_feed_items_updated_at on public.feed_items;
create trigger set_feed_items_updated_at before update on public.feed_items
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_feed_transactions_updated_at on public.feed_transactions;
create trigger set_feed_transactions_updated_at before update on public.feed_transactions
  for each row execute procedure public.set_updated_at();

-- MVP 2 updated_at triggers (new)
drop trigger if exists set_feed_suppliers_updated_at on public.feed_suppliers;
create trigger set_feed_suppliers_updated_at before update on public.feed_suppliers
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_feed_purchases_updated_at on public.feed_purchases;
create trigger set_feed_purchases_updated_at before update on public.feed_purchases
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_health_treatment_logs_updated_at on public.health_treatment_logs;
create trigger set_health_treatment_logs_updated_at before update on public.health_treatment_logs
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_flock_transfers_updated_at on public.flock_transfers;
create trigger set_flock_transfers_updated_at before update on public.flock_transfers
  for each row execute procedure public.set_updated_at();

drop trigger if exists sync_feed_item_stock on public.feed_transactions;
create trigger sync_feed_item_stock
  after insert or update or delete on public.feed_transactions
  for each row execute procedure public.sync_feed_item_stock();

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_memberships enable row level security;
alter table public.flock_memberships enable row level security;
alter table public.houses enable row level security;
alter table public.flocks enable row level security;
alter table public.daily_logs enable row level security;
alter table public.feed_items enable row level security;
alter table public.feed_transactions enable row level security;

-- MVP 2 RLS enablement (new)
alter table public.feed_suppliers enable row level security;
alter table public.feed_purchases enable row level security;
alter table public.health_treatment_logs enable row level security;
alter table public.flock_transfers enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  using (id = public.current_app_user_id() or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  using (id = public.current_app_user_id() or public.is_admin())
  with check (id = public.current_app_user_id() or public.is_admin());

drop policy if exists "farms_select_accessible" on public.farms;
create policy "farms_select_accessible"
  on public.farms
  for select
  using (public.has_farm_visibility(id));

drop policy if exists "farms_insert_manager_admin" on public.farms;
create policy "farms_insert_manager_admin"
  on public.farms
  for insert
  with check (
    public.current_app_user_id() = created_by
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "farms_update_manager_admin" on public.farms;
create policy "farms_update_manager_admin"
  on public.farms
  for update
  using (
    public.has_farm_access(id)
    and public.current_user_role() in ('admin', 'manager')
  )
  with check (
    public.has_farm_access(id)
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "farm_memberships_select_self_or_admin" on public.farm_memberships;
create policy "farm_memberships_select_self_or_admin"
  on public.farm_memberships
  for select
  using (user_id = public.current_app_user_id() or public.is_admin());

drop policy if exists "farm_memberships_insert_admin" on public.farm_memberships;
create policy "farm_memberships_insert_admin"
  on public.farm_memberships
  for insert
  with check (public.is_admin());

drop policy if exists "farm_memberships_update_admin" on public.farm_memberships;
create policy "farm_memberships_update_admin"
  on public.farm_memberships
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "flock_memberships_select_self_or_admin" on public.flock_memberships;
create policy "flock_memberships_select_self_or_admin"
  on public.flock_memberships
  for select
  using (user_id = public.current_app_user_id() or public.is_admin());

drop policy if exists "flock_memberships_insert_admin" on public.flock_memberships;
create policy "flock_memberships_insert_admin"
  on public.flock_memberships
  for insert
  with check (public.is_admin());

drop policy if exists "flock_memberships_update_admin" on public.flock_memberships;
create policy "flock_memberships_update_admin"
  on public.flock_memberships
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "houses_select_accessible" on public.houses;
create policy "houses_select_accessible"
  on public.houses
  for select
  using (public.has_farm_visibility(farm_id));

drop policy if exists "houses_insert_manager_admin" on public.houses;
create policy "houses_insert_manager_admin"
  on public.houses
  for insert
  with check (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "houses_update_manager_admin" on public.houses;
create policy "houses_update_manager_admin"
  on public.houses
  for update
  using (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  )
  with check (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "flocks_select_accessible" on public.flocks;
create policy "flocks_select_accessible"
  on public.flocks
  for select
  using (public.has_flock_access(id));

drop policy if exists "flocks_insert_manager_admin" on public.flocks;
create policy "flocks_insert_manager_admin"
  on public.flocks
  for insert
  with check (
    public.has_farm_access(farm_id)
    and public.current_app_user_id() = created_by
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "flocks_update_manager_admin" on public.flocks;
create policy "flocks_update_manager_admin"
  on public.flocks
  for update
  using (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  )
  with check (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "daily_logs_select_accessible" on public.daily_logs;
create policy "daily_logs_select_accessible"
  on public.daily_logs
  for select
  using (public.has_flock_access(flock_id));

drop policy if exists "daily_logs_insert_accessible" on public.daily_logs;
create policy "daily_logs_insert_accessible"
  on public.daily_logs
  for insert
  with check (public.has_flock_access(flock_id));

drop policy if exists "daily_logs_update_accessible" on public.daily_logs;
create policy "daily_logs_update_accessible"
  on public.daily_logs
  for update
  using (
    public.has_flock_access(flock_id)
    and (created_by = public.current_app_user_id() or public.current_user_role() in ('admin', 'manager'))
  )
  with check (
    public.has_flock_access(flock_id)
    and (created_by = public.current_app_user_id() or public.current_user_role() in ('admin', 'manager'))
  );

drop policy if exists "feed_items_select_accessible" on public.feed_items;
create policy "feed_items_select_accessible"
  on public.feed_items
  for select
  using (public.has_farm_visibility(farm_id));

drop policy if exists "feed_items_insert_manager_admin" on public.feed_items;
create policy "feed_items_insert_manager_admin"
  on public.feed_items
  for insert
  with check (
    public.has_farm_access(farm_id)
    and created_by = public.current_app_user_id()
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "feed_items_update_manager_admin" on public.feed_items;
create policy "feed_items_update_manager_admin"
  on public.feed_items
  for update
  using (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  )
  with check (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "feed_transactions_select_accessible" on public.feed_transactions;
create policy "feed_transactions_select_accessible"
  on public.feed_transactions
  for select
  using (public.has_farm_visibility(farm_id));

drop policy if exists "feed_transactions_insert_manager_admin" on public.feed_transactions;
create policy "feed_transactions_insert_manager_admin"
  on public.feed_transactions
  for insert
  with check (
    public.has_farm_access(farm_id)
    and created_by = public.current_app_user_id()
    and public.current_user_role() in ('admin', 'manager')
  );

-- MVP 2 policies (new)
drop policy if exists "feed_suppliers_select_accessible" on public.feed_suppliers;
create policy "feed_suppliers_select_accessible"
  on public.feed_suppliers
  for select
  using (public.has_farm_visibility(farm_id));

drop policy if exists "feed_suppliers_insert_manager_admin" on public.feed_suppliers;
create policy "feed_suppliers_insert_manager_admin"
  on public.feed_suppliers
  for insert
  with check (
    public.has_farm_access(farm_id)
    and created_by = public.current_app_user_id()
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "feed_suppliers_update_manager_admin" on public.feed_suppliers;
create policy "feed_suppliers_update_manager_admin"
  on public.feed_suppliers
  for update
  using (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  )
  with check (
    public.has_farm_access(farm_id)
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "feed_purchases_select_accessible" on public.feed_purchases;
create policy "feed_purchases_select_accessible"
  on public.feed_purchases
  for select
  using (public.has_farm_visibility(farm_id));

drop policy if exists "feed_purchases_insert_manager_admin" on public.feed_purchases;
create policy "feed_purchases_insert_manager_admin"
  on public.feed_purchases
  for insert
  with check (
    public.has_farm_access(farm_id)
    and created_by = public.current_app_user_id()
    and public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "health_treatment_logs_select_accessible" on public.health_treatment_logs;
create policy "health_treatment_logs_select_accessible"
  on public.health_treatment_logs
  for select
  using (public.has_flock_access(flock_id));

drop policy if exists "health_treatment_logs_insert_accessible" on public.health_treatment_logs;
create policy "health_treatment_logs_insert_accessible"
  on public.health_treatment_logs
  for insert
  with check (
    public.has_flock_access(flock_id)
    and created_by = public.current_app_user_id()
  );

drop policy if exists "health_treatment_logs_update_accessible" on public.health_treatment_logs;
create policy "health_treatment_logs_update_accessible"
  on public.health_treatment_logs
  for update
  using (
    public.has_flock_access(flock_id)
    and (created_by = public.current_app_user_id() or public.current_user_role() in ('admin', 'manager'))
  )
  with check (
    public.has_flock_access(flock_id)
    and (created_by = public.current_app_user_id() or public.current_user_role() in ('admin', 'manager'))
  );

drop policy if exists "flock_transfers_select_accessible" on public.flock_transfers;
create policy "flock_transfers_select_accessible"
  on public.flock_transfers
  for select
  using (public.has_farm_visibility(farm_id));

drop policy if exists "flock_transfers_insert_manager_admin" on public.flock_transfers;
create policy "flock_transfers_insert_manager_admin"
  on public.flock_transfers
  for insert
  with check (
    public.has_farm_access(farm_id)
    and created_by = public.current_app_user_id()
    and public.current_user_role() in ('admin', 'manager')
  );

-- ============================================================================
-- LEGACY ACCESS HELPERS RE-DECLARED
-- Compatibility block retained from the original schema ordering.
-- ============================================================================

create or replace function public.has_farm_access(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.farm_memberships
      where farm_id = target_farm_id
        and user_id = public.current_app_user_id()
    )
$$;

create or replace function public.has_farm_visibility(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_farm_access(target_farm_id)
    or exists (
      select 1
      from public.flock_memberships fm
      join public.flocks f on f.id = fm.flock_id
      where f.farm_id = target_farm_id
        and fm.user_id = public.current_app_user_id()
    )
$$;

create or replace function public.has_flock_access(target_flock_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.flock_memberships
      where flock_id = target_flock_id
        and user_id = public.current_app_user_id()
    )
    or exists (
      select 1
      from public.flocks
      where id = target_flock_id
        and public.has_farm_access(farm_id)
    )
$$;


 create or replace function public.current_user_role()
 returns text
 language sql
 stable
 security definer
 set search_path = public
 as $$
   select role
   from public.profiles
   where id = public.current_app_user_id()
 $$;
 
 create or replace function public.is_admin()
 returns boolean
 language sql
 stable
 security definer
 set search_path = public
 as $$
   select coalesce(public.current_user_role() = 'admin', false)
 $$;

  create or replace function public.current_app_user_id()
 returns uuid
 language plpgsql
 stable
 as $$
 declare
   auth_user_id uuid;
   jwt_claim_sub text;
   local_user_id text;
 begin
   auth_user_id := auth.uid();
   if auth_user_id is not null then
     return auth_user_id;
   end if;
 
   jwt_claim_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
   if jwt_claim_sub is not null then
     return jwt_claim_sub::uuid;
   end if;
 
   local_user_id := nullif(current_setting('app.current_user_id', true), '');
   if local_user_id is not null then
     return local_user_id::uuid;
   end if;
 
   return null;
 end;
 $$;
