// Derleme sırasında Supabase adresini ve herkese açık Auth ayarlarını kontrol eder.
// Yalnızca durum bilgisi yazar; URL host adı dışında hiçbir değer, anahtar ya da e-posta loglanmaz. Her zaman 0 ile çıkar.
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const note = (lvl, t, m) => console.log(`::${lvl} title=supabase ${t}::${m}`);
(async () => {
  if (!url || !key) return note('warning', 'secret', 'EXPO_PUBLIC_SUPABASE_URL veya ANON_KEY boş');
  let host; try { host = new URL(url).host; } catch { return note('warning', 'url', 'URL biçimi geçersiz (https://<ref>.supabase.co olmalı)'); }
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (r.status === 401 || r.status === 403) return note('warning', 'anahtar', `host ${host} yanıt verdi ama anon anahtarı reddedildi (HTTP ${r.status})`);
    if (!r.ok) return note('warning', 'durum', `host ${host} HTTP ${r.status}`);
    const s = await r.json();
    note('notice', 'ulasilabilir', `host ${host} yanıt veriyor`);
    note('notice', 'auth ayarlari', `email_saglayici=${s.external?.email} | signup_kapali=${s.disable_signup} | otomatik_onay(confirm_email_KAPALI)=${s.mailer_autoconfirm}`);
  } catch (e) {
    const code = e.cause?.code || e.code || e.name;
    note('warning', 'ulasilamiyor', `host ${host} çözülemiyor/ulaşılamıyor (${code}). URL hatalı ya da proje duraklatılmış/silinmiş olabilir`);
  }
})();

// Baseline migration'daki tabloların hedef projede var olup olmadığını salt-okunur GET ile sınar.
// 200/401/403 = tablo var (izin durumu önemsiz), 404 = yok. Yalnızca tablo adları yazılır.
(async () => {
  if (!url || !key) return;
  const fs = require('fs');
  let sql = ''; try { sql = fs.readFileSync('supabase/migrations/20261001_baseline_inferred_schema.sql', 'utf8'); } catch { return; }
  const tables = [...new Set([...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1]))];
  const missing = [];
  for (const t of tables) {
    try { const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=0`, { headers: { apikey: key } }); if (r.status === 404) missing.push(t); } catch { return; }
  }
  if (missing.length) note('warning', 'eksik tablolar', `${missing.length}/${tables.length}: ${missing.join(', ')}`);
  else note('notice', 'tablolar', `baseline'daki ${tables.length} tablonun hepsi mevcut`);
  for (const f of ['public_paid_campaigns', 'university_public_messages', 'experiences_enabled']) {
    // Yalnızca varlık sınaması: GET bir RPC'yi çalıştırmaz (PostgREST yalnızca POST/STABLE GET ile çağırır); 404 = yok.
    try { const r = await fetch(`${url}/rest/v1/rpc/${f}`, { method: 'HEAD', headers: { apikey: key } }); note(r.status === 404 ? 'warning' : 'notice', 'rpc ' + f, r.status === 404 ? 'YOK' : 'var'); } catch {}
  }
})();
