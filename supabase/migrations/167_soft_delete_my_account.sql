begin;

create or replace function public.soft_delete_my_account()
returns table (
  id uuid,
  is_deleted boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  update public.profiles p
  set
    is_deleted = true,
    display_name = 'Deleted User',
    bio = null,
    avatar_cloudinary_url = null,
    avatar_cloudinary_public_id = null,
    banner_cloudinary_url = null,
    banner_cloudinary_public_id = null,
    city = null,
    state = null,
    privacy_settings = coalesce(
      p.privacy_settings,
      jsonb_build_object(
        'profile_visibility',
        jsonb_build_object(
          'show_email', false,
          'show_city', false,
          'show_state', false,
          'show_real_name', false,
          'show_age', false
        )
      )
    ),
    updated_at = now()
  where p.id = auth.uid()
    and coalesce(p.is_deleted, false) = false
  returning p.id, p.is_deleted;
end;
$$;

revoke all on function public.soft_delete_my_account() from public;
grant execute on function public.soft_delete_my_account() to authenticated;

commit;
