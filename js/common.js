/* common.js — helpers shared by the survey and the dashboard. */

window.U = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const byId = Object.fromEntries(SURVEY.questions.map((q) => [q.id, q]));

  /** Questions shown to this respondent, in order. */
  const visible = (answers) => SURVEY.questions.filter((q) => !q.showIf || q.showIf(answers));

  const otherText = (answers, q) => (answers[q.id + '_other'] || '').trim();

  function isAnswered(q, answers) {
    const v = answers[q.id];
    switch (q.type) {
      case 'fields': return !!v && q.fields.some((f) => (v[f.key] || '').trim());
      case 'single': return !!v && (v !== 'Other' || !!otherText(answers, q));
      case 'multi':  return Array.isArray(v) && v.length > 0 && (!v.includes('Other') || !!otherText(answers, q));
      case 'grid':   return !!v && q.rows.every((r) => v[r]);
      case 'text':   return typeof v === 'string' && v.trim().length >= 2;
    }
    return false;
  }

  function format(q, answers) {
    const v = answers[q.id];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
    const withOther = (x) => (x === 'Other' ? 'Other: ' + (otherText(answers, q) || '—') : x);
    switch (q.type) {
      case 'fields': return q.fields.map((f) => (v[f.key] || '').trim()).filter(Boolean).join(', ');
      case 'single': return withOther(v);
      case 'multi':  return v.map(withOther).join('; ');
      case 'grid':   return Object.keys(v).length + ' of ' + q.rows.length + ' rated';
      case 'text':   return v.trim();
    }
    return String(v);
  }

  /** One flat column per answer — shared by the CSV export and the Google Sheet. */
  function columns() {
    const cols = [['id', (r) => r.id], ['submittedAt', (r) => r.submittedAt], ['durationSec', (r) => r.durationSec]];
    for (const q of SURVEY.questions) {
      if (q.type === 'fields') q.fields.forEach((f) => cols.push([`Q${q.num} ${f.label}`, (r) => r.answers[q.id]?.[f.key] || '']));
      else if (q.type === 'grid') q.rows.forEach((row) => cols.push([`Q${q.num} ${row}`, (r) => r.answers[q.id]?.[row] || '']));
      else {
        cols.push([`Q${q.num} ${q.title}`, (r) => (Array.isArray(r.answers[q.id]) ? r.answers[q.id].join('; ') : r.answers[q.id] || '')]);
        if (q.other) cols.push([`Q${q.num} Other`, (r) => r.answers[q.id + '_other'] || '']);
      }
    }
    return cols;
  }

  const flatten = (r) => Object.fromEntries(columns().map(([name, get]) => [name, get(r) ?? '']));

  /* theme: follows the system until the person picks one */
  const THEME_KEY = 'mfd_theme';
  function initTheme(button) {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch {}
    if (saved) document.documentElement.dataset.theme = saved;
    const isDark = () => document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const paint = () => { button.innerHTML = isDark() ? ICON.sun : ICON.moon; button.title = isDark() ? 'Light mode' : 'Dark mode'; };
    button.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      paint();
    });
    paint();
  }

  let toastTimer;
  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  const ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    left: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>',
    clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
  };

  return { esc, byId, visible, isAnswered, format, otherText, columns, flatten, initTheme, toast, ICON };
})();
