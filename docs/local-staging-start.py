#!/usr/bin/env python3
"""LOCAL ONLY. Creates one bounded, VOLATILE PostgreSQL rehearsal container.
No app or cloud configuration. Refuses existing named resources/credential file.
PGDATA uses a size-bounded tmpfs Docker volume: stop/reboot may lose all data.
"""
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import time

NAME = 'crm-local-staging'
VOLUME = 'crm-local-staging-data'
IMAGE = 'postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
ENV = Path.home() / '.config/crm/local-staging.env'
PORT = 55437

def docker(*args, **kw):
    return subprocess.run(['docker', *args], check=True, capture_output=True, text=True, **kw).stdout.strip()

def main():
    available = next(int(x.split()[1]) for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:'))
    assert available > 2 * 1024 * 1024, 'Less than 2GiB RAM available: stop'
    assert shutil.disk_usage('/').free > 3 * 1024**3, 'Less than 3GiB disk free: stop'
    assert NAME not in docker('ps', '-a', '--format', '{{.Names}}').splitlines(), 'Container exists: stop'
    assert VOLUME not in docker('volume', 'ls', '--format', '{{.Name}}').splitlines(), 'Volume exists: stop'
    assert not ENV.exists(), 'Credential file exists: stop (never overwrite)'
    with socket.socket() as s:
        s.bind(('127.0.0.1', PORT))
    # This digest was inspected from the official postgres:17-alpine pull.
    docker('image', 'inspect', IMAGE)
    ENV.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    password = secrets.token_urlsafe(48)
    fd = os.open(ENV, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(f'POSTGRES_USER=postgres\nPOSTGRES_PASSWORD={password}\nPOSTGRES_DB=crm_local_staging\nPGHOST=127.0.0.1\nPGPORT={PORT}\n')
    made_volume = False
    made_container = False
    try:
        docker('volume', 'create', '--label', 'crm.scope=local-synthetic-only', '--driver', 'local',
               '--opt', 'type=tmpfs', '--opt', 'device=tmpfs', '--opt', 'o=size=256m,uid=70,gid=70,mode=0700', VOLUME)
        made_volume = True
        docker('run', '-d', '--name', NAME, '--label', 'crm.scope=local-synthetic-only',
               '--memory=512m', '--memory-swap=512m', '--cpus=1', '--pids-limit=100',
               '--restart=no', '--publish', f'127.0.0.1:{PORT}:5432',
               '--mount', f'type=volume,source={VOLUME},target=/var/lib/postgresql/data',
               '--env-file', str(ENV), '--env', 'PGPORT=5432',
               '--env', 'POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256',
               '--log-driver=json-file', '--log-opt=max-size=5m', '--log-opt=max-file=2',
               '--health-cmd=pg_isready -U postgres -d crm_local_staging -h 127.0.0.1 -p 5432',
               '--health-interval=5s', '--health-timeout=3s', '--health-retries=12',
               IMAGE, 'postgres', '-c', 'shared_buffers=32MB', '-c', 'max_connections=20',
               '-c', 'work_mem=2MB', '-c', 'maintenance_work_mem=16MB',
               '-c', 'min_wal_size=32MB', '-c', 'max_wal_size=64MB', '-c', 'temp_file_limit=16384')
        made_container = True
        for _ in range(60):
            state = json.loads(docker('inspect', '--format', '{{json .State}}', NAME))
            if state.get('Health', {}).get('Status') == 'healthy':
                print(json.dumps({'container': NAME, 'status': 'healthy', 'port': PORT,
                                  'image': IMAGE, 'credential_mode': oct(ENV.stat().st_mode & 0o777),
                                  'data_volume': '256MiB VOLATILE tmpfs', 'memory': '512MiB', 'cpus': 1}))
                return
            if not state['Running']:
                raise RuntimeError('Local container exited during initialization')
            time.sleep(1)
        raise RuntimeError('Local container did not become healthy')
    except Exception:
        if made_container:
            logs = subprocess.run(['docker', 'logs', NAME], capture_output=True, text=True)
            for line in (logs.stdout + logs.stderr).splitlines():
                if 'listening on' in line or 'FATAL:' in line or 'ERROR:' in line:
                    print(line.replace(password, '[REDACTED]'))
            docker('rm', '-f', NAME)
        if made_volume:
            docker('volume', 'rm', VOLUME)
        ENV.unlink(missing_ok=True)
        raise

if __name__ == '__main__':
    main()
