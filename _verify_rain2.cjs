// 雨夜可见性复验：setWeather('rain') 后截图
const fs = require('fs');
const { createRequire } = require('module');
const req = createRequire('C:/Users/cxy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js');
const pw = req('playwright');
const DIR = 'C:/Users/cxy/Desktop/宇宙版';
const URL = 'file:///' + DIR + '/index.html';

(async () => {
  const out = { console: [], pageErrors: [], checks: {} };
  const browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') out.console.push(m.text()); });
  page.on('pageerror', e => out.pageErrors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('rkIntro', '1'));
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const rec = { map: { core: '核心', plain: '白话', example: '例子', trap: '避坑', question: '追问' }, ts: new Date().toISOString(), concepts: ['学习'] };
    DEMO.topics.forEach(t => { S.learned[t.id] = { published: true, votes: 150, voted: false, at: new Date().toISOString() }; S.records[t.id] = JSON.parse(JSON.stringify(rec)); });
    save();
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => showView('uni'));
  await page.waitForTimeout(4000);
  await page.evaluate(() => ReckonUniverse.setWeather('rain', true));
  await page.waitForTimeout(3000);
  out.checks.diag = await page.evaluate(() => ReckonUniverse.diag());
  await page.screenshot({ path: DIR + '/_uni_a_rain2.png' });
  fs.writeFileSync(DIR + '/_uni_rain2_out.json', JSON.stringify(out, null, 2));
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
