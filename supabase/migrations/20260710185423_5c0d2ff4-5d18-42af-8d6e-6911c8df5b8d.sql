
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_stripe_id on public.subscriptions(stripe_subscription_id);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "own subscription read" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "service manage subscriptions" on public.subscriptions for all using (auth.role() = 'service_role');

create table public.portfolio_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  purchased int not null default 0,
  used int not null default 0,
  updated_at timestamptz default now()
);
grant select, update on public.portfolio_credits to authenticated;
grant all on public.portfolio_credits to service_role;
alter table public.portfolio_credits enable row level security;
create policy "own credits read" on public.portfolio_credits for select to authenticated using (auth.uid() = user_id);
create policy "own credits update used" on public.portfolio_credits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "service manage credits" on public.portfolio_credits for all using (auth.role() = 'service_role');

create or replace function public.has_active_buyer_network(_user_id uuid, _env text default 'sandbox')
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.subscriptions
    where user_id = _user_id
      and product_id = 'buyer_network'
      and environment = _env
      and (
        (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  )
$$;
