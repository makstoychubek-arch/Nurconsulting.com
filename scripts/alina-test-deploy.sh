#!/usr/bin/env bash
# Выкладка тестового вебхука Алины в ОТДЕЛЬНЫЙ тестовый проект Supabase.
# Использование: SUPABASE_ACCESS_TOKEN=... scripts/alina-test-deploy.sh <ref тестового проекта>
set -euo pipefail
REF="${1:?нужен ref тестового проекта}"
if [ "$REF" = "fiukyfyhotctvfdidktx" ]; then echo "Это рабочий проект, отказ." >&2; exit 1; fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
F="$W/supabase/functions"
mkdir -p "$F/alina-manager-test" "$F/_shared"
cp "$ROOT"/supabase/alina-test/functions/alina-manager-test/*.ts "$F/alina-manager-test/"
cp "$ROOT/supabase/functions/_shared/alina-manager.ts" "$ROOT/supabase/functions/_shared/alina-db.ts" "$F/_shared/"
printf '[functions.alina-manager-test]\nverify_jwt = false\n' > "$W/supabase/config.toml"
cd "$W"
supabase functions deploy alina-manager-test --project-ref "$REF" --no-verify-jwt --use-api
