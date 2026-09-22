-- Run with psql -v ON_ERROR_STOP=1 -f supabase/tests/creator_organization_v1.sql.
-- Fixtures and all changes roll back. Exercises real API roles, not only superuser calls.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end;
$$;
create function pg_temp.expect_error(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then return; end;
  raise exception 'FAIL: unexpectedly permitted: %', statement;
end;
$$;
update public.founding_500_settings set is_auto_assignment_enabled=false where singleton;
insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data)
select ('c1000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 'creator-v1-' || n || '@example.test',
 jsonb_build_object('username','creator_v1_' || n,'dob','1980-01-01',
   'profile_type',case n when 2 then 'creator' when 3 then 'organization' else 'member' end,
   'display_name','Identity ' || n,
   'profile_metadata',jsonb_build_object('category','Education','public_location','Public location','social_links',jsonb_build_array(jsonb_build_object('url','https://youtube.com/example','label','YouTube')))),
 '{"provider":"email","providers":["email"]}'::jsonb
from generate_series(1,6) n;
update public.profiles set founding_member_number=(select min(n) from generate_series(1,500) n where not exists(select 1 from public.founding_member_numbers f where f.number=n))
where id='c1000000-0000-0000-0000-000000000002';
update public.profiles set role='admin' where id='c1000000-0000-0000-0000-000000000004';
update public.profiles set role='ceo' where id='c1000000-0000-0000-0000-000000000006';
update public.profiles set first_name='Private name',email='private@example.test' where id='c1000000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select profile_type='creator' and role='user' from public.profiles where id='c1000000-0000-0000-0000-000000000002'),'signup creates creator without role escalation');
select pg_temp.assert_true((select profile_type='organization' and role='user' from public.profiles where id='c1000000-0000-0000-0000-000000000003'),'signup creates organization');
select pg_temp.assert_true(not exists(select 1 from public.user_badges ub join public.badges b on b.id=ub.badge_id where ub.user_id::text like 'c1000000-%' and b.slug like 'verified%'),'signup never verifies');
insert into public.posts(id,user_id,title) values
 ('c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002','Creator update'),
 ('c2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003','Organization update'),
 ('c2000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','Not followed');
insert into public.posts(id,user_id,title,is_deleted,deleted_at) values
 ('c2000000-0000-0000-0000-000000000004','c1000000-0000-0000-0000-000000000002','Deleted',true,now());

set local role anon;
select pg_temp.expect_error($q$select public.set_profile_follow('c1000000-0000-0000-0000-000000000002',true)$q$);
select pg_temp.expect_error($q$select public.set_profile_verification('c1000000-0000-0000-0000-000000000002',true)$q$);
select pg_temp.assert_true((select profile_type='creator' and email is null and first_name is null from public.get_public_profile('c1000000-0000-0000-0000-000000000002')),'public profile preserves privacy and type');
reset role;
select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.assert_true((select profile_type='member' from public.get_my_profile()),'member self contract unchanged');
select public.set_profile_follow('c1000000-0000-0000-0000-000000000002',true);
select public.set_profile_follow('c1000000-0000-0000-0000-000000000002',true);
select public.set_profile_follow('c1000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((public.get_profile_follow_summary('c1000000-0000-0000-0000-000000000002')->>'followers')::int=1,'duplicate follow is idempotent');
select pg_temp.assert_true((public.get_profile_follow_summary('c1000000-0000-0000-0000-000000000001')->>'following')::int=2,'following count');
select pg_temp.assert_true((public.get_profile_follow_summary('c1000000-0000-0000-0000-000000000002')->>'is_following')::boolean,'viewer follows state');
select pg_temp.expect_error($q$select public.set_profile_follow('c1000000-0000-0000-0000-000000000001',true)$q$);
select pg_temp.expect_error($q$select public.set_profile_follow('c1000000-0000-0000-0000-999999999999',true)$q$);
select pg_temp.expect_error($q$insert into public.profile_follows(follower_id,following_id) values('c1000000-0000-0000-0000-000000000005','c1000000-0000-0000-0000-000000000002')$q$);
select pg_temp.expect_error($q$select public.set_profile_verification('c1000000-0000-0000-0000-000000000002',true)$q$);
select pg_temp.expect_error($q$select public.award_user_badge('c1000000-0000-0000-0000-000000000001','verified-creator')$q$);
select pg_temp.assert_true(jsonb_array_length(public.get_profile_follow_list('c1000000-0000-0000-0000-000000000001','following'))=2,'following list');
select pg_temp.assert_true(jsonb_array_length(public.get_profile_follow_list('c1000000-0000-0000-0000-000000000001','following',1,1))=1,'pagination');
select pg_temp.assert_true(jsonb_array_length(public.get_profile_follow_list('c1000000-0000-0000-0000-000000000002','followers'))=1,'followers list');
select pg_temp.assert_true((select count(*)=2 from public.get_following_post_ids()),'feed includes followed visible posts only');
select public.set_profile_follow('c1000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true((select count(*)=1 from public.get_following_post_ids()),'unfollow removes feed posts');
select pg_temp.assert_true((public.get_profile_follow_summary('c1000000-0000-0000-0000-000000000003')->>'followers')::int=0,'unfollow count');
reset role;
select pg_temp.assert_true(not exists(select 1 from public.friends where requester_id='c1000000-0000-0000-0000-000000000001'),'follows do not create friends');
update public.profiles set is_banned=true where id='c1000000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.get_following_post_ids()),'banned authors excluded');
select pg_temp.assert_true(jsonb_array_length(public.get_profile_follow_list('c1000000-0000-0000-0000-000000000001','following'))=0,'banned profiles excluded from lists');
select pg_temp.expect_error($q$select public.set_profile_follow('c1000000-0000-0000-0000-000000000002',true)$q$);
reset role;
update public.profiles set is_banned=false,is_deleted=true where id='c1000000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.expect_error($q$select public.set_profile_follow('c1000000-0000-0000-0000-000000000002',true)$q$);
select pg_temp.assert_true((select count(*)=0 from public.get_following_post_ids()),'deleted authors excluded');
reset role;
update public.profiles set is_deleted=false where id='c1000000-0000-0000-0000-000000000002';
update public.profiles set is_banned=true where id='c1000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.expect_error($q$select public.set_profile_follow('c1000000-0000-0000-0000-000000000003',true)$q$);
reset role;
update public.profiles set is_banned=false where id='c1000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select public.set_profile_verification('c1000000-0000-0000-0000-000000000002',true);
select public.set_profile_verification('c1000000-0000-0000-0000-000000000003',true);
select pg_temp.expect_error($q$select public.award_user_badge('c1000000-0000-0000-0000-000000000003','verified-creator')$q$);
select pg_temp.expect_error($q$select public.award_user_badge('c1000000-0000-0000-0000-000000000002','verified-organization')$q$);
select pg_temp.expect_error($q$select public.award_user_badge('c1000000-0000-0000-0000-000000000001','verified-creator')$q$);
select pg_temp.assert_true((select count(*)=2 from public.get_public_profile_badges(array['c1000000-0000-0000-0000-000000000002'::uuid,'c1000000-0000-0000-0000-000000000003'::uuid]) where badge_slug in ('verified-creator','verified-organization')),'public typed verification badges');
select pg_temp.assert_true((select count(*)=2 from public.get_public_profile_badges(array['c1000000-0000-0000-0000-000000000002'::uuid]) where badge_slug in ('founding-500','verified-creator')),'Founding 500 coexists with verification');
select public.set_profile_verification('c1000000-0000-0000-0000-000000000002',false);
select pg_temp.assert_true(not exists(select 1 from public.get_public_profile_badges(array['c1000000-0000-0000-0000-000000000002'::uuid]) where badge_slug='verified-creator'),'revocation');
reset role;
select set_config('request.jwt.claim.sub','c1000000-0000-0000-0000-000000000006',true);
set local role authenticated;
select public.set_profile_verification('c1000000-0000-0000-0000-000000000002',true);
reset role;
select pg_temp.assert_true((select role='user' from public.profiles where id='c1000000-0000-0000-0000-000000000002'),'verification never changes role');
select pg_temp.assert_true((select count(*)>=4 from public.moderation_actions where target_user_id::text like 'c1000000-%' and metadata->>'badge_slug' like 'verified-%'),'verification audit trail');
update public.profiles set profile_type='member' where id='c1000000-0000-0000-0000-000000000002';
select pg_temp.assert_true(not exists(select 1 from public.get_public_profile_badges(array['c1000000-0000-0000-0000-000000000002'::uuid]) where badge_slug like 'verified-%'),'type change invalidates verification');
rollback;
