-- Chatty v2 Supabase Schema

-- Profiles
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  last_seen timestamp with time zone default timezone('utc'::text, now())
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Chats
create table if not exists chats (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('direct', 'group')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text,
  avatar_url text
);

alter table chats enable row level security;
create policy "Users can view chats they participate in." on chats for select using (
  exists (select 1 from chat_participants cp where cp.chat_id = chats.id and cp.user_id = auth.uid())
);
create policy "Users can create chats." on chats for insert with check (true);

-- Chat Participants
create table if not exists chat_participants (
  chat_id uuid references chats(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_read_message_id uuid, -- will reference messages(id) later, but no hard FK to avoid circular dependencies
  primary key (chat_id, user_id)
);

alter table chat_participants enable row level security;
create policy "Users can view participants of their chats." on chat_participants for select using (
  exists (select 1 from chat_participants cp where cp.chat_id = chat_participants.chat_id and cp.user_id = auth.uid())
);
create policy "Users can insert participants." on chat_participants for insert with check (true);
create policy "Users can update their own participant record (last_read)." on chat_participants for update using (auth.uid() = user_id);

-- Messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references chats(id) on delete cascade not null,
  sender_id uuid references profiles(id) not null,
  text text not null,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table messages enable row level security;

create policy "Users can read messages in their chats" on messages for select using (
  exists (select 1 from chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid())
);
create policy "Users can insert messages in their chats" on messages for insert with check (
  exists (select 1 from chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid()) and auth.uid() = sender_id
);

-- Realtime: Enable realtime broadcasts on messages table and chat_participants (for read receipts)
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table chat_participants;

-- Trigger for new users
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_username text;
begin
  raw_username := split_part(new.email, '@', 1);
  insert into public.profiles (id, username, display_name)
  values (new.id, raw_username, raw_username);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users cascade;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RPC Function to get conversation list
create or replace function get_conversations(current_user_id uuid)
returns table (
  chat_id uuid,
  chat_type text,
  chat_name text,
  chat_avatar_url text,
  partner_id uuid,
  partner_username text,
  partner_display_name text,
  partner_avatar text,
  last_message text,
  last_message_time timestamp with time zone,
  last_sender_id uuid,
  unread_count bigint,
  partner_last_read_time timestamp with time zone
) as $$
begin
  return query
  select
    c.id as chat_id,
    c.type as chat_type,
    c.name as chat_name,
    c.avatar_url as chat_avatar_url,
    p.id as partner_id,
    p.username as partner_username,
    p.display_name as partner_display_name,
    p.avatar_url as partner_avatar,
    m.text as last_message,
    m.created_at as last_message_time,
    m.sender_id as last_sender_id,
    (
      select count(*)
      from messages unread
      where unread.chat_id = c.id 
        and unread.sender_id != current_user_id
        and unread.created_at > coalesce((
          select m_read.created_at 
          from messages m_read 
          where m_read.id = cp.last_read_message_id
        ), 'epoch'::timestamp)
    ) as unread_count,
    (
      select m_read.created_at 
      from messages m_read 
      where m_read.id = cp2.last_read_message_id
    ) as partner_last_read_time
  from chats c
  join chat_participants cp on cp.chat_id = c.id and cp.user_id = current_user_id
  -- Join to find the direct message partner
  left join chat_participants cp2 on cp2.chat_id = c.id and cp2.user_id != current_user_id and c.type = 'direct'
  left join profiles p on p.id = cp2.user_id
  -- Join to get the latest message
  left join lateral (
    select text, created_at, sender_id
    from messages m2
    where m2.chat_id = c.id
    order by created_at desc
    limit 1
  ) m on true
  order by coalesce(m.created_at, c.created_at) desc;
end;
$$ language plpgsql security definer;
-- Storage Buckets and Policies
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('chat_attachments', 'chat_attachments', true)
on conflict (id) do nothing;

create policy "Avatars are publicly accessible." on storage.objects for select using (bucket_id = 'avatars');
create policy "Users can upload their own avatar." on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update their own avatar." on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Chat attachments are publicly accessible." on storage.objects for select using (bucket_id = 'chat_attachments');
create policy "Users can upload chat attachments." on storage.objects for insert with check (bucket_id = 'chat_attachments' and (storage.foldername(name))[1] = auth.uid()::text);
