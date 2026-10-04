#!/usr/bin/env python3
"""LOCAL-ONLY real SQL rehearsal. Refuses nonempty primary or wrong container.
Stores synthetic custom-format dump outside repo, schema/count evidence inside docs.
Run once after local-staging-start.py; no cloud/network API/app credentials used.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
NAME = 'crm-local-staging'
DB = 'crm_local_staging'
RESTORE = 'crm_local_restore'
ENV = Path.home() / '.config/crm/local-staging.env'
DUMP = ENV.with_name('local-staging.dump')
IMAGE = 'postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'

def run(args, data=None):
    r = subprocess.run(args, input=data, capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr.decode(errors='replace'))
    return r.stdout

def sql(text, db=DB):
    return run(['docker','exec','-i',NAME,'psql','-X','-h','/var/run/postgresql','-p','5432','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-At'],text.encode()).decode().strip()

def scalar(text, db=DB):
    return sql(text,db).splitlines()[0]

def snapshot(db):
    queries = {
        'columns': "SELECT table_name,column_name,udt_name,is_nullable,column_default,datetime_precision,character_maximum_length FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
        'constraints': "SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY 1,2",
        'indexes': "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2",
        'enums': "SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY 1,3",
        'rls': "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1",
        'policies': "SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
    }
    result = {}
    for key, query in queries.items():
        result[key] = json.loads(sql("SELECT coalesce(json_agg(q),'[]'::json) FROM ("+query+") q;",db))
    tables=[x['relname'] for x in result['rls']]
    result['counts']={t:int(scalar(f'SELECT count(*) FROM "{t}";',db)) for t in tables}
    result['data_hashes']={t:scalar(f"SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text),'')) FROM \"{t}\" t;",db) for t in tables}
    return result

def main():
    info=json.loads(run(['docker','inspect',NAME]))[0]
    assert info['Config']['Labels']['crm.scope']=='local-synthetic-only'
    assert info['State']['Health']['Status']=='healthy'
    assert info['HostConfig']['Memory']==512*1024**2 and info['HostConfig']['NanoCpus']==10**9
    assert info['HostConfig']['PortBindings']=={'5432/tcp':[{'HostIp':'127.0.0.1','HostPort':'55437'}]}
    assert scalar('SELECT current_database();')==DB
    table_count=int(scalar("SELECT count(*) FROM pg_tables WHERE schemaname='public';"))
    assert table_count in (0,6), 'Unexpected primary schema: refusing mutation'
    assert not DUMP.exists(), 'Existing dump: refusing overwrite'
    # Test authenticated TCP through the actual published host-loopback port.
    tcp = run(['docker','run','--rm','--network=host','--memory=64m','--memory-swap=64m','--cpus=0.25',
               '--read-only','--cap-drop=ALL','--env-file',str(ENV),'--entrypoint','sh',IMAGE,'-c',
               'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -w -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select current_database(),current_user,inet_server_port();"']).decode().strip()
    assert tcp==DB+'|postgres|5432'
    baseline=(ROOT/'schema-drafts/local-baseline.sql').read_text()
    additive=(ROOT/'schema-drafts/tags-lists.sql').read_text()
    tests=(ROOT/'schema-drafts/local-database-tests.sql').read_text()
    if table_count==0:
        sql(baseline)
    base=snapshot(DB)
    assert set(base['counts'])=={'profiles','leads','calls','tasks','smart_views','org_settings'}
    assert all(n==0 for n in base['counts'].values()), 'Existing data: refusing mutation'
    assert len(base['rls'])==6 and len(base['columns'])==63 and len(base['constraints'])==15 and len(base['indexes'])==17
    assert all(not x['relrowsecurity'] for x in base['rls'])
    core_dates=[c for c in base['columns'] if c['udt_name']=='timestamptz']
    assert len(core_dates)==9 and all(c['datetime_precision']==6 for c in core_dates)
    assert all('ON UPDATE' not in c['pg_get_constraintdef'] for c in base['constraints'] if 'FOREIGN KEY' in c['pg_get_constraintdef'])
    # Negative precondition (organizer relation is genuinely absent before migration).
    assert scalar("SELECT to_regclass('public.tags') IS NULL;")=='t'
    sql(additive)
    post=snapshot(DB)
    assert len(post['rls'])==10 and len(post['constraints'])==24 and len(post['indexes'])==25
    new={'tags','lead_tags','lead_lists','lead_list_memberships'}
    assert {x['relname'] for x in post['rls'] if x['relrowsecurity']}==new
    assert post['policies']==[]
    sql(tests)
    primary=snapshot(DB)
    expected={'calls':1,'lead_list_memberships':2,'lead_lists':3,'lead_tags':1,'leads':1,'org_settings':1,'profiles':2,'smart_views':1,'tags':1,'tasks':1}
    assert primary['counts']==expected
    # DDL rollback rehearsal, isolated to the second local database.
    sql('CREATE DATABASE '+RESTORE+';', 'postgres')
    empty_restore=snapshot(RESTORE)
    assert additive.rstrip().endswith('COMMIT;') and baseline.rstrip().endswith('COMMIT;')
    # Keep baseline and additive DDL inside one outer transaction. No DROP needed.
    # Savepoint rollback removes additive tables while preserving baseline in-session.
    rollback_sql=baseline.rstrip()[:-len('COMMIT;')]+'\nSAVEPOINT baseline_ready;\n'
    rollback_sql+=additive.replace('BEGIN;', '', 1).rstrip()[:-len('COMMIT;')]
    rollback_sql+="""
DO $$ BEGIN IF (SELECT count(*) FROM pg_tables WHERE schemaname='public') <> 10 THEN RAISE EXCEPTION 'DDL not applied'; END IF; END $$;
ROLLBACK TO SAVEPOINT baseline_ready;
DO $$ BEGIN IF (SELECT count(*) FROM pg_tables WHERE schemaname='public') <> 6 OR to_regclass('public.tags') IS NOT NULL THEN RAISE EXCEPTION 'Additive rollback failed'; END IF; END $$;
ROLLBACK;
"""
    sql(rollback_sql,RESTORE)
    assert snapshot(RESTORE)==empty_restore, 'Outer DDL rollback altered empty database'
    dump=run(['docker','exec',NAME,'pg_dump','-h','/var/run/postgresql','-p','5432','-U','postgres','-Fc','--dbname='+DB])
    fd=os.open(DUMP,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:
        f.write(dump)
    run(['docker','exec','-i',NAME,'pg_restore','-h','/var/run/postgresql','-p','5432','-U','postgres','--exit-on-error','--single-transaction','--dbname='+RESTORE],dump)
    restored=snapshot(RESTORE)
    assert primary==restored, 'Schema/count/data mismatch after restore'
    def schema_dump(db):
        data=run(['docker','exec',NAME,'pg_dump','-h','/var/run/postgresql','-p','5432','-U','postgres','--schema-only','--dbname='+db]).decode()
        return '\n'.join(l for l in data.splitlines() if not l.startswith(('\\restrict ','\\unrestrict ')))
    original_schema=schema_dump(DB)
    assert original_schema==schema_dump(RESTORE), 'Full schema-only dump differs'
    volume=json.loads(run(['docker','volume','inspect','crm-local-staging-data']))[0]
    evidence={
        'at_utc':datetime.now(timezone.utc).isoformat(), 'image_digest':IMAGE,
        'server_version':scalar('SHOW server_version;'), 'authenticated_host_loopback_tcp':tcp,
        'baseline':base,'post_migration':post,'final_primary':primary,
        'checks':{'five_fk_rejections':True,'four_unique_rejections':True,'two_idempotent_retries':True,
                  'one_lead_multiple_lists':True,'cascade_and_data_rollback':True,'rls_nonowner_all_four_crud':True,
                  'ddl_savepoint_rollback_six_core_tables_and_outer_rollback_empty':True,'restored_catalog_counts_data_hashes_equal':True,
                  'full_schema_dump_equal_ignoring_random_restrict_tokens':True},
        'dump_bytes':len(dump),'dump_sha256':hashlib.sha256(dump).hexdigest(),
        'normalized_schema_sha256':hashlib.sha256(original_schema.encode()).hexdigest(),
        'input_sha256':{name:hashlib.sha256(text.encode()).hexdigest() for name,text in [('baseline',baseline),('additive',additive),('tests',tests)]},
        'limits':{k:info['HostConfig'][k] for k in ['Memory','MemorySwap','NanoCpus','PidsLimit','PortBindings','LogConfig','RestartPolicy']},
        'volume_options':volume['Options'],
        'volume_usage':run(['docker','exec',NAME,'df','-k','/var/lib/postgresql/data']).decode().strip(),
        'stats':run(['docker','stats','--no-stream',NAME,'--format','{{.MemUsage}} | {{.CPUPerc}}']).decode().strip(),
        'credential_mode':oct(ENV.stat().st_mode & 0o777),
        'dump_mode':oct(DUMP.stat().st_mode & 0o777),
    }
    (ROOT/'local-database-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps({k:evidence[k] for k in ['server_version','checks','dump_bytes','dump_sha256','stats','volume_usage']},indent=2))
    print('COUNTS',json.dumps(primary['counts'],sort_keys=True))

if __name__=='__main__':
    main()
