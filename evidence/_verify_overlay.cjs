/* 覆盖层互斥修复验证：热榜↔已习得双向、Esc 分层、退出清理 */
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

  // 进宇宙（boot 的调试钩子 ?auto=uni 不可用因已加载，直接调入口）
  await page.evaluate(() => { if (window.showView) window.showView('uni'); });
  await page.waitForTimeout(2500);
  const diag = await page.evaluate(() => window.ReckonUniverse ? window.ReckonUniverse.diag() : null);
  console.log('DIAG', JSON.stringify(diag));

  const st = () => page.evaluate(() => ({
    shell: document.getElementById('uniShell').classList.contains('on'),
    hot: document.getElementById('uniHotPanel').classList.contains('on'),
    know: !!document.getElementById('uniKnowPanel') && document.getElementById('uniKnowPanel').classList.contains('on'),
    card: document.getElementById('uniCard').classList.contains('on'),
    reader: document.getElementById('uniReader').classList.contains('on'),
    mind: !!document.getElementById('uniMind') && document.getElementById('uniMind').classList.contains('on'),
  }));

  // 预置一篇已习得，让已习得面板有内容
  await page.evaluate(() => {
    const S = window.S; if (!S) return;
    S.learned = S.learned || {}; S.learned['t1-1'] = 1;
    S.records = S.records || {}; S.records['t1-1'] = { steps: [1,1,1,1,1] };
    if (S.save) S.save();
  });
  await page.reload(); await page.waitForTimeout(1200);
  await page.evaluate(() => { if (window.showView) window.showView('uni'); });
  await page.waitForTimeout(2500);

  // 场景1：先热榜 → 再已习得 → 热榜应自动关
  await page.click('#uniHotBtn'); await page.waitForTimeout(400);
  await page.click('#uniKnowBtn'); await page.waitForTimeout(400);
  let s = await st();
  console.log('S1 热榜→已习得:', JSON.stringify(s), s.know && !s.hot ? 'PASS' : 'FAIL');

  // 场景2（用户发现的 bug）：先已习得 → 再热榜 → 已习得应自动关
  await page.click('#uniKnowBtn'); await page.waitForTimeout(300); // 收起已习得
  await page.click('#uniKnowBtn'); await page.waitForTimeout(400); // 打开已习得
  await page.click('#uniHotBtn'); await page.waitForTimeout(400);
  s = await st();
  console.log('S2 已习得→热榜:', JSON.stringify(s), s.hot && !s.know ? 'PASS' : 'FAIL');

  // 场景3：Esc 关热榜（不退出宇宙）
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  s = await st();
  console.log('S3 Esc关热榜:', JSON.stringify(s), s.shell && !s.hot ? 'PASS' : 'FAIL');

  // 场景4：Esc 关已习得
  await page.click('#uniKnowBtn'); await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  s = await st();
  console.log('S4 Esc关已习得:', JSON.stringify(s), s.shell && !s.know ? 'PASS' : 'FAIL');

  // 场景5：开着已习得退出宇宙 → 重进 → 面板应关闭
  await page.click('#uniKnowBtn'); await page.waitForTimeout(400);
  await page.click('#uniBack'); await page.waitForTimeout(600);
  await page.evaluate(() => { if (window.showView) window.showView('uni'); });
  await page.waitForTimeout(2200);
  s = await st();
  console.log('S5 退出清理重进:', JSON.stringify(s), s.shell && !s.know ? 'PASS' : 'FAIL');

  console.log('ERRORS', errors.length ? errors.slice(0, 5) : 'none');
  await page.screenshot({ path: '_verify_overlay.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
