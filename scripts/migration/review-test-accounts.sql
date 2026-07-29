\pset pager off

with auth_users as (
  select
    u.id,
    lower(nullif(trim(u.email), '')) as normalized_email,
    u.email,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
),
profile_rows as (
  select
    p.id,
    lower(nullif(trim(p.email), '')) as normalized_profile_email,
    lower(nullif(trim(p.username), '')) as normalized_username,
    p.email,
    p.username,
    p.display_name,
    p.created_at
  from public.profiles p
),
combined as (
  select
    coalesce(a.id, p.id) as user_id,
    coalesce(a.email, p.email) as email,
    p.username,
    p.display_name,
    coalesce(a.created_at, p.created_at) as account_created_at,
    a.last_sign_in_at,
    a.normalized_email,
    p.normalized_username,
    (a.id is null) as profile_without_auth_user,
    (p.id is null) as auth_user_without_profile
  from auth_users a
  full join profile_rows p on p.id = a.id
),
activity as (
  select
    c.user_id,
    (select count(*) from public.posts x where x.user_id = c.user_id) as post_count,
    (select count(*) from public.comments x where x.user_id = c.user_id) as comment_count,
    (select count(*) from public.post_media x where x.user_id = c.user_id) as media_count,
    (select count(*) from public.post_votes x where x.user_id = c.user_id) as vote_count,
    (select count(*) from public.friends x where x.requester_id = c.user_id or x.addressee_id = c.user_id) as friend_count
  from combined c
),
duplicates as (
  select
    c.user_id,
    case
      when c.normalized_email is null then 0
      else count(*) over (partition by c.normalized_email)
    end as normalized_email_count,
    case
      when c.normalized_username is null then 0
      else count(*) over (partition by c.normalized_username)
    end as normalized_username_count
  from combined c
),
scored as (
  select
    c.*,
    a.post_count,
    a.comment_count,
    a.media_count,
    a.vote_count,
    a.friend_count,
    array_remove(array[
      case when coalesce(c.email, '') ~* '(^|[._+-])(test|testing|qa|demo|seed|dev|local)([._+-]|@|$)' then 'email contains test-like term' end,
      case when coalesce(c.username, '') ~* '^(test|testing|qa|demo|seed|dev|user[0-9]+|testuser[0-9]*)$' then 'username contains test-like term or development pattern' end,
      case when coalesce(c.display_name, '') ~* '(test|testing|qa|demo|seed|development)' then 'display name contains test-like term' end,
      case when coalesce(c.email, '') ~* '@(example\.com|example\.org|example\.net|mailinator\.com|tempmail\.com|10minutemail\.com|invalid\.test)$' then 'disposable or reserved email domain' end,
      case when d.normalized_email_count > 1 then 'duplicate normalized email' end,
      case when d.normalized_username_count > 1 then 'duplicate normalized username' end,
      case when c.auth_user_without_profile then 'auth user without profile' end,
      case when c.profile_without_auth_user then 'profile without auth user' end,
      case when a.post_count + a.comment_count + a.media_count + a.vote_count + a.friend_count = 0 then 'zero activity' end,
      case when c.last_sign_in_at is null then 'never signed in' end,
      case when coalesce(c.email, c.username, '') ~* '(^|[^0-9])0{0,2}[0-9]{1,3}($|[^0-9])' then 'possible sequential naming' end
    ], null) as reason_flags
  from combined c
  join activity a on a.user_id = c.user_id
  left join duplicates d on d.user_id = c.user_id
),
ranked as (
  select
    *,
    (
      case when array_length(reason_flags, 1) is null then 0 else array_length(reason_flags, 1) end
      - case when reason_flags = array['zero activity'] then 1 else 0 end
    ) as candidate_score
  from scored
)
select
  user_id,
  email,
  username,
  display_name,
  account_created_at,
  last_sign_in_at,
  post_count,
  comment_count,
  media_count,
  vote_count,
  friend_count,
  array_to_string(reason_flags, '; ') as reason_flags,
  candidate_score,
  case
    when candidate_score >= 4 then 'high'
    when candidate_score >= 2 then 'medium'
    when candidate_score = 1 then 'low'
    else 'informational'
  end as confidence_level,
  ''::text as manual_decision,
  ''::text as decision_notes
from ranked
where candidate_score > 0
order by candidate_score desc, account_created_at nulls last, user_id;
