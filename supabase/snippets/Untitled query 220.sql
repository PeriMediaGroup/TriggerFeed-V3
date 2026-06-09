select
  id,
  post_id,
  user_id,
  media_type,
  provider,
  source,
  cloudinary_url,
  cloudinary_secure_url,
  cloudinary_public_id,
  external_url,
  thumbnail_url,
  width,
  height,
  sort_order,
  display_order,
  created_at
from public.post_media
where post_id = 'bbf4ae63-f31b-4433-ae1b-ea44959327f2'
order by sort_order asc, display_order asc, created_at asc;