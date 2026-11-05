#!/usr/bin/env node
/* Optional: run the whole suite headlessly (needs Node + `npm i playwright`). Most people can just open tests.html. */
const path = require('path');
(async () => {
  let pw; try { pw = require('playwright'); } catch (e) { console.error('Playwright not installed. Open tests/tests.html in Chrome/Edge instead, or run: npm i playwright'); process.exit(2); }
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); if (process.env.VERBOSE && m.text().startsWith('[test]')) console.log(m.text()); });
  const timeout = +(process.env.TEST_TIMEOUT || 600000);
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?selftest=1' + (process.argv[2] ? '&grep=' + encodeURIComponent(process.argv[2]) : ''), { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__TEST_RESULTS__, null, { timeout });
  const r = await page.evaluate(() => window.__TEST_RESULTS__);
  console.log(`\n${r.passed} passed, ${r.failed} failed (${(r.durationMs / 1000).toFixed(1)} s)`);
  r.failures.forEach(f => console.log(`  ✘ [${f.suite}] ${f.test}\n      ${f.error}`));
  if (errors.length) { console.log('\nBrowser errors:'); errors.forEach(e => console.log('  ' + e)); }
  await browser.close();
  process.exit(r.failed || errors.length ? 1 : 0);
})();
