const { createRequire } = require('module');
const req = createRequire('C:/Users/cxy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js');
const pw = req('playwright');
const DIR = 'C:/Users/cxy/Desktop/宇宙版/';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('rkIntro', '1'); });
  await page.goto('file:///C:/Users/cxy/Desktop/宇宙版/index.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { if (window.showView) window.showView('uni'); });
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => {
    const s = document.getElementById('uniShell');
    const c = document.getElementById('uniCanvas');
    return { shellClass: s ? s.className : 'none', canvas: c ? c.width + 'x' + c.height : 'no-canvas' };
  });
  console.log('state:', JSON.stringify(state));
  await page.screenshot({ path: DIR + '_shot_uni_real.png' });
  const card = await page.evaluate(() => {
    const u = window.ReckonUniverse;
    if (u && u.openCard) { try { u.openCard('feynman'); return 'called'; } catch (e) { return 'err ' + e.message; } }
    return 'no-api';
  });
  console.log('card:', card);
  await page.waitForTimeout(900);
  await page.screenshot({ path: DIR + '_shot_uni_real_card.png' });
  await browser.close();
  if (errs.length) console.log('PAGEERRORS:', errs.slice(0, 5));
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
