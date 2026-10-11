-- Odrusmark AI Project Copilot migration
-- Safe to re-run. Run after the base Odrusmark schema has created profiles and projects.
begin;

alter table public.projects add column if not exists target_completion_date date;

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 3 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists project_updates_project_created_idx on public.project_updates(project_id, created_at desc);
alter table public.project_updates enable row level security;
drop policy if exists "clients read own project updates; staff read all" on public.project_updates;
create policy "clients read own project updates; staff read all" on public.project_updates for select to authenticated
using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  or public.current_app_role() in ('researcher','admin')
);
drop policy if exists "staff publish project updates" on public.project_updates;
create policy "staff publish project updates" on public.project_updates for insert to authenticated
with check (author_id = (select auth.uid()) and public.current_app_role() in ('researcher','admin'));
revoke all on public.project_updates from anon, authenticated;
grant select, insert on public.project_updates to authenticated;

create table if not exists public.project_ai_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  mode text not null check (mode in ('ask','clarify','plan','research')),
  content text not null check (char_length(content) between 1 and 12000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  created_at timestamptz not null default now()
);
create index if not exists project_ai_messages_history_idx on public.project_ai_messages(project_id, created_at desc);
alter table public.project_ai_messages enable row level security;
drop policy if exists "clients read own project AI messages" on public.project_ai_messages;
create policy "clients read own project AI messages" on public.project_ai_messages for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
drop policy if exists "clients send own project AI messages" on public.project_ai_messages;
create policy "clients send own project AI messages" on public.project_ai_messages for insert to authenticated
with check (
  user_id = (select auth.uid()) and role = 'user'
  and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
revoke all on public.project_ai_messages from anon, authenticated;
grant select, insert on public.project_ai_messages to authenticated;
grant select, insert on public.project_ai_messages to service_role;

create table if not exists public.project_ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  standard_count integer not null default 0 check (standard_count >= 0),
  research_count integer not null default 0 check (research_count >= 0),
  primary key (user_id, usage_date)
);
alter table public.project_ai_usage enable row level security;
revoke all on public.project_ai_usage from anon, authenticated;

create or replace function public.consume_project_ai_quota(p_is_research boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
  v_day date := (now() at time zone 'utc')::date;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if p_is_research then
    insert into public.project_ai_usage(user_id, usage_date, standard_count, research_count)
    values (v_user, v_day, 0, 1)
    on conflict (user_id, usage_date) do update
      set research_count = public.project_ai_usage.research_count + 1
      where public.project_ai_usage.research_count < 5
    returning research_count into v_count;
    if v_count is null then return -1; end if;
    return 5 - v_count;
  else
    insert into public.project_ai_usage(user_id, usage_date, standard_count, research_count)
    values (v_user, v_day, 1, 0)
    on conflict (user_id, usage_date) do update
      set standard_count = public.project_ai_usage.standard_count + 1
      where public.project_ai_usage.standard_count < 30
    returning standard_count into v_count;
    if v_count is null then return -1; end if;
    return 30 - v_count;
  end if;
end;
$$;
revoke all on function public.consume_project_ai_quota(boolean) from public, anon;
grant execute on function public.consume_project_ai_quota(boolean) to authenticated;

comment on table public.project_ai_messages is 'Private, project-scoped AI copilot messages; source links are stored with assistant drafts.';
comment on table public.project_ai_usage is 'Private daily rate limits for the project copilot.';

commit;
