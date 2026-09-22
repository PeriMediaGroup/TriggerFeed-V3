-- Local-only, rollback-only test. Requires at least four unallocated numbers.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/founding_500_internal_domains.sql
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end;
$$;
create function pg_temp.expect_internal_error(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when raise_exception then
    if sqlerrm = 'Internal company email accounts cannot receive Founding Member numbers' then return; end if;
    raise;
  end;
  raise exception 'FAIL: internal claim unexpectedly permitted';
end;
$$;
create temporary table initial_registry as select count(*) as count, coalesce(max(number),0) as last_number from public.founding_member_numbers;
select pg_temp.assert_true((select last_number <= 496 from initial_registry),'test requires four available numbers');
update public.founding_500_settings set is_auto_assignment_enabled=true where singleton;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
select ('d1000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 case n when 1 then 'test_member@triggerfeed.com'
 when 2 then 'test_creator@TRIGGERFEED.COM'
 when 3 then 'test_member@perimediagroup.com'
 when 4 then 'test_creator@PeriMediaGroup.Com'
 when 5 then 'test_member@example.test'
 when 6 then 'test_creator@example.test'
 when 7 then 'test_org@example.test' end,
 jsonb_build_object('username','internal_domain_test_' || n,'dob','1980-01-01',
 'profile_type',case when n in (2,4,6) then 'creator' when n=7 then 'organization' else 'member' end),
 '{"provider":"email","providers":["email"]}'::jsonb
from generate_series(1,7) n;
select pg_temp.assert_true(not exists(select 1 from public.profiles where id in (
 'd1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000002',
 'd1000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000004',
 'd1000000-0000-0000-0000-000000000007') and founding_member_number is not null),'both domains and organization skipped');
select pg_temp.assert_true((select count(*)=(select count+2 from initial_registry) from public.founding_member_numbers),'internal signups consume no registry numbers');
select pg_temp.assert_true((select founding_member_number=(select last_number+1 from initial_registry) from public.profiles where id='d1000000-0000-0000-0000-000000000005'),'public member gets next number');
select pg_temp.assert_true((select founding_member_number=(select last_number+2 from initial_registry) from public.profiles where id='d1000000-0000-0000-0000-000000000006'),'public creator gets next number');
select pg_temp.assert_true(not exists(select 1 from public.profiles where id::text like 'd1000000-%' and role <> 'user'),'roles unchanged');
select pg_temp.assert_true((select count(*)=3 from public.profiles where id::text like 'd1000000-%' and profile_type='creator'),'creator types unchanged');
select pg_temp.assert_true(public.is_founding_500_internal_email(' staff@TRIGGERFEED.com ') and public.is_founding_500_internal_email(' staff@PERIMEDIAGROUP.COM '),'case and whitespace normalization');
select pg_temp.assert_true(not public.is_founding_500_internal_email('staff@nottriggerfeed.com') and not public.is_founding_500_internal_email('staff@triggerfeed.com.example.test') and not public.is_founding_500_internal_email('staff@sub.triggerfeed.com'),'matches only exact listed domains');
do $$
declare target uuid; next_number integer;
begin
 select last_number+3 into next_number from initial_registry;
 for target in select id from public.profiles where id in (
 'd1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000002',
 'd1000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000004') loop
   perform pg_temp.expect_internal_error(format('select public.claim_founding_member_number(%L::uuid)',target));
   perform pg_temp.expect_internal_error(format('select public.claim_founding_member_number(%L::uuid,%s)',target,next_number));
   perform pg_temp.expect_internal_error(format('update public.profiles set founding_member_number=%s where id=%L::uuid',next_number,target));
   perform pg_temp.expect_internal_error(format('insert into public.founding_member_numbers(number,profile_id) values(%s,%L::uuid)',next_number,target));
 end loop;
end;
$$;
select pg_temp.assert_true((select count(*)=(select count+2 from initial_registry) from public.founding_member_numbers),'rejected manual claims consume nothing');

update public.founding_500_settings set is_auto_assignment_enabled=false where singleton;
insert into auth.users(id,email,raw_user_meta_data) values
 ('d1000000-0000-0000-0000-000000000008','manual@example.test','{"username":"domain_manual","dob":"1980-01-01"}'),
 ('d1000000-0000-0000-0000-000000000009','profile_email@example.test','{"username":"domain_profile","dob":"1980-01-01"}'),
 ('d1000000-0000-0000-0000-000000000010','auth_email@triggerfeed.com','{"username":"domain_auth","dob":"1980-01-01"}'),
 ('d1000000-0000-0000-0000-000000000011','system@example.test','{"username":"domain_system","dob":"1980-01-01"}'),
 ('d1000000-0000-0000-0000-000000000012','changed@example.test','{"username":"domain_changed","dob":"1980-01-01"}');
update public.profiles set founding_member_number=(select last_number+3 from initial_registry) where id='d1000000-0000-0000-0000-000000000008';
select pg_temp.assert_true((select founding_member_number=(select last_number+3 from initial_registry) from public.profiles where id='d1000000-0000-0000-0000-000000000008'),'public manual assignment allowed');
update public.profiles set email='profile_email@perimediagroup.com' where id='d1000000-0000-0000-0000-000000000009';
update public.profiles set email='auth_email@example.test' where id='d1000000-0000-0000-0000-000000000010';
select pg_temp.expect_internal_error($q$select public.claim_founding_member_number('d1000000-0000-0000-0000-000000000009')$q$);
select pg_temp.expect_internal_error($q$select public.claim_founding_member_number('d1000000-0000-0000-0000-000000000010')$q$);
-- NEW.email is checked even when the stored profile/auth email is still public.
select pg_temp.expect_internal_error($q$update public.profiles set email='changed@triggerfeed.com', founding_member_number=(select last_number+4 from initial_registry) where id='d1000000-0000-0000-0000-000000000012'$q$);

update public.profiles set account_type='system',profile_type='system' where id='d1000000-0000-0000-0000-000000000011';
do $$
declare target uuid;
begin
 for target in select id from public.profiles where id in ('d1000000-0000-0000-0000-000000000007','d1000000-0000-0000-0000-000000000011') loop
   begin
     perform public.claim_founding_member_number(target);
     raise exception 'FAIL: ineligible type was allowed';
   exception when raise_exception then
     if sqlerrm <> 'Only member or creator user accounts can receive Founding Member numbers' then raise; end if;
   end;
 end loop;
end;
$$;

-- Existing numbers and badges survive a later internal email and unrelated profile updates.
create temporary table held_badges as select * from public.user_badges where user_id='d1000000-0000-0000-0000-000000000005';
update public.profiles set email='existing@triggerfeed.com' where id='d1000000-0000-0000-0000-000000000005';
update public.profiles set profile_type=profile_type where id='d1000000-0000-0000-0000-000000000005';
select pg_temp.assert_true((select founding_member_number=(select last_number+1 from initial_registry) from public.profiles where id='d1000000-0000-0000-0000-000000000005'),'existing assignment retained');
select pg_temp.assert_true(not exists(select * from held_badges except select * from public.user_badges),'existing badges retained');
select pg_temp.expect_internal_error($q$select public.claim_founding_member_number('d1000000-0000-0000-0000-000000000005',(select last_number+1 from initial_registry))$q$);
rollback;
