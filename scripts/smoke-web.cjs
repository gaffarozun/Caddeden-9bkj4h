// Dağıtılan siteyi gerçek tarayıcıyla açar; konsol hatalarını ve görünen metni GitHub annotation olarak yazar.
const { chromium } = require('playwright');
const url = process.argv[2];
const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').replace(/eyJ[\w-]{20,}\.[\w-]+\.[\w-]+/g, '<jwt>').slice(0, 280);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [], fails = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(clean(m.text())); });
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + clean(e.message)));
  p.on('requestfailed', (r) => fails.push(clean(r.url()) + ' ' + clean(r.failure()?.errorText)));
  p.on('response', (r) => { if (r.status() >= 400) fails.push(r.status() + ' ' + clean(r.url())); });
  const resp = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => { errs.push('GOTO ' + clean(e.message)); return null; });
  await p.waitForTimeout(1300);
  const v = await p.evaluate(() => { const e = document.querySelector('video'); return e ? { var: true, t: +e.currentTime.toFixed(2), paused: e.paused, ready: e.readyState, w: e.videoWidth, h: e.videoHeight, err: e.error ? e.error.code : null } : { var: false }; }).catch(() => ({ var: 'hata' }));
  console.log(`::notice title=smoke intro video::${JSON.stringify(v)}`);
  const d = await p.evaluate(async () => {
    const e = document.querySelector('video'); const src = e && (e.currentSrc || e.src);
    const out = { src: src ? src.replace(location.origin, '') : null, h264: document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"') || 'hayir' };
    if (src) { try { const r = await fetch(src); out.status = r.status; out.type = r.headers.get('content-type'); out.bytes = (await r.arrayBuffer()).byteLength; } catch (x) { out.fetchErr = String(x).slice(0, 80); } }
    return out;
  }).catch(() => ({}));
  console.log(`::notice title=smoke intro dosya::${JSON.stringify(d)}`);
  await p.screenshot({ path: 'smoke-intro.png' });
  await p.waitForTimeout(5000);
  console.log(`::notice title=smoke http::${resp ? resp.status() : 'no response'} ${url}`);
  const text = clean(await p.evaluate(() => document.body.innerText).catch(() => ''));
  console.log(`::notice title=smoke gorunen metin::${text || '(BOŞ SAYFA)'}`);
  errs.slice(0, 6).forEach((e) => console.log(`::warning title=smoke konsol hatasi::${e}`));
  fails.slice(0, 6).forEach((e) => console.log(`::warning title=smoke ag hatasi::${e}`));
  await p.screenshot({ path: 'smoke.png', fullPage: true });
  await b.close();
})().catch((e) => { console.log(`::error title=smoke coktu::${clean(e.message)}`); process.exit(1); });
