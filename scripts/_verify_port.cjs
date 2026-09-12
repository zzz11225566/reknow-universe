// 9/12 四补丁移植验证：file:// 打开 index.html（修改版已于当日转正为正式文件名）
const fs = require('fs');
const { createRequire } = require('module');
const req = createRequire('C:/Users/cxy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js');
const pw = req('playwright');
const DIR = 'C:/Users/cxy/Desktop/宇宙版';
const URL = 'file:///' + DIR + '/index.html';

(async () => {
  const out = { console: [], pageErrors: [], checks: {} };
  const browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });

  // ---------- 桌面 1440 ----------
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') out.console.push(t + ': ' + m.text()); });
  page.on('pageerror', e => out.pageErrors.push(String(e)));
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 }).catch(e => out.pageErrors.push('goto: ' + e.message));
  await page.waitForTimeout(2500);

  out.checks.homeHero = await page.evaluate(() => !!document.querySelector('#view-home .hero-band'));
  out.checks.ctaStart = await page.evaluate(() => { const b = document.getElementById('hbStart'); return b ? b.textContent.trim() : null; });
  out.checks.ctaUni = await page.evaluate(() => { const b = document.getElementById('hbUni'); return b ? b.textContent.trim() : null; });
  out.checks.hbRandomGone = await page.evaluate(() => !document.getElementById('hbRandom'));
  out.checks.subCopy = await page.evaluate(() => { const s = document.querySelector('#view-home .hero-band .sub'); return s ? s.textContent.slice(0, 40) : null; });
  // 横向溢出
  out.checks.hOverflowDesktop = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: DIR + '/_verify_port_desktop.png', fullPage: false });

  // 首次访问有新手引导遮罩，先点掉再测 CTA（等同真实用户操作）
  try {
    await page.waitForSelector('#ovOnboard.on #oNext', { timeout: 5000 });
    for (let i = 0; i < 4; i++) {
      const btn = await page.$('#ovOnboard.on #oNext');
      if (!btn) break;
      await btn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch (e) { out.checks.dismissOnboard = 'note: ' + e.message.split('\n')[0]; }
  // 点击「⚡ 打开即学」→ 应进入学习流
  try {
    await page.click('#hbStart');
    await page.waitForTimeout(1200);
    out.checks.ctaEntersFlow = await page.evaluate(() => ({
      flowOn: document.getElementById('view-flow').classList.contains('on'),
      homeOn: document.getElementById('view-home').classList.contains('on'),
      topic: (document.getElementById('flowTopic') || {}).textContent || ''
    }));
  } catch (e) { out.checks.ctaEntersFlow = 'ERR ' + e.message; }

  // ---------- ?auto=uni 宇宙 + 看山固定右下角 ----------
  try {
    await page.goto(URL + '?auto=uni', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    out.checks.uniShellOn = await page.evaluate(() => { const s = document.getElementById('uniShell'); return s ? s.className : 'none'; });
    out.checks.foxFixed = await page.evaluate(() => {
      const f = document.getElementById('uniFox');
      if (!f) return null;
      const cs = getComputedStyle(f);
      const r = f.getBoundingClientRect();
      return { display: cs.display, position: cs.position, right: cs.right, bottom: cs.bottom, rectRight: Math.round(r.right), rectBottom: Math.round(r.bottom), vw: innerWidth, vh: innerHeight };
    });
    out.checks.brandTxt = await page.evaluate(() => { const b = document.querySelector('.uni-brand b'); return b ? b.textContent : null; });
    await page.screenshot({ path: DIR + '/_verify_port_uni.png', fullPage: false });
  } catch (e) { out.checks.uniErr = String(e); }

  // ---------- 开杠话术（直接调用函数验证引用原话） ----------
  out.checks.debateQuotesArg = await page.evaluate(() => {
    try {
      const t = window.DEMO && window.DEMO.topics && window.DEMO.topics[0];
      if (!t || typeof debateRebuttals !== 'function') return 'no-fn';
      const r = debateRebuttals(t, 0, '我自己的独特理解哈哈');
      return { ok: r[0].indexOf('我自己的独特理解哈') >= 0, head: r[0].slice(0, 30) };
    } catch (e) { return 'ERR ' + e.message; }
  });

  // ---------- 移动 390 ----------
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mp.on('console', m => { const t = m.type(); if (t === 'error') out.console.push('mobile error: ' + m.text()); });
  mp.on('pageerror', e => out.pageErrors.push('mobile: ' + String(e)));
  await mp.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await mp.waitForTimeout(2500);
  out.checks.mobileHero = await mp.evaluate(() => !!document.querySelector('#view-home .hero-band'));
  out.checks.mobileCta = await mp.evaluate(() => { const b = document.getElementById('hbStart'); return b ? b.textContent.trim() : null; });
  out.checks.hOverflowMobile = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await mp.screenshot({ path: DIR + '/_verify_port_mobile.png', fullPage: false });

  out.console = out.console.slice(0, 40);
  fs.writeFileSync(DIR + '/verify_port_out.json', JSON.stringify(out, null, 2));
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
