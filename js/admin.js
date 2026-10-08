/* admin.js — the results dashboard. Click any bar to filter every chart by it. */

(() => {
  const { esc, byId, format, toast } = U;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const key = new URLSearchParams(location.search).get('key') || '';
  const GRID = SURVEY.questions.find((q) => q.type === 'grid');
  const CHOICE = SURVEY.questions.filter((q) => q.type === 'single' || q.type === 'multi');

  let real = [];
  let source = 'server';
  let demo = false;
  let demoAuto = false;
  let filters = [];          // { qid, value } or { qid, row, min }
  let tab = 'overview';
  let heatSort = { col: 'avg', dir: -1 };
  let textQuery = '';

  const all = () => (demo ? sample() : real);

  /* ── filtering ───────────────────────────────────────────── */

  const matches = (r, f) => {
    const v = r.answers[f.qid];
    if (f.row) return (v?.[f.row] || 0) >= f.min;
    return Array.isArray(v) ? v.includes(f.value) : v === f.value;
  };
  const filtered = () => all().filter((r) => filters.every((f) => matches(r, f)));
  const sameFilter = (a, b) => a.qid === b.qid && a.value === b.value && a.row === b.row;

  function toggleFilter(f) {
    const i = filters.findIndex((x) => sameFilter(x, f));
    if (i >= 0) filters.splice(i, 1);
    else filters.push(f);
    paint();
  }

  /* ── load ────────────────────────────────────────────────── */

  async function load() {
    const res = await Store.list(key);
    source = res.source;
    real = res.responses.filter((r) => r && r.answers);
    // Preview with sample data until the first real response arrives.
    if (!real.length && source !== 'locked' && !demo) demo = demoAuto = true;
    else if (real.length && demoAuto) demo = demoAuto = false;
    paint();
  }

  /* ── paint ───────────────────────────────────────────────── */

  function paint() {
    const rows = filtered();
    paintSource();
    paintFilters();
    paintKpis(rows);
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
    $('#demo').textContent = demo ? 'Hide sample data' : 'Show sample data';

    const view = $('#view');
    if (source === 'locked') {
      view.innerHTML = `<div class="empty-state"><h2>Dashboard is locked</h2><p>Open this page with <code>?key=…</code> added to the address, using your ADMIN_KEY.</p></div>`;
      return;
    }
    if (!rows.length) {
      view.innerHTML = `<div class="empty-state"><h2>No responses ${filters.length ? 'match these filters' : 'yet'}</h2><p>${filters.length ? 'Remove a filter above.' : 'Share the survey link, or press “Show sample data” to preview the dashboard.'}</p></div>`;
      return;
    }
    ({ overview, questions, open, responses })[tab](view, rows);
    requestAnimationFrame(() => $$('.fill', view).forEach((el) => (el.style.width = el.dataset.w)));
  }

  function paintSource() {
    const el = $('#source');
    const msg = {
      server: `Live data · ${real.length} response${real.length === 1 ? '' : 's'} stored in ${Store.backend === 'sheets' ? 'the Google Sheet' : '<code>data/responses.json</code>'}.`,
      local: Store.backend === 'sheets'
        ? `The Google Sheet couldn't be reached, so you're seeing only responses saved in <b>this browser</b> (${real.length}).`
        : `The server isn't reachable, so you're seeing only responses saved in <b>this browser</b> (${real.length}). Run <code>node server.mjs</code> for shared data, or set <code>sheetsUrl</code> in <code>js/config.js</code>.`,
      locked: 'This dashboard needs an admin key.',
    }[source];
    el.className = 'source' + (source === 'server' && !demo ? '' : ' warn');
    el.innerHTML = demo ? `<b>Showing sample data</b> — 120 made-up responses so you can explore the dashboard. Nothing here is real. ${msg}` : msg;
  }

  function paintFilters() {
    const el = $('#filters');
    if (!filters.length) {
      el.innerHTML = `<span class="lbl">Tip: click any bar or heatmap row to filter every chart by it.</span>`;
      return;
    }
    el.innerHTML = `<span class="lbl">Filtered by</span>` + filters.map((f, i) => `
      <button class="fchip" data-i="${i}" title="Remove filter">Q${byId[f.qid].num}: ${esc(f.row ? `${short(f.row)} rated ${f.min}+` : short(f.value))}<span>✕</span></button>`).join('') +
      `<button class="btn text small" id="clear">Clear all</button>`;
    $$('.fchip', el).forEach((b) => b.addEventListener('click', () => { filters.splice(+b.dataset.i, 1); paint(); }));
    $('#clear', el).addEventListener('click', () => { filters = []; paint(); });
  }

  const short = (s) => (s.length > 42 ? s.slice(0, 40) + '…' : s);
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  function paintKpis(rows) {
    const total = all().length;
    const durations = rows.map((r) => r.durationSec).filter((d) => d > 0).sort((a, b) => a - b);
    const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
    const secondGen = rows.filter((r) => (r.answers.q2 || '').startsWith('Second-generation')).length;
    const heavyOps = rows.filter((r) => ['40–60%', 'More than 60%'].includes(r.answers.q16)).length;
    const greens = SURVEY.questions.filter((q) => q.priority === 2);
    const allGreen = rows.filter((r) => greens.every((q) => U.isAnswered(q, r.answers))).length;

    $('#kpis').innerHTML = [
      ['Responses', rows.length, filters.length ? `of ${total} total` : 'total'],
      ['Second-generation', pct(secondGen, rows.length) + '%', `${secondGen} respondents`],
      ['>40% time on non-revenue work', pct(heavyOps, rows.length) + '%', 'Q16'],
      ['Answered all recommended', pct(allGreen, rows.length) + '%', `${greens.length} green questions`],
      ['Median time to complete', median ? (median < 60 ? '<1' : Math.round(median / 60)) + ' min' : '—', 'start to submit'],
    ].map(([k, v, s]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  /* ── views ───────────────────────────────────────────────── */

  function overview(view, rows) {
    const stats = gridStats(rows);
    const top = [...stats].sort((a, b) => b.avg - a.avg)[0];
    const p1 = CHOICE.filter((q) => q.priority === 1);

    view.innerHTML = `
      <div class="cards">
        <div class="card wide">
          <div class="card-top"><span class="badge p1">High priority · Q12</span><span>${rows.length} respondents</span></div>
          <h3>Challenge heatmap — how hard is each one today?</h3>
          <div class="sub">Cells show % of respondents giving each rating. Biggest challenge right now: <b style="color:var(--text)">${esc(top.row)}</b> (avg ${top.avg.toFixed(2)}). Click a header to sort, a row to filter to people who rated it 4–5.</div>
          <div class="heat-wrap">${heatmap(stats)}</div>
        </div>
        ${p1.map((q) => chartCard(q, rows)).join('')}
      </div>`;
    wire(view);
  }

  function questions(view, rows) {
    view.innerHTML = [1, 2, 3].map((p) => `
      <h2 style="font-size:16px;margin:24px 0 12px;display:flex;gap:10px;align-items:center">
        <span class="badge ${PRIORITY[p].key}">${PRIORITY[p].long}</span>
        <span style="color:var(--muted);font-weight:500">${PRIORITY[p].label} in the survey</span>
      </h2>
      <div class="cards">${CHOICE.filter((q) => q.priority === p).map((q) => chartCard(q, rows)).join('')}</div>`).join('');
    wire(view);
  }

  function open(view, rows) {
    const q = byId.q13;
    const texts = rows.filter((r) => (r.answers.q13 || '').trim());
    const counts = {};
    for (const r of texts) {
      const hit = GRID.rows.find((row) => r.answers.q13.startsWith(row));
      if (hit) counts[hit] = (counts[hit] || 0) + 1;
    }
    const themes = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const shown = texts.filter((r) => !textQuery || r.answers.q13.toLowerCase().includes(textQuery.toLowerCase()));

    view.innerHTML = `
      <div class="cards">
        <div class="card">
          <div class="card-top"><span class="badge p1">High priority · Q13</span></div>
          <h3>Answers that match a Q12 challenge</h3>
          <div class="sub">Respondents who picked one of their top-rated challenges. Click to search for it.</div>
          <div class="bars">${themes.map(([t, n]) => barHtml(t, n, texts.length, { search: t })).join('') || '<p class="sub">None yet.</p>'}</div>
        </div>
        <div class="card">
          <div class="card-top"><span>${shown.length} of ${texts.length} answers</span></div>
          <h3>${esc(q.title)}</h3>
          <input class="input" id="search" placeholder="Search answers…" value="${esc(textQuery)}" style="margin:10px 0 12px">
          <div class="texts">
            ${shown.map((r) => `<div class="text-item">${esc(r.answers.q13)}<small>${esc(r.answers.q2 ? short(r.answers.q2) : '—')} · ${esc(r.answers.q10 || '')}</small></div>`).join('') || '<p class="sub">No answers match.</p>'}
          </div>
        </div>
      </div>`;
    const input = $('#search', view);
    input.addEventListener('input', () => { textQuery = input.value; paint(); const i = $('#search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
    $$('[data-search]', view).forEach((b) => b.addEventListener('click', () => { textQuery = b.dataset.search; paint(); }));
  }

  function responses(view, rows) {
    const sorted = [...rows].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    view.innerHTML = `
      <div class="card">
        <div class="table-wrap">
          <table class="list">
            <thead><tr><th>Submitted</th><th>Name / city</th><th>Type</th><th>Years</th><th>AUM</th><th>Location</th><th>Time</th></tr></thead>
            <tbody>
              ${sorted.map((r) => `
                <tr class="click" data-id="${esc(r.id)}" tabindex="0">
                  <td>${r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                  <td>${esc(format(byId.q1, r.answers) || '—')}</td>
                  <td>${esc(short(r.answers.q2 || '—'))}</td>
                  <td>${esc(r.answers.q3 || '—')}</td>
                  <td>${esc(r.answers.q6 || '—')}</td>
                  <td>${esc(r.answers.q10 || '—')}</td>
                  <td>${r.durationSec ? Math.round(r.durationSec / 60) + ' min' : '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    $$('tr.click', view).forEach((tr) => {
      const openIt = () => showResponse(rows.find((r) => r.id === tr.dataset.id));
      tr.addEventListener('click', openIt);
      tr.addEventListener('keydown', (e) => e.key === 'Enter' && openIt());
    });
  }

  function showResponse(r) {
    $('#modal-title').textContent = format(byId.q1, r.answers) || 'Anonymous response';
    $('#modal-body').innerHTML = SURVEY.questions.map((q) => {
      let ans = esc(format(q, r.answers)) || '<span style="color:var(--faint)">—</span>';
      if (q.type === 'grid') {
        const v = r.answers[q.id] || {};
        ans = `<div class="mini-bars">${q.rows.map((row) => `<div><span>${esc(row)}</span><span style="display:flex;align-items:center;gap:6px"><i style="width:${(v[row] || 0) * 14}px"></i>${v[row] || '—'}</span></div>`).join('')}</div>`;
      }
      return `<div class="review-item" style="grid-template-columns:1fr"><div><div class="rq"><b>Q${q.num}</b> ${esc(q.title)} <span class="badge ${PRIORITY[q.priority].key}">${PRIORITY[q.priority].label}</span></div><div class="ra">${ans}</div></div></div>`;
    }).join('');
    $('#modal').showModal();
  }

  /* ── charts ──────────────────────────────────────────────── */

  function chartCard(q, rows) {
    const opts = [...q.options, ...(q.other ? ['Other'] : [])];
    const answered = rows.filter((r) => U.isAnswered(q, r.answers) || (q.whenHidden && r.answers[q.id]));
    const counts = opts.map((o) => answered.filter((r) => (q.type === 'multi' ? (r.answers[q.id] || []).includes(o) : r.answers[q.id] === o)).length);
    const others = q.other ? answered.map((r) => r.answers[q.id + '_other']).filter(Boolean) : [];
    const p = PRIORITY[q.priority];

    return `
      <div class="card">
        <div class="card-top"><span class="badge ${p.key}">${p.long} · Q${q.num}</span><span>${answered.length} answered${q.type === 'multi' ? ' · multi-select' : ''}</span></div>
        <h3>${esc(q.title)}</h3>
        <div class="sub">${q.type === 'multi' ? '% of respondents who selected each' : '% of respondents'}${q.showIf ? ' · shown only to second-generation practitioners' : ''}</div>
        <div class="bars">${opts.map((o, i) => barHtml(o, counts[i], answered.length, { qid: q.id, value: o })).join('')}</div>
        ${others.length ? `<details style="margin-top:10px;font-size:13px"><summary style="cursor:pointer;color:var(--muted)">${others.length} “Other” answer${others.length > 1 ? 's' : ''}</summary><ul>${others.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></details>` : ''}
      </div>`;
  }

  function barHtml(label, n, total, data) {
    const active = data.qid && filters.some((f) => sameFilter(f, { qid: data.qid, value: data.value }));
    const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    return `
      <button class="bar ${active ? 'active' : ''}" ${attrs} title="${esc(label)} — ${n} (${pct(n, total)}%)">
        <span><span class="bl">${esc(label)}</span><span class="track"><span class="fill" data-w="${pct(n, total)}%"></span></span></span>
        <span class="bn"><b>${pct(n, total)}%</b> · ${n}</span>
      </button>`;
  }

  function gridStats(rows) {
    return GRID.rows.map((row) => {
      const vals = rows.map((r) => r.answers[GRID.id]?.[row]).filter(Boolean);
      const dist = [1, 2, 3, 4, 5].map((n) => vals.filter((v) => v === n).length);
      return { row, n: vals.length, dist, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
    });
  }

  function heatmap(stats) {
    const val = (s, col) => (col === 'avg' ? s.avg : col === 'row' ? s.row : s.dist[col - 1] / (s.n || 1));
    const sorted = [...stats].sort((a, b) => {
      const x = val(a, heatSort.col), y = val(b, heatSort.col);
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * heatSort.dir;
    });
    const th = (col, label) => `<th data-col="${col}" class="${heatSort.col === col ? 'sorted' : ''}">${label}${heatSort.col === col ? (heatSort.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`;
    // Shade relative to the busiest cell so differences stay visible.
    const peak = Math.max(0.01, ...stats.flatMap((s) => s.dist.map((d) => d / (s.n || 1))));
    const cell = (p) => {
      const t = p / peak;
      return `<td style="background:color-mix(in srgb, var(--heat-1) ${Math.round(t * 90)}%, var(--heat-0));color:${t > 0.55 ? 'var(--on-accent)' : 'var(--text)'}">${Math.round(p * 100)}%</td>`;
    };

    return `
      <table class="heat">
        <thead><tr>${th('row', 'Challenge')}${[1, 2, 3, 4, 5].map((n) => th(n, n)).join('')}${th('avg', 'Avg')}</tr></thead>
        <tbody>
          ${sorted.map((s) => {
            const active = filters.some((f) => f.row === s.row);
            return `<tr class="heat-row" data-row="${esc(s.row)}" style="cursor:pointer${active ? ';outline:2px solid var(--accent);outline-offset:-1px' : ''}" title="Filter to respondents who rated this 4 or 5">
              <td>${esc(s.row)}</td>
              ${s.dist.map((d) => cell(s.n ? d / s.n : 0)).join('')}
              <td class="avg">${s.avg.toFixed(2)}<span class="avgbar" style="width:${s.avg * 10}px"></span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function wire(view) {
    $$('.bar[data-qid]', view).forEach((b) => b.addEventListener('click', () => toggleFilter({ qid: b.dataset.qid, value: b.dataset.value })));
    $$('.heat th', view).forEach((th) => th.addEventListener('click', () => {
      const col = isNaN(th.dataset.col) ? th.dataset.col : +th.dataset.col;
      heatSort = heatSort.col === col ? { col, dir: -heatSort.dir } : { col, dir: col === 'row' ? 1 : -1 };
      paint();
    }));
    $$('.heat-row', view).forEach((tr) => tr.addEventListener('click', () => toggleFilter({ qid: GRID.id, row: tr.dataset.row, min: 4 })));
  }

  /* ── export ──────────────────────────────────────────────── */

  function toCsv(rows) {
    const cols = U.columns();
    const cellCsv = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + [cols.map((c) => cellCsv(c[0])).join(','), ...rows.map((r) => cols.map((c) => cellCsv(c[1](r))).join(','))].join('\n');
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  /* ── sample data (made up, for previewing the dashboard) ─── */

  let sampleCache;
  function sample() {
    if (sampleCache) return sampleCache;
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pick = (arr, skew = 1) => arr[Math.floor(Math.pow(rnd(), skew) * arr.length)];
    const bias = GRID.rows.map(() => 1.5 + rnd() * 3);
    const cities = ['Pune', 'Indore', 'Jaipur', 'Surat', 'Nagpur', 'Mumbai', 'Lucknow', 'Coimbatore', 'Kochi', 'Bhopal'];

    sampleCache = Array.from({ length: 120 }, (_, i) => {
      const a = {};
      if (rnd() < 0.5) a.q1 = { name: '', city: pick(cities) };
      a.q2 = pick(byId.q2.options, 1.3);
      for (const id of ['q3', 'q4', 'q6', 'q7', 'q8', 'q9', 'q10', 'q15', 'q16']) {
        if (byId[id].priority > 1 && rnd() < 0.12) continue;
        a[id] = pick(byId[id].options, 1.4);
      }
      for (const id of ['q5', 'q11', 'q14']) {
        const q = byId[id];
        const n = 1 + Math.floor(rnd() * (q.max || 3));
        a[id] = [...new Set(Array.from({ length: n }, () => pick(q.options, 1.6)))];
      }
      a.q12 = Object.fromEntries(GRID.rows.map((r, j) => [r, Math.max(1, Math.min(5, Math.round(bias[j] + (rnd() - 0.5) * 2.4)))]));
      const top = [...GRID.rows].sort((x, y) => a.q12[y] - a.q12[x])[0];
      a.q13 = rnd() < 0.6 ? top : pick(['Getting a steady flow of referrals', 'One platform for MF, insurance and NPS', 'Building trust with clients older than me', 'Time to learn new products']);
      a.q17 = a.q2.startsWith('Second') ? pick(byId.q17.options.slice(0, 5)) : 'Not applicable';
      const dur = 420 + Math.floor(rnd() * 900);
      const when = new Date(Date.now() - rnd() * 20 * 86400000);
      return { id: 'sample-' + i, answers: a, durationSec: dur, submittedAt: when.toISOString() };
    });
    return sampleCache;
  }

  /* ── wiring ──────────────────────────────────────────────── */

  $$('.tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; paint(); }));
  $('#refresh').addEventListener('click', async () => { await load(); toast('Updated'); });
  $('#demo').addEventListener('click', () => { demo = !demo; demoAuto = false; filters = []; paint(); });
  $('#csv').addEventListener('click', () => {
    const rows = filtered();
    if (!rows.length) return toast('Nothing to export');
    download(`mfd-survey-${demo ? 'SAMPLE-' : ''}${stamp()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  });
  $('#json').addEventListener('click', () => {
    const rows = filtered();
    if (!rows.length) return toast('Nothing to export');
    download(`mfd-survey-${demo ? 'SAMPLE-' : ''}${stamp()}.json`, JSON.stringify(rows, null, 2), 'application/json');
  });
  $('#modal-close').addEventListener('click', () => $('#modal').close());
  $('#modal').addEventListener('click', (e) => e.target.id === 'modal' && $('#modal').close());

  U.initTheme($('#theme'));
  load();
})();
