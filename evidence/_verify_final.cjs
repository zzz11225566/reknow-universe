/* 最终验收：五天气连切 + 双端截图 + E 组标记核查 */
const { chromium } = require('C:/Users/cxy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.addInitScript(() => { localStorage.setItem('rkIntro', '1'); });
  await page.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(1200);
  // 预置 4 篇已习得 → 星海有星
  await page.evaluate(() => {
    const S = window.S; if (!S) return;
    S.learned = { feynman: 1, spaced: 1, notes: 1, interview: 1 };
    S.records = { feynman: { steps: [1,1,1,1,1] }, spaced: { steps: [1,1,1,1,1] }, notes: { steps: [1,1,1,1,1] }, interview: { steps: [1,1,1,1,1] } };
    S.xp = 120;
    if (typeof save === 'function') save();
  });
  await page.reload(); await page.waitForTimeout(1200);
  await page.evaluate(() => { if (window.showView) window.showView('uni'); });
  await page.waitForTimeout(3000);
  const diag = await page.evaluate(() => window.ReckonUniverse.diag());
  console.log('DIAG', JSON.stringify(diag), diag.stars >= 4 ? 'STARS_PASS' : 'STARS_FAIL');

  // E 组标记核查
  const echk = await page.evaluate(() => {
    const src = document.querySelector('script[src*="universe"]') ? 'universe loaded' : '';
    return {
      hasUniverse: !!window.ReckonUniverse,
    };
  });
  console.log('ECHK', JSON.stringify(echk));

  const weathers = ['sunny', 'cloudy', 'rain', 'snow', 'aurora'];
  for (const w of weathers) {
    const btn = await page.$('[data-w="' + w + '"]');
    if (!btn) { console.log('WX ' + w + ': BTN_MISSING'); continue; }
    await btn.click();
    await page.waitForTimeout(2200); // 1.5s 过渡 + 余量
    const d = await page.evaluate(() => window.ReckonUniverse.diag());
    await page.screenshot({ path: '_final_wx_' + w + '.png' });
    console.log('WX ' + w + ': fogD=' + (d.fogD && d.fogD.toFixed(4)) + ' renders=' + d.renders + ' pts=' + d.points + ' SHOT');
  }

  // 移动端 390
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '_final_mob_aurora.png' });
  const b2 = await page.$('[data-w="rain"]'); if (b2) { await b2.click(); await page.waitForTimeout(2200); }
  await page.screenshot({ path: '_final_mob_rain.png' });
  // 移动端横向溢出检查
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('MOB overflow px:', overflow, overflow <= 1 ? 'PASS' : 'FAIL');

  console.log('ERRORS', errors.length ? errors.slice(0, 6) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
