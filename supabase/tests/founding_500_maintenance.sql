-- Local isolated database only. All fixtures and failure injection roll back.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end;
$$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'FAIL: unexpectedly allowed: %',statement;
end;
$$;
create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
select ('f5000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
$$;
select pg_temp.assert_true((select count(*)=0 from public.founding_member_numbers),'isolated empty registry required');
update public.founding_500_settings set is_auto_assignment_enabled=false where singleton;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
select pg_temp.uid(n),'maintenance-'||n||'@example.test',
  jsonb_build_object('username','maintenance_'||n,'dob','1980-01-01','profile_type',case when n=5 then 'creator' else 'member' end),
  '{"provider":"email","providers":["email"]}'::jsonb from generate_series(1,10) n;
update public.profiles set role='ceo' where id=pg_temp.uid(1);
update public.profiles set role='admin' where id=pg_temp.uid(2);
update public.profiles set role='moderator' where id=pg_temp.uid(3);
update public.profiles set founding_member_number=right(id::text,1)::integer-3 where id in (pg_temp.uid(4),pg_temp.uid(5),pg_temp.uid(6),pg_temp.uid(7));
insert into public.posts(id,user_id,body) values(pg_temp.uid(100),pg_temp.uid(5),'Keep this post');
insert into public.comments(id,post_id,user_id,body) values(pg_temp.uid(101),pg_temp.uid(100),pg_temp.uid(5),'Keep this comment');
create temp table original_profiles as select id,profile_type,account_type,role,username,is_deleted from public.profiles;
create temp table original_ledger as select * from public.founding_member_numbers;
create temp table original_badges as select * from public.user_badges;

-- Actual API roles: no anonymous execution, no helper/context bypass, no regular/moderator access.
set local role anon;
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(5),2)$q$,'permission denied');
select pg_temp.expect_error($q$select public.repair_founding_500('REPAIR FOUNDING 500')$q$,'permission denied');
select pg_temp.expect_error($q$select public.finalize_founding_500('FINALIZE FOUNDING 500')$q$,'permission denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.uid(8)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(5),2)$q$,'Admin permission');
select pg_temp.expect_error($q$select public.get_admin_founding_500()$q$,'Admin permission');
select pg_temp.expect_error($q$select public.set_founding_500_number_internal(pg_temp.uid(5),null)$q$,'permission denied');
select pg_temp.expect_error($q$insert into public.founding_500_transitions values(txid_current(),pg_temp.uid(5),null)$q$,'permission denied');
-- Custom GUCs confer no authority.
select set_config('triggerfeed.founding_500_maintenance','true',true);
reset role;
select set_config('request.jwt.claim.sub',pg_temp.uid(3)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(5),2)$q$,'Admin permission');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.uid(2)::text,true);
savepoint banned_admin;
update public.profiles set is_banned=true where id=pg_temp.uid(2);
set local role authenticated;
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(5),2)$q$,'Admin permission');
reset role;
rollback to banned_admin;
savepoint deleted_admin;
update public.profiles set is_deleted=true where id=pg_temp.uid(2);
set local role authenticated;
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(5),2)$q$,'Admin permission');
reset role;
rollback to deleted_admin;
set local role authenticated;
select pg_temp.expect_error($q$select public.repair_founding_500('REPAIR FOUNDING 500')$q$,'CEO permission');
select pg_temp.expect_error($q$select public.finalize_founding_500('FINALIZE FOUNDING 500')$q$,'CEO permission');
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(8),2)$q$,'not a Founding');
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(5),3)$q$,'number changed');
reset role;
select pg_temp.expect_error($q$update public.profiles set founding_member_number=1 where id=pg_temp.uid(8)$q$,'duplicate key');
select pg_temp.expect_error($q$update public.profiles set founding_member_number=null where id=pg_temp.uid(5)$q$,'cannot be changed');

-- First, last, and middle removal independently; earlier claims and types/content survive.
savepoint first_removal;
set local role authenticated;
select public.remove_founding_500_member(pg_temp.uid(4),1,'First');
reset role;
select pg_temp.assert_true((select array_agg(profile_id order by number)=array[pg_temp.uid(5),pg_temp.uid(6),pg_temp.uid(7)] from public.founding_member_numbers),'first removal shifts all later members');
select pg_temp.assert_true((select min(number)=1 and max(number)=3 and count(*)=3 from public.founding_member_numbers),'first removal contiguous');
rollback to first_removal;
savepoint last_removal;
set local role authenticated;
select public.remove_founding_500_member(pg_temp.uid(7),4);
reset role;
select pg_temp.assert_true(not exists(select * from public.founding_member_numbers except select * from original_ledger),'last removal leaves all preceding rows unchanged');
rollback to last_removal;

-- Failure at the final audit write rolls back all earlier mutations, including badges.
create function pg_temp.fail_audit() returns trigger language plpgsql as $$begin raise exception 'injected audit failure'; end;$$;
create trigger maintenance_test_fail before insert on public.moderation_actions for each row execute function pg_temp.fail_audit();
set local role authenticated;
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(5),2)$q$,'injected audit failure');
reset role;
select pg_temp.assert_true(not exists(select * from original_ledger except select * from public.founding_member_numbers),'failed operation restores ledger');
select pg_temp.assert_true(not exists(select * from original_badges except select * from public.user_badges),'failed operation restores badges');
select pg_temp.assert_true((select founding_member_number=2 from public.profiles where id=pg_temp.uid(5)),'failed operation restores number');
select pg_temp.assert_true((select count(*)=0 from public.founding_500_transitions),'failed operation leaves no capability');
drop trigger maintenance_test_fail on public.moderation_actions;

set local role authenticated;
select public.remove_founding_500_member(pg_temp.uid(5),2,'Abandoned account');
reset role;
select pg_temp.assert_true((select founding_member_number is null and profile_type='creator' from public.profiles where id=pg_temp.uid(5)),'creator survives without Founding status');
select pg_temp.assert_true(not exists(select * from original_profiles except select id,profile_type,account_type,role,username,is_deleted from public.profiles),'profile/account types and identity unchanged');
select pg_temp.assert_true(exists(select 1 from auth.users where id=pg_temp.uid(5)) and exists(select 1 from public.posts where id=pg_temp.uid(100)) and exists(select 1 from public.comments where id=pg_temp.uid(101)),'account/posts/comments remain intact');
select pg_temp.assert_true(not exists(select 1 from public.user_badges ub join public.badges b on ub.badge_id=b.id where ub.user_id=pg_temp.uid(5) and b.slug='founding-500'),'removed badge revoked');
select pg_temp.assert_true((select founding_member_number=2 from public.profiles where id=pg_temp.uid(6)) and (select founding_member_number=3 from public.profiles where id=pg_temp.uid(7)),'multiple later members shift by exactly one');
select pg_temp.assert_true((select to_jsonb(f)=to_jsonb(o) from public.founding_member_numbers f join original_ledger o using(number) where f.number=1),'earlier ledger row unchanged');
select pg_temp.assert_true(exists(select 1 from public.moderation_actions where actor_user_id=pg_temp.uid(2) and target_user_id=pg_temp.uid(5) and action_type='founding_removed' and reason='Abandoned account' and metadata->>'previous_number'='2' and jsonb_array_length(metadata->'mappings')=2 and created_at is not null),'removal audit details');
set local role anon;
select pg_temp.assert_true((select array_agg(founding_member_number)=array[1,2,3] from public.get_founding_500_registry()),'public ordering');
reset role;

-- Open conversion releases a slot. Normal removal rejects unrelated gaps.
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(6),'organization');
select pg_temp.expect_error($q$select public.remove_founding_500_member(pg_temp.uid(7),3)$q$,'CEO repair required');
reset role;
-- Retired and soft-deleted slots coexist with a released slot.
delete from auth.users where id=pg_temp.uid(4);
update public.profiles set founding_member_number=5 where id=pg_temp.uid(8);
update public.profiles set founding_member_number=7 where id=pg_temp.uid(9);
update public.profiles set is_deleted=true where id=pg_temp.uid(9);
-- Assignment dates deliberately conflict with number order.
update public.founding_member_numbers set assigned_at=now()-interval '10 years' where number=5;
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.repair_founding_500('wrong')$q$,'confirmation required');
reset role;
create temp table repair_before as select * from public.founding_member_numbers;
create trigger maintenance_test_fail before insert on public.moderation_actions for each row execute function pg_temp.fail_audit();
set local role authenticated;
select pg_temp.expect_error($q$select public.repair_founding_500('REPAIR FOUNDING 500')$q$,'injected audit failure');
reset role;
select pg_temp.assert_true(not exists(select * from repair_before except select * from public.founding_member_numbers),'repair failure rolls back ledger');
drop trigger maintenance_test_fail on public.moderation_actions;
set local role authenticated;
select public.repair_founding_500('REPAIR FOUNDING 500','Reclaim provisional slots');
reset role;
select pg_temp.assert_true((select array_agg(profile_id order by number)=array[pg_temp.uid(7),pg_temp.uid(8)] from public.founding_member_numbers),'repair preserves numeric order, not date order');
select pg_temp.assert_true((select count(*)=2 and min(number)=1 and max(number)=2 from public.founding_member_numbers),'repair compacts retired released and absent gaps');
select pg_temp.assert_true((select founding_member_number is null from public.profiles where id=pg_temp.uid(9)),'soft deleted number cleared');
select pg_temp.assert_true((select assigned_at=(select assigned_at from repair_before where number=5) from public.founding_member_numbers where number=2),'assignment timestamp retained');
select pg_temp.assert_true(exists(select 1 from public.moderation_actions where action_type='founding_repaired' and actor_user_id=pg_temp.uid(1) and jsonb_array_length(metadata->'previous_ledger')=5 and jsonb_array_length(metadata->'mappings')=2),'full historical ledger and mappings audited');
select pg_temp.assert_true((select profile_type='organization' and founding_member_number is null from public.profiles where id=pg_temp.uid(6)),'repair does not enroll organization');

-- Finalization is explicit, not count-derived; CEO-only and no reopening/reuse.
set local role authenticated;
select pg_temp.expect_error($q$select public.finalize_founding_500('wrong')$q$,'confirmation required');
select public.finalize_founding_500('FINALIZE FOUNDING 500','Close program');
reset role;
savepoint finalized_deletion;
delete from auth.users where id=pg_temp.uid(7);
select pg_temp.assert_true((select founding_member_number=2 from public.profiles where id=pg_temp.uid(8)),'finalized deletion never renumbers');
select pg_temp.assert_true(exists(select 1 from public.founding_member_numbers where number=1),'finalized deletion keeps ledger reservation');
select pg_temp.expect_error($q$select public.claim_founding_member_number(pg_temp.uid(10),1)$q$,'finalized');
rollback to finalized_deletion;
set local role authenticated;
select pg_temp.expect_error($q$select public.repair_founding_500('REPAIR FOUNDING 500')$q$,'finalized');
select pg_temp.expect_error($q$select public.set_founding_500_auto_assignment_enabled(true)$q$,'cannot be reopened');
select public.remove_founding_500_member(pg_temp.uid(7),1);
reset role;
select pg_temp.assert_true((select founding_member_number=2 from public.profiles where id=pg_temp.uid(8)),'finalized removal never renumbers');
select pg_temp.assert_true((select profile_id is null and released_at is null from public.founding_member_numbers where number=1),'finalized removed slot reserved');
select pg_temp.expect_error($q$select public.claim_founding_member_number(pg_temp.uid(10),1)$q$,'finalized');
select pg_temp.expect_error($q$update public.founding_500_settings set finalized_at=null$q$,'cannot be reopened');
set local role authenticated;
select public.update_profile_type_and_metadata(pg_temp.uid(8),'organization');
reset role;
select pg_temp.assert_true((select profile_id is null and released_at is null from public.founding_member_numbers where number=2),'finalized conversion retires number');
insert into auth.users(id,email,raw_user_meta_data) values(pg_temp.uid(11),'closed@example.test','{"username":"maintenance_closed","dob":"1980-01-01"}');
select pg_temp.assert_true((select founding_member_number is null from public.profiles where id=pg_temp.uid(11)),'finalized signup never claims');
select pg_temp.assert_true(exists(select 1 from public.moderation_actions where action_type='founding_finalized' and metadata ? 'ledger'),'finalization audited');
set local role anon;
select pg_temp.assert_true((select count(*)=2 from public.get_founding_500_registry() where status='retired'),'public finalized retired numbers remain');
select pg_temp.assert_true(public.get_founding_500_state()->>'finalized_at' is not null,'public explicit state');
reset role;
rollback;
