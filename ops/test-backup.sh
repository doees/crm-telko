#!/usr/bin/env bash
# Rehearsal only: restores into new databases inside the isolated CI stack.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${COMPOSE_PROJECT_NAME:-}" != nusa-crm-image-qa || "${CRM_ENV_FILE:-}" != .env.test ]]; then
    printf 'Refusing backup rehearsal outside isolated nusa-crm-image-qa.\n' >&2
    exit 1
fi
compose=(docker compose --env-file .env.test -p nusa-crm-image-qa -f compose.yml -f ops/compose.qa.yml)
for key in CRM_DATABASE_NAME FINANCE_DATABASE_NAME SCM_DATABASE_NAME; do
    name=$("${compose[@]}" exec -T db printenv "$key")
    [[ "$name" == *_test ]] || { printf 'Test database suffix required.\n' >&2; exit 1; }
done
./ops/backup.sh
backup_dir=""
for candidate in backups/*; do [[ -d "$candidate" ]] && backup_dir="$candidate"; done
[[ -n "$backup_dir" ]]
for service in crm finance scm; do
    case "$service" in
        crm) owner=crm_app; password_name=CRM_DB_PASSWORD; source_db=crm_test; tables=(Customer Subscription Session) ;;
        finance) owner=finance_app; password_name=FINANCE_DB_PASSWORD; source_db=finance_test; tables=(ServiceInvoice Payment) ;;
        scm) owner=scm_app; password_name=SCM_DB_PASSWORD; source_db=scm_test; tables=(StockItem StockMovement FulfillmentRequest) ;;
    esac
    restore_db="${service}_restore_test"
    [[ -s "$backup_dir/$service.dump" ]]
    "${compose[@]}" exec -T db createdb -U postgres --owner "$owner" "$restore_db"
    "${compose[@]}" exec -T -e RESTORE_DATABASE="$restore_db" -e RESTORE_OWNER="$owner" -e RESTORE_PASSWORD_NAME="$password_name" db sh -c 'export PGPASSWORD="$(printenv "$RESTORE_PASSWORD_NAME")"; exec pg_restore --exit-on-error --no-owner --no-acl -h 127.0.0.1 -U "$RESTORE_OWNER" -d "$RESTORE_DATABASE"' < "$backup_dir/$service.dump"
    for table in "${tables[@]}"; do
        before=$("${compose[@]}" exec -T db psql -U postgres -d "$source_db" -Atc "SELECT count(*) FROM \"$table\"")
        after=$("${compose[@]}" exec -T db psql -U postgres -d "$restore_db" -Atc "SELECT count(*) FROM \"$table\"")
        [[ "$before" == "$after" ]] || { printf 'Restore row count mismatch: %s\n' "$table" >&2; exit 1; }
    done
done
printf 'Consistent three-database backup and restore rehearsal passed on isolated QA databases.\n'
