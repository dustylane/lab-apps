/* Tiny IndexedDB key-value store for autosave (survives closing the tab). Fails quietly where unavailable. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const req = indexedDB.open('kerf-studio', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction('kv', mode); const s = t.objectStore('kv'); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
  }
  CI.store = {
    async get(k) { try { return await tx('readonly', s => s.get(k)); } catch (e) { return null; } },
    async set(k, v) { try { await tx('readwrite', s => s.put(v, k)); return true; } catch (e) { return false; } },
    async del(k) { try { await tx('readwrite', s => s.delete(k)); return true; } catch (e) { return false; } },
  };
})(window.CI);
