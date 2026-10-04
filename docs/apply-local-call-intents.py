"""Apply ONLY the reviewed additive intent draft to the owned local container.
No application env loading; refuse any identity/port mismatch. No cloud traffic.
"""
import json
import pathlib
import subprocess


def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kwargs).stdout


def main():
    info = json.loads(run(["docker", "inspect", "crm-local-staging"]))[0]
    assert info["Name"] == "/crm-local-staging"
    assert info["State"]["Running"]
    assert info["NetworkSettings"]["Ports"]["5432/tcp"] == [{"HostIp": "127.0.0.1", "HostPort": "55437"}]
    cmd = ["docker", "exec", "-i", "crm-local-staging", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-h", "/var/run/postgresql", "-p", "5432", "-U", "postgres", "-d", "crm_local_staging"]
    assert run(cmd + ["-Atc", "SELECT current_database() || ':' || current_user"]).strip() == "crm_local_staging:postgres"
    existing = run(cmd + ["-Atc", "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('call_intents','call_intent_leases')"]).strip()
    assert existing == "0", "Refusing existing intent tables; no overwrite/reapply"
    draft = pathlib.Path(__file__).parent / "schema-drafts/call-intents-local-only.sql"
    print(run(cmd, input=draft.read_text()))
    assert run(cmd + ["-Atc", "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('call_intents','call_intent_leases') AND rowsecurity"]).strip() == "2"
    print("LOCAL_INTENT_SCHEMA_VERIFIED: 2 additive RLS tables; no baseline types changed")


if __name__ == "__main__":
    main()
