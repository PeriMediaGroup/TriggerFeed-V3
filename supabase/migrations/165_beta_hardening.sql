-- =========================================================
-- 165: Beta Hardening
-- DOB verification, poll privacy, transactional post writes,
-- moderation guards, and Cloudinary production assumptions.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- Age gate helpers
-- ---------------------------------------------------------

create or replace function public.is_adult_dob(p_dob date)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_dob is not null
    and p_dob <= (current_date - interval '18 years')::date
    and p_dob >= date '1900-01-01';
$$;

revoke all on function public.is_adult_dob(date) from public;
grant execute on function public.is_adult_dob(date) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob date;
  v_age_gate_version text;
  v_birthday_messages_enabled boolean;
begin
  begin
    if new.raw_user_meta_data ? 'dob'
      and (new.raw_user_meta_data->>'dob') ~ '^\d{4}-\d{2}-\d{2}$'
    then
      v_dob := (new.raw_user_meta_data->>'dob')::date;
    end if;
  exception
    when others then
      v_dob := null;
  end;

  v_age_gate_version := nullif(trim(coalesce(new.raw_user_meta_data->>'age_gate_version', '')), '');
  v_birthday_messages_enabled := coalesce(
    case
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('true', 't', '1', 'yes')
        then true
      when lower(coalesce(new.raw_user_meta_data->>'birthday_messages_enabled', '')) in ('false', 'f', '0', 'no')
        then false
      else null
    end,
    true
  );

  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    first_name,
    last_name,
    dob,
    age_verified_at,
    age_gate_version,
    birthday_messages_enabled,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'last_name', ''),
    case when public.is_adult_dob(v_dob) then v_dob else null end,
    case when public.is_adult_dob(v_dob) then now() else null end,
    coalesce(v_age_gate_version, 'v1'),
    v_birthday_messages_enabled,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    dob = coalesce(public.profiles.dob, excluded.dob),
    age_verified_at = coalesce(public.profiles.age_verified_at, excluded.age_verified_at),
    age_gate_version = coalesce(nullif(public.profiles.age_gate_version, ''), excluded.age_gate_version, 'v1'),
    birthday_messages_enabled = coalesce(public.profiles.birthday_messages_enabled, excluded.birthday_messages_enabled, true),
    updated_at = now();

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;

create or replace function public.repair_my_age_gate(
  p_dob date,
  p_age_gate_version text default 'v1',
  p_birthday_messages_enabled boolean default true
)
returns table (
  id uuid,
  dob date,
  age_verified_at timestamptz,
  age_gate_version text,
  birthday_messages_enabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_adult_dob(p_dob) then
    raise exception 'TriggerFeed is only available to users 18 or older.';
  end if;

  return query
  update public.profiles p
  set
    dob = p_dob,
    age_verified_at = coalesce(p.age_verified_at, now()),
    age_gate_version = coalesce(nullif(trim(p_age_gate_version), ''), 'v1'),
    birthday_messages_enabled = coalesce(p_birthday_messages_enabled, true),
    updated_at = now()
  where p.id = auth.uid()
    and coalesce(p.is_deleted, false) = false
    and coalesce(p.is_banned, false) = false
  returning
    p.id,
    p.dob,
    p.age_verified_at,
    p.age_gate_version,
    p.birthday_messages_enabled;
end;
$$;

revoke all on function public.repair_my_age_gate(date, text, boolean) from public;
grant execute on function public.repair_my_age_gate(date, text, boolean) to authenticated;

-- ---------------------------------------------------------
-- Poll response privacy and aggregate results
-- ---------------------------------------------------------

revoke select on public.poll_responses from anon;
revoke select on public.poll_responses from authenticated;
grant select (id, poll_id, option_id, user_id, created_at) on public.poll_responses to authenticated;

drop policy if exists "poll_responses_select_visible_public_posts"
on public.poll_responses;

create policy "poll_responses_select_own_visible_public_post"
on public.poll_responses
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

create or replace function public.get_poll_results(p_poll_ids uuid[])
returns table (
  poll_id uuid,
  option_id uuid,
  vote_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    po.poll_id,
    po.id as option_id,
    count(pr.id)::integer as vote_count
  from public.poll_options po
  join public.polls poll on poll.id = po.poll_id
  join public.posts p on p.id = poll.post_id
  left join public.poll_responses pr
    on pr.option_id = po.id
   and pr.poll_id = po.poll_id
  where po.poll_id = any(p_poll_ids)
    and p.is_deleted = false
    and p.visibility = 'public'
  group by po.poll_id, po.id, po.display_order
  order by po.poll_id, po.display_order;
$$;

revoke all on function public.get_poll_results(uuid[]) from public;
grant execute on function public.get_poll_results(uuid[]) to anon, authenticated;

create or replace function public.get_my_poll_responses(p_poll_ids uuid[])
returns table (
  poll_id uuid,
  option_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.poll_id, pr.option_id
  from public.poll_responses pr
  join public.polls poll on poll.id = pr.poll_id
  join public.posts p on p.id = poll.post_id
  where auth.uid() is not null
    and pr.user_id = auth.uid()
    and pr.poll_id = any(p_poll_ids)
    and p.is_deleted = false
    and p.visibility = 'public';
$$;

revoke all on function public.get_my_poll_responses(uuid[]) from public;
grant execute on function public.get_my_poll_responses(uuid[]) to authenticated;

-- ---------------------------------------------------------
-- Moderation guards for existing mutation paths
-- ---------------------------------------------------------

drop policy if exists "posts_update_own_non_deleted"
on public.posts;

create policy "posts_update_own_non_deleted"
on public.posts
for update
to authenticated
using (
  auth.uid() = user_id
  and is_deleted = false
  and public.current_user_can_interact()
)
with check (
  auth.uid() = user_id
  and visibility = 'public'
  and public.current_user_can_interact()
  and (
    (is_deleted = false and deleted_at is null)
    or
    (is_deleted = true and deleted_at is not null)
  )
);

create or replace function public.soft_delete_post(target_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_post_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  update public.posts
  set
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where id = target_post_id
    and user_id = auth.uid()
    and is_deleted = false
  returning id into deleted_post_id;

  if deleted_post_id is null then
    raise exception 'Post not found or you do not have permission to delete it';
  end if;

  return deleted_post_id;
end;
$$;

drop policy if exists "comments_update_own_non_deleted"
on public.comments;

create policy "comments_update_own_non_deleted"
on public.comments
for update
to authenticated
using (
  auth.uid() = user_id
  and is_deleted = false
  and public.current_user_can_interact()
)
with check (
  auth.uid() = user_id
  and public.current_user_can_interact()
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
  and (
    (is_deleted = false and deleted_at is null)
    or
    (is_deleted = true and deleted_at is not null)
  )
);

create or replace function public.soft_delete_comment(target_comment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_comment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  update public.comments
  set
    body = '[deleted]',
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where id = target_comment_id
    and user_id = auth.uid()
    and is_deleted = false
  returning id into deleted_comment_id;

  if deleted_comment_id is null then
    raise exception 'Comment not found or you do not have permission to delete it';
  end if;

  return deleted_comment_id;
end;
$$;

create or replace function public.soft_delete_comment_thread(target_comment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  select c.id, c.post_id, c.user_id, c.is_deleted
  into target_comment
  from public.comments c
  where c.id = target_comment_id;

  if target_comment is null then
    raise exception 'Comment not found';
  end if;

  if target_comment.user_id <> auth.uid() then
    raise exception 'You do not have permission to delete this comment';
  end if;

  if target_comment.is_deleted = true then
    raise exception 'Comment is already deleted';
  end if;

  update public.comments
  set
    body = '[deleted]',
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where post_id = target_comment.post_id
    and is_deleted = false
    and (
      id = target_comment.id
      or parent_comment_id = target_comment.id
    );

  return target_comment.id;
end;
$$;

drop policy if exists "post_media_insert_own_post_trusted_source"
on public.post_media;

create policy "post_media_insert_own_post_trusted_source"
on public.post_media
for insert
to authenticated
with check (
  public.current_user_can_interact()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
      and p.visibility = 'public'
  )
  and (
    (
      provider = 'cloudinary'
      and media_type in ('image', 'video')
      and cloudinary_url is not null
      and cloudinary_public_id is not null
      and cloudinary_public_id like ('triggerfeed/posts/' || auth.uid()::text || '/' || post_id::text || '/%')
      and cloudinary_url like 'https://res.cloudinary.com/triggerfeed/%'
      and (
        cloudinary_secure_url is null
        or cloudinary_secure_url like 'https://res.cloudinary.com/triggerfeed/%'
      )
    )
    or
    (
      provider = 'giphy'
      and media_type = 'gif'
      and external_url is not null
      and (
        external_url like 'https://media.giphy.com/%'
        or external_url like 'https://media%.giphy.com/%'
        or external_url like 'https://i.giphy.com/%'
      )
      and (
        thumbnail_url is null
        or thumbnail_url like 'https://media.giphy.com/%'
        or thumbnail_url like 'https://media%.giphy.com/%'
        or thumbnail_url like 'https://i.giphy.com/%'
      )
    )
  )
);

drop policy if exists "post_media_update_own_post_trusted_source"
on public.post_media;

create policy "post_media_update_own_post_trusted_source"
on public.post_media
for update
to authenticated
using (
  public.current_user_can_interact()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
      and p.visibility = 'public'
  )
)
with check (
  public.current_user_can_interact()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
      and p.visibility = 'public'
  )
  and (
    (
      provider = 'cloudinary'
      and media_type in ('image', 'video')
      and cloudinary_url is not null
      and cloudinary_public_id is not null
      and cloudinary_public_id like ('triggerfeed/posts/' || auth.uid()::text || '/' || post_id::text || '/%')
      and cloudinary_url like 'https://res.cloudinary.com/triggerfeed/%'
      and (
        cloudinary_secure_url is null
        or cloudinary_secure_url like 'https://res.cloudinary.com/triggerfeed/%'
      )
    )
    or
    (
      provider = 'giphy'
      and media_type = 'gif'
      and external_url is not null
      and (
        external_url like 'https://media.giphy.com/%'
        or external_url like 'https://media%.giphy.com/%'
        or external_url like 'https://i.giphy.com/%'
      )
      and (
        thumbnail_url is null
        or thumbnail_url like 'https://media.giphy.com/%'
        or thumbnail_url like 'https://media%.giphy.com/%'
        or thumbnail_url like 'https://i.giphy.com/%'
      )
    )
  )
);

drop policy if exists "post_media_delete_own_post"
on public.post_media;

create policy "post_media_delete_own_post"
on public.post_media
for delete
to authenticated
using (
  public.current_user_can_interact()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
      and p.user_id = auth.uid()
      and p.is_deleted = false
  )
);

drop policy if exists "poll_responses_insert_own_visible_public_post"
on public.poll_responses;

create policy "poll_responses_insert_own_visible_public_post"
on public.poll_responses
for insert
to authenticated
with check (
  public.current_user_can_interact()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    join public.polls poll on poll.id = po.poll_id
    join public.posts p on p.id = poll.post_id
    where po.id = poll_responses.option_id
      and po.poll_id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

drop policy if exists "poll_responses_update_own_visible_public_post"
on public.poll_responses;

create policy "poll_responses_update_own_visible_public_post"
on public.poll_responses
for update
to authenticated
using (
  public.current_user_can_interact()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
)
with check (
  public.current_user_can_interact()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.poll_options po
    join public.polls poll on poll.id = po.poll_id
    join public.posts p on p.id = poll.post_id
    where po.id = poll_responses.option_id
      and po.poll_id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

drop policy if exists "poll_responses_delete_own_visible_public_post"
on public.poll_responses;

create policy "poll_responses_delete_own_visible_public_post"
on public.poll_responses
for delete
to authenticated
using (
  public.current_user_can_interact()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.polls po
    join public.posts p on p.id = po.post_id
    where po.id = poll_responses.poll_id
      and p.is_deleted = false
      and p.visibility = 'public'
  )
);

drop policy if exists "Users can create their own post reports"
on public.post_reports;

create policy "Users can create their own post reports"
on public.post_reports
for insert
to authenticated
with check (
  public.current_user_can_interact()
  and reporter_id = auth.uid()
  and status = 'open'
  and reviewed_by is null
  and reviewed_at is null
);

-- ---------------------------------------------------------
-- Transactional post create/update RPCs
-- ---------------------------------------------------------

create or replace function public.create_post_transactional(
  p_title text,
  p_body text,
  p_visibility text,
  p_is_sticky boolean default false,
  p_gif jsonb default null,
  p_poll jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
  v_poll_id uuid;
  v_option text;
  v_option_index integer := 0;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  insert into public.posts (
    user_id,
    title,
    body,
    visibility,
    is_sticky
  )
  values (
    auth.uid(),
    nullif(trim(coalesce(p_title, '')), ''),
    nullif(trim(coalesce(p_body, '')), ''),
    coalesce(nullif(trim(coalesce(p_visibility, '')), ''), 'public'),
    coalesce(v_role = 'ceo' and p_is_sticky, false)
  )
  returning id into v_post_id;

  if p_gif is not null then
    insert into public.post_media (
      post_id,
      user_id,
      media_type,
      provider,
      source,
      external_id,
      external_url,
      thumbnail_url,
      title,
      sort_order,
      display_order
    )
    values (
      v_post_id,
      auth.uid(),
      'gif',
      'giphy',
      'giphy',
      nullif(p_gif->>'external_id', ''),
      p_gif->>'external_url',
      nullif(p_gif->>'thumbnail_url', ''),
      nullif(p_gif->>'title', ''),
      coalesce((p_gif->>'sort_order')::integer, 0),
      coalesce((p_gif->>'display_order')::integer, 0)
    );
  end if;

  if p_poll is not null then
    insert into public.polls (
      post_id,
      question,
      allows_multiple
    )
    values (
      v_post_id,
      p_poll->>'question',
      coalesce((p_poll->>'allows_multiple')::boolean, false)
    )
    returning id into v_poll_id;

    for v_option in
      select jsonb_array_elements_text(coalesce(p_poll->'options', '[]'::jsonb))
    loop
      insert into public.poll_options (
        poll_id,
        option_text,
        display_order
      )
      values (
        v_poll_id,
        v_option,
        v_option_index
      );

      v_option_index := v_option_index + 1;
    end loop;
  end if;

  return v_post_id;
end;
$$;

revoke all on function public.create_post_transactional(text, text, text, boolean, jsonb, jsonb) from public;
grant execute on function public.create_post_transactional(text, text, text, boolean, jsonb, jsonb) to authenticated;

create or replace function public.update_post_transactional(
  p_post_id uuid,
  p_title text,
  p_body text,
  p_visibility text,
  p_is_sticky boolean default false,
  p_gif jsonb default null,
  p_remove_gif boolean default false,
  p_poll jsonb default null,
  p_remove_poll boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll_id uuid;
  v_response_count integer;
  v_option text;
  v_option_index integer := 0;
  v_role text;
  v_existing_gif_id uuid;
  v_sort_order integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_current_user_can_interact();

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  update public.posts p
  set
    title = nullif(trim(coalesce(p_title, '')), ''),
    body = nullif(trim(coalesce(p_body, '')), ''),
    visibility = coalesce(nullif(trim(coalesce(p_visibility, '')), ''), 'public'),
    is_sticky = coalesce(v_role = 'ceo' and p_is_sticky, false),
    updated_at = now()
  where p.id = p_post_id
    and p.user_id = auth.uid()
    and p.is_deleted = false;

  if not found then
    raise exception 'Post not found or you do not have permission to edit it';
  end if;

  if p_remove_gif then
    delete from public.post_media pm
    where pm.post_id = p_post_id
      and pm.user_id = auth.uid()
      and pm.media_type = 'gif';
  end if;

  if p_gif is not null then
    select pm.id, coalesce(pm.display_order, pm.sort_order, 0)
    into v_existing_gif_id, v_sort_order
    from public.post_media pm
    where pm.post_id = p_post_id
      and pm.user_id = auth.uid()
      and pm.media_type = 'gif'
    order by pm.display_order asc, pm.created_at asc
    limit 1;

    if v_existing_gif_id is null then
      select coalesce(max(coalesce(pm.display_order, pm.sort_order, 0)) + 1, 0)
      into v_sort_order
      from public.post_media pm
      where pm.post_id = p_post_id
        and pm.user_id = auth.uid();

      insert into public.post_media (
        post_id,
        user_id,
        media_type,
        provider,
        source,
        external_id,
        external_url,
        thumbnail_url,
        title,
        sort_order,
        display_order
      )
      values (
        p_post_id,
        auth.uid(),
        'gif',
        'giphy',
        'giphy',
        nullif(p_gif->>'external_id', ''),
        p_gif->>'external_url',
        nullif(p_gif->>'thumbnail_url', ''),
        nullif(p_gif->>'title', ''),
        v_sort_order,
        v_sort_order
      );
    else
      update public.post_media pm
      set
        provider = 'giphy',
        source = 'giphy',
        external_id = nullif(p_gif->>'external_id', ''),
        external_url = p_gif->>'external_url',
        thumbnail_url = nullif(p_gif->>'thumbnail_url', ''),
        title = nullif(p_gif->>'title', ''),
        sort_order = v_sort_order,
        display_order = v_sort_order
      where pm.id = v_existing_gif_id
        and pm.post_id = p_post_id
        and pm.user_id = auth.uid();
    end if;

    delete from public.post_media pm
    where pm.post_id = p_post_id
      and pm.user_id = auth.uid()
      and pm.media_type = 'gif'
      and pm.id <> coalesce(v_existing_gif_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and v_existing_gif_id is not null;
  end if;

  select poll.id
  into v_poll_id
  from public.polls poll
  where poll.post_id = p_post_id
  limit 1;

  if p_remove_poll and v_poll_id is not null then
    select count(*)::integer
    into v_response_count
    from public.poll_responses pr
    where pr.poll_id = v_poll_id;

    if v_response_count > 0 then
      raise exception 'This poll already has votes, so it cannot be removed.';
    end if;

    delete from public.poll_options po where po.poll_id = v_poll_id;
    delete from public.polls poll where poll.id = v_poll_id and poll.post_id = p_post_id;
    v_poll_id := null;
  end if;

  if p_poll is not null then
    if v_poll_id is null then
      insert into public.polls (
        post_id,
        question,
        allows_multiple
      )
      values (
        p_post_id,
        p_poll->>'question',
        coalesce((p_poll->>'allows_multiple')::boolean, false)
      )
      returning id into v_poll_id;
    else
      select count(*)::integer
      into v_response_count
      from public.poll_responses pr
      where pr.poll_id = v_poll_id;

      if v_response_count > 0 then
        raise exception 'This poll already has votes, so its options cannot be changed.';
      end if;

      update public.polls poll
      set
        question = p_poll->>'question',
        allows_multiple = coalesce((p_poll->>'allows_multiple')::boolean, false),
        updated_at = now()
      where poll.id = v_poll_id
        and poll.post_id = p_post_id;

      delete from public.poll_options po where po.poll_id = v_poll_id;
    end if;

    for v_option in
      select jsonb_array_elements_text(coalesce(p_poll->'options', '[]'::jsonb))
    loop
      insert into public.poll_options (
        poll_id,
        option_text,
        display_order
      )
      values (
        v_poll_id,
        v_option,
        v_option_index
      );

      v_option_index := v_option_index + 1;
    end loop;
  end if;

  return p_post_id;
end;
$$;

revoke all on function public.update_post_transactional(uuid, text, text, text, boolean, jsonb, boolean, jsonb, boolean) from public;
grant execute on function public.update_post_transactional(uuid, text, text, text, boolean, jsonb, boolean, jsonb, boolean) to authenticated;

comment on policy "post_media_insert_own_post_trusted_source" on public.post_media is
  'Cloudinary production cloud name is intentionally fixed to triggerfeed for beta. If staging/prod diverge, deploy an environment-specific policy migration before uploads.';

commit;
