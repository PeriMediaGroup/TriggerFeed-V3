-- Exclude internal email domains from NEW Founding 500 claims.
-- No UPDATE/DELETE of profiles, badges, or the existing registry is performed.
begin;

create or replace function public.is_founding_500_internal_email(p_email text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(lower(btrim(p_email)) ~ '@(triggerfeed\.com|perimediagroup\.com)$', false);
$$;
revoke all on function public.is_founding_500_internal_email(text) from public, anon, authenticated;

create or replace function public.is_founding_500_internal_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u where u.id = p_profile_id
    and public.is_founding_500_internal_email(u.email))
    or exists (select 1 from public.profiles p where p.id = p_profile_id
    and public.is_founding_500_internal_email(p.email));
$$;
revoke all on function public.is_founding_500_internal_profile(uuid) from public, anon, authenticated;

create or replace function public.claim_founding_member_number(
  p_profile_id uuid,
  p_requested_number integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
begin
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
    ) then
      return p_requested_number;
    end if;

    insert into public.founding_member_numbers (number, profile_id)
    values (p_requested_number, p_profile_id);

    return p_requested_number;
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

revoke all on function public.claim_founding_member_number(uuid, integer) from public;

create or replace function public.set_profile_founding_member_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

revoke all on function public.set_profile_founding_member_number() from public;

-- Also protect privileged manual registry inserts from consuming a number.
create or replace function public.guard_founding_500_internal_claim()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_founding_500_internal_profile(new.profile_id) then
    raise exception 'Internal company email accounts cannot receive Founding Member numbers';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_founding_500_internal_claim() from public, anon, authenticated;
create trigger guard_founding_500_internal_claim
before insert or update of profile_id, number on public.founding_member_numbers
for each row execute function public.guard_founding_500_internal_claim();

commit;
