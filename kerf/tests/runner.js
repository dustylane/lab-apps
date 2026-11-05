/* Tiny dependency-free test framework. Results render on tests.html and are exposed on window.__TEST_RESULTS__ for headless runs. */
(function () {
  'use strict';
  const suites = []; let current = null;
  window.describe = (name, fn) => { const s = { name, tests: [] }; suites.push(s); const prev = current; current = s; fn(); current = prev; };
  window.it = (name, fn, timeout = 20000) => current.tests.push({ name, fn, timeout });

  class AssertionError extends Error {}
  const fmt = (v) => { try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v); } catch (e) { return String(v); } };
  window.expect = (actual) => {
    const api = {
      toBe: (e) => { if (actual !== e) throw new AssertionError(`expected ${fmt(actual)} to be ${fmt(e)}`); },
      toEqual: (e) => { if (fmt(actual) !== fmt(e)) throw new AssertionError(`expected ${fmt(actual)} to equal ${fmt(e)}`); },
      toBeTruthy: () => { if (!actual) throw new AssertionError(`expected ${fmt(actual)} to be truthy`); },
      toBeFalsy: () => { if (actual) throw new AssertionError(`expected ${fmt(actual)} to be falsy`); },
      toBeGreaterThan: (e) => { if (!(actual > e)) throw new AssertionError(`expected ${fmt(actual)} > ${e}`); },
      toBeLessThan: (e) => { if (!(actual < e)) throw new AssertionError(`expected ${fmt(actual)} < ${e}`); },
      toBeCloseTo: (e, tol = 1e-6) => { if (!(Math.abs(actual - e) <= tol)) throw new AssertionError(`expected ${fmt(actual)} ≈ ${e} (±${tol})`); },
      toContain: (e) => { if (!(actual && actual.indexOf && actual.indexOf(e) >= 0)) throw new AssertionError(`expected ${fmt(actual).slice(0, 200)} to contain ${fmt(e)}`); },
      toMatch: (re) => { if (!re.test(actual)) throw new AssertionError(`expected ${fmt(actual).slice(0, 200)} to match ${re}`); },
      toThrow: () => { let threw = false; try { actual(); } catch (e) { threw = true; } if (!threw) throw new AssertionError('expected function to throw'); },
    };
    api.not = {
      toBe: (e) => { if (actual === e) throw new AssertionError(`expected not ${fmt(e)}`); },
      toContain: (e) => { if (actual && actual.indexOf && actual.indexOf(e) >= 0) throw new AssertionError(`expected not to contain ${fmt(e)}`); },
      toThrow: () => { try { actual(); } catch (e) { throw new AssertionError('expected not to throw, got: ' + e.message); } },
    };
    return api;
  };

  async function runAll() {
    const out = document.getElementById('results'); const sum = document.getElementById('summary');
    if (!out || !sum) throw new Error('test results container missing');
    const results = { passed: 0, failed: 0, failures: [], durationMs: 0 };
    const t0 = performance.now();
    for (const s of suites) {
      const sec = document.createElement('section'); sec.innerHTML = `<h2>${s.name}</h2>`; out.appendChild(sec);
      for (const t of s.tests) {
        const grep = new URLSearchParams(location.search).get('grep');
        if (grep && !(s.name + ' ' + t.name).toLowerCase().includes(grep.toLowerCase())) continue;
        const row = document.createElement('div'); row.className = 'test running'; row.textContent = '… ' + t.name; sec.appendChild(row);
        await new Promise(r => setTimeout(r, 0));   // let the page breathe (progress shows, load events fire)
        const ts = performance.now(); console.log('[test] ' + s.name + ' :: ' + t.name);
        try {
          await Promise.race([Promise.resolve().then(t.fn), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout after ' + t.timeout + 'ms')), t.timeout))]);
          results.passed++; row.className = 'test pass'; row.textContent = '✔ ' + t.name + `  (${Math.round(performance.now() - ts)} ms)`;
        } catch (e) {
          results.failed++; row.className = 'test fail'; row.innerHTML = '✘ ' + t.name + '<pre>' + (e && (e.stack || e.message) || e) + '</pre>';
          results.failures.push({ suite: s.name, test: t.name, error: String(e && e.message || e) });
        }
        sum.textContent = `${results.passed} passed, ${results.failed} failed`;
      }
    }
    results.durationMs = Math.round(performance.now() - t0);
    sum.textContent = `${results.passed} passed, ${results.failed} failed  ·  ${(results.durationMs / 1000).toFixed(1)} s`;
    sum.className = results.failed ? 'bad' : 'good';
    window.__TEST_RESULTS__ = results;
    return results;
  }
  window.__runTests = runAll;
})();
