#!/usr/bin/env bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
 -v crm_password="$CRM_DB_PASSWORD" -v finance_password="$FINANCE_DB_PASSWORD" -v scm_password="$SCM_DB_PASSWORD" -v crm_db="${CRM_DATABASE_NAME:-crm}" -v finance_db="${FINANCE_DATABASE_NAME:-finance}" -v scm_db="${SCM_DATABASE_NAME:-scm}" <<'SQL'
CREATE ROLE crm_app LOGIN PASSWORD :'crm_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE finance_app LOGIN PASSWORD :'finance_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE scm_app LOGIN PASSWORD :'scm_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
SELECT format('CREATE DATABASE %I OWNER crm_app', :'crm_db') \gexec
SELECT format('CREATE DATABASE %I OWNER finance_app', :'finance_db') \gexec
SELECT format('CREATE DATABASE %I OWNER scm_app', :'scm_db') \gexec
SQL
