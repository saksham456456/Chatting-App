-- Chatty v2 Supabase Schema

-- Create a table for public profiles
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Create a table for messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references profiles(id) not null,
  receiver_id uuid references profiles(id) not null,
  text text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table messages enable row level security;

create policy "Users can read own messages" on messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users can insert own messages" on messages for insert with check (auth.uid() = sender_id);
create policy "Users can update received messages" on messages for update using (auth.uid() = receiver_id);

-- Realtime: Enable realtime broadcasts on messages table
alter publication supabase_realtime add table messages;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RPC Function to get conversation list (Telegram style)
create or replace function get_conversations(current_user_id uuid)
returns table (
  partner_id uuid,
  partner_username text,
  partner_display_name text,
  partner_avatar text,
  last_message text,
  last_message_time timestamp with time zone,
  last_sender_id uuid,
  unread_count bigint
) as $$
begin
  return query
  with partners as (
    select distinct
      case when sender_id = current_user_id then receiver_id else sender_id end as pid
    from messages
    where sender_id = current_user_id or receiver_id = current_user_id
  )
  select
    u.id as partner_id,
    u.username as partner_username,
    u.display_name as partner_display_name,
    u.avatar_url as partner_avatar,
    m.text as last_message,
    m.created_at as last_message_time,
    m.sender_id as last_sender_id,
    (
      select count(*)
      from messages unread
      where unread.sender_id = u.id 
        and unread.receiver_id = current_user_id 
        and unread.read = false
    ) as unread_count
  from partners p
  join profiles u on u.id = p.pid
  join messages m on m.id = (
    select id from messages
    where (sender_id = current_user_id and receiver_id = p.pid)
       or (sender_id = p.pid and receiver_id = current_user_id)
    order by created_at desc
    limit 1
  )
  order by m.created_at desc;
end;
$$ language plpgsql security definer;
