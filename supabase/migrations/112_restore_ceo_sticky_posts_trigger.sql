create or replace function public.enforce_ceo_sticky_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if coalesce(new.is_sticky, false) = true then
    select role
    into v_role
    from public.profiles
    where id = auth.uid();

    if v_role is distinct from 'ceo' then
      raise exception 'Only CEO users can create official sticky posts.';
    end if;

    new.is_sticky = true;
    new.sticky_at = coalesce(new.sticky_at, now());
    new.sticky_by = coalesce(new.sticky_by, auth.uid());

    return new;
  end if;

  new.is_sticky = false;
  new.sticky_at = null;
  new.sticky_by = null;

  return new;
end;
$$;

drop trigger if exists enforce_ceo_sticky_posts_trigger on public.posts;

create trigger enforce_ceo_sticky_posts_trigger
before insert or update
on public.posts
for each row
execute function public.enforce_ceo_sticky_posts();