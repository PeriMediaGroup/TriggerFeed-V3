select
  least(requester_id, addressee_id) as profile_a,
  greatest(requester_id, addressee_id) as profile_b,
  count(*)
from public.friends
group by 1, 2
having count(*) > 1;