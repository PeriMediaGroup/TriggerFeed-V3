-- Rollback-only regression test. Run on local DB as owner with ON_ERROR_STOP.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end;
$$;

select pg_temp.assert_true(public.is_internal_ad_attribution(' TriggerFeed ', '/merch'), 'reserved source');
select pg_temp.assert_true(public.is_internal_ad_attribution('psa', '/friends?x=1&utm_medium=in-feed-ad#end'), 'explicit medium');
select pg_temp.assert_true(not public.is_internal_ad_attribution('psa', '/?utm_medium=in-feed-advertisement'), 'exact medium only');
select pg_temp.assert_true(not public.is_internal_ad_attribution('sawmill', '/#?utm_medium=in-feed-ad'), 'fragment is not query');
select pg_temp.assert_true(not public.is_internal_ad_attribution(null, null), 'null-safe');

insert into auth.users(id, email, raw_user_meta_data) values
('a9300000-0000-4000-8000-000000000001', 'marketing-test@example.test', '{"username":"marketing_test_930","dob":"1980-01-01"}');
update public.profiles set role = 'admin' where id = 'a9300000-0000-4000-8000-000000000001';

set local role anon;
select pg_temp.assert_true(public.record_marketing_attribution_visit(
  'a9300000-0000-4000-8000-000000000002', 'triggerfeed', 'plain-name', '/merch?utm_medium=in-feed-ad'
) is null, 'anon internal visit rejected');
select pg_temp.assert_true(public.record_marketing_attribution_visit(
  'a9300000-0000-4000-8000-000000000002', 'psa', 'business-card', '/friends?utm_medium=in-feed-ad'
) is null, 'medium independently rejects visit');
select pg_temp.assert_true(public.record_marketing_attribution_visit(
  'a9300000-0000-4000-8000-000000000003', 'psa-register', 'og-sticker', '/signup?source=psa-register&campaign=og-sticker'
) is not null, 'PSA QR recorded');
select pg_temp.assert_true(public.record_marketing_attribution_visit(
  'a9300000-0000-4000-8000-000000000004', 'sawmill', 'a9300000-0000-4000-8000-000000000005', '/signup?source=sawmill'
) is not null, 'external UUID campaign recorded');
reset role;
select pg_temp.assert_true(not exists(select from public.marketing_visitors where id = 'a9300000-0000-4000-8000-000000000002'), 'no internal first-touch visitor');

-- Simulate historical contamination on a visitor who also has an external visit.
insert into public.marketing_visits(visitor_id, source_id, landing_path)
values ('a9300000-0000-4000-8000-000000000003', public.get_or_create_marketing_source('triggerfeed'), '/merch?utm_medium=in-feed-ad');
insert into public.marketing_visits(visitor_id, source_id, landing_path)
values ('a9300000-0000-4000-8000-000000000003', public.get_or_create_marketing_source('psa'), '/profile?utm_medium=in-feed-ad');
update public.marketing_visits set created_at = '2099-01-02', converted_user_id = 'a9300000-0000-4000-8000-000000000001'
where visitor_id in ('a9300000-0000-4000-8000-000000000003', 'a9300000-0000-4000-8000-000000000004');

select set_config('request.jwt.claim.sub', 'a9300000-0000-4000-8000-000000000001', true);
set local role authenticated;
select pg_temp.assert_true((select visits = 2 and unique_visitors = 2 and registrations = 1 from public.get_marketing_attribution_totals('2099-01-01', '2099-01-03')), 'external-only totals with deduplicated registrations');
select pg_temp.assert_true((select count(*) = 2 and sum(visits) = 2 from public.get_marketing_attribution_summary('2099-01-01', '2099-01-03')), 'external-only summary');
select pg_temp.assert_true((select sum(visits) = 2 from public.get_marketing_device_breakdown('2099-01-01', '2099-01-03')), 'external-only device breakdown');
reset role;
select pg_temp.assert_true((select count(*) = 4 from public.marketing_visits where created_at = '2099-01-02'), 'historical rows retained');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.is_internal_ad_attribution(text,text)', 'EXECUTE'), 'helper not client-callable');

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $$
begin
  begin
    perform public.get_marketing_attribution_totals();
    raise exception 'FAIL: missing dashboard authorization';
  exception when raise_exception then
    if sqlerrm <> 'Admin permission required' then raise; end if;
  end;
end;
$$;
reset role;
rollback;
