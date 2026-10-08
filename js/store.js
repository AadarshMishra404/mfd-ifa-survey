/* store.js — where responses go.
 *
 * If CONFIG.sheetsUrl is set, responses are sent to that Google Apps Script
 * and land in a Google Sheet. Otherwise they are POSTed to /api/responses on
 * `node server.mjs` and kept in data/responses.json.
 *
 * If neither can be reached, responses are kept in this browser and pushed
 * the next time the page opens online.
 */

window.Store = (() => {
  const DRAFT_KEY = 'mfd_survey_draft_v1';
  const LOCAL_KEY = 'mfd_survey_local_v1';
  const SHEETS = (window.CONFIG && CONFIG.sheetsUrl) || '';

  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

  const readLocal = () => safe(() => JSON.parse(localStorage.getItem(LOCAL_KEY)) || [], []);
  const writeLocal = (list) => safe(() => localStorage.setItem(LOCAL_KEY, JSON.stringify(list)));

  async function post(response) {
    const res = SHEETS
      // text/plain keeps this a "simple" request, which Apps Script accepts cross-origin.
      ? await fetch(SHEETS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ response, flat: U.flatten(response) }) })
      : await fetch('api/responses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(response) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const body = await res.json();
    if (body.error) throw new Error(body.error);
    return body;
  }

  async function get(key) {
    const q = key ? '?key=' + encodeURIComponent(key) : '';
    const res = await fetch((SHEETS || 'api/responses') + q);
    if (res.status === 401) return null;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const body = await res.json();
    if (body && body.error === 'key required') return null;
    if (!Array.isArray(body)) throw new Error(body.error || 'bad response');
    return body;
  }

  return {
    backend: SHEETS ? 'sheets' : 'server',

    saveDraft: (draft) => safe(() => localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }))),
    loadDraft: () => safe(() => JSON.parse(localStorage.getItem(DRAFT_KEY)), null),
    clearDraft: () => safe(() => localStorage.removeItem(DRAFT_KEY)),

    /** Returns 'server' or 'local' depending on where it landed. */
    async submit(response) {
      try {
        await post(response);
        this.flushLocal();
        return 'server';
      } catch {
        writeLocal([...readLocal(), { ...response, pending: true }]);
        return 'local';
      }
    },

    /** Push anything that was saved locally while offline. */
    async flushLocal() {
      const pending = readLocal().filter((r) => r.pending);
      if (!pending.length) return;
      const kept = readLocal().filter((r) => !r.pending);
      for (const r of pending) {
        try { const { pending: _, ...clean } = r; await post(clean); }
        catch { kept.push(r); }
      }
      writeLocal(kept);
    },

    /** For the dashboard. Returns { source, responses }. */
    async list(key) {
      try {
        const responses = await get(key);
        if (!responses) return { source: 'locked', responses: [] };
        return { source: 'server', responses };
      } catch {
        return { source: 'local', responses: readLocal() };
      }
    },
  };
})();
