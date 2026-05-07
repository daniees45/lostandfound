create extension if not exists vector;

create table if not exists profiles (
  id uuid primary key,
  role text not null check (role in ('student', 'admin', 'pickup_point')),
  email text,
  full_name text,
  created_at timestamptz default now()
);

alter table profiles
  alter column role set default 'student';

alter table profiles add column if not exists email text;

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  title text not null,
  description text not null,
  category text not null,
  ai_tags text[] default '{}'::text[],
  location text not null,
  status text not null check (status in ('lost', 'found', 'claimed', 'returned', 'held_at_pickup')),
  image_url text,
  pickup_code text,
  embedding vector(384),
  created_at timestamptz default now()
);

alter table items add column if not exists ai_tags text[] default '{}'::text[];

create index if not exists items_embedding_idx
on items using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index if not exists items_user_created_idx
on items(user_id, created_at desc);

create index if not exists items_status_created_idx
on items(status, created_at desc);

create or replace function match_items(
  query_embedding vector(384),
  match_count int default 20
)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  ai_tags text[],
  location text,
  status text,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    i.id,
    i.title,
    i.description,
    i.category,
    i.ai_tags,
    i.location,
    i.status,
    i.created_at,
    1 - (i.embedding <=> query_embedding) as similarity
  from items i
  where i.status in ('found', 'held_at_pickup', 'claimed')
    and i.embedding is not null
  order by i.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  claimant_id uuid not null references profiles(id),
  proof_description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create index if not exists claims_item_status_created_idx
on claims(item_id, status, created_at desc);

create index if not exists claims_claimant_created_idx
on claims(claimant_id, created_at desc);

create table if not exists custody_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  from_user_id uuid references profiles(id),
  to_user_id uuid references profiles(id),
  verification_method text not null check (verification_method in ('handover_code', 'id_card', 'manual_override')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  channel text not null check (channel in ('email', 'sms_dummy')),
  message text not null,
  status text not null default 'sent' check (status in ('queued', 'sent', 'failed')),
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

alter table notification_logs add column if not exists is_read boolean not null default false;
alter table notification_logs add column if not exists read_at timestamptz;

create index if not exists notification_logs_user_unread_idx
on notification_logs(user_id, is_read, created_at desc);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  finder_id uuid references profiles(id),
  claimer_id uuid references profiles(id),
  session_code text not null unique,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

alter table chat_sessions add column if not exists item_id uuid references items(id) on delete cascade;
alter table chat_sessions add column if not exists finder_id uuid references profiles(id);
alter table chat_sessions add column if not exists claimer_id uuid references profiles(id);

create unique index if not exists chat_sessions_item_claimer_idx
on chat_sessions(item_id, claimer_id)
where item_id is not null and claimer_id is not null;

create unique index if not exists chat_sessions_item_open_idx
on chat_sessions(item_id)
where item_id is not null and claimer_id is null;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  sender_role text not null check (sender_role in ('finder', 'claimer')),
  body text not null,
  created_at timestamptz default now()
);

create index if not exists messages_session_created_idx
on messages(session_id, created_at asc);

alter table profiles enable row level security;
alter table items enable row level security;
alter table claims enable row level security;
alter table custody_logs enable row level security;
alter table notification_logs enable row level security;
alter table chat_sessions enable row level security;
alter table messages enable row level security;

create or replace function is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles p
    where p.id = uid
      and p.role = 'admin'
  );
$$;

create or replace function is_pickup_point(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles p
    where p.id = uid
      and p.role = 'pickup_point'
  );
$$;

create or replace function is_staff(uid uuid)
returns boolean
language sql
stable
as $$
  select is_admin(uid) or is_pickup_point(uid);
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'student');

  if user_role not in ('student', 'admin', 'pickup_point') then
    user_role := 'student';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    user_role
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = coalesce(public.profiles.role, excluded.role);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "public read found items" on items;
drop policy if exists "owner read own items" on items;
drop policy if exists "staff read all items" on items;
drop policy if exists "authenticated insert item" on items;
drop policy if exists "owner update item" on items;
drop policy if exists "staff update items" on items;
drop policy if exists "read own profile" on profiles;
drop policy if exists "read related or staff profiles" on profiles;
drop policy if exists "insert own profile" on profiles;
drop policy if exists "update own profile" on profiles;
drop policy if exists "service role inserts profiles" on profiles;
drop policy if exists "service role updates profiles" on profiles;
drop policy if exists "read custody logs" on custody_logs;
drop policy if exists "insert custody logs" on custody_logs;
drop policy if exists "read notification logs" on notification_logs;
drop policy if exists "insert notification logs" on notification_logs;
drop policy if exists "update own notification logs" on notification_logs;
drop policy if exists "read chat sessions" on chat_sessions;
drop policy if exists "insert chat sessions" on chat_sessions;
drop policy if exists "update open chat sessions" on chat_sessions;
drop policy if exists "read messages" on messages;
drop policy if exists "insert messages" on messages;
drop policy if exists "read own claims" on claims;
drop policy if exists "insert own claim" on claims;
drop policy if exists "update own claim" on claims;
drop policy if exists "read related claims" on claims;
drop policy if exists "staff read claims" on claims;
drop policy if exists "update owned item claims" on claims;
drop policy if exists "public read item images" on storage.objects;
drop policy if exists "authenticated upload item images" on storage.objects;
drop policy if exists "owners update item images" on storage.objects;
drop policy if exists "owners delete item images" on storage.objects;

create policy "public read found items"
on items
for select
using (status in ('found', 'held_at_pickup', 'claimed'));

create policy "owner read own items"
on items
for select
to authenticated
using (auth.uid() = user_id);

create policy "staff read all items"
on items
for select
to authenticated
using (is_staff(auth.uid()));

create policy "authenticated insert item"
on items
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "owner update item"
on items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "staff update items"
on items
for update
to authenticated
using (is_staff(auth.uid()))
with check (is_staff(auth.uid()));

create policy "read own profile"
on profiles
for select
to authenticated
using (auth.uid() = id);

create policy "read related or staff profiles"
on profiles
for select
to authenticated
using (
  is_staff(auth.uid())
  or exists (
    select 1
    from items i
    where i.user_id = auth.uid()
      and exists (
        select 1
        from claims c
        where c.item_id = i.id
          and c.claimant_id = profiles.id
      )
  )
  or exists (
    select 1
    from claims c
    join items i on i.id = c.item_id
    where c.claimant_id = auth.uid()
      and i.user_id = profiles.id
  )
);

create policy "insert own profile"
on profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "service role inserts profiles"
on profiles
for insert
to service_role
with check (true);

create policy "update own profile"
on profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "service role updates profiles"
on profiles
for update
to service_role
using (true)
with check (true);

create policy "read custody logs"
on custody_logs
for select
to authenticated
using (true);

create policy "insert custody logs"
on custody_logs
for insert
to authenticated
with check (true);

create policy "read notification logs"
on notification_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "insert notification logs"
on notification_logs
for insert
to authenticated
with check (true);

create policy "update own notification logs"
on notification_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "read related claims"
on claims
for select
to authenticated
using (
  auth.uid() = claimant_id
  or is_staff(auth.uid())
  or exists (
    select 1
    from items i
    where i.id = claims.item_id
      and i.user_id = auth.uid()
  )
);

create policy "staff read claims"
on claims
for select
to authenticated
using (is_staff(auth.uid()));

create policy "insert own claim"
on claims
for insert
to authenticated
with check (
  auth.uid() = claimant_id
  and exists (
    select 1
    from items i
    where i.id = claims.item_id
      and i.user_id <> auth.uid()
      and i.status in ('found', 'held_at_pickup', 'claimed')
  )
);

create policy "update owned item claims"
on claims
for update
to authenticated
using (
  exists (
    select 1
    from items i
    where i.id = claims.item_id
      and i.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from items i
    where i.id = claims.item_id
      and i.user_id = auth.uid()
  )
  and status in ('approved', 'rejected')
);

create policy "read chat sessions"
on chat_sessions
for select
to authenticated
using (
  auth.uid() = finder_id
  or auth.uid() = claimer_id
  or auth.uid() = created_by
  or (
    claimer_id is null
    and exists (
      select 1
      from claims c
      where c.item_id = chat_sessions.item_id
        and c.claimant_id = auth.uid()
        and c.status in ('pending', 'approved')
    )
  )
);

create policy "insert chat sessions"
on chat_sessions
for insert
to authenticated
with check (
  (
    auth.uid() = created_by
    and auth.uid() = claimer_id
    and finder_id = (select user_id from items where items.id = item_id)
    and exists (
      select 1
      from claims c
      where c.item_id = chat_sessions.item_id
        and c.claimant_id = auth.uid()
        and c.status in ('pending', 'approved')
    )
  )
  or (
    auth.uid() = created_by
    and auth.uid() = finder_id
    and claimer_id is null
    and finder_id = (select user_id from items where items.id = item_id)
  )
);

create policy "update open chat sessions"
on chat_sessions
for update
to authenticated
using (
  claimer_id is null
  and exists (
    select 1
    from claims c
    where c.item_id = chat_sessions.item_id
      and c.claimant_id = auth.uid()
      and c.status in ('pending', 'approved')
  )
)
with check (
  claimer_id = auth.uid()
  and exists (
    select 1
    from claims c
    where c.item_id = chat_sessions.item_id
      and c.claimant_id = auth.uid()
      and c.status in ('pending', 'approved')
  )
);

create policy "read messages"
on messages
for select
to authenticated
using (
  exists (
    select 1
    from chat_sessions cs
    where cs.id = messages.session_id
      and (auth.uid() = cs.finder_id or auth.uid() = cs.claimer_id or auth.uid() = cs.created_by)
  )
);

create policy "insert messages"
on messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from chat_sessions cs
    where cs.id = messages.session_id
      and (
        (auth.uid() = cs.finder_id and messages.sender_role = 'finder')
        or (auth.uid() = cs.claimer_id and messages.sender_role = 'claimer')
      )
  )
);

create policy "public read item images"
on storage.objects
for select
using (bucket_id = 'item-images');

create policy "authenticated upload item images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners update item images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners delete item images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'item-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
