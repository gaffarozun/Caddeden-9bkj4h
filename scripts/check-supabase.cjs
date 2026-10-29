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

// Tüm migration dosyalarındaki tabloların ve argümansız RPC fonksiyonlarının hedef projede var olup olmadığını
// salt-okunur isteklerle sınar (tablo: GET limit=0; fonksiyon: HEAD → PostgREST GET; volatile fonksiyon çalıştırılmaz, 405 döner).
// 404 = yok. Yalnızca nesne ve dosya adları yazılır.
(async () => {
  if (!url || !key) return;
  const fs = require('fs'), path = require('path');
  const dir = 'supabase/migrations';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const tables = new Map(), fns = new Map();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)) if (!tables.has(m[1])) tables.set(m[1], f);
    for (const m of sql.matchAll(/create (?:or replace )?function public\.(\w+)\(\s*\)\s*returns/gi)) if (!fns.has(m[1])) fns.set(m[1], f);
  }
  const missT = [], missF = [];
  for (const [t, f] of tables) {
    try { const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=0`, { headers: { apikey: key } }); if (r.status === 404) missT.push(`${t} (${f})`); } catch { return; }
  }
  for (const [n, f] of fns) {
    try { const r = await fetch(`${url}/rest/v1/rpc/${n}`, { method: 'HEAD', headers: { apikey: key } }); if (r.status === 404) missF.push(`${n} (${f})`); } catch { return; }
  }
  note(missT.length ? 'warning' : 'notice', 'tablolar', `${tables.size - missT.length}/${tables.size} var` + (missT.length ? ` | EKSİK: ${missT.join(', ')}` : ''));
  note(missF.length ? 'warning' : 'notice', 'rpc fonksiyonlari', `${fns.size - missF.length}/${fns.size} var` + (missF.length ? ` | EKSİK: ${missF.join(', ')}` : ''));
  const mig = [...new Set([...missT, ...missF].map((x) => x.match(/\((.+)\)$/)[1]))];
  if (mig.length) note('warning', 'uygulanmamis migration dosyalari', mig.join(' → '));
})();
