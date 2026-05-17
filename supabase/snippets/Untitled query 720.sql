select
  id,
  post_id,
  user_id,
  media_type,
  provider,
  source,
  external_id,
  external_url,
  thumbnail_url,
  title
from public.post_media
where post_id = 'f2d25565-70e6-437c-97ba-b5abf64b6c49';