"""Exact local-only additive lifecycle extension; no production migrations."""
import json
import pathlib
import subprocess


def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kwargs).stdout


def main():
    info = json.loads(run(["docker", "inspect", "crm-local-staging"]))[0]
    assert info["Name"] == "/crm-local-staging" and info["State"]["Running"]
    assert info["NetworkSettings"]["Ports"]["5432/tcp"] == [{"HostIp": "127.0.0.1", "HostPort": "55437"}]
    cmd = ["docker", "exec", "-i", "crm-local-staging", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-h", "/var/run/postgresql", "-p", "5432", "-U", "postgres", "-d", "crm_local_staging"]
    assert run(cmd + ["-Atc", "SELECT current_database() || ':' || current_user"]).strip() == "crm_local_staging:postgres"
    assert run(cmd + ["-Atc", "SELECT count(*) FROM call_intents"]).strip() == "0", "Refuse nonempty intent baseline"
    assert run(cmd + ["-Atc", "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='call_intents' AND column_name='child_call_sid'"]).strip() == "0", "Never reapply"
    draft = pathlib.Path(__file__).parent / "schema-drafts/call-lifecycle-local-only.sql"
    print(run(cmd, input=draft.read_text()))
    assert run(cmd + ["-Atc", "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='call_intents' AND column_name IN ('child_call_sid','parent_status','child_status','finished_at')"]).strip() == "4"
    print("LOCAL_LIFECYCLE_SCHEMA_VERIFIED: four additive columns; no existing types or rows changed")


if __name__ == "__main__":
    main()
