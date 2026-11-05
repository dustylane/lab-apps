/* Loads the test suite into the running app when opened as index.html?selftest=1 (works from file:// with no server). */
(function () {
  'use strict';
  if (!/[?&]selftest=1/.test(location.search)) return;
  const css = `#selftest{position:fixed;left:60px;top:56px;bottom:34px;width:470px;z-index:200;background:rgba(18,17,15,.97);border:1px solid #4a453c;border-radius:10px;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.6);font:12.5px/1.45 system-ui,sans-serif;color:#ede8dc}
  #selftest header{padding:10px 14px;border-bottom:1px solid #3a362f;display:flex;gap:10px;align-items:baseline}#selftest header b{font-size:14px}
  #summary.good{color:#7fe0a0;font-weight:700}#summary.bad{color:#ff8f80;font-weight:700}#results{overflow:auto;padding:4px 12px 20px}
  #results h2{font-size:11px;margin:14px 0 4px;text-transform:uppercase;letter-spacing:.07em;color:#a59d8c}.test{padding:2px 6px;border-radius:4px;font-family:ui-monospace,monospace;font-size:11.5px}
  .test.pass{color:#7fe0a0}.test.fail{color:#ffb4a8;background:#3a1612}.test.running{color:#888}.test pre{white-space:pre-wrap;margin:3px 0 2px 14px;font-size:11px}
  #selftest button{margin-left:auto;background:#2e2b25;border:1px solid #4a453c;color:#ede8dc;border-radius:6px;padding:3px 9px;cursor:pointer}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const box = document.createElement('div'); box.id = 'selftest';
  box.innerHTML = '<header><b>Kerf self-test</b><span id="summary">loading…</span><button id="st-hide" title="Hide/show results">Hide</button></header><div id="results"></div>';
  document.body.appendChild(box);
  document.getElementById('st-hide').onclick = () => { const r = document.getElementById('results'); r.hidden = !r.hidden; };
  const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.body.appendChild(s); });
  (async () => {
    const t0 = Date.now(); while (!window.__KERF_READY__ && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 30));
    try { for (const f of ['tests/runner.js', 'tests/core.test.js', 'tests/ui.test.js']) await load(f); await window.__runTests(); }
    catch (e) { document.getElementById('summary').textContent = 'Failed to start: ' + e.message; window.__TEST_RESULTS__ = { passed: 0, failed: 1, failures: [{ suite: 'boot', test: 'load', error: e.message }], durationMs: 0 }; }
  })();
})();
