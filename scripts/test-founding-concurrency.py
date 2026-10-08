"""Local Docker-only concurrency regression. Requires an EMPTY disposable app DB.

python scripts/test-founding-concurrency.py founding_maintenance_v2
Uses committed fixtures to exercise separate PostgreSQL connections; cleans them up.
Never accepts a connection URL or a production database name.
"""
import concurrent.futures
import re
import subprocess
import sys
import time

database = sys.argv[1] if len(sys.argv) == 2 else ""
if not re.fullmatch(r"founding_maintenance_[a-z0-9_]+", database):
    raise SystemExit("Pass an empty disposable database named founding_maintenance_<suffix>.")
command = ["docker", "exec", "-i", "supabase_db_TriggerFeed_V3", "psql", "-X", "-U", "postgres",
           "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt"]


def sql(statement):
    result = subprocess.run(command, input=statement, text=True, capture_output=True, timeout=20)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


def uid(number):
    return f"f6000000-0000-0000-0000-{number:012d}"


def setup(gapped=False):
    assert sql("select count(*) from public.profiles;") == "0", "Requires empty disposable database"
    assert sql("select count(*) from public.founding_member_numbers;") == "0"
    sql("""update public.founding_500_settings set is_auto_assignment_enabled=false where singleton;
        insert into auth.users(id,email,raw_user_meta_data)
        select ('f6000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
        'concurrency-'||n||'@example.test',jsonb_build_object('username','concurrency_'||n,'dob','1980-01-01')
        from generate_series(1,4) n;
        """ + f"update public.profiles set role='ceo' where id='{uid(1)}';" + "\n".join(
            f"update public.profiles set founding_member_number={(n-1)*(2 if gapped else 1)} where id='{uid(n)}';"
            for n in range(2, 5)))
    sql("update public.founding_500_settings set is_auto_assignment_enabled=true where singleton;")


def cleanup():
    # Test fixture teardown only. The application deliberately cannot undo finalization.
    sql("""begin;
        alter table public.founding_500_settings disable trigger set_founding_500_settings_updated_at;
        update public.founding_500_settings set finalized_at=null,is_auto_assignment_enabled=false;
        alter table public.founding_500_settings enable trigger set_founding_500_settings_updated_at;
        delete from public.moderation_actions where actor_user_id='f6000000-0000-0000-0000-000000000001';
        delete from auth.users where id::text like 'f6000000-%';
        delete from public.founding_member_numbers where profile_id::text like 'f6000000-%';
        commit;""")


def compete(operation, expected_signup_number, gapped=False):
    setup(gapped)
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(sql, f"""begin;
                set local application_name='founding_concurrency_holder';
                select set_config('request.jwt.claim.sub','{uid(1)}',true);
                set local role authenticated;
                {operation};
                select pg_sleep(2);
                commit;""")
            for _ in range(60):
                if sql("select count(*) from pg_stat_activity where datname=current_database() and application_name='founding_concurrency_holder' and wait_event='PgSleep';") == "1":
                    break
                if pending.done():
                    pending.result()
                    raise AssertionError("Mutation finished before concurrency barrier")
                time.sleep(0.05)
            else:
                raise AssertionError("Mutation did not reach concurrency barrier")
            sql(f"insert into auth.users(id,email,raw_user_meta_data) values('{uid(5)}','racing-signup@example.test','{{\"username\":\"racing_signup\",\"dob\":\"1980-01-01\"}}');")
            pending.result()
        actual = sql(f"select coalesce(founding_member_number::text,'null') from public.profiles where id='{uid(5)}';")
        assert actual == str(expected_signup_number), (actual, expected_signup_number)
        assert sql("select count(*)=count(distinct founding_member_number) from public.profiles where founding_member_number is not null;") == "t"
        assert sql("select count(*) from public.founding_500_transitions;") == "0"
        assert sql("select count(*) from public.founding_member_numbers f join public.profiles p on p.id=f.profile_id where f.number<>p.founding_member_number;") == "0"
        print(f"PASS concurrent signup: {operation}")
    finally:
        cleanup()


compete(f"select public.remove_founding_500_member('{uid(3)}',2)", 3)
compete("select public.repair_founding_500('REPAIR FOUNDING 500')", 4, gapped=True)
compete("select public.finalize_founding_500('FINALIZE FOUNDING 500')", "null")
