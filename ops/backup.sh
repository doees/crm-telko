#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="backups/$stamp"
mkdir -p "$backup_dir"
# Pause writers to make the three database snapshots mutually consistent.
trap 'docker compose start crm worker finance scm >/dev/null' EXIT
docker compose stop crm worker finance scm
for service in crm finance scm; do
    case "$service" in
        crm) owner=crm_app; password_name=CRM_DB_PASSWORD ;;
        finance) owner=finance_app; password_name=FINANCE_DB_PASSWORD ;;
        scm) owner=scm_app; password_name=SCM_DB_PASSWORD ;;
    esac
    docker compose exec -T -e BACKUP_DATABASE="$service" -e BACKUP_OWNER="$owner" -e BACKUP_PASSWORD_NAME="$password_name" db sh -c 'export PGPASSWORD="$(printenv "$BACKUP_PASSWORD_NAME")"; exec pg_dump -h 127.0.0.1 -U "$BACKUP_OWNER" -d "$BACKUP_DATABASE" -Fc' > "$backup_dir/$service.dump"
done
printf 'Backup written to %s (private files; copy to protected offsite storage).\n' "$backup_dir"
