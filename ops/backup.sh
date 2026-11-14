#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="backups/$stamp"
mkdir -p "$backup_dir"
compose=(docker compose --env-file "${CRM_ENV_FILE:-.env}")
# Stop writers so the three snapshots describe the same operational moment.
trap '"${compose[@]}" start crm worker finance scm >/dev/null' EXIT
"${compose[@]}" stop crm worker finance scm
for service in crm finance scm; do
    case "$service" in
        crm) owner=crm_app; password_name=CRM_DB_PASSWORD; database_name=CRM_DATABASE_NAME ;;
        finance) owner=finance_app; password_name=FINANCE_DB_PASSWORD; database_name=FINANCE_DATABASE_NAME ;;
        scm) owner=scm_app; password_name=SCM_DB_PASSWORD; database_name=SCM_DATABASE_NAME ;;
    esac
    "${compose[@]}" exec -T -e BACKUP_DATABASE_NAME="$database_name" -e BACKUP_OWNER="$owner" -e BACKUP_PASSWORD_NAME="$password_name" db sh -c 'export PGPASSWORD="$(printenv "$BACKUP_PASSWORD_NAME")"; exec pg_dump -h 127.0.0.1 -U "$BACKUP_OWNER" -d "$(printenv "$BACKUP_DATABASE_NAME")" -Fc' > "$backup_dir/$service.dump"
done
printf 'Backup written to %s (private files; copy to protected offsite storage).\n' "$backup_dir"
