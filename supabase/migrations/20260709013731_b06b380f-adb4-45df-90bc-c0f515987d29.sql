
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'artist');
create type public.artwork_status as enum ('available', 'sold', 'private');
create type public.inquiry_status as enum ('new', 'read', 'replied', 'archived');

-- ============ ADMIN ALLOWLIST ============
create table public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);
grant select on public.admin_emails to authenticated;
grant all on public.admin_emails to service_role;
alter table public.admin_emails enable row level security;
-- no policies: only service_role/admins access via functions

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users see own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id);
create policy "Admins see all roles" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  slug text unique not null,
  artist_name text,
  email text,
  avatar_path text,
  city text,
  country text,
  instagram text,
  website text,
  phone text,
  medium text,
  years_creating int,
  style text,
  price_range text,
  commission_available boolean not null default false,
  languages text[],
  exhibitions text,
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Public read published profiles" on public.profiles for select to anon
  using (published = true);
create policy "Auth read all profiles" on public.profiles for select to authenticated
  using (true);
create policy "Users manage own profile" on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins manage profiles" on public.profiles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ ARTWORKS ============
create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text,
  title text not null,
  medium text,
  dimensions text,
  year int,
  status artwork_status not null default 'available',
  price numeric,
  collection_name text,
  tags text[],
  description text,
  featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.artworks to anon;
grant select, insert, update, delete on public.artworks to authenticated;
grant all on public.artworks to service_role;
alter table public.artworks enable row level security;

create policy "Public read artworks of published profiles" on public.artworks for select to anon
  using (exists (select 1 from public.profiles p where p.id = artworks.user_id and p.published = true));
create policy "Auth read all artworks" on public.artworks for select to authenticated using (true);
create policy "Users manage own artworks" on public.artworks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins manage artworks" on public.artworks for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- limit 15 artworks per user
create or replace function public.enforce_artwork_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.artworks where user_id = new.user_id) >= 15 then
    raise exception 'Artwork limit reached (15 max)';
  end if;
  return new;
end $$;
create trigger artworks_limit before insert on public.artworks
  for each row execute function public.enforce_artwork_limit();

-- ============ QUESTIONNAIRES ============
create table public.questionnaires (
  user_id uuid primary key references auth.users(id) on delete cascade,
  q1 text, q2 text, q3 text, q4 text, q5 text,
  q6 text, q7 text, q8 text, q9 text, q10 text,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.questionnaires to authenticated;
grant all on public.questionnaires to service_role;
alter table public.questionnaires enable row level security;
create policy "Own questionnaire" on public.questionnaires for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ AI CONTENT ============
create table public.ai_content (
  user_id uuid primary key references auth.users(id) on delete cascade,
  artist_statement text,
  short_statement text,
  biography text,
  instagram_bio text,
  homepage_copy text,
  collection_description text,
  seo_description text,
  elevator_pitch text,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);
grant select on public.ai_content to anon;
grant select, insert, update, delete on public.ai_content to authenticated;
grant all on public.ai_content to service_role;
alter table public.ai_content enable row level security;
create policy "Public read AI content of published" on public.ai_content for select to anon
  using (exists (select 1 from public.profiles p where p.id = ai_content.user_id and p.published = true));
create policy "Own AI content" on public.ai_content for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ INQUIRIES ============
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  budget text,
  message text not null,
  status inquiry_status not null default 'new',
  created_at timestamptz not null default now()
);
grant insert on public.inquiries to anon;
grant select, insert, update, delete on public.inquiries to authenticated;
grant all on public.inquiries to service_role;
alter table public.inquiries enable row level security;
create policy "Anyone can submit inquiry" on public.inquiries for insert to anon with check (true);
create policy "Auth can submit inquiry" on public.inquiries for insert to authenticated with check (true);
create policy "Artist reads own inquiries" on public.inquiries for select to authenticated
  using (auth.uid() = artist_id);
create policy "Artist manages own inquiries" on public.inquiries for update to authenticated
  using (auth.uid() = artist_id) with check (auth.uid() = artist_id);
create policy "Admins manage inquiries" on public.inquiries for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ ANALYTICS ============
create table public.analytics_events (
  id bigserial primary key,
  artist_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, -- 'site_view', 'artwork_view', 'portfolio_download'
  ref_id uuid,
  created_at timestamptz not null default now()
);
grant insert on public.analytics_events to anon;
grant select, insert on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;
alter table public.analytics_events enable row level security;
create policy "Anyone logs event" on public.analytics_events for insert to anon with check (true);
create policy "Auth logs event" on public.analytics_events for insert to authenticated with check (true);
create policy "Artist reads own analytics" on public.analytics_events for select to authenticated
  using (auth.uid() = artist_id);
create policy "Admins read analytics" on public.analytics_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create index on public.analytics_events (artist_id, event_type, created_at);

-- ============ UPDATED_AT TRIGGER ============
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.tg_touch_updated_at();
create trigger artworks_touch before update on public.artworks for each row execute function public.tg_touch_updated_at();
create trigger ai_content_touch before update on public.ai_content for each row execute function public.tg_touch_updated_at();
create trigger questionnaires_touch before update on public.questionnaires for each row execute function public.tg_touch_updated_at();

-- ============ NEW USER: profile + role ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_slug text;
  final_slug text;
  n int := 0;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  base_slug := regexp_replace(lower(coalesce(display_name, 'artist')), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'artist'; end if;
  final_slug := base_slug;
  while exists (select 1 from public.profiles where slug = final_slug) loop
    n := n + 1;
    final_slug := base_slug || '-' || n::text;
  end loop;

  insert into public.profiles (id, slug, artist_name, email)
  values (new.id, final_slug, display_name, new.email);

  insert into public.user_roles (user_id, role) values (new.id, 'artist');

  -- admin allowlist by email (verified only)
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- grant admin when the user later confirms email
create or replace function public.grant_admin_on_verify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email is distinct from new.email)
     and exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at, email on auth.users
  for each row execute function public.grant_admin_on_verify();

-- ============ STORAGE POLICIES ============
create policy "Own avatar read"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
create policy "Own avatar write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and owner = auth.uid() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Own avatar update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
create policy "Own avatar delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
create policy "Public read avatars via signed"
  on storage.objects for select to anon
  using (bucket_id = 'avatars');

create policy "Own artwork read"
  on storage.objects for select to authenticated
  using (bucket_id = 'artworks' and owner = auth.uid());
create policy "Own artwork write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'artworks' and owner = auth.uid() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Own artwork update"
  on storage.objects for update to authenticated
  using (bucket_id = 'artworks' and owner = auth.uid());
create policy "Own artwork delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'artworks' and owner = auth.uid());
create policy "Public read artworks via signed"
  on storage.objects for select to anon
  using (bucket_id = 'artworks');
