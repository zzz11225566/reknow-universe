const { createRequire } = require('module');
const req = createRequire('C:/Users/cxy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js');
const pw = req('playwright');

(async () => {
  const browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  for (const d of ['a', 'b', 'c']) {
    await page.goto('file:///C:/Users/cxy/Desktop/宇宙版/_draft_uni_' + d + '.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'C:/Users/cxy/Desktop/宇宙版/_draft_uni_' + d + '.png' });
    console.log('shot', d);
  }
  await browser.close();
  if (errs.length) { console.log('PAGEERRORS:', errs); process.exit(1); }
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
