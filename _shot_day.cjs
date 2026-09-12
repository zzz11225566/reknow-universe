const { createRequire } = require('module');
const req = createRequire('C:/Users/cxy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js');
const pw = req('playwright');
const DIR = 'C:/Users/cxy/Desktop/宇宙版/';

// 用真实白天场景的近似背景替换设计稿的暗夜背景，检验昼夜兼容性
const DAY = `body{
background:
 radial-gradient(900px 520px at 50% 114%, rgba(255,150,60,.28), transparent 62%),
 radial-gradient(1300px 700px at 50% -20%, rgba(255,255,255,.75), transparent 62%),
 linear-gradient(180deg,#dde8f4 0%,#c9d9ec 48%,#bccfe4 100%) !important;}`;
const DAY_B = `body{
background:
 radial-gradient(760px 540px at 63% 44%, rgba(120,150,220,.25), transparent 65%),
 linear-gradient(180deg,#dde8f4 0%,#c9d9ec 48%,#bccfe4 100%) !important;}`;

(async () => {
  const browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file:///C:/Users/cxy/Desktop/宇宙版/_draft_uni_a.html', { waitUntil: 'load' });
  await page.addStyleTag({ content: DAY });
  await page.waitForTimeout(500);
  await page.screenshot({ path: DIR + '_draft_uni_a_day.png' });
  console.log('shot a_day');
  await page.goto('file:///C:/Users/cxy/Desktop/宇宙版/_draft_uni_b.html', { waitUntil: 'load' });
  await page.addStyleTag({ content: DAY_B });
  await page.waitForTimeout(500);
  await page.screenshot({ path: DIR + '_draft_uni_b_day.png' });
  console.log('shot b_day');
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
