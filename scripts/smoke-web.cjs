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
  const resp = await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => { errs.push('GOTO ' + clean(e.message)); return null; });
  await p.waitForTimeout(3000);
  console.log(`::notice title=smoke http::${resp ? resp.status() : 'no response'} ${url}`);
  const text = clean(await p.evaluate(() => document.body.innerText).catch(() => ''));
  console.log(`::notice title=smoke gorunen metin::${text || '(BOŞ SAYFA)'}`);
  errs.slice(0, 6).forEach((e) => console.log(`::warning title=smoke konsol hatasi::${e}`));
  fails.slice(0, 6).forEach((e) => console.log(`::warning title=smoke ag hatasi::${e}`));
  await p.screenshot({ path: 'smoke.png', fullPage: true });
  await b.close();
})().catch((e) => { console.log(`::error title=smoke coktu::${clean(e.message)}`); process.exit(1); });
