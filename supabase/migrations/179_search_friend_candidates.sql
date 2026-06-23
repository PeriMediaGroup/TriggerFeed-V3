begin;

create or replace function public.search_friend_candidates(
  p_query text,
  p_limit integer default 25
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_cloudinary_url text,
  city text,
  state text,
  friendship_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_query text := lower(trim(regexp_replace(coalesce(p_query, ''), '^@+', '')));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  if v_viewer_id is null then
    raise exception 'Authentication required';
  end if;

  if v_query = '' then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_cloudinary_url,
      case
        when lower(p.privacy_settings #>> '{profile_visibility,show_city}') in ('true', 'false')
          and (p.privacy_settings #>> '{profile_visibility,show_city}')::boolean
          then p.city
        else null
      end as city,
      case
        when lower(p.privacy_settings #>> '{profile_visibility,show_state}') in ('true', 'false')
          and (p.privacy_settings #>> '{profile_visibility,show_state}')::boolean
          then p.state
        else null
      end as state,
      relationship.status as friendship_status,
      case
        when starts_with(lower(coalesce(p.username, '')), v_query)
          or starts_with(lower(coalesce(p.display_name, '')), v_query)
          or starts_with(lower(coalesce(p.first_name, '')), v_query)
          or starts_with(lower(coalesce(p.last_name, '')), v_query)
          or starts_with(lower(
            concat_ws(
              ' ',
              nullif(trim(p.first_name), ''),
              nullif(trim(p.last_name), '')
            )
          ), v_query)
          then 0
        else 1
      end as match_rank
    from public.profiles p
    left join lateral (
      select f.status
      from public.friends f
      where
        (f.requester_id = v_viewer_id and f.addressee_id = p.id)
        or
        (f.requester_id = p.id and f.addressee_id = v_viewer_id)
      order by
        case f.status
          when 'accepted' then 0
          when 'pending' then 1
          when 'blocked' then 2
          else 3
        end,
        f.updated_at desc
      limit 1
    ) relationship on true
    where p.id <> v_viewer_id
      and coalesce(p.is_deleted, false) = false
      and coalesce(p.is_banned, false) = false
      and (
        strpos(lower(coalesce(p.username, '')), v_query) > 0
        or strpos(lower(coalesce(p.display_name, '')), v_query) > 0
        or strpos(lower(coalesce(p.first_name, '')), v_query) > 0
        or strpos(lower(coalesce(p.last_name, '')), v_query) > 0
        or strpos(lower(
          concat_ws(
            ' ',
            nullif(trim(p.first_name), ''),
            nullif(trim(p.last_name), '')
          )
        ), v_query) > 0
      )
  )
  select
    c.id,
    c.username,
    c.display_name,
    c.avatar_cloudinary_url,
    c.city,
    c.state,
    c.friendship_status
  from candidates c
  order by
    c.match_rank,
    lower(coalesce(c.username, '')),
    lower(coalesce(c.display_name, '')),
    c.id
  limit v_limit;
end;
$$;

revoke all on function public.search_friend_candidates(text, integer) from public;
grant execute on function public.search_friend_candidates(text, integer) to authenticated;

commit;
