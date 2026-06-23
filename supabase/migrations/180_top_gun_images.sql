begin;

alter table public.profile_top_guns
  add column if not exists image_cloudinary_secure_url text,
  add column if not exists image_width integer,
  add column if not exists image_height integer;

update public.profile_top_guns
set image_cloudinary_secure_url = image_cloudinary_url
where image_cloudinary_secure_url is null
  and image_cloudinary_url is not null;

alter table public.profile_top_guns
  drop constraint if exists profile_top_guns_image_url_check,
  drop constraint if exists profile_top_guns_image_secure_url_check,
  drop constraint if exists profile_top_guns_image_width_check,
  drop constraint if exists profile_top_guns_image_height_check;

alter table public.profile_top_guns
  add constraint profile_top_guns_image_url_check
    check (
      image_cloudinary_url is null
      or image_cloudinary_url like 'https://res.cloudinary.com/triggerfeed/%'
    ),
  add constraint profile_top_guns_image_secure_url_check
    check (
      image_cloudinary_secure_url is null
      or image_cloudinary_secure_url like 'https://res.cloudinary.com/triggerfeed/%'
    ),
  add constraint profile_top_guns_image_width_check
    check (image_width is null or image_width > 0),
  add constraint profile_top_guns_image_height_check
    check (image_height is null or image_height > 0);

commit;
