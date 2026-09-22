-- Creator / Organization V1. Roles, friendships and Founding 500 remain independent.
begin;

-- Keep the existing privacy projections; append only the authoritative type.
drop function public.get_my_profile();
create or replace function public.get_my_profile()
returns table (
  profile_type text,
  id uuid,
  email text,
  username text,
  first_name text,
  last_name text,
  display_name text,
  avatar_cloudinary_url text,
  banner_cloudinary_url text,
  profile_badge text,
  account_type text,
  founding_member_number integer,
  city text,
  state text,
  bio text,
  dob date,
  age_verified_at timestamptz,
  age_gate_version text,
  birthday_messages_enabled boolean,
  privacy_settings jsonb,
  referral_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.profile_type,
    p.id,
    p.email,
    p.username,
    p.first_name,
    p.last_name,
    p.display_name,
    p.avatar_cloudinary_url,
    p.banner_cloudinary_url,
    p.profile_badge,
    p.account_type,
    p.founding_member_number,
    p.city,
    p.state,
    p.bio,
    p.dob,
    p.age_verified_at,
    p.age_gate_version,
    p.birthday_messages_enabled,
    p.privacy_settings,
    p.referral_code,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

drop function public.get_public_profile(uuid);
create or replace function public.get_public_profile(p_profile_id uuid)
returns table (
  profile_type text,
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  birthday_display text,
  email text,
  city text,
  state text,
  bio text,
  avatar_cloudinary_url text,
  banner_cloudinary_url text,
  profile_badge text,
  founding_member_number integer,
  privacy_settings jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.profile_type,
    p.id,
    p.username,
    p.display_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.first_name
      else null
    end as first_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.last_name
      else null
    end as last_name,
    case
      when p.dob is not null
        and case
          when lower(p.privacy_settings #>> '{profile_visibility,show_birthday}') in ('true', 'false')
            then (p.privacy_settings #>> '{profile_visibility,show_birthday}')::boolean
          else false
        end then to_char(p.dob, 'FMMonth FMDD')
      else null
    end as birthday_display,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_email}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_email}')::boolean
        else false
      end then p.email
      else null
    end as email,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
        else false
      end then p.city
      else null
    end as city,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
        else false
      end then p.state
      else null
    end as state,
    p.bio,
    p.avatar_cloudinary_url,
    p.banner_cloudinary_url,
    p.profile_badge,
    p.founding_member_number,
    null::jsonb as privacy_settings,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = p_profile_id
    and coalesce(p.is_deleted, false) = false
  limit 1;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

drop function public.get_public_profile_cards(uuid[]);
create or replace function public.get_public_profile_cards(p_profile_ids uuid[])
returns table (
  profile_type text,
  id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  avatar_cloudinary_url text,
  profile_badge text,
  founding_member_number integer,
  city text,
  state text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.profile_type,
    p.id,
    p.username,
    p.display_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.first_name
      else null
    end as first_name,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_real_name}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_real_name}')::boolean
        else false
      end then p.last_name
      else null
    end as last_name,
    p.avatar_cloudinary_url,
    p.profile_badge,
    p.founding_member_number,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
        else false
      end then p.city
      else null
    end as city,
    case
      when case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          then (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
        else false
      end then p.state
      else null
    end as state
  from public.profiles p
  where p.id = any(p_profile_ids)
    and coalesce(p.is_deleted, false) = false;
$$;

revoke all on function public.get_public_profile_cards(uuid[]) from public;
grant execute on function public.get_public_profile_cards(uuid[]) to anon, authenticated;

-- A narrow public eligibility predicate; no private profile columns are returned.
create function public.is_follow_profile_available(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_profile_visible(p_profile_id) and exists (
    select 1 from public.profiles p where p.id = p_profile_id
    and not p.is_deleted and not p.is_banned and p.profile_type <> 'system'
  );
$$;
revoke all on function public.is_follow_profile_available(uuid) from public;
grant execute on function public.is_follow_profile_available(uuid) to anon, authenticated;

create table public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint profile_follows_no_self check (follower_id <> following_id)
);
create index profile_follows_followers_idx on public.profile_follows(following_id, created_at desc, follower_id);
create index profile_follows_following_idx on public.profile_follows(follower_id, created_at desc, following_id);
alter table public.profile_follows enable row level security;
revoke all on public.profile_follows from public, anon, authenticated;
grant select on public.profile_follows to anon, authenticated;
create policy profile_follows_read_visible on public.profile_follows for select to anon, authenticated
using (public.is_follow_profile_available(follower_id) and public.is_follow_profile_available(following_id));

-- Writes use the authenticated identity, never a caller-supplied follower ID.
create function public.set_profile_follow(p_profile_id uuid, p_follow boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_follow_profile_available(auth.uid()) then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;
  if p_follow is null then raise exception 'Follow state is required.'; end if;
  if p_follow then
    -- Serialize with account moderation/deletion while checking eligibility.
    perform 1 from public.profiles where id in (auth.uid(), p_profile_id) order by id for share;
    if p_profile_id = auth.uid() or not public.is_follow_profile_available(p_profile_id)
       or not public.is_follow_profile_available(auth.uid()) then
      raise exception 'This profile cannot be followed.' using errcode = '22023';
    end if;
    insert into public.profile_follows(follower_id, following_id) values (auth.uid(), p_profile_id)
    on conflict do nothing;
  else
    delete from public.profile_follows where follower_id = auth.uid() and following_id = p_profile_id;
  end if;
end;
$$;
revoke all on function public.set_profile_follow(uuid, boolean) from public;
grant execute on function public.set_profile_follow(uuid, boolean) to authenticated;

create function public.get_profile_follow_summary(p_profile_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'followers', (select count(*) from public.profile_follows where following_id = p_profile_id),
    'following', (select count(*) from public.profile_follows where follower_id = p_profile_id),
    'is_following', exists(select 1 from public.profile_follows where follower_id = auth.uid() and following_id = p_profile_id)
  );
$$;
revoke all on function public.get_profile_follow_summary(uuid) from public;
grant execute on function public.get_profile_follow_summary(uuid) to anon, authenticated;

-- Lists expose only the existing privacy-filtered card contract, in bounded pages.
create function public.get_profile_follow_list(p_profile_id uuid, p_direction text, p_offset integer default 0, p_limit integer default 25)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare result jsonb;
begin
  if p_direction not in ('followers', 'following') or p_direction is null then raise exception 'Invalid direction'; end if;
  with page as (
    select case when p_direction = 'followers' then f.follower_id else f.following_id end as id, f.created_at
    from public.profile_follows f
    where (p_direction = 'followers' and f.following_id = p_profile_id)
       or (p_direction = 'following' and f.follower_id = p_profile_id)
    order by f.created_at desc, f.follower_id, f.following_id
    offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit,25),1),50)
  )
  select coalesce(jsonb_agg(to_jsonb(c) order by page.created_at desc, page.id), '[]'::jsonb) into result
  from public.get_public_profile_cards(array(select id from page)) c join page on page.id = c.id;
  return result;
end;
$$;
revoke all on function public.get_profile_follow_list(uuid,text,integer,integer) from public;
grant execute on function public.get_profile_follow_list(uuid,text,integer,integer) to anon, authenticated;

-- Filter BEFORE the limit, using post RLS. Clients retain existing media/vote/comment hydration.
create function public.get_following_post_ids(p_limit integer default 50)
returns table(id uuid) language sql stable security invoker set search_path = public as $$
  select p.id from public.posts p
  where auth.uid() is not null and not p.is_deleted and p.visibility = 'public'
    and exists (select 1 from public.profile_follows f where f.follower_id = auth.uid() and f.following_id = p.user_id)
  order by p.is_sticky desc, p.sticky_at desc nulls last, p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit,50),1),100);
$$;
revoke all on function public.get_following_post_ids(integer) from public;
grant execute on function public.get_following_post_ids(integer) to authenticated;

insert into public.badges(slug,name,description,icon_key,variant,display_order,is_active)
values
 ('verified-creator','Verified Creator','Identity confirmed by TriggerFeed.','badge-check','verified',5,true),
 ('verified-organization','Verified Organization','Organization confirmed by TriggerFeed.','badge-check','verified',5,true)
on conflict(slug) do update set name=excluded.name, description=excluded.description, is_active=true;

-- Preserve existing admin-granted verification, without verifying any new signup.
insert into public.user_badges(user_id,badge_id,metadata,awarded_at)
select ub.user_id, b.id, ub.metadata, ub.awarded_at from public.user_badges ub
join public.badges old on old.id=ub.badge_id and old.slug='verified'
join public.profiles p on p.id=ub.user_id and p.profile_type in ('creator','organization')
join public.badges b on b.slug='verified-' || p.profile_type
on conflict(user_id,badge_id) do nothing;
delete from public.user_badges using public.badges b where badge_id=b.id and b.slug='verified';

-- Enforce types for ALL badge award paths, including the existing admin RPC.
create function public.guard_identity_badge() returns trigger
language plpgsql security definer set search_path=public as $$
declare slug text; kind text;
begin
 select b.slug into slug from public.badges b where b.id=new.badge_id;
 if slug in ('verified','verified-creator','verified-organization') then
   if auth.uid() is null or not public.is_admin_or_above() then raise exception 'Administrator required.' using errcode='42501'; end if;
   select p.profile_type into kind from public.profiles p where p.id=new.user_id and not p.is_deleted and not p.is_banned for share;
   if slug is distinct from ('verified-' || kind) or kind not in ('creator','organization') then
     raise exception 'Verification must match the profile type.';
   end if;
 end if;
 return new;
end;
$$;
revoke all on function public.guard_identity_badge() from public;
create trigger guard_identity_badge before insert or update on public.user_badges for each row execute function public.guard_identity_badge();

-- A type change invalidates verification; it does not silently verify the new identity.
create function public.clear_changed_identity_verification() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.profile_type is distinct from new.profile_type then
   delete from public.user_badges ub using public.badges b
   where ub.user_id=new.id and ub.badge_id=b.id and b.slug in ('verified','verified-creator','verified-organization');
 end if;
 return new;
end;
$$;
revoke all on function public.clear_changed_identity_verification() from public;
create trigger clear_changed_identity_verification after update of profile_type on public.profiles
for each row execute function public.clear_changed_identity_verification();

create function public.set_profile_verification(p_user_id uuid, p_verified boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare kind text;
begin
 if auth.uid() is null or not public.is_admin_or_above() then raise exception 'Administrator required.' using errcode='42501'; end if;
 select profile_type into kind from public.profiles where id=p_user_id for update;
 if kind is null or kind not in ('creator','organization') then raise exception 'Creator or organization required.'; end if;
 if p_verified is null then raise exception 'Verification state required.'; end if;
 if p_verified then perform public.award_user_badge(p_user_id, 'verified-' || kind);
 else perform public.revoke_user_badge(p_user_id, 'verified-' || kind);
 end if;
 return true;
end;
$$;
revoke all on function public.set_profile_verification(uuid,boolean) from public;
grant execute on function public.set_profile_verification(uuid,boolean) to authenticated;

-- Audit all identity badge changes, including awards/revocations via older admin clients.
create function public.audit_identity_badge() returns trigger
language plpgsql security definer set search_path=public as $$
declare slug text; target uuid;
begin
 if tg_op='DELETE' then
   select b.slug into slug from public.badges b where b.id=old.badge_id; target:=old.user_id;
 else
   select b.slug into slug from public.badges b where b.id=new.badge_id; target:=new.user_id;
 end if;
 if slug in ('verified-creator','verified-organization') and exists(select 1 from public.profiles where id=target) then
   insert into public.moderation_actions(target_user_id,actor_user_id,action_type,reason,metadata)
   values(target,auth.uid(),'admin_note',case when tg_op='DELETE' then 'Verification revoked' else 'Verification awarded' end,
          jsonb_build_object('badge_slug',slug,'operation',tg_op));
 end if;
 return null;
end;
$$;
revoke all on function public.audit_identity_badge() from public;
create trigger audit_identity_badge after insert or update or delete on public.user_badges
for each row execute function public.audit_identity_badge();

commit;
