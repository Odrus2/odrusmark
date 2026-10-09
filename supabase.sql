-- Odrusmark client research platform
-- Run in the Supabase SQL Editor. This file is safe to re-run after initial setup.
-- Never put a service_role key in the static frontend.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) between 1 and 120),
  email text not null,
  role text not null default 'client' check (role in ('client', 'researcher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 5 and 160),
  category text not null check (category in ('Market Research','Business Research','Technology Research','Technical Research','Data & Analytics','Feasibility Study','Academic / Literature','Product Research','Custom Research')),
  description text not null check (char_length(description) between 20 and 10000),
  research_question text not null check (char_length(research_question) between 10 and 3000),
  desired_outcome text not null check (char_length(desired_outcome) between 1 and 3000),
  additional_information text check (additional_information is null or char_length(additional_information) <= 5000),
  deadline date,
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','in_progress','awaiting_client','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_requests_user_created_idx on public.research_requests (user_id, created_at desc);
create index if not exists research_requests_status_deadline_idx on public.research_requests (status, deadline);

-- Projects are the primary client-facing unit of work. Kept alongside the
-- original research_requests table so existing request data remains intact.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 5 and 160),
  objective text not null check (char_length(objective) between 20 and 10000),
  success_criteria text check (success_criteria is null or char_length(success_criteria) <= 3000),
  known_context text check (known_context is null or char_length(known_context) <= 5000),
  attempted text check (attempted is null or char_length(attempted) <= 5000),
  desired_timeline text check (desired_timeline is null or char_length(desired_timeline) <= 300),
  status text not null default 'submitted' check (status in ('submitted','under_review','scoped','active','on_hold','awaiting_client','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_created_idx on public.projects (owner_id, created_at desc);
create index if not exists projects_status_idx on public.projects (status, updated_at desc);

-- Private client attachments. Folder path is <owner UUID>/<project UUID>/<file name>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('odrusmark-project-files', 'odrusmark-project-files', false, 10485760,
        array['application/pdf','text/plain','text/csv','image/jpeg','image/png','image/webp',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/msword','application/vnd.ms-excel'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists requests_touch_updated_at on public.research_requests;
create trigger requests_touch_updated_at before update on public.research_requests
for each row execute function public.touch_updated_at();
drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at before update on public.projects
for each row execute function public.touch_updated_at();

-- Role is assigned only during profile creation. No client-facing update path can change it.
create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Client'),
          new.email,
          'client')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

-- This helper can only reveal the role of the calling authenticated user.
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.research_requests enable row level security;
alter table public.projects enable row level security;

drop policy if exists "project owners and staff read project files" on storage.objects;
create policy "project owners and staff read project files" on storage.objects for select to authenticated
using (bucket_id = 'odrusmark-project-files' and (
  public.current_app_role() in ('researcher','admin') or
  ((storage.foldername(name))[1] = (select auth.uid())::text and exists (
    select 1 from public.projects p where p.id::text = (storage.foldername(name))[2] and p.owner_id = (select auth.uid())
  ))
));
drop policy if exists "project owners upload project files" on storage.objects;
create policy "project owners upload project files" on storage.objects for insert to authenticated
with check (bucket_id = 'odrusmark-project-files' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (
  select 1 from public.projects p where p.id::text = (storage.foldername(name))[2] and p.owner_id = (select auth.uid())
));
drop policy if exists "project owners or admins delete project files" on storage.objects;
create policy "project owners or admins delete project files" on storage.objects for delete to authenticated
using (bucket_id = 'odrusmark-project-files' and (
  public.current_app_role() = 'admin' or
  ((storage.foldername(name))[1] = (select auth.uid())::text and exists (
    select 1 from public.projects p where p.id::text = (storage.foldername(name))[2] and p.owner_id = (select auth.uid())
  ))
));

drop policy if exists "profile read own or staff" on public.profiles;
create policy "profile read own or staff" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.current_app_role() in ('researcher','admin'));
drop policy if exists "profile update own name" on public.profiles;
create policy "profile update own name" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "clients read own requests; staff read all" on public.research_requests;
create policy "clients read own requests; staff read all" on public.research_requests for select to authenticated
using (user_id = (select auth.uid()) or public.current_app_role() in ('researcher','admin'));
drop policy if exists "clients submit own requests" on public.research_requests;
create policy "clients submit own requests" on public.research_requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'submitted');
drop policy if exists "staff update requests" on public.research_requests;
create policy "staff update requests" on public.research_requests for update to authenticated
using (public.current_app_role() in ('researcher','admin'))
with check (public.current_app_role() in ('researcher','admin'));
drop policy if exists "admins delete requests" on public.research_requests;
create policy "admins delete requests" on public.research_requests for delete to authenticated
using (public.current_app_role() = 'admin');

drop policy if exists "clients read own projects; staff read all" on public.projects;
create policy "clients read own projects; staff read all" on public.projects for select to authenticated
using (owner_id = (select auth.uid()) or public.current_app_role() in ('researcher','admin'));
drop policy if exists "clients create own projects" on public.projects;
create policy "clients create own projects" on public.projects for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'submitted');
drop policy if exists "staff update projects" on public.projects;
create policy "staff update projects" on public.projects for update to authenticated
using (public.current_app_role() in ('researcher','admin'))
with check (public.current_app_role() in ('researcher','admin'));
drop policy if exists "admins delete projects" on public.projects;
create policy "admins delete projects" on public.projects for delete to authenticated
using (public.current_app_role() = 'admin');

-- Grant only fields the browser needs. In particular clients cannot edit role or request
-- ownership/status. Only staff roles can change request status via the RLS update policy.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
revoke all on public.research_requests from anon, authenticated;
grant select, insert on public.research_requests to authenticated;
grant update, delete on public.research_requests to authenticated;
revoke all on public.projects from anon, authenticated;
grant select, insert on public.projects to authenticated;
grant update, delete on public.projects to authenticated;

comment on table public.profiles is 'Application profile linked one-to-one to Supabase Auth users; role elevation is an operator-controlled database action.';
comment on table public.research_requests is 'Client research intake and status tracking. Client-facing access is constrained by RLS.';
comment on table public.projects is 'Primary client-facing unit of work. Future project workspace tables will reference this ID and enforce project membership through RLS.';

commit;
