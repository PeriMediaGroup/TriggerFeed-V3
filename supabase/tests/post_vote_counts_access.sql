-- Focused aggregate vote access test.
-- Run after migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/post_vote_counts_access.sql

begin;

do $$
declare
  object_kind "char";
  exposed_columns text[];
begin
  select c.relkind
  into object_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'post_vote_counts';

  if object_kind <> 'v' then
    raise exception 'post_vote_counts should be a normal view, got relkind %', object_kind;
  end if;

  select array_agg(a.attname order by a.attnum)
  into exposed_columns
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'post_vote_counts'
    and a.attnum > 0
    and not a.attisdropped;

  if exposed_columns <> array[
    'post_id',
    'upvote_count',
    'downvote_count',
    'score',
    'vote_score',
    'vote_count',
    'interaction_count'
  ]::text[] then
    raise exception 'post_vote_counts exposed unexpected columns: %', exposed_columns;
  end if;
end $$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '21000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'vote-audit-one@example.com',
    crypt('testMe123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"vote_audit_one","dob":"1980-01-01"}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'vote-audit-two@example.com',
    crypt('testMe123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"vote_audit_two","dob":"1980-01-02"}'::jsonb,
    now(),
    now()
  );

insert into public.posts (id, user_id, title, visibility)
values (
  '22000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  'Vote aggregate access audit',
  'public'
);

insert into public.post_votes (post_id, user_id, vote_type)
values
  (
    '22000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    'upvote'
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000002',
    'downvote'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);

do $$
declare
  result record;
  ignored_count integer;
begin
  begin
    select count(*) into ignored_count from public.post_votes;
    raise exception 'authenticated direct post_votes select should fail';
  exception
    when insufficient_privilege then null;
  end;

  begin
    select count(*) into ignored_count from public.post_vote_counts;
    raise exception 'authenticated direct post_vote_counts select should fail';
  exception
    when insufficient_privilege then null;
  end;

  select *
  into result
  from public.get_post_vote_counts(
    array['22000000-0000-0000-0000-000000000001'::uuid]
  );

  if result.upvote_count <> 1
    or result.downvote_count <> 1
    or result.vote_count <> 2
    or result.score <> 0 then
    raise exception 'authenticated aggregate RPC returned unexpected values: %', result;
  end if;
end $$;

reset role;
set local role anon;

do $$
declare
  result record;
  ignored_count integer;
begin
  begin
    select count(*) into ignored_count from public.post_votes;
    raise exception 'anon direct post_votes select should fail';
  exception
    when insufficient_privilege then null;
  end;

  begin
    select count(*) into ignored_count from public.post_vote_counts;
    raise exception 'anon direct post_vote_counts select should fail';
  exception
    when insufficient_privilege then null;
  end;

  select *
  into result
  from public.get_post_vote_counts(
    array['22000000-0000-0000-0000-000000000001'::uuid]
  );

  if result.upvote_count <> 1
    or result.downvote_count <> 1
    or result.vote_count <> 2
    or result.score <> 0 then
    raise exception 'anon aggregate RPC returned unexpected values: %', result;
  end if;
end $$;

reset role;
rollback;

select 'post vote count access test passed' as result;
