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
