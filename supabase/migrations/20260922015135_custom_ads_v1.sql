-- First-party feed ads. No billing, targeting, or changes to marketing identity/auth.
begin;
create function public.ad_https_url_valid(p_url text) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(p_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
   and p_url !~ '[[:cntrl:]\\]' and length(p_url)<=2048,false);
$$;
revoke all on function public.ad_https_url_valid(text) from public;

create table public.ads (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 120),
 advertiser_name text not null check(length(btrim(advertiser_name)) between 1 and 120),
 advertiser_type text not null default 'house' check(advertiser_type in ('house','partner','paid')),
 status text not null default 'draft' check(status in ('draft','active','paused','ended')),
 destination_url text not null check(public.ad_https_url_valid(destination_url)),
 starts_at timestamptz, ends_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create index ads_delivery_idx on public.ads(status,starts_at,ends_at);
create table public.ad_creatives (
 id uuid primary key default gen_random_uuid(),
 ad_id uuid not null references public.ads(id) on delete cascade,
 headline text not null check(length(btrim(headline)) between 1 and 160),
 body text not null default '' check(length(body)<=1000),
 image_url text check(image_url is null or public.ad_https_url_valid(image_url)),
 call_to_action text not null default 'Learn more' check(length(btrim(call_to_action)) between 1 and 60),
 platform text not null default 'all' check(platform in ('all','web_desktop','web_mobile','android')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,ad_id)
);
create index ad_creatives_ad_platform_idx on public.ad_creatives(ad_id,platform);
create table public.ad_placements (
 id uuid primary key default gen_random_uuid(), ad_id uuid not null references public.ads(id) on delete cascade,
 placement text not null default 'feed' check(placement in ('feed')),
 frequency integer not null default 7 check(frequency between 6 and 8),
 weight integer not null default 1 check(weight between 1 and 100), enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(ad_id,placement)
);
-- Delivery tickets are capabilities, not impressions. They bind all event dimensions server-side.
create table public.ad_deliveries (
 id uuid primary key default gen_random_uuid(),
 ad_id uuid not null references public.ads(id) on delete cascade,
 creative_id uuid not null,
 user_id uuid references public.profiles(id) on delete set null,
 visitor_id uuid references public.marketing_visitors(id) on delete set null,
 platform text not null check(platform in ('web_desktop','web_mobile','android')),
 placement text not null check(placement in ('feed')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '1 day'),
 foreign key(creative_id,ad_id) references public.ad_creatives(id,ad_id) on delete cascade
);
create index ad_deliveries_created_idx on public.ad_deliveries(created_at);
create index ad_deliveries_ad_idx on public.ad_deliveries(ad_id);
create index ad_deliveries_creative_idx on public.ad_deliveries(creative_id,ad_id);
create index ad_deliveries_user_idx on public.ad_deliveries(user_id);
create index ad_deliveries_visitor_idx on public.ad_deliveries(visitor_id);
create table public.ad_impressions (
 id uuid primary key default gen_random_uuid(),
 delivery_id uuid not null unique references public.ad_deliveries(id) on delete cascade,
 ad_id uuid not null references public.ads(id) on delete cascade,
 creative_id uuid not null,
 user_id uuid references public.profiles(id) on delete set null,
 visitor_id uuid references public.marketing_visitors(id) on delete set null,
 platform text not null check(platform in ('web_desktop','web_mobile','android')),
 placement text not null check(placement in ('feed')),
 created_at timestamptz not null default now(),
 foreign key(creative_id,ad_id) references public.ad_creatives(id,ad_id) on delete cascade
);
create index ad_impressions_ad_created_idx on public.ad_impressions(ad_id,created_at);
create index ad_impressions_platform_created_idx on public.ad_impressions(platform,created_at);
create index ad_impressions_creative_idx on public.ad_impressions(creative_id,ad_id);
create index ad_impressions_user_idx on public.ad_impressions(user_id);
create index ad_impressions_visitor_idx on public.ad_impressions(visitor_id);
create table public.ad_clicks (
 id uuid primary key default gen_random_uuid(),
 delivery_id uuid not null unique references public.ad_deliveries(id) on delete cascade,
 ad_id uuid not null references public.ads(id) on delete cascade,
 creative_id uuid not null,
 user_id uuid references public.profiles(id) on delete set null,
 visitor_id uuid references public.marketing_visitors(id) on delete set null,
 platform text not null check(platform in ('web_desktop','web_mobile','android')),
 placement text not null check(placement in ('feed')),
 created_at timestamptz not null default now(),
 foreign key(creative_id,ad_id) references public.ad_creatives(id,ad_id) on delete cascade
);
create index ad_clicks_ad_created_idx on public.ad_clicks(ad_id,created_at);
create index ad_clicks_platform_created_idx on public.ad_clicks(platform,created_at);
create index ad_clicks_creative_idx on public.ad_clicks(creative_id,ad_id);
create index ad_clicks_user_idx on public.ad_clicks(user_id);
create index ad_clicks_visitor_idx on public.ad_clicks(visitor_id);
alter table public.ads enable row level security;
revoke all on public.ads from public,anon,authenticated;
grant select on public.ads to authenticated;
create policy ads_admin_read on public.ads for select to authenticated using(public.is_admin_or_above());
alter table public.ad_creatives enable row level security;
revoke all on public.ad_creatives from public,anon,authenticated;
grant select on public.ad_creatives to authenticated;
create policy ad_creatives_admin_read on public.ad_creatives for select to authenticated using(public.is_admin_or_above());
alter table public.ad_placements enable row level security;
revoke all on public.ad_placements from public,anon,authenticated;
grant select on public.ad_placements to authenticated;
create policy ad_placements_admin_read on public.ad_placements for select to authenticated using(public.is_admin_or_above());
alter table public.ad_deliveries enable row level security;
revoke all on public.ad_deliveries from public,anon,authenticated;
grant select on public.ad_deliveries to authenticated;
create policy ad_deliveries_admin_read on public.ad_deliveries for select to authenticated using(public.is_admin_or_above());
alter table public.ad_impressions enable row level security;
revoke all on public.ad_impressions from public,anon,authenticated;
grant select on public.ad_impressions to authenticated;
create policy ad_impressions_admin_read on public.ad_impressions for select to authenticated using(public.is_admin_or_above());
alter table public.ad_clicks enable row level security;
revoke all on public.ad_clicks from public,anon,authenticated;
grant select on public.ad_clicks to authenticated;
create policy ad_clicks_admin_read on public.ad_clicks for select to authenticated using(public.is_admin_or_above());

create function public.get_feed_ads(p_platform text, p_placement text default 'feed', p_limit integer default 8, p_visitor_id uuid default null)
returns table(delivery_id uuid,ad_id uuid,creative_id uuid,advertiser_name text,advertiser_type text,headline text,body text,image_url text,call_to_action text,destination_url text,platform text,placement text,frequency integer)
language plpgsql security definer set search_path=public as $$
declare chosen record; ticket uuid; visitor uuid; slot integer;
begin
 if p_platform is null or p_platform not in ('web_desktop','web_mobile','android') or p_placement is distinct from 'feed' then raise exception 'Invalid ad platform or placement'; end if;
 -- Reuse an existing marketing ID when available; never create a competing visitor.
 select v.id into visitor from public.marketing_visitors v where v.id=p_visitor_id;
 for slot in 1..least(greatest(coalesce(p_limit,8),0),8) loop
   select a.id as campaign_id,c.id as selected_creative,c.headline,c.body,c.image_url,c.call_to_action,
      a.destination_url,a.advertiser_name,a.advertiser_type,ap.frequency
   into chosen
   from public.ads a join public.ad_placements ap on ap.ad_id=a.id and ap.placement=p_placement and ap.enabled
   cross join lateral (select ac.* from public.ad_creatives ac where ac.ad_id=a.id and ac.platform in ('all',p_platform)
     order by (ac.platform=p_platform) desc,random() limit 1) c
   where a.status='active' and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
   order by -ln(greatest(random(),0.000001))/ap.weight limit 1;
   if not found then return; end if;
   insert into public.ad_deliveries(ad_id,creative_id,user_id,visitor_id,platform,placement)
   values(chosen.campaign_id,chosen.selected_creative,auth.uid(),visitor,p_platform,p_placement) returning id into ticket;
   return query select ticket,chosen.campaign_id,chosen.selected_creative,chosen.advertiser_name,chosen.advertiser_type,
     chosen.headline,chosen.body,chosen.image_url,chosen.call_to_action,chosen.destination_url,p_platform,p_placement,chosen.frequency;
 end loop;
end;
$$;
revoke all on function public.get_feed_ads(text,text,integer,uuid) from public;
grant execute on function public.get_feed_ads(text,text,integer,uuid) to anon,authenticated;

create function public.record_ad_event(p_delivery_id uuid,p_event text)
returns boolean language plpgsql security definer set search_path=public as $$
declare ticket public.ad_deliveries; inserted integer;
begin
 if p_event is null or p_event not in ('impression','click') then raise exception 'Invalid event'; end if;
 select d.* into ticket from public.ad_deliveries d where d.id=p_delivery_id and d.expires_at>now()
   and d.user_id is not distinct from auth.uid() for update;
 if not found then return false; end if;
 if not exists(select 1 from public.ads a join public.ad_placements ap on ap.ad_id=a.id
   join public.ad_creatives c on c.ad_id=a.id and c.id=ticket.creative_id and c.platform in ('all',ticket.platform)
   where a.id=ticket.ad_id and a.status='active' and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
    and ap.placement=ticket.placement and ap.enabled) then return false; end if;
 if p_event='impression' then
   insert into public.ad_impressions(delivery_id,ad_id,creative_id,user_id,visitor_id,platform,placement)
   values(ticket.id,ticket.ad_id,ticket.creative_id,ticket.user_id,ticket.visitor_id,ticket.platform,ticket.placement) on conflict(delivery_id) do nothing;
 else
   insert into public.ad_clicks(delivery_id,ad_id,creative_id,user_id,visitor_id,platform,placement)
   values(ticket.id,ticket.ad_id,ticket.creative_id,ticket.user_id,ticket.visitor_id,ticket.platform,ticket.placement) on conflict(delivery_id) do nothing;
 end if;
 get diagnostics inserted=row_count;
 return inserted>0;
end;
$$;
revoke all on function public.record_ad_event(uuid,text) from public;
grant execute on function public.record_ad_event(uuid,text) to anon,authenticated;

create function public.save_ad_campaign(p_ad jsonb,p_creative jsonb,p_placement jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare campaign uuid; creative uuid;
begin
 if auth.uid() is null or not public.is_admin_or_above() then raise exception 'Administrator required' using errcode='42501'; end if;
 campaign:=nullif(p_ad->>'id','')::uuid;
 if campaign is null then
   insert into public.ads(name,advertiser_name,advertiser_type,status,destination_url,starts_at,ends_at)
   values(p_ad->>'name',p_ad->>'advertiser_name',p_ad->>'advertiser_type',coalesce(p_ad->>'status','draft'),p_ad->>'destination_url',nullif(p_ad->>'starts_at','')::timestamptz,nullif(p_ad->>'ends_at','')::timestamptz)
   returning id into campaign;
 else
   update public.ads set name=p_ad->>'name',advertiser_name=p_ad->>'advertiser_name',advertiser_type=p_ad->>'advertiser_type',status=p_ad->>'status',
    destination_url=p_ad->>'destination_url',starts_at=nullif(p_ad->>'starts_at','')::timestamptz,ends_at=nullif(p_ad->>'ends_at','')::timestamptz,updated_at=now() where id=campaign;
   if not found then raise exception 'Campaign not found'; end if;
 end if;
 creative:=nullif(p_creative->>'id','')::uuid;
 if creative is null then
   insert into public.ad_creatives(ad_id,headline,body,image_url,call_to_action,platform)
   values(campaign,p_creative->>'headline',coalesce(p_creative->>'body',''),nullif(p_creative->>'image_url',''),p_creative->>'call_to_action',p_creative->>'platform');
 else
   update public.ad_creatives set headline=p_creative->>'headline',body=coalesce(p_creative->>'body',''),image_url=nullif(p_creative->>'image_url',''),
    call_to_action=p_creative->>'call_to_action',platform=p_creative->>'platform',updated_at=now() where id=creative and ad_id=campaign;
   if not found then raise exception 'Creative does not belong to this campaign'; end if;
 end if;
 insert into public.ad_placements(ad_id,placement,frequency,weight,enabled)
 values(campaign,'feed',coalesce((p_placement->>'frequency')::integer,7),coalesce((p_placement->>'weight')::integer,1),coalesce((p_placement->>'enabled')::boolean,true))
 on conflict(ad_id,placement) do update set frequency=excluded.frequency,weight=excluded.weight,enabled=excluded.enabled,updated_at=now();
 return campaign;
end;
$$;
revoke all on function public.save_ad_campaign(jsonb,jsonb,jsonb) from public;
grant execute on function public.save_ad_campaign(jsonb,jsonb,jsonb) to authenticated;

create function public.set_ad_status(p_ad_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_admin_or_above() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_status='active' and not exists(select 1 from public.ad_creatives where ad_id=p_ad_id) then raise exception 'Add a creative before activation'; end if;
 update public.ads set status=p_status,updated_at=now() where id=p_ad_id;
 if not found then raise exception 'Campaign not found'; end if;
end;
$$;
revoke all on function public.set_ad_status(uuid,text) from public;
grant execute on function public.set_ad_status(uuid,text) to authenticated;

create function public.get_admin_ads_dashboard()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare campaigns jsonb; summary jsonb;
begin
 if auth.uid() is null or not public.is_admin_or_above() then raise exception 'Administrator required' using errcode='42501'; end if;
 with impressions as(select ad_id,count(*) as total from public.ad_impressions group by ad_id),
 clicks as(select ad_id,count(*) as total from public.ad_clicks group by ad_id)
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('impressions',coalesce(i.total,0),'clicks',coalesce(c.total,0),
 'creatives',(select coalesce(jsonb_agg(to_jsonb(ac) order by ac.created_at),'[]') from public.ad_creatives ac where ac.ad_id=a.id),
 'feed_placement',(select to_jsonb(ap) from public.ad_placements ap where ap.ad_id=a.id and ap.placement='feed')) order by a.created_at desc),'[]')
 into campaigns from public.ads a left join impressions i on i.ad_id=a.id left join clicks c on c.ad_id=a.id;
 select jsonb_build_object('active_campaigns',(select count(*) from public.ads where status='active' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())),
 'impressions',count(*),'clicks',(select count(*) from public.ad_clicks),
 'web_desktop',count(*) filter(where platform='web_desktop'),'web_mobile',count(*) filter(where platform='web_mobile'),'android',count(*) filter(where platform='android'))
 into summary from public.ad_impressions;
 return jsonb_build_object('campaigns',campaigns,'summary',summary);
end;
$$;
revoke all on function public.get_admin_ads_dashboard() from public;
grant execute on function public.get_admin_ads_dashboard() to authenticated;

-- Existing merch destination and existing image assets, prepared as reviewable drafts.
do $$
declare shirt uuid; stickers uuid;
begin
 insert into public.ads(name,advertiser_name,advertiser_type,destination_url) values('TriggerFeed Shirt','TriggerFeed','house','https://triggerfeed.com/merch') returning id into shirt;
 insert into public.ads(name,advertiser_name,advertiser_type,destination_url) values('TriggerFeed Stickers','TriggerFeed','house','https://triggerfeed.com/merch') returning id into stickers;
 insert into public.ad_creatives(ad_id,headline,body,image_url,call_to_action) values
 (shirt,'Train. Carry. Stay ready.','Rep TriggerFeed.','https://triggerfeed.com/images/merch/classic-tf-shirt.jpg','Shop Shirt'),
 (stickers,'TriggerFeed Stickers','Put TriggerFeed somewhere it probably doesn''t belong.','https://triggerfeed.com/images/merch/classic-tf-stickers.jpg','Get Stickers');
 insert into public.ad_placements(ad_id) values(shirt),(stickers);
end;
$$;
commit;
