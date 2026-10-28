#!/usr/bin/env bash
# Salt-okunur DNS kontrolü: caddeden.com.tr için Resend kayıtlarının internette görünüp görünmediğini yazar.
D="${1:-caddeden.com.tr}"
note() { echo "::notice title=dns $1::$2"; }
q() { dig +short +time=4 +tries=1 "@$1" "$3" "$2" 2>&1 | tr '\n' ' ' | cut -c1-240; }
NS=$(dig +short +time=4 NS "$D" @1.1.1.1 | tr '\n' ' ')
note "NS($D)" "${NS:-(YOK: alan adı çözülmüyor ya da NS kaydı bulunamadı)}"
for r in 1.1.1.1; do
  for spec in "TXT resend._domainkey" "CNAME resend._domainkey" "CNAME resend" "CNAME rsend" "TXT rsend" "MX send" "TXT send" "CNAME send" "TXT _dmarc"; do
    t=${spec%% *}; n=${spec#* }
    v=$(q "$r" "$t" "$n.$D")
    note "$r $t $n" "${v:-(boş)}"
  done
done
# Cloudflare kayıtlarını hatalı çift ekleme (alan adı iki kez) için tara
for n in "resend._domainkey.$D.$D" "send.$D.$D" "resend.$D.$D"; do
  v=$(q 1.1.1.1 ANY "$n"); [ -n "$v" ] && echo "::warning title=dns CIFT ALAN ADI::$n kaydı var: ${v:0:100}"
done
# Authoritative sunucudan doğrudan sorgu
for ns in $NS; do
  v=$(q "${ns%.}" TXT "send.$D"); note "yetkili ${ns%.} TXT send" "${v:-(boş)}"; break
done
