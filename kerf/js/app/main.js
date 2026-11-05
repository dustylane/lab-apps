/* Boot. ?test=1 disables autosave restore so the test suite starts clean. */
(function () {
  'use strict';
  const test = /[?&](test|selftest)=1/.test(location.search);
  CI.fonts.loadBundled();
  const canvas = document.getElementById('canvas');
  const app = new CI.App(canvas, { checkDelay: test ? 0 : 600 });
  const tools = new CI.Tools(app);
  const ui = new CI.UI(app, tools);
  window.app = app; window.tools = tools; window.ui = ui;

  const stage = document.getElementById('stage');
  const fit = () => { const r = canvas.getBoundingClientRect(); if (r.width && r.height) { app.view.viewSize = new paper.Size(r.width, r.height); app.emit('view'); } };
  new ResizeObserver(() => fit()).observe(stage);
  fit(); app.zoomFitMat();
  app.runCutCheck();

  // autosave the session (IndexedDB) so a closed tab or crash never loses work
  if (!test) {
    const save = CI.util.debounce(() => { try { CI.store.set('autosave', app.projectJSON()); } catch (e) { /* ignore */ } }, 1500);
    app.on('change', save);
    CI.store.get('autosave').then(s => {
      const wizard = () => { if (!app.designItems().length) ui.modalWizard(); };
      if (!s) return wizard();
      try { const p = JSON.parse(s); if (!p.design || !JSON.stringify(p.design).includes('"children"')) return wizard(); } catch (e) { return wizard(); }
      const card = `<h2>Pick up where you left off?</h2><p class="help">Kerf saved your last session automatically.</p>
        <div class="acts" style="justify-content:flex-start"><button class="btn go" id="restore-yes">Restore last session</button><button class="btn" id="restore-no">Start fresh</button></div>`;
      const m = document.getElementById('modal'); document.getElementById('modal-card').innerHTML = card; m.hidden = false;
      document.getElementById('restore-yes').onclick = async () => { m.hidden = true; await ui.restoreAutosave(); };
      document.getElementById('restore-no').onclick = () => { m.hidden = true; };
    });
    window.addEventListener('beforeunload', () => { try { CI.store.set('autosave', app.projectJSON()); } catch (e) { /* ignore */ } });
  }
  window.__KERF_READY__ = true;
})();
