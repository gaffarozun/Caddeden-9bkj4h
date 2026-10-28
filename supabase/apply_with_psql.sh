#!/usr/bin/env bash
# İsteğe bağlı: apply_order.txt sırasını psql ile uygular. Hedef BOŞ proje olmalıdır.
# Kullanım: HEDEF_DB_URL='postgresql://...' ./supabase/apply_with_psql.sh
# Bağlantı dizesini (parola içerir) depoya veya komut geçmişine yazmayın; ortam değişkeni olarak verin.
set -euo pipefail
: "${HEDEF_DB_URL:?HEDEF_DB_URL tanımlı değil}"
cd "$(dirname "$0")"
grep -v -e '^#' -e '^$' apply_order.txt | grep -v '^verify/' | while read -r f; do
  echo ">> $f"
  psql "$HEDEF_DB_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$f"
done
echo "Bitti. Şimdi verify/readiness_check.sql dosyasını çalıştırın."
