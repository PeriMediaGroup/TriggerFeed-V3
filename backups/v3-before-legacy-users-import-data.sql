SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict aLOQmnSU6QglGyv4nBVpxHb6olZWhKEb43Q2m2gkESVi0cWqNfr3C3CVZ5C9gu6

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") VALUES
	('1bc919b1-d433-4961-be82-0eb032fcec91', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'dbba1264-6c5b-41ca-9ca5-537a8cc82d73', 's256', '1Md7Wy7EFlK98RqI3znuEAV8tm_2FRkr7JBI40u-94c', 'email', '', '', '2026-06-25 14:37:12.16922+00', '2026-06-25 14:37:59.655774+00', 'email/signup', '2026-06-25 14:37:59.6557+00', NULL, NULL, NULL, NULL, false),
	('92943770-d684-4571-943f-c9fb115b86d2', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'c4a974fd-f98a-4d3c-97a4-6f8a5c752f3f', 's256', 'LKWlYofud4g_okyyfJ9UK5ByTReH-x8HEot5aMGjcsI', 'email', '', '', '2026-06-25 15:15:54.65772+00', '2026-06-25 15:16:12.405788+00', 'email/signup', '2026-06-25 15:16:12.405735+00', NULL, NULL, NULL, NULL, false);


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'd7926f2a-711b-42f5-a0b9-11de2aa18793', 'authenticated', 'authenticated', 'test_0@triggerfeed.com', '$2a$10$ml7aFCe7KLfhn9zjwT4tG.UoobuDCpG2C5fW4VE0xvbmlKUJa3idu', '2026-06-25 15:43:16.642313+00', NULL, '', '2026-06-25 15:42:36.736646+00', '', NULL, '', '', NULL, '2026-06-25 15:43:17.025705+00', '{"provider": "email", "providers": ["email"]}', '{"dob": "1970-08-19", "sub": "d7926f2a-711b-42f5-a0b9-11de2aa18793", "email": "test_0@triggerfeed.com", "email_verified": true, "phone_verified": false, "age_gate_version": "v1", "birthday_messages_enabled": true}', NULL, '2026-06-25 15:42:36.684951+00', '2026-06-25 15:43:17.036652+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'authenticated', 'authenticated', 'test_1@triggerfeed.com', '$2a$10$o64nPUHXDbnXMjx8hFyWUeJgIQR4L7smwd.jjYd6Vl1IJOAVo7h.S', '2026-06-25 15:16:12.400762+00', NULL, '', '2026-06-25 15:15:54.669527+00', '', NULL, '', '', NULL, '2026-06-25 15:50:15.346038+00', '{"provider": "email", "providers": ["email"]}', '{"dob": "1970-08-19", "sub": "a0466339-37cd-465f-a017-9583a4ad65ff", "email": "test_1@triggerfeed.com", "email_verified": true, "phone_verified": false, "age_gate_version": "v1", "birthday_messages_enabled": true}', NULL, '2026-06-25 15:15:54.582757+00', '2026-06-25 15:50:15.383807+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'authenticated', 'authenticated', 'test@triggerfeed.com', '$2a$10$2p.gT.2AsyTa8FN9wQLv0OZeSFgRVfdGkfRV3AUt7CwfcmnG048Bm', '2026-06-25 14:37:59.643296+00', NULL, '', '2026-06-25 14:37:12.174488+00', '', NULL, '', '', NULL, '2026-06-25 15:50:50.204417+00', '{"provider": "email", "providers": ["email"]}', '{"dob": "1970-08-19", "sub": "00f0d3a1-931e-4148-8cb5-eda0502f0350", "email": "test@triggerfeed.com", "email_verified": true, "phone_verified": false, "age_gate_version": "v1", "birthday_messages_enabled": true}', NULL, '2026-06-25 14:37:12.150841+00', '2026-06-25 15:50:50.224507+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('00f0d3a1-931e-4148-8cb5-eda0502f0350', '00f0d3a1-931e-4148-8cb5-eda0502f0350', '{"dob": "1970-08-19", "sub": "00f0d3a1-931e-4148-8cb5-eda0502f0350", "email": "test@triggerfeed.com", "email_verified": true, "phone_verified": false, "age_gate_version": "v1", "birthday_messages_enabled": true}', 'email', '2026-06-25 14:37:12.166404+00', '2026-06-25 14:37:12.166451+00', '2026-06-25 14:37:12.166451+00', 'dcc31ffe-837c-4b19-bd0f-abecd0dea6d5'),
	('a0466339-37cd-465f-a017-9583a4ad65ff', 'a0466339-37cd-465f-a017-9583a4ad65ff', '{"dob": "1970-08-19", "sub": "a0466339-37cd-465f-a017-9583a4ad65ff", "email": "test_1@triggerfeed.com", "email_verified": true, "phone_verified": false, "age_gate_version": "v1", "birthday_messages_enabled": true}', 'email', '2026-06-25 15:15:54.646523+00', '2026-06-25 15:15:54.646573+00', '2026-06-25 15:15:54.646573+00', '726126d6-c3d8-435f-bfd4-79447d005888'),
	('d7926f2a-711b-42f5-a0b9-11de2aa18793', 'd7926f2a-711b-42f5-a0b9-11de2aa18793', '{"dob": "1970-08-19", "sub": "d7926f2a-711b-42f5-a0b9-11de2aa18793", "email": "test_0@triggerfeed.com", "email_verified": true, "phone_verified": false, "age_gate_version": "v1", "birthday_messages_enabled": true}', 'email', '2026-06-25 15:42:36.722214+00', '2026-06-25 15:42:36.72226+00', '2026-06-25 15:42:36.72226+00', '5673d636-6bc7-4af5-a5b9-fc2c5bb012fe');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('5b645b9c-302e-49b5-8c44-160e6640ddd8', '00f0d3a1-931e-4148-8cb5-eda0502f0350', '2026-06-25 15:50:50.206769+00', '2026-06-25 15:50:50.206769+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0', '50.36.55.106', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('5b645b9c-302e-49b5-8c44-160e6640ddd8', '2026-06-25 15:50:50.225011+00', '2026-06-25 15:50:50.225011+00', 'password', '95f77c4d-4c29-4232-b7de-742cdcab9f98');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 109, 'vbjtko6hor3k', '00f0d3a1-931e-4148-8cb5-eda0502f0350', false, '2026-06-25 15:50:50.22291+00', '2026-06-25 15:50:50.22291+00', NULL, '5b645b9c-302e-49b5-8c44-160e6640ddd8');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: user_rank_thresholds; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_rank_thresholds" ("key", "label", "min_posts", "sort_order", "is_active", "created_at", "updated_at") VALUES
	('FNG', 'FNG', 0, 10, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('range_regular', 'Range Regular', 5, 20, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('trailhand', 'Trailhand', 15, 30, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('camp_builder', 'Camp Builder', 30, 40, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('brass_stacker', 'Brass Stacker', 50, 50, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('gear_hound', 'Gear Hound', 75, 60, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('readiness_regular', 'Readiness Regular', 100, 70, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('signal_fire', 'Signal Fire', 150, 80, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('trail_boss', 'Trail Boss', 250, 90, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00'),
	('brass_baron', 'Brass Baron', 500, 100, true, '2026-06-25 14:17:26.478327+00', '2026-06-25 14:17:26.478327+00');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "email", "username", "username_lower", "display_name", "first_name", "last_name", "city", "state", "bio", "dob", "age_verified_at", "age_gate_version", "birthday_messages_enabled", "avatar_cloudinary_url", "avatar_cloudinary_public_id", "banner_cloudinary_url", "banner_cloudinary_public_id", "role", "profile_badge", "is_banned", "is_muted", "is_deleted", "privacy_settings", "created_at", "updated_at", "last_seen_rank_key", "last_seen_rank_at") VALUES
	('00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test@triggerfeed.com', 'TF_One', 'tf_one', NULL, NULL, NULL, NULL, NULL, NULL, '1970-08-19', '2026-06-25 14:37:12.149804+00', 'v1', true, 'https://res.cloudinary.com/triggerfeed/image/upload/v1782400473/triggerfeed-v3/profiles/00f0d3a1-931e-4148-8cb5-eda0502f0350/avatar/current.png', 'triggerfeed-v3/profiles/00f0d3a1-931e-4148-8cb5-eda0502f0350/avatar/current', 'https://res.cloudinary.com/triggerfeed/image/upload/v1782400465/triggerfeed-v3/profiles/00f0d3a1-931e-4148-8cb5-eda0502f0350/banner/current.png', 'triggerfeed-v3/profiles/00f0d3a1-931e-4148-8cb5-eda0502f0350/banner/current', 'ceo', NULL, false, false, false, '{"profile_visibility": {"show_age": false, "show_city": false, "show_email": false, "show_state": false, "show_real_name": false}}', '2026-06-25 14:37:12.149804+00', '2026-06-25 15:14:34.591682+00', NULL, NULL),
	('d7926f2a-711b-42f5-a0b9-11de2aa18793', 'test_0@triggerfeed.com', 'Test_0', 'test_0', NULL, NULL, NULL, NULL, NULL, NULL, '1970-08-19', '2026-06-25 15:42:36.684579+00', 'v1', true, NULL, NULL, NULL, NULL, 'user', NULL, false, false, false, '{"profile_visibility": {"show_age": false, "show_city": false, "show_email": false, "show_state": false, "show_real_name": false}}', '2026-06-25 15:42:36.684579+00', '2026-06-25 15:43:28.608377+00', NULL, NULL),
	('a0466339-37cd-465f-a017-9583a4ad65ff', 'test_1@triggerfeed.com', 'Not_Real', 'not_real', NULL, NULL, NULL, NULL, NULL, NULL, '1970-08-19', '2026-06-25 15:15:54.579794+00', 'v1', true, NULL, NULL, NULL, NULL, 'moderator', NULL, false, false, false, '{"profile_visibility": {"show_city": true, "show_email": true, "show_state": true, "show_birthday": true, "show_real_name": true}}', '2026-06-25 15:15:54.579794+00', '2026-06-25 15:50:03.139816+00', NULL, NULL);


--
-- Data for Name: abuse_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: auth_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."auth_events" ("id", "user_id", "email", "event_type", "success", "error_code", "error_message", "metadata", "created_at") VALUES
	('dddb55ae-d48d-4967-91ee-692f185b2ac2', NULL, 'test@triggerfeed.com', 'signup_started', true, NULL, NULL, '{"source": "signup_page", "age_gate_version": "v1"}', '2026-06-25 14:33:03.874224+00'),
	('30d88341-eff0-4395-9953-1ba52f665be9', NULL, 'test@triggerfeed.com', 'signup_success', true, NULL, NULL, '{"source": "signup_page", "auth_user_id": "d0e432af-95eb-4c23-bdf7-7c89665d9f88", "age_gate_version": "v1", "needs_email_confirmation": false}', '2026-06-25 14:33:04.461911+00'),
	('201b1e5f-b0f0-440f-9eb8-89acd550d250', NULL, 'test@triggerfeed.com', 'signup_started', true, NULL, NULL, '{"source": "signup_page", "age_gate_version": "v1"}', '2026-06-25 14:37:11.947851+00'),
	('d9bfbaba-7068-44b2-ae08-24695a59ad43', NULL, 'test@triggerfeed.com', 'signup_success', true, NULL, NULL, '{"source": "signup_page", "auth_user_id": "00f0d3a1-931e-4148-8cb5-eda0502f0350", "age_gate_version": "v1", "needs_email_confirmation": true}', '2026-06-25 14:37:12.599688+00'),
	('860136b4-e444-4bd6-819c-9a16d03052ae', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 14:53:44.228734+00'),
	('ca56d314-2d12-476d-9604-c64c580f7ed5', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test@triggerfeed.com', 'onboarding_completed', true, NULL, NULL, '{"source": "onboarding_page"}', '2026-06-25 14:53:57.282065+00'),
	('26d03a58-7b27-45a0-9a51-dbe67beaa258', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 14:57:39.24299+00'),
	('09e29879-9b69-44e1-a007-56c9d988a36a', NULL, 'test_1@triggerfeed.com', 'signup_started', true, NULL, NULL, '{"source": "signup_page", "age_gate_version": "v1"}', '2026-06-25 15:15:54.388308+00'),
	('0093ac5c-17df-445b-ad43-251984040571', NULL, 'test_1@triggerfeed.com', 'signup_success', true, NULL, NULL, '{"source": "signup_page", "auth_user_id": "a0466339-37cd-465f-a017-9583a4ad65ff", "age_gate_version": "v1", "needs_email_confirmation": true}', '2026-06-25 15:15:54.999705+00'),
	('f2a9eabb-b8ca-42ea-83de-9dc8b545e649', NULL, 'test_0@triggerfeed.com', 'signup_started', true, NULL, NULL, '{"source": "signup_page", "age_gate_version": "v1"}', '2026-06-25 15:21:26.092595+00'),
	('ca026659-12f1-4dff-8fec-2a96c0ca4ed7', NULL, 'test_0@triggerfeed.com', 'signup_failed', false, 'over_email_send_rate_limit', 'email rate limit exceeded', '{"source": "signup_page", "age_gate_version": "v1"}', '2026-06-25 15:21:26.329068+00'),
	('34cbcaeb-907a-45d3-8f79-288f47502f6b', NULL, 'test_0@triggerfeed.com', 'signup_started', true, NULL, NULL, '{"source": "signup_page", "age_gate_version": "v1"}', '2026-06-25 15:23:33.757934+00'),
	('9de016d7-22aa-402a-a5bc-1dd2932af331', NULL, 'test_0@triggerfeed.com', 'signup_failed', false, 'over_email_send_rate_limit', 'email rate limit exceeded', '{"source": "signup_page", "age_gate_version": "v1"}', '2026-06-25 15:23:34.042335+00'),
	('2160346e-d3ee-4492-bfc9-a286c918ef35', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'test_1@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 15:26:10.266077+00'),
	('f5904212-6b00-4a80-b9ee-766980f9d36e', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'test_1@triggerfeed.com', 'onboarding_completed', true, NULL, NULL, '{"source": "onboarding_page"}', '2026-06-25 15:26:18.869529+00'),
	('75ce0700-2de4-489f-9744-908b1427d5c8', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 15:27:38.132283+00'),
	('01c6a4c3-f3eb-4985-831d-50da7e8213f4', NULL, 'test_0@triggerfeed.com', 'signup_started', true, NULL, NULL, '{"source": "signup_page", "age_gate_version": "v1"}', '2026-06-25 15:42:36.432689+00'),
	('1eb8cc4e-3531-49ca-baf8-379247b40dfd', NULL, 'test_0@triggerfeed.com', 'signup_success', true, NULL, NULL, '{"source": "signup_page", "auth_user_id": "d7926f2a-711b-42f5-a0b9-11de2aa18793", "age_gate_version": "v1", "needs_email_confirmation": true}', '2026-06-25 15:42:37.124121+00'),
	('c10add8b-658e-4935-9d4b-823cedabc903', 'd7926f2a-711b-42f5-a0b9-11de2aa18793', 'test_0@triggerfeed.com', 'onboarding_completed', true, NULL, NULL, '{"source": "onboarding_page"}', '2026-06-25 15:43:28.676198+00'),
	('e6d6e26b-fae7-41ea-b010-3fa42666de0c', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'test_1@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 15:44:16.742695+00'),
	('50b39a7e-19d3-43a5-9950-ab20d7bb5cfc', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 15:44:36.704554+00'),
	('ed618dbf-9cb2-44ed-9b62-61bcdd9f09c2', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'test_1@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 15:45:02.788873+00'),
	('148117ed-7032-4cb5-be47-8383d4595701', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'test_1@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 15:50:15.66331+00'),
	('98bcfbdf-ee6b-466e-af36-407475638521', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test@triggerfeed.com', 'login_success', true, NULL, NULL, '{"source": "login_page"}', '2026-06-25 15:50:50.302498+00');


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."posts" ("id", "user_id", "title", "body", "visibility", "is_deleted", "deleted_at", "created_at", "updated_at", "is_sticky", "sticky_at", "sticky_by", "removed_at", "removed_by", "removal_reason", "restored_at", "restored_by") VALUES
	('9887bf93-93a4-4ebb-83e3-ccce5b4b3752', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'testing', 'This is a test MF''r', 'public', false, NULL, '2026-06-25 14:58:58.232665+00', '2026-06-25 14:58:58.232665+00', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('d80eee7b-a8c4-4276-b4d3-837df242af54', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test image', 'But I didn''t today!', 'public', true, '2026-06-25 15:07:27.622809+00', '2026-06-25 15:00:11.324045+00', '2026-06-25 15:07:27.622809+00', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('e739e044-d7da-44b5-8e04-9ba701dea825', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test', 'image', 'public', false, NULL, '2026-06-25 15:07:59.437374+00', '2026-06-25 15:07:59.437374+00', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('ded7bd5b-e3f0-4890-a71b-8a2e500734e5', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'test', 'Video', 'public', true, '2026-06-25 15:11:52.910221+00', '2026-06-25 15:08:37.936215+00', '2026-06-25 15:11:52.910221+00', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('01ad608c-8268-4d05-8d30-4e8c586266b9', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'Video', 'Mag dump?', 'public', false, NULL, '2026-06-25 15:12:22.609756+00', '2026-06-25 15:12:22.609756+00', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('6bf036b7-a183-4520-b109-9d5f14a51c1b', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'hello world', '💀', 'public', false, NULL, '2026-06-25 15:13:10.455773+00', '2026-06-25 15:13:10.455773+00', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('288adc69-bbea-4abf-a292-c278cf86888a', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'Fuck you', 'You fucking fuck.', 'public', true, '2026-06-25 15:27:58.450646+00', '2026-06-25 15:27:05.872271+00', '2026-06-25 15:27:58.450646+00', false, NULL, NULL, '2026-06-25 15:27:58.450646+00', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'Cuz it''s a test', NULL, NULL),
	('eab57e78-3792-4224-8f9f-84ac38b01da5', 'd7926f2a-711b-42f5-a0b9-11de2aa18793', 'Hi there', 'I am not a real user?', 'public', false, NULL, '2026-06-25 15:43:59.943605+00', '2026-06-25 15:43:59.943605+00', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('99c28024-052d-45bc-8e91-9d9e563b8fcb', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'Nope...', 'No hello world here!', 'public', false, NULL, '2026-06-25 15:46:38.352432+00', '2026-06-25 15:46:38.352432+00', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."comments" ("id", "post_id", "user_id", "parent_comment_id", "body", "is_deleted", "deleted_at", "created_at", "updated_at") VALUES
	('4e2c1c98-a7af-4090-a8dd-f64b1275f77a', '9887bf93-93a4-4ebb-83e3-ccce5b4b3752', '00f0d3a1-931e-4148-8cb5-eda0502f0350', NULL, 'this is a comment', false, NULL, '2026-06-25 14:59:07.257339+00', '2026-06-25 14:59:07.257339+00');


--
-- Data for Name: friends; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."friends" ("id", "requester_id", "addressee_id", "status", "created_at", "updated_at") VALUES
	('33340f35-3347-4619-9673-5c1fb3faf21b', 'a0466339-37cd-465f-a017-9583a4ad65ff', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'accepted', '2026-06-25 15:15:54.579794+00', '2026-06-25 15:15:54.579794+00'),
	('5d633a60-a9f9-4443-bddc-35c86bde269d', 'd7926f2a-711b-42f5-a0b9-11de2aa18793', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'accepted', '2026-06-25 15:42:36.684579+00', '2026-06-25 15:42:36.684579+00');


--
-- Data for Name: post_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."post_reports" ("id", "post_id", "reporter_id", "reason", "details", "status", "reviewed_by", "reviewed_at", "created_at", "updated_at") VALUES
	('53dca6ed-f486-4513-ba1a-03a8bebddfe7', '288adc69-bbea-4abf-a292-c278cf86888a', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'threats', 'Testing this shit out', 'post_removed', '00f0d3a1-931e-4148-8cb5-eda0502f0350', '2026-06-25 15:27:58.450646+00', '2026-06-25 15:27:21.746354+00', '2026-06-25 15:27:58.450646+00'),
	('6c910fe7-6900-4f4c-a52e-2af0d6dd0e43', 'eab57e78-3792-4224-8f9f-84ac38b01da5', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'other', 'Just testing things out.', 'dismissed', '00f0d3a1-931e-4148-8cb5-eda0502f0350', '2026-06-25 15:51:10.41129+00', '2026-06-25 15:45:18.724214+00', '2026-06-25 15:51:10.41129+00');


--
-- Data for Name: moderation_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."moderation_actions" ("id", "target_user_id", "actor_user_id", "related_post_id", "related_report_id", "action_type", "reason", "message", "expires_at", "created_at", "metadata") VALUES
	('d181738b-e9f2-414a-aede-b32879c30ad4', 'a0466339-37cd-465f-a017-9583a4ad65ff', '00f0d3a1-931e-4148-8cb5-eda0502f0350', '288adc69-bbea-4abf-a292-c278cf86888a', '53dca6ed-f486-4513-ba1a-03a8bebddfe7', 'remove_post', 'Cuz it''s a test', NULL, NULL, '2026-06-25 15:27:58.450646+00', '{}'),
	('a6829815-7c9d-49b7-ab05-ebfa69505a46', 'd7926f2a-711b-42f5-a0b9-11de2aa18793', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'eab57e78-3792-4224-8f9f-84ac38b01da5', '6c910fe7-6900-4f4c-a52e-2af0d6dd0e43', 'escalate_report', 'I am not sure about this', NULL, NULL, '2026-06-25 15:50:33.708479+00', '{"status": "escalated"}'),
	('53ea52b2-14b6-4043-9f4a-bc3562807a03', 'd7926f2a-711b-42f5-a0b9-11de2aa18793', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'eab57e78-3792-4224-8f9f-84ac38b01da5', '6c910fe7-6900-4f4c-a52e-2af0d6dd0e43', 'dismiss_report', 'no issue with this, all good', NULL, NULL, '2026-06-25 15:51:10.41129+00', '{"status": "dismissed"}');


--
-- Data for Name: moderation_events; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."notification_settings" ("user_id", "mentions_enabled", "comments_enabled", "friend_requests_enabled", "friend_accepts_enabled", "created_at", "updated_at") VALUES
	('00f0d3a1-931e-4148-8cb5-eda0502f0350', true, true, true, true, '2026-06-25 14:37:12.149804+00', '2026-06-25 14:37:12.149804+00'),
	('a0466339-37cd-465f-a017-9583a4ad65ff', true, true, true, true, '2026-06-25 15:15:54.579794+00', '2026-06-25 15:15:54.579794+00'),
	('d7926f2a-711b-42f5-a0b9-11de2aa18793', true, true, true, true, '2026-06-25 15:42:36.684579+00', '2026-06-25 15:42:36.684579+00');


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: polls; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."polls" ("id", "post_id", "question", "allows_multiple", "created_at", "updated_at") VALUES
	('07983c7e-270b-4997-bb6e-60c3873a3c57', 'eab57e78-3792-4224-8f9f-84ac38b01da5', 'Am I real?', false, '2026-06-25 15:43:59.943605+00', '2026-06-25 15:43:59.943605+00');


--
-- Data for Name: poll_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."poll_options" ("id", "poll_id", "option_text", "display_order", "created_at") VALUES
	('7579ad99-6499-4652-a1d5-6768e1e92637', '07983c7e-270b-4997-bb6e-60c3873a3c57', 'Yes', 0, '2026-06-25 15:43:59.943605+00'),
	('0090e781-ab8d-48ca-8017-0c8f34847bc7', '07983c7e-270b-4997-bb6e-60c3873a3c57', 'No', 1, '2026-06-25 15:43:59.943605+00');


--
-- Data for Name: poll_responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."poll_responses" ("id", "poll_id", "option_id", "user_id", "created_at") VALUES
	('bb8a03c9-9e44-4731-b8d9-ac7c010afe4e', '07983c7e-270b-4997-bb6e-60c3873a3c57', '0090e781-ab8d-48ca-8017-0c8f34847bc7', 'a0466339-37cd-465f-a017-9583a4ad65ff', '2026-06-25 15:44:19.014358+00'),
	('028d9cfa-7e62-4d6f-8209-e090e42f28ba', '07983c7e-270b-4997-bb6e-60c3873a3c57', '0090e781-ab8d-48ca-8017-0c8f34847bc7', '00f0d3a1-931e-4148-8cb5-eda0502f0350', '2026-06-25 15:44:39.187889+00');


--
-- Data for Name: post_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."post_audit_logs" ("id", "post_id", "user_id", "event_type", "success", "error_code", "error_message", "metadata", "created_at") VALUES
	('77e2c095-ffe4-44c4-8c42-efeb5394fe79', '9887bf93-93a4-4ebb-83e3-ccce5b4b3752', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": false, "has_poll": false}', '2026-06-25 14:58:58.281653+00'),
	('b72fb722-5f48-43ec-9719-e457d64a68ab', 'd80eee7b-a8c4-4276-b4d3-837df242af54', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": false, "has_poll": false}', '2026-06-25 15:00:11.370779+00'),
	('4f3831a6-0e2f-4f0d-a251-f44c3a551f22', 'e739e044-d7da-44b5-8e04-9ba701dea825', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": false, "has_poll": false}', '2026-06-25 15:07:59.487405+00'),
	('ac6f698d-17d1-4319-98db-eb2a8354fd96', 'ded7bd5b-e3f0-4890-a71b-8a2e500734e5', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": false, "has_poll": false}', '2026-06-25 15:08:37.990697+00'),
	('9796483c-c052-40e7-969b-55d708376bd3', '01ad608c-8268-4d05-8d30-4e8c586266b9', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": false, "has_poll": false}', '2026-06-25 15:12:22.672146+00'),
	('f3277dab-a942-49c6-9090-3b84c111dcad', '6bf036b7-a183-4520-b109-9d5f14a51c1b', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": true, "has_poll": false}', '2026-06-25 15:13:10.50919+00'),
	('b5b05f92-1ae2-43df-80f0-c4a65e007e61', '288adc69-bbea-4abf-a292-c278cf86888a', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": false, "has_poll": false}', '2026-06-25 15:27:05.971329+00'),
	('94ee6f7e-bc13-4f9d-b68e-f4e6a6b20000', 'eab57e78-3792-4224-8f9f-84ac38b01da5', 'd7926f2a-711b-42f5-a0b9-11de2aa18793', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": false, "has_poll": true}', '2026-06-25 15:44:00.028906+00'),
	('5b2adf80-9261-40fa-a832-5b8bc5ef135a', '99c28024-052d-45bc-8e91-9d9e563b8fcb', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'post_create_success', true, NULL, NULL, '{"source": "createPost", "has_gif": false, "has_poll": false}', '2026-06-25 15:46:38.38948+00');


--
-- Data for Name: post_media; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."post_media" ("id", "post_id", "user_id", "media_type", "provider", "source", "cloudinary_url", "cloudinary_secure_url", "cloudinary_public_id", "external_id", "external_url", "thumbnail_url", "title", "original_filename", "mime_type", "file_size_bytes", "width", "height", "format", "alt_text", "sort_order", "display_order", "created_at") VALUES
	('31076f84-6bc6-4c10-8e72-e651a8a44668', 'e739e044-d7da-44b5-8e04-9ba701dea825', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'image', 'cloudinary', NULL, 'https://res.cloudinary.com/triggerfeed/image/upload/v1782400080/triggerfeed/posts/00f0d3a1-931e-4148-8cb5-eda0502f0350/e739e044-d7da-44b5-8e04-9ba701dea825/Screenshot_2025-04-23_235031_fwpxs5.png', 'https://res.cloudinary.com/triggerfeed/image/upload/v1782400080/triggerfeed/posts/00f0d3a1-931e-4148-8cb5-eda0502f0350/e739e044-d7da-44b5-8e04-9ba701dea825/Screenshot_2025-04-23_235031_fwpxs5.png', 'triggerfeed/posts/00f0d3a1-931e-4148-8cb5-eda0502f0350/e739e044-d7da-44b5-8e04-9ba701dea825/Screenshot_2025-04-23_235031_fwpxs5', NULL, NULL, NULL, NULL, 'Screenshot 2025-04-23 235031.png', 'image/png', 373985, 622, 494, 'png', NULL, 0, 0, '2026-06-25 15:08:01.396783+00'),
	('b519513d-40ff-4a66-86fd-10cde195fa8b', '01ad608c-8268-4d05-8d30-4e8c586266b9', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'video', 'cloudinary', NULL, 'https://res.cloudinary.com/triggerfeed/video/upload/v1782400344/triggerfeed/posts/00f0d3a1-931e-4148-8cb5-eda0502f0350/01ad608c-8268-4d05-8d30-4e8c586266b9/upload_w4ariw_s2hk3p.mp4', 'https://res.cloudinary.com/triggerfeed/video/upload/v1782400344/triggerfeed/posts/00f0d3a1-931e-4148-8cb5-eda0502f0350/01ad608c-8268-4d05-8d30-4e8c586266b9/upload_w4ariw_s2hk3p.mp4', 'triggerfeed/posts/00f0d3a1-931e-4148-8cb5-eda0502f0350/01ad608c-8268-4d05-8d30-4e8c586266b9/upload_w4ariw_s2hk3p', NULL, NULL, NULL, NULL, 'upload_w4ariw.mp4', 'video/mp4', 35055831, 1080, 1920, 'mp4', NULL, 0, 0, '2026-06-25 15:12:26.24849+00'),
	('81ff7f7b-d219-42ad-9e96-9fcc2be06be8', '6bf036b7-a183-4520-b109-9d5f14a51c1b', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'gif', 'giphy', 'giphy', NULL, NULL, NULL, 'OuQmhmAAdJFLi', 'https://media2.giphy.com/media/v1.Y2lkPWEzYWEyMDUzdGJ6ODdlYWNwdGR5aW4ydjd5M2R4dHgyeHRqYW94bndkODQzem85ZiZlcD12MV9naWZzX3RyZW5kaW5nJmN0PWc/OuQmhmAAdJFLi/giphy.gif', 'https://media2.giphy.com/media/v1.Y2lkPWEzYWEyMDUzdGJ6ODdlYWNwdGR5aW4ydjd5M2R4dHgyeHRqYW94bndkODQzem85ZiZlcD12MV9naWZzX3RyZW5kaW5nJmN0PWc/OuQmhmAAdJFLi/100w.gif', 'kisses feel GIF', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-06-25 15:13:10.455773+00');


--
-- Data for Name: post_votes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."post_votes" ("id", "post_id", "user_id", "vote_type", "created_at", "updated_at") VALUES
	('4362afef-c1df-4af4-9437-97daaa697620', 'e739e044-d7da-44b5-8e04-9ba701dea825', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'upvote', '2026-06-25 15:08:07.598556+00', '2026-06-25 15:08:07.598556+00'),
	('4e219dbc-7ba9-4ebf-b542-474d63b64023', 'ded7bd5b-e3f0-4890-a71b-8a2e500734e5', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'downvote', '2026-06-25 15:10:46.033019+00', '2026-06-25 15:10:46.033019+00'),
	('8ca20968-5d91-4254-82ef-8aa5f2ca3988', '6bf036b7-a183-4520-b109-9d5f14a51c1b', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 'upvote', '2026-06-25 15:13:24.451001+00', '2026-06-25 15:13:24.451001+00');


--
-- Data for Name: profile_top_friends; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profile_top_friends" ("id", "user_id", "friend_user_id", "display_order", "created_at", "updated_at") VALUES
	('d86871ac-b178-43a0-a28d-bb1f57cc84ae', 'a0466339-37cd-465f-a017-9583a4ad65ff', '00f0d3a1-931e-4148-8cb5-eda0502f0350', 0, '2026-06-25 15:45:37.043882+00', '2026-06-25 15:45:37.043882+00');


--
-- Data for Name: profile_top_guns; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profile_top_guns" ("id", "user_id", "name", "description", "image_cloudinary_url", "image_cloudinary_public_id", "display_order", "created_at", "updated_at", "image_cloudinary_secure_url", "image_width", "image_height") VALUES
	('9f0912c5-4fdc-48e6-a14d-13a9c80900ad', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'BB', NULL, 'https://res.cloudinary.com/triggerfeed/image/upload/v1782402361/triggerfeed/guns/a0466339-37cd-465f-a017-9583a4ad65ff/9f0912c5-4fdc-48e6-a14d-13a9c80900ad.png', 'triggerfeed/guns/a0466339-37cd-465f-a017-9583a4ad65ff/9f0912c5-4fdc-48e6-a14d-13a9c80900ad', 0, '2026-06-25 15:45:52.272321+00', '2026-06-25 15:46:02.418867+00', 'https://res.cloudinary.com/triggerfeed/image/upload/v1782402361/triggerfeed/guns/a0466339-37cd-465f-a017-9583a4ad65ff/9f0912c5-4fdc-48e6-a14d-13a9c80900ad.png', 1024, 1024),
	('6d748da4-6913-46f6-9e27-ee9e6eef8864', 'a0466339-37cd-465f-a017-9583a4ad65ff', 'old', NULL, 'https://res.cloudinary.com/triggerfeed/image/upload/v1782402367/triggerfeed/guns/a0466339-37cd-465f-a017-9583a4ad65ff/6d748da4-6913-46f6-9e27-ee9e6eef8864.png', 'triggerfeed/guns/a0466339-37cd-465f-a017-9583a4ad65ff/6d748da4-6913-46f6-9e27-ee9e6eef8864', 1, '2026-06-25 15:45:52.272321+00', '2026-06-25 15:46:08.24603+00', 'https://res.cloudinary.com/triggerfeed/image/upload/v1782402367/triggerfeed/guns/a0466339-37cd-465f-a017-9583a4ad65ff/6d748da4-6913-46f6-9e27-ee9e6eef8864.png', 1024, 1024);


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 109, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict aLOQmnSU6QglGyv4nBVpxHb6olZWhKEb43Q2m2gkESVi0cWqNfr3C3CVZ5C9gu6

RESET ALL;
