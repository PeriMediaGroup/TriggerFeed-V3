-- Read-only audit; no cleanup or reassignment. Run as database administrator.
-- Check both sources so a stale profile email cannot hide an internal auth email.
select
  p.id,
  p.username,
  p.email as profile_email,
  u.email as auth_email,
  p.profile_type,
  p.founding_member_number
from public.profiles p
left join auth.users u on u.id = p.id
where p.founding_member_number is not null
  and (
    lower(btrim(p.email)) ~ '@(triggerfeed\.com|perimediagroup\.com)$'
    or lower(btrim(u.email)) ~ '@(triggerfeed\.com|perimediagroup\.com)$'
  )
order by p.founding_member_number;
