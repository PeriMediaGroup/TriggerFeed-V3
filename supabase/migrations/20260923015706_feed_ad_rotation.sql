-- Optional previous-campaign context; existing callers can omit it.
-- Only delivery selection changes. Tables, eligibility and event tracking do not.
begin;

-- Avoid ambiguous PostgREST overloads when adding a defaulted argument.
drop function public.get_feed_ads(text, text, integer, uuid);
create function public.get_feed_ads(
  p_platform text,
  p_placement text default 'feed',
  p_limit integer default 8,
  p_visitor_id uuid default null,
  p_previous_campaign_id uuid default null
)
returns table (
  delivery_id uuid, ad_id uuid, creative_id uuid, advertiser_name text,
  advertiser_type text, headline text, body text, image_url text,
  call_to_action text, destination_url text, platform text, placement text, frequency integer
)
language plpgsql security definer set search_path = public as $$
declare
  chosen record;
  ticket uuid;
  visitor uuid;
  slot integer;
  previous_campaign uuid := p_previous_campaign_id;
begin
  if p_platform is null or p_platform not in ('web_desktop', 'web_mobile', 'android')
    or p_placement is distinct from 'feed' then
    raise exception 'Invalid ad platform or placement';
  end if;
  select v.id into visitor from public.marketing_visitors v where v.id = p_visitor_id;

  for slot in 1..least(greatest(coalesce(p_limit, 8), 0), 8) loop
    with eligible as materialized (
      select a.id as campaign_id, c.id as selected_creative, c.headline, c.body,
        c.image_url, c.call_to_action, a.destination_url, a.advertiser_name,
        a.advertiser_type, ap.frequency, ap.weight
      from public.ads a
      join public.ad_placements ap on ap.ad_id = a.id and ap.placement = p_placement and ap.enabled
      cross join lateral (
        select ac.* from public.ad_creatives ac
        where ac.ad_id = a.id and ac.platform in ('all', p_platform)
        order by (ac.platform = p_platform) desc, random() limit 1
      ) c
      where a.status = 'active'
        and (a.starts_at is null or a.starts_at <= now())
        and (a.ends_at is null or a.ends_at > now())
    )
    select e.* into chosen from eligible e
    where e.campaign_id is distinct from previous_campaign
      or not exists (
        select 1 from eligible alternative
        where alternative.campaign_id is distinct from previous_campaign
      )
    order by -ln(greatest(random(), 0.000001)) / e.weight limit 1;
    if not found then return; end if;

    insert into public.ad_deliveries(ad_id, creative_id, user_id, visitor_id, platform, placement)
    values(chosen.campaign_id, chosen.selected_creative, auth.uid(), visitor, p_platform, p_placement)
    returning id into ticket;
    return query select ticket, chosen.campaign_id, chosen.selected_creative,
      chosen.advertiser_name, chosen.advertiser_type, chosen.headline, chosen.body,
      chosen.image_url, chosen.call_to_action, chosen.destination_url,
      p_platform, p_placement, chosen.frequency;
    previous_campaign := chosen.campaign_id;
  end loop;
end;
$$;
revoke all on function public.get_feed_ads(text, text, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_feed_ads(text, text, integer, uuid, uuid) to anon, authenticated;
comment on function public.get_feed_ads(text, text, integer, uuid, uuid) is
  'Weighted eligible feed delivery; excludes the previous campaign when an eligible alternative exists, including across batches.';
notify pgrst, 'reload schema';
commit;
