-- Provisional numbers during open enrollment; permanent identifiers after finalization.
-- No existing claims are changed by this migration. Repair is an explicit CEO action.
begin;

alter table public.founding_500_settings add column finalized_at timestamptz;

-- A capability owned by the database, NOT a caller-settable session setting.
-- Exact expected transitions authorize the existing profile trigger during maintenance.
create table public.founding_500_transitions (
  transaction_id bigint not null,
  profile_id uuid not null,
  new_number integer,
  primary key (transaction_id, profile_id)
);
alter table public.founding_500_transitions enable row level security;
revoke all on public.founding_500_transitions from public, anon, authenticated;

create function public.lock_founding_500_writes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('triggerfeed_founding_500'));
  return null;
end;
$$;
revoke all on function public.lock_founding_500_writes() from public, anon, authenticated;
-- Acquire before tuple locks, including signup, deletion and soft deletion.
create trigger founding_500_insert_delete_lock before insert or delete on public.profiles
for each statement execute function public.lock_founding_500_writes();
create trigger founding_500_update_lock before update of founding_member_number, profile_type, account_type, is_deleted on public.profiles
for each statement execute function public.lock_founding_500_writes();
create trigger founding_500_settings_lock before update on public.founding_500_settings
for each statement execute function public.lock_founding_500_writes();

create function public.get_founding_500_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('finalized_at', s.finalized_at,
    'is_auto_assignment_enabled', s.is_auto_assignment_enabled)
  from public.founding_500_settings s where s.singleton;
$$;
revoke all on function public.get_founding_500_state() from public, anon, authenticated;
grant execute on function public.get_founding_500_state() to anon, authenticated;

create function public.set_founding_500_number_internal(p_id uuid, p_number integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin_or_above() then
    raise exception 'Admin permission required' using errcode='42501';
  end if;
  if p_number is not null and exists(select 1 from public.founding_500_settings where finalized_at is not null) then
    raise exception 'Founding 500 is finalized';
  end if;
  insert into public.founding_500_transitions values (txid_current(), p_id, p_number);
  update public.profiles set founding_member_number=p_number where id=p_id;
  delete from public.founding_500_transitions where transaction_id=txid_current() and profile_id=p_id;
end;
$$;
revoke all on function public.set_founding_500_number_internal(uuid,integer) from public, anon, authenticated;

-- Reject ambiguous live ownership; repair is deliberately not a membership backfill.
create function public.check_founding_500_registry(p_contiguous boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.profiles p where p.founding_member_number is not null
    and not coalesce(p.is_deleted,false) and (
      p.account_type <> 'user' or p.profile_type not in ('member','creator')
      or not exists(select 1 from public.founding_member_numbers f
        where f.number=p.founding_member_number and f.profile_id=p.id and f.released_at is null)
      or (select count(*) from public.founding_member_numbers f where f.profile_id=p.id) <> 1
    )
  ) or exists (
    select 1 from public.founding_member_numbers f join public.profiles p on p.id=f.profile_id
    where not coalesce(p.is_deleted,false) and
      (p.founding_member_number is distinct from f.number or f.released_at is not null)
  ) then
    raise exception 'Ambiguous Founding registry ownership; manual review required';
  end if;
  if p_contiguous and (
    exists(select 1 from public.founding_member_numbers f left join public.profiles p
      on p.id=f.profile_id and p.founding_member_number=f.number and not coalesce(p.is_deleted,false)
      where p.id is null or f.released_at is not null)
    or (select coalesce(max(number),0) <> count(*) from public.founding_member_numbers)
  ) then
    raise exception 'Founding registry has gaps or retired slots; CEO repair required first';
  end if;
end;
$$;
revoke all on function public.check_founding_500_registry(boolean) from public, anon, authenticated;

alter table public.moderation_actions drop constraint moderation_actions_action_type_check;
alter table public.moderation_actions add constraint moderation_actions_action_type_check check (action_type in (
  'warn','mute','unmute','ban','unban','remove_post','restore_post','dismiss_report','review_report',
  'escalate_report','recommend_ban','admin_note','promote_user','demote_user','role_changed',
  'founding_removed','founding_repaired','founding_finalized'));
alter table public.moderation_actions drop constraint moderation_actions_target_or_related_required_check;
alter table public.moderation_actions add constraint moderation_actions_target_or_related_required_check check (
  target_user_id is not null or related_post_id is not null or related_report_id is not null
  or action_type in ('founding_repaired','founding_finalized'));

create function public.remove_founding_500_member(p_user_id uuid, p_expected_number integer, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_number integer; v_finalized boolean; v_row record;
  v_mappings jsonb := '[]'::jsonb; v_before jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_above() then
    raise exception 'Admin permission required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));
  select finalized_at is not null into v_finalized from public.founding_500_settings where singleton;
  select founding_member_number into v_number from public.profiles where id=p_user_id for update;
  if v_number is null then raise exception 'User is not a Founding member'; end if;
  if p_expected_number is distinct from v_number then raise exception 'Founding number changed; refresh and confirm again'; end if;
  perform public.check_founding_500_registry(not v_finalized);
  select to_jsonb(f) into v_before from public.founding_member_numbers f
    where number=v_number and profile_id=p_user_id and released_at is null;
  if v_before is null then raise exception 'Founding registry mismatch; CEO review required'; end if;
  perform public.set_founding_500_number_internal(p_user_id,null);
  if v_finalized then
    update public.founding_member_numbers set profile_id=null, released_at=null where number=v_number;
  else
    delete from public.founding_member_numbers where number=v_number;
    -- Each destination has already been vacated. Both unique indexes remain enabled.
    for v_row in select * from public.founding_member_numbers where number>v_number order by number loop
      update public.founding_member_numbers set number=v_row.number-1 where number=v_row.number;
      perform public.set_founding_500_number_internal(v_row.profile_id,v_row.number-1);
      v_mappings := v_mappings || jsonb_build_array(jsonb_build_object(
        'profile_id',v_row.profile_id,'old_number',v_row.number,'new_number',v_row.number-1));
    end loop;
    perform public.check_founding_500_registry(true);
  end if;
  insert into public.moderation_actions(actor_user_id,target_user_id,action_type,reason,metadata)
    values(auth.uid(),p_user_id,'founding_removed',nullif(btrim(p_reason),''),
      jsonb_build_object('previous_number',v_number,'previous_claim',v_before,'finalized',v_finalized,'mappings',v_mappings));
  return jsonb_build_object('removed_number',v_number,'finalized',v_finalized,'mappings',v_mappings);
end;
$$;
revoke all on function public.remove_founding_500_member(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.remove_founding_500_member(uuid,integer,text) to authenticated;

create function public.repair_founding_500(p_confirmation text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb; v_members jsonb; v_row record; v_number integer := 0;
  v_mappings jsonb := '[]'::jsonb; v_cleared jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_ceo() then raise exception 'CEO permission required' using errcode='42501'; end if;
  if p_confirmation is distinct from 'REPAIR FOUNDING 500' then raise exception 'Explicit repair confirmation required'; end if;
  perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));
  if exists(select 1 from public.founding_500_settings where finalized_at is not null) then
    raise exception 'Founding 500 is finalized; renumbering is prohibited';
  end if;
  perform public.check_founding_500_registry(false);
  select coalesce(jsonb_agg(to_jsonb(f) order by number),'[]') into v_before from public.founding_member_numbers f;
  select coalesce(jsonb_agg(to_jsonb(f) order by number),'[]') into v_members
    from public.founding_member_numbers f join public.profiles p on p.id=f.profile_id
    where p.founding_member_number=f.number and not coalesce(p.is_deleted,false) and f.released_at is null;
  -- Deleted profiles can still hold a denormalized number. Clear only their Founding state.
  for v_row in select id, founding_member_number from public.profiles
    where coalesce(is_deleted,false) and founding_member_number is not null order by founding_member_number loop
    v_cleared := v_cleared || jsonb_build_array(jsonb_build_object('profile_id',v_row.id,'old_number',v_row.founding_member_number,'new_number',null));
    perform public.set_founding_500_number_internal(v_row.id,null);
  end loop;
  -- Retired/released rows are archived in this transaction's audit, then reclaimed.
  -- Explicit bounded predicate also satisfies PostgREST safeupdate protection.
  delete from public.founding_member_numbers where number between 1 and 500;
  for v_row in select * from jsonb_to_recordset(v_members) as m(number integer,profile_id uuid,assigned_at timestamptz) order by number loop
    v_number := v_number+1;
    insert into public.founding_member_numbers(number,profile_id,assigned_at) values(v_number,v_row.profile_id,v_row.assigned_at);
    if v_row.number <> v_number then
      perform public.set_founding_500_number_internal(v_row.profile_id,v_number);
      v_mappings := v_mappings || jsonb_build_array(jsonb_build_object('profile_id',v_row.profile_id,'old_number',v_row.number,'new_number',v_number));
    end if;
  end loop;
  perform public.check_founding_500_registry(true);
  insert into public.moderation_actions(actor_user_id,action_type,reason,metadata)
    values(auth.uid(),'founding_repaired',nullif(btrim(p_reason),''),jsonb_build_object(
      'previous_ledger',v_before,'mappings',v_mappings,'cleared_deleted_profiles',v_cleared,'assigned',v_number));
  return jsonb_build_object('mappings',v_mappings,'cleared_deleted_profiles',v_cleared,
    'reclaimed_slots',jsonb_array_length(v_before)-v_number,'assigned',v_number);
end;
$$;
revoke all on function public.repair_founding_500(text,text) from public, anon, authenticated;
grant execute on function public.repair_founding_500(text,text) to authenticated;

create function public.finalize_founding_500(p_confirmation text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  if auth.uid() is null or not public.is_ceo() then raise exception 'CEO permission required' using errcode='42501'; end if;
  if p_confirmation is distinct from 'FINALIZE FOUNDING 500' then raise exception 'Explicit finalization confirmation required'; end if;
  perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));
  if exists(select 1 from public.founding_500_settings where finalized_at is not null) then raise exception 'Founding 500 is already finalized'; end if;
  perform public.check_founding_500_registry(true);
  select coalesce(jsonb_agg(to_jsonb(f) order by number),'[]') into v_before from public.founding_member_numbers f;
  update public.founding_500_settings set finalized_at=now(),is_auto_assignment_enabled=false where singleton;
  insert into public.moderation_actions(actor_user_id,action_type,reason,metadata)
    values(auth.uid(),'founding_finalized',nullif(btrim(p_reason),''),jsonb_build_object('ledger',v_before));
  return public.get_founding_500_state();
end;
$$;
revoke all on function public.finalize_founding_500(text,text) from public, anon, authenticated;
grant execute on function public.finalize_founding_500(text,text) to authenticated;

create function public.get_admin_founding_500() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_entries jsonb; v_assigned integer; v_needs_repair boolean := false;
begin
  if auth.uid() is null or not public.is_admin_or_above() then raise exception 'Admin permission required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('number',f.number,'assigned_at',f.assigned_at,
    'profile_id',p.id,'username',p.username,'display_name',p.display_name,'profile_type',p.profile_type,
    'created_at',p.created_at,'is_deleted',p.is_deleted,'is_banned',p.is_banned,
    'active',p.id is not null and not coalesce(p.is_deleted,false) and p.founding_member_number=f.number and f.released_at is null,
    'released',f.released_at is not null) order by f.number),'[]') into v_entries
    from public.founding_member_numbers f left join public.profiles p on p.id=f.profile_id;
  select count(*) into v_assigned from public.profiles where founding_member_number is not null and not coalesce(is_deleted,false);
  begin perform public.check_founding_500_registry(true); exception when others then v_needs_repair := true; end;
  return public.get_founding_500_state() || jsonb_build_object('entries',v_entries,'assigned',v_assigned,'remaining',500-v_assigned,'needs_repair',v_needs_repair);
end;
$$;
revoke all on function public.get_admin_founding_500() from public, anon, authenticated;
grant execute on function public.get_admin_founding_500() to authenticated;


create or replace function public.claim_founding_member_number(
  p_profile_id uuid,
  p_requested_number integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number integer;
begin
  perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));
  if exists(select 1 from public.founding_500_settings where finalized_at is not null) then
    if p_requested_number is null then return null; end if;
    if exists(select 1 from public.founding_member_numbers where number=p_requested_number and profile_id=p_profile_id and released_at is null) then
      return p_requested_number;
    end if;
    raise exception 'Founding 500 is finalized; new claims are prohibited';
  end if;
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if public.is_founding_500_internal_profile(p_profile_id) then
    raise exception 'Internal company email accounts cannot receive Founding Member numbers';
  end if;

  -- During signup this BEFORE INSERT trigger runs before the profile is visible.
  -- Existing profiles must satisfy the same eligibility rules as the assignment trigger.
  if exists (select 1 from public.profiles p where p.id = p_profile_id
    and (p.account_type <> 'user' or p.profile_type not in ('member', 'creator'))) then
    raise exception 'Only member or creator user accounts can receive Founding Member numbers';
  end if;

  perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));

  if p_requested_number is not null then
    if p_requested_number < 1 or p_requested_number > 500 then
      raise exception 'Founding Member number must be between 1 and 500';
    end if;

    if exists (
      select 1
      from public.founding_member_numbers fmn
      where fmn.number = p_requested_number
        and fmn.profile_id = p_profile_id
        and fmn.released_at is null
    ) then
      return p_requested_number;
    end if;

    update public.founding_member_numbers
    set profile_id = p_profile_id, assigned_at = now(), released_at = null
    where number = p_requested_number and released_at is not null;

    if not found then
      insert into public.founding_member_numbers (number, profile_id)
      values (p_requested_number, p_profile_id);
    end if;

    return p_requested_number;
  end if;

  -- Only explicitly released claims may be reused. Deleted profiles remain retired.
  select min(fmn.number) into v_number
  from public.founding_member_numbers fmn where fmn.released_at is not null;

  if v_number is not null then
    update public.founding_member_numbers
    set profile_id = p_profile_id, assigned_at = now(), released_at = null
    where number = v_number;
    return v_number;
  end if;

  select coalesce(max(fmn.number), 0) + 1
  into v_number
  from public.founding_member_numbers fmn;

  if v_number > 500 then
    return null;
  end if;

  insert into public.founding_member_numbers (number, profile_id)
  values (v_number, p_profile_id);

  return v_number;
end;
$$;

create or replace function public.set_profile_founding_member_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and exists (
    select 1 from public.founding_500_transitions t where t.transaction_id=txid_current()
      and t.profile_id=old.id and t.new_number is not distinct from new.founding_member_number
  ) then
    if auth.uid() is null or not public.is_admin_or_above() then
      raise exception 'Admin permission required' using errcode='42501';
    end if;
    return new;
  end if;
  -- Outside explicit maintenance, only authorized organization conversion clears a number.
  -- The surrounding profile UPDATE and metadata RPC share this transaction.
  if tg_op = 'UPDATE'
    and old.profile_type in ('member', 'creator')
    and new.profile_type = 'organization'
    and old.founding_member_number is not null
    and (new.founding_member_number is null or new.founding_member_number = old.founding_member_number)
    and old.account_type = 'user' and new.account_type = 'user'
  then
    if auth.uid() is null or not public.is_admin_or_above() then
      raise exception 'Only administrators can release Founding Member numbers.' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));
    update public.founding_member_numbers
    set profile_id = null, released_at = case when exists(select 1 from public.founding_500_settings where finalized_at is not null) then null else now() end
    where number = old.founding_member_number and profile_id = old.id and released_at is null;
    if not found or exists (
      select 1 from public.founding_member_numbers where profile_id = old.id
    ) then
      raise exception 'Founding Member registry does not match this profile; review the claim before conversion.';
    end if;
    new.founding_member_number := null;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.founding_member_number is not null
    and new.founding_member_number is distinct from old.founding_member_number
  then
    raise exception 'Founding Member numbers cannot be changed once assigned';
  end if;

  if new.founding_member_number is not null
    and (
      new.account_type <> 'user'
      or new.profile_type not in ('member', 'creator')
    )
  then
    raise exception 'Only member or creator user accounts can receive Founding Member numbers';
  end if;

  if tg_op = 'INSERT'
    and new.founding_member_number is null
    and new.account_type = 'user'
    and new.profile_type in ('member', 'creator')
    and not public.is_founding_500_internal_email(new.email)
    and not public.is_founding_500_internal_profile(new.id)
    and public.is_founding_500_auto_assignment_enabled()
  then
    new.founding_member_number := public.claim_founding_member_number(new.id);
  elsif new.founding_member_number is not null
    and (
      tg_op = 'INSERT'
      or old.founding_member_number is null
    )
  then
    if public.is_founding_500_internal_email(new.email) then
      raise exception 'Internal company email accounts cannot receive Founding Member numbers';
    end if;
    perform public.claim_founding_member_number(
      new.id,
      new.founding_member_number
    );
  end if;

  return new;
end;
$$;

create or replace function public.update_profile_type_and_metadata(
  p_user_id uuid,
  p_profile_type text,
  p_category text default null,
  p_subtype text default null,
  p_website_url text default null,
  p_primary_link_url text default null,
  p_primary_link_label text default null,
  p_social_links jsonb default '[]'::jsonb,
  p_public_contact_email text default null,
  p_public_contact_phone text default null,
  p_public_location text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_type text := lower(trim(coalesce(p_profile_type, '')));
  v_previous_type text;
  v_account_type text;
begin
  if auth.uid() is null or not public.is_admin_or_above() then
    raise exception 'Only administrators can manage profile type metadata.';
  end if;

  if v_profile_type not in ('member', 'creator', 'organization') then
    raise exception 'Invalid profile type.';
  end if;

  if coalesce(jsonb_typeof(p_social_links), 'array') <> 'array' then
    raise exception 'Social links must be a JSON array.';
  end if;

  perform pg_advisory_xact_lock(hashtext('triggerfeed_founding_500'));

  select p.profile_type, p.account_type
  into v_previous_type, v_account_type
  from public.profiles p
  where p.id = p_user_id
    and coalesce(p.is_deleted, false) = false
  for update;

  if not found then
    raise exception 'Profile does not exist or is deleted.';
  end if;

  if v_account_type <> 'user' or v_previous_type = 'system' then
    raise exception 'System, editorial, and bot profiles cannot be converted through this operation.';
  end if;

  update public.profiles
  set profile_type = v_profile_type
  where id = p_user_id;

  -- Claim only after the new eligible type is stored: claim() checks the profile.
  -- No remembered number is restored, and disabled auto-assignment stays disabled.
  if v_previous_type = 'organization' and v_profile_type in ('member', 'creator')
    and public.is_founding_500_auto_assignment_enabled()
    and not public.is_founding_500_internal_profile(p_user_id)
  then
    update public.profiles
    set founding_member_number = public.claim_founding_member_number(p_user_id)
    where id = p_user_id and founding_member_number is null;
  end if;

  if v_profile_type in ('creator', 'organization') then
    insert into public.profile_metadata (
      user_id,
      category,
      subtype,
      website_url,
      primary_link_url,
      primary_link_label,
      social_links,
      public_contact_email,
      public_contact_phone,
      public_location
    )
    values (
      p_user_id,
      nullif(trim(coalesce(p_category, '')), ''),
      nullif(trim(coalesce(p_subtype, '')), ''),
      nullif(trim(coalesce(p_website_url, '')), ''),
      nullif(trim(coalesce(p_primary_link_url, '')), ''),
      nullif(trim(coalesce(p_primary_link_label, '')), ''),
      coalesce(p_social_links, '[]'::jsonb),
      nullif(trim(coalesce(p_public_contact_email, '')), ''),
      nullif(trim(coalesce(p_public_contact_phone, '')), ''),
      nullif(trim(coalesce(p_public_location, '')), '')
    )
    on conflict (user_id) do update
    set
      category = excluded.category,
      subtype = excluded.subtype,
      website_url = excluded.website_url,
      primary_link_url = excluded.primary_link_url,
      primary_link_label = excluded.primary_link_label,
      social_links = excluded.social_links,
      public_contact_email = excluded.public_contact_email,
      public_contact_phone = excluded.public_contact_phone,
      public_location = excluded.public_location;
  else
    delete from public.profile_metadata
    where user_id = p_user_id;
  end if;

  return true;
end;
$$;

create or replace function public.is_founding_500_auto_assignment_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_auto_assignment_enabled and finalized_at is null from public.founding_500_settings where singleton),false);
$$;
revoke all on function public.is_founding_500_auto_assignment_enabled() from public, anon, authenticated;

create or replace function public.set_founding_500_settings_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.finalized_at is not null and (new.finalized_at is distinct from old.finalized_at or new.is_auto_assignment_enabled) then
    raise exception 'Founding 500 is finalized; enrollment cannot be reopened';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

comment on column public.profiles.founding_member_number is
  'Provisional Founding position during open enrollment; permanent historical identifier after explicit finalization.';
comment on table public.founding_member_numbers is
  'Current Founding ledger. Open CEO repair archives and reclaims retired/released slots in moderation_actions. Finalized slots remain reserved.';
comment on column public.founding_500_settings.finalized_at is
  'Explicit irreversible program closure; never inferred from member count. No automatic finalization.';
commit;
