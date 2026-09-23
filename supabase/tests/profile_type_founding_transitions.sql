-- Run against an isolated local database with free fixture numbers 24-27.
-- Every fixture and change rolls back; real API roles exercise authorization.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end;
$$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm) > 0 then return; end if;
    raise;
  end;
  raise exception 'FAIL: unexpectedly permitted: %', statement;
end;
$$;
create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
 select ('e1000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid;
$$;
update public.founding_500_settings set is_auto_assignment_enabled=false where singleton;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
select pg_temp.uid(n),
 case n when 9 then 'transition@triggerfeed.com' when 10 then 'transition@perimediagroup.com' else 'transition-' || n || '@example.test' end,
 jsonb_build_object('username','transition_' || n,'dob','1980-01-01',
 'profile_type',case when n in (6,16) then 'creator' when n in (7,8,9,10,15,18) then 'organization' else 'member' end),
 '{"provider":"email","providers":["email"]}'::jsonb
from generate_series(1,19) n;
update public.profiles set role='admin' where id=pg_temp.uid(1);
update public.profiles set role='ceo' where id=pg_temp.uid(2);
update public.profiles set role='moderator' where id=pg_temp.uid(4);
update public.profiles set account_type='system',profile_type='system' where id=pg_temp.uid(11);
update public.profiles set account_type='editorial',profile_type='system' where id=pg_temp.uid(12);
update public.profiles set account_type='bot',profile_type='system' where id=pg_temp.uid(13);
update public.profiles set profile_type='system' where id=pg_temp.uid(14);
update public.profiles set founding_member_number=24 where id=pg_temp.uid(5);
update public.profiles set founding_member_number=25 where id=pg_temp.uid(6);
update public.profiles set founding_member_number=26 where id=pg_temp.uid(16);
update public.profiles set founding_member_number=27 where id=pg_temp.uid(19);
-- A legacy internal founder can release their number, but cannot receive another.
update auth.users set email='legacy@triggerfeed.com' where id=pg_temp.uid(19);
create temporary table original_claims as select * from public.founding_member_numbers;
create temporary table original_badges as select * from public.user_badges where user_id in(pg_temp.uid(5),pg_temp.uid(6),pg_temp.uid(16));

-- Admin member -> creator and CEO creator -> member preserve number, claim, and badge.
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(5),'creator',p_category=>'Sport');
select pg_temp.assert_true((select account_type='user' and profile_type='creator' and founding_member_number=24 from public.search_admin_users('transition_5')),'admin editor receives authoritative type and number');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.uid(2)::text,true);
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(6),'member');
reset role;
select pg_temp.assert_true((select profile_type='creator' and founding_member_number=24 from public.profiles where id=pg_temp.uid(5)),'member to creator keeps number');
select pg_temp.assert_true((select profile_type='member' and founding_member_number=25 from public.profiles where id=pg_temp.uid(6)),'creator to member keeps number');
select pg_temp.assert_true(not exists(select * from original_claims except select * from public.founding_member_numbers),'retained claims unchanged');
select pg_temp.assert_true(not exists(select * from original_badges except select * from public.user_badges),'retained Founding badges unchanged');

-- Metadata failure after the profile update must roll back release AND verification invalidation.
set local role authenticated;
select public.set_profile_verification(pg_temp.uid(16),true);
select public.update_profile_type_and_metadata(pg_temp.uid(16),'creator',p_category=>'Original');
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(16),'organization',p_category=>repeat('x',81))$q$,'profile_metadata_category_length_check');
reset role;
select pg_temp.assert_true((select profile_type='creator' and founding_member_number=26 from public.profiles where id=pg_temp.uid(16)),'failed conversion rolls back profile');
select pg_temp.assert_true((select profile_id=pg_temp.uid(16) and released_at is null from public.founding_member_numbers where number=26),'failed conversion rolls back claim release');
select pg_temp.assert_true((select category='Original' from public.profile_metadata where user_id=pg_temp.uid(16)),'failed conversion keeps metadata');
select pg_temp.assert_true((select count(*)=2 from public.get_public_profile_badges(array[pg_temp.uid(16)]) where badge_slug in('founding-500','verified-creator')),'failed conversion rolls back badge changes');

-- Member -> organization releases #24 and removes its public registry entry and badge.
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(5),'member');
select public.update_profile_type_and_metadata(pg_temp.uid(5),'organization',p_category=>'Business');
reset role;
select pg_temp.assert_true((select profile_type='organization' and founding_member_number is null and role='user' and account_type='user' from public.profiles where id=pg_temp.uid(5)),'member organization conversion clears only founding/type state');
select pg_temp.assert_true((select profile_id is null and released_at is not null from public.founding_member_numbers where number=24),'claim explicitly released');
select pg_temp.assert_true(not exists(select 1 from public.founding_member_numbers where profile_id=pg_temp.uid(5)),'no stale claim ownership');
select pg_temp.assert_true(not exists(select 1 from public.user_badges ub join public.badges b on ub.badge_id=b.id where ub.user_id=pg_temp.uid(5) and b.slug='founding-500'),'Founding badge deleted');
set local role anon;
select pg_temp.assert_true(not exists(select 1 from public.get_founding_500_registry() where founding_member_number=24),'released claim not displayed as active or retired');
reset role;
update public.founding_500_settings set is_auto_assignment_enabled=true where singleton;
insert into auth.users(id,email,raw_user_meta_data) values(pg_temp.uid(20),'new-transition@example.test','{"username":"transition_20","dob":"1980-01-01"}');
select pg_temp.assert_true((select founding_member_number=24 from public.profiles where id=pg_temp.uid(20)),'normal public signup reuses released number');
select pg_temp.assert_true((select profile_id=pg_temp.uid(20) and released_at is null from public.founding_member_numbers where number=24),'reuse claims the same registry slot');
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(5),'member');
reset role;
select pg_temp.assert_true((select profile_type='member' and founding_member_number=28 from public.profiles where id=pg_temp.uid(5)),'returning organization uses normal next number rather than restoring #24');

-- Creator -> organization also releases; another organization -> creator takes normal reusable slot.
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(6),'creator');
select public.update_profile_type_and_metadata(pg_temp.uid(6),'organization');
reset role;
select pg_temp.assert_true((select profile_type='organization' and founding_member_number is null from public.profiles where id=pg_temp.uid(6)),'creator conversion clears number');
select pg_temp.assert_true((select profile_id is null and released_at is not null from public.founding_member_numbers where number=25),'creator claim released');
select pg_temp.assert_true(not exists(select 1 from public.user_badges ub join public.badges b on ub.badge_id=b.id where ub.user_id=pg_temp.uid(6) and b.slug='founding-500'),'creator Founding badge removed');
set local role authenticated;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(8),'creator',p_category=>repeat('x',81))$q$,'profile_metadata_category_length_check');
reset role;
select pg_temp.assert_true((select profile_type='organization' and founding_member_number is null from public.profiles where id=pg_temp.uid(8)),'failed eligible conversion rolls back type and number');
select pg_temp.assert_true((select released_at is not null and profile_id is null from public.founding_member_numbers where number=25),'failed eligible conversion does not consume released number');
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(8),'creator');
select public.update_profile_type_and_metadata(pg_temp.uid(7),'member');
select public.update_profile_type_and_metadata(pg_temp.uid(6),'creator');
reset role;
select pg_temp.assert_true((select profile_type='creator' and founding_member_number=25 from public.profiles where id=pg_temp.uid(8)),'organization to creator uses normal released slot');
select pg_temp.assert_true((select profile_type='member' and founding_member_number=29 from public.profiles where id=pg_temp.uid(7)),'organization to member gets normal next number');
select pg_temp.assert_true((select profile_type='creator' and founding_member_number=30 from public.profiles where id=pg_temp.uid(6)),'returning creator never specially restores old number');

-- Both internal email domains stay excluded across both eligible transitions.
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(9),'member');
select public.update_profile_type_and_metadata(pg_temp.uid(10),'creator');
select public.update_profile_type_and_metadata(pg_temp.uid(9),'organization');
select public.update_profile_type_and_metadata(pg_temp.uid(10),'organization');
select public.update_profile_type_and_metadata(pg_temp.uid(9),'creator');
select public.update_profile_type_and_metadata(pg_temp.uid(10),'member');
select public.update_profile_type_and_metadata(pg_temp.uid(19),'organization');
select public.update_profile_type_and_metadata(pg_temp.uid(19),'member');
reset role;
select pg_temp.assert_true(not exists(select 1 from public.profiles where id in(pg_temp.uid(9),pg_temp.uid(10),pg_temp.uid(19)) and founding_member_number is not null),'internal domains cannot regain numbers');
select pg_temp.assert_true(not exists(select 1 from public.founding_member_numbers where profile_id in(pg_temp.uid(9),pg_temp.uid(10),pg_temp.uid(19))),'internal accounts consume no claims');

-- The rollout switch still controls new assignments on organization conversion.
update public.founding_500_settings set is_auto_assignment_enabled=false where singleton;
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(15),'member');
reset role;
select pg_temp.assert_true((select profile_type='member' and founding_member_number is null from public.profiles where id=pg_temp.uid(15)),'disabled auto assignment respected');

-- System/editorial/bot and system public types cannot pass the conversion RPC.
set local role authenticated;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(11),'creator')$q$,'System, editorial, and bot profiles');
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(12),'organization')$q$,'System, editorial, and bot profiles');
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(13),'member')$q$,'System, editorial, and bot profiles');
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(14),'member')$q$,'System, editorial, and bot profiles');
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(3),'system')$q$,'Invalid profile type');
reset role;

-- Ordinary users and moderators cannot change their own or another user's type.
select set_config('request.jwt.claim.sub',pg_temp.uid(3)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(3),'creator')$q$,'Only administrators');
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(5),'organization')$q$,'Only administrators');
select pg_temp.expect_error($q$update public.profiles set profile_type='organization' where id=pg_temp.uid(3)$q$,'permission denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.uid(4)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(4),'organization')$q$,'Only administrators');
select pg_temp.expect_error($q$select * from public.search_admin_users()$q$,'Admin permission required');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(3),'creator')$q$,'permission denied');
reset role;

-- Banned/deleted administrators and deleted target profiles remain protected.
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
update public.profiles set is_banned=true where id=pg_temp.uid(1);
set local role authenticated;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(3),'creator')$q$,'Only administrators');
reset role;
update public.profiles set is_banned=false,is_deleted=true where id=pg_temp.uid(1);
set local role authenticated;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(3),'creator')$q$,'Only administrators');
reset role;
update public.profiles set is_deleted=false where id=pg_temp.uid(1);
update public.profiles set is_deleted=true where id=pg_temp.uid(3);
set local role authenticated;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(3),'creator')$q$,'Profile does not exist or is deleted');
reset role;
update public.profiles set is_deleted=false where id=pg_temp.uid(3);
select pg_temp.expect_error($q$select public.claim_founding_member_number(pg_temp.uid(19),27)$q$,'Internal company email accounts');

-- Arbitrary number changes remain forbidden, even for admin callers.
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select pg_temp.expect_error($q$update public.profiles set founding_member_number=null where id=pg_temp.uid(16)$q$,'cannot be changed once assigned');
select pg_temp.expect_error($q$update public.profiles set founding_member_number=31 where id=pg_temp.uid(16)$q$,'cannot be changed once assigned');
-- Explicit manual claim may reuse a release, but clients cannot call the internal helper.
select pg_temp.assert_true(public.claim_founding_member_number(pg_temp.uid(17),27)=27,'manual claim reuses explicitly released number');
update public.profiles set founding_member_number=27 where id=pg_temp.uid(17);
set local role authenticated;
select pg_temp.expect_error($q$select public.claim_founding_member_number(pg_temp.uid(3))$q$,'permission denied');
reset role;
-- A mismatched registry fails closed and leaves metadata/profile state intact.
update public.founding_member_numbers set profile_id=pg_temp.uid(3) where number=26;
set local role authenticated;
select pg_temp.expect_error($q$select public.update_profile_type_and_metadata(pg_temp.uid(16),'organization')$q$,'registry does not match');
reset role;
select pg_temp.assert_true((select profile_type='creator' and founding_member_number=26 from public.profiles where id=pg_temp.uid(16)),'mismatch cannot partially convert');
update public.founding_member_numbers set profile_id=pg_temp.uid(16) where number=26;

-- Exhaustion does not block conversion or exceed 500; retired numbers stay claimed.
insert into public.founding_member_numbers(number,profile_id)
select n,'e1000000-0000-0000-0000-999999999999'::uuid from generate_series(1,500) n
where not exists(select 1 from public.founding_member_numbers f where f.number=n);
update public.founding_500_settings set is_auto_assignment_enabled=true where singleton;
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(18),'creator');
reset role;
select pg_temp.assert_true((select profile_type='creator' and founding_member_number is null from public.profiles where id=pg_temp.uid(18)),'full registry still allows eligible type without number');
select pg_temp.assert_true((select count(*)=500 and max(number)=500 from public.founding_member_numbers),'500 cap and retired claims preserved');
-- Release remains reusable even once the high-water mark has reached 500.
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(16),'organization');
select public.update_profile_type_and_metadata(pg_temp.uid(18),'organization');
select public.update_profile_type_and_metadata(pg_temp.uid(18),'member');
reset role;
select pg_temp.assert_true((select founding_member_number=26 from public.profiles where id=pg_temp.uid(18)),'released number reused after cap');
select pg_temp.assert_true((select count(*)=500 from public.founding_member_numbers),'reuse does not grow ledger');
rollback;
