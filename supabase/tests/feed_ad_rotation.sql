-- Rollback-only delivery contract tests. Run locally as owner with ON_ERROR_STOP.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end;
$$;
update public.ads set status = 'paused';
insert into public.ads(id, name, advertiser_name, advertiser_type, status, destination_url)
values
  ('a2000000-0000-0000-0000-000000000001', 'Rotation A', 'Test', 'house', 'active', 'https://triggerfeed.com/merch'),
  ('a2000000-0000-0000-0000-000000000002', 'Rotation B', 'Test', 'partner', 'active', 'https://example.com/');
insert into public.ad_creatives(ad_id, headline, call_to_action, platform)
select a.id, p, 'Go', p from public.ads a
cross join unnest(array['all', 'web_desktop', 'web_mobile', 'android']) p
where a.id in ('a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002');
insert into public.ad_placements(ad_id, placement, weight)
values ('a2000000-0000-0000-0000-000000000001', 'feed', 100),
       ('a2000000-0000-0000-0000-000000000002', 'feed', 1);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
declare
  platform_name text;
  previous_id uuid;
  delivered record;
  batch integer;
  count_delivered integer;
  tickets uuid[];
begin
  foreach platform_name in array array['web_desktop', 'web_mobile', 'android'] loop
    previous_id := 'a2000000-0000-0000-0000-000000000001';
    tickets := '{}';
    -- Three batches prove later repeats and continuation beyond eight slots.
    for batch in 1..3 loop
      count_delivered := 0;
      for delivered in select * from public.get_feed_ads(
        platform_name, p_limit => 8, p_previous_campaign_id => previous_id
      ) loop
        perform pg_temp.assert_true(delivered.ad_id <> previous_id, 'no consecutive campaign, including batch boundary');
        perform pg_temp.assert_true(not delivered.delivery_id = any(tickets), 'fresh ticket for each repeated campaign');
        perform pg_temp.assert_true(delivered.platform = platform_name and delivered.headline = platform_name, 'platform tracking and creative preference retained');
        previous_id := delivered.ad_id;
        tickets := array_append(tickets, delivered.delivery_id);
        count_delivered := count_delivered + 1;
      end loop;
      perform pg_temp.assert_true(count_delivered = 8, 'pool is not exhausted');
    end loop;
  end loop;
  -- Old clients omit the new parameter and still resolve to a single RPC.
  perform pg_temp.assert_true((select count(*) = 8 from public.get_feed_ads('android', 'feed', 100, null)), 'legacy signature and eight-ticket cap');
  perform pg_temp.assert_true((select count(*) = 0 from public.get_feed_ads('android', p_limit => 0)), 'zero limit');
end;
$$;
reset role;

-- Each kind of ineligible alternative must still permit the sole eligible A.
create function pg_temp.assert_sole_campaign() returns void language plpgsql as $$
declare delivered record; count_delivered integer := 0;
begin
  for delivered in select * from public.get_feed_ads('android', p_limit => 8,
    p_previous_campaign_id => 'a2000000-0000-0000-0000-000000000001') loop
    perform pg_temp.assert_true(delivered.ad_id = 'a2000000-0000-0000-0000-000000000001', 'only eligible campaign repeats');
    count_delivered := count_delivered + 1;
  end loop;
  perform pg_temp.assert_true(count_delivered = 8, 'single campaign fills every slot');
end;
$$;
update public.ads set status = 'paused' where id = 'a2000000-0000-0000-0000-000000000002';
set local role anon;
select pg_temp.assert_sole_campaign();
reset role;
update public.ads set status = 'active', starts_at = now() + interval '1 day' where id = 'a2000000-0000-0000-0000-000000000002';
select pg_temp.assert_sole_campaign();
update public.ads set starts_at = null, ends_at = now() - interval '1 day' where id = 'a2000000-0000-0000-0000-000000000002';
select pg_temp.assert_sole_campaign();
update public.ads set ends_at = null where id = 'a2000000-0000-0000-0000-000000000002';
update public.ad_placements set enabled = false where ad_id = 'a2000000-0000-0000-0000-000000000002';
select pg_temp.assert_sole_campaign();
update public.ad_placements set enabled = true where ad_id = 'a2000000-0000-0000-0000-000000000002';
delete from public.ad_creatives where ad_id = 'a2000000-0000-0000-0000-000000000002' and platform in ('all', 'android');
set local role authenticated;
select pg_temp.assert_sole_campaign();
-- Unknown previous IDs must not exclude an eligible campaign or expose other data.
select pg_temp.assert_true((select count(*) = 1 from public.get_feed_ads('android', p_limit => 1,
  p_previous_campaign_id => 'a2000000-0000-0000-0000-000000000099')), 'unknown previous campaign');
reset role;
update public.ads set status = 'paused' where id = 'a2000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*) = 0 from public.get_feed_ads('android')), 'empty eligible pool');
rollback;
