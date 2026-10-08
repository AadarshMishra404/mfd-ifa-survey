/* survey.js — the respondent flow: welcome → one question per screen → review → done. */

(() => {
  const { esc, visible, isAnswered, format, ICON, toast } = U;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const stage = $('#stage');
  const navbar = $('#navbar');
  const nextBtn = $('#next');
  const backBtn = $('#back');
  const progress = $('#progress');

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const fresh = () => ({ id: uid(), answers: {}, pos: 'welcome', furthest: 0, startedAt: null, nudged: {}, fromReview: false });

  let S = fresh();
  let gridActive = 0;       // row with keyboard focus on the Q12 grid
  let advanceTimer = null;  // auto-advance after a single-choice pick

  const list = () => visible(S.answers);
  const current = () => (typeof S.pos === 'number' ? list()[S.pos] : null);

  /* ── persistence ─────────────────────────────────────────── */

  let savedTimer;
  function persist() {
    if (S.pos === 'done') return;
    Store.saveDraft({ id: S.id, answers: S.answers, pos: S.pos, furthest: S.furthest, startedAt: S.startedAt, nudged: S.nudged });
    const el = $('#save-state');
    el.textContent = 'Saved ✓';
    el.style.opacity = 1;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (el.style.opacity = 0.6), 1200);
  }

  function setAnswer(id, value) {
    S.answers[id] = value;
    persist();
    paintProgress();
  }

  /* ── navigation ──────────────────────────────────────────── */

  function go(pos, dir = 1) {
    clearTimeout(advanceTimer);
    S.pos = pos;
    if (typeof pos === 'number') S.furthest = Math.max(S.furthest, pos);
    persist();
    render(dir);
    window.scrollTo(0, 0);
  }

  function next() {
    const q = current();
    if (S.pos === 'review') return submit();
    if (!q) return;

    if (!isAnswered(q, S.answers)) {
      if (q.priority === 1) return blockRequired(q);
      if (q.priority === 2 && !S.nudged[q.id]) {
        S.nudged[q.id] = true;
        persist();
        return showNudge('warn', 'This one helps us a lot', 'It takes a few seconds. Tap Next again if you\'d rather skip it.');
      }
    }

    if (S.fromReview) { S.fromReview = false; return go('review'); }
    const n = list().length;
    go(S.pos + 1 < n ? S.pos + 1 : 'review');
  }

  function back() {
    if (S.pos === 'review') return go(list().length - 1, -1);
    if (S.pos === 0) return go('welcome', -1);
    if (typeof S.pos === 'number') go(S.pos - 1, -1);
  }

  function blockRequired(q) {
    if (q.type === 'grid') {
      const missing = q.rows.filter((r) => !(S.answers.q12 || {})[r]);
      $$('.row').forEach((el) => el.classList.toggle('missing', missing.includes(el.dataset.row)));
      const first = $('.row.missing');
      if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); gridActive = q.rows.indexOf(first.dataset.row); paintGridActive(); }
      return showNudge('error', `${missing.length} still to rate`, 'Please rate every challenge — it\'s the most important question in the survey.');
    }
    if ((q.type === 'single' || q.type === 'multi') && isOtherEmpty(q)) {
      $('.other-input input')?.focus();
      return showNudge('error', 'Tell us what "Other" is', 'Add a few words in the box, or pick a listed option.');
    }
    $$('.opt').forEach((o) => { o.classList.remove('shake'); void o.offsetWidth; o.classList.add('shake'); });
    showNudge('error', 'This question is required', 'It\'s one of the high-priority questions — please answer to continue.');
  }

  const isOtherEmpty = (q) => {
    const v = S.answers[q.id];
    const picked = Array.isArray(v) ? v.includes('Other') : v === 'Other';
    return picked && !U.otherText(S.answers, q);
  };

  function showNudge(kind, title, body) {
    $('.nudge')?.remove();
    const el = document.createElement('div');
    el.className = 'nudge' + (kind === 'error' ? ' error' : '');
    el.setAttribute('role', 'alert');
    el.innerHTML = `${ICON.info}<div><b>${esc(title)}</b>${esc(body)}</div>`;
    $('.screen').append(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── progress bar ────────────────────────────────────────── */

  function paintProgress() {
    const qs = list();
    const onQuestion = typeof S.pos === 'number';
    progress.hidden = S.pos === 'welcome' || S.pos === 'done';
    progress.innerHTML = qs.map((q, i) => {
      const done = isAnswered(q, S.answers);
      const skipped = !done && i < S.furthest;
      const cls = ['seg', done && 'done', skipped && 'skipped', onQuestion && i === S.pos && 'current'].filter(Boolean).join(' ');
      return `<button class="${cls}" data-i="${i}" title="Q${q.num}. ${esc(q.title)}" aria-label="Question ${q.num}${done ? ', answered' : ''}"></button>`;
    }).join('');
    $$('.seg', progress).forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (i <= S.furthest || S.pos === 'review') go(i, i < S.pos ? -1 : 1);
      else toast('Answer the earlier questions first');
    }));

    const q = current();
    $('#section-label').textContent = q ? ` · Section ${q.section}` : S.pos === 'review' ? ' · Review' : '';
  }

  /* ── screens ─────────────────────────────────────────────── */

  function render(dir = 1) {
    paintProgress();
    navbar.hidden = S.pos === 'welcome' || S.pos === 'done';
    stage.innerHTML = '';
    const screen = document.createElement('section');
    screen.className = 'screen' + (dir < 0 ? ' back' : '');
    stage.append(screen);

    if (S.pos === 'welcome') return renderWelcome(screen);
    if (S.pos === 'review') return renderReview(screen);
    if (S.pos === 'done') return renderDone(screen);
    renderQuestion(screen, current());
  }

  function renderWelcome(el) {
    const draft = Store.loadDraft();
    const resumable = !!draft && (typeof draft.pos === 'number' || draft.pos === 'review');
    const counts = [1, 2, 3].map((p) => SURVEY.questions.filter((q) => q.priority === p).length);

    el.innerHTML = `
      <div class="hero">
        ${resumable ? `
          <div class="resume-card">
            <div><b>Welcome back.</b> You answered ${Object.keys(draft.answers || {}).filter((k) => !k.endsWith('_other')).length} questions last time.</div>
            <div class="cta-row">
              <button class="btn small" id="resume">Resume where I left off</button>
              <button class="btn text small" id="restart">Start over</button>
            </div>
          </div>` : ''}
        <div class="eyebrow">Practitioner survey · 2026</div>
        <h1>${esc(SURVEY.title)}</h1>
        ${SURVEY.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
        <div class="meta-row">
          <span class="chip">${ICON.clock} ${SURVEY.minutes} minutes</span>
          <span class="chip">${ICON.list} ${SURVEY.questions.length} questions · 2 sections</span>
          <span class="chip">${ICON.lock} Confidential</span>
          <span class="chip">${ICON.phone} Works on your phone</span>
        </div>
        <div class="info-grid">
          <div class="info-card"><h3>Who should take it</h3><p>${esc(SURVEY.whoShould)}</p></div>
          <div class="info-card"><h3>How to answer</h3><p>${esc(SURVEY.howTo)}</p></div>
          <div class="info-card">
            <h3>Question labels</h3>
            <div class="legend" style="margin-top:8px">
              <span class="badge p1">Required · ${counts[0]}</span>
              <span class="badge p2">Recommended · ${counts[1]}</span>
              <span class="badge p3">Optional · ${counts[2]}</span>
            </div>
          </div>
        </div>
        <div class="cta-row">
          <button class="btn" id="start">Start the survey ${ICON.right}</button>
          <span class="hint" style="color:var(--faint);font-size:13px">Press <kbd>Enter</kbd> to begin</span>
        </div>
      </div>`;

    $('#start', el).addEventListener('click', () => {
      if (resumable && !confirm('Start a new response? Your saved answers will be cleared.')) return;
      if (resumable) Store.clearDraft();
      S = fresh();
      S.startedAt = new Date().toISOString();
      go(0);
    });
    if (resumable) {
      $('#resume', el).addEventListener('click', () => {
        S = { ...fresh(), ...draft, fromReview: false, nudged: draft.nudged || {} };
        go(S.pos);
      });
      $('#restart', el).addEventListener('click', () => { Store.clearDraft(); S = fresh(); render(); });
    }
  }

  function header(q) {
    const p = PRIORITY[q.priority];
    const counter = q.type === 'multi' && q.max ? `<span class="q-counter" id="counter"></span>` : '';
    return `
      <div class="q-head">
        <div class="q-meta">
          <span class="q-num">Q${q.num}</span>
          <span>Section ${q.section} · ${esc(SURVEY.sections[q.section])}</span>
          <span class="badge ${p.key}">${p.label}</span>
          ${counter}
        </div>
        <h2 class="q-title" id="qt">${esc(q.title)}</h2>
        ${q.hint ? `<p class="q-hint">${esc(q.hint)}</p>` : ''}
      </div>`;
  }

  function renderQuestion(el, q) {
    el.innerHTML = header(q) + '<div id="body"></div>';
    const body = $('#body', el);
    ({ fields: renderFields, single: renderChoice, multi: renderChoice, grid: renderGrid, text: renderText })[q.type](body, q);

    nextBtn.textContent = S.fromReview ? 'Back to review' : S.pos === list().length - 1 ? 'Review answers' : 'Next';
    nextBtn.innerHTML += ' ' + ICON.right;
    backBtn.hidden = false;
    $('#kbd-hint').innerHTML = q.type === 'grid'
      ? '<kbd>1</kbd>–<kbd>5</kbd> rate · <kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> next'
      : q.type === 'single' || q.type === 'multi'
        ? '<kbd>1</kbd>–<kbd>9</kbd> choose · <kbd>Enter</kbd> next'
        : '<kbd>Enter</kbd> next';
  }

  function renderFields(body, q) {
    const v = S.answers[q.id] || {};
    body.innerHTML = q.fields.map((f) => `
      <div class="field">
        <label for="f-${f.key}">${esc(f.label)}</label>
        <input class="input" id="f-${f.key}" data-key="${f.key}" placeholder="${esc(f.placeholder)}" value="${esc(v[f.key] || '')}" autocomplete="${f.key === 'name' ? 'name' : 'address-level2'}" maxlength="80">
      </div>`).join('');
    $$('input', body).forEach((inp) => inp.addEventListener('input', () => {
      setAnswer(q.id, { ...(S.answers[q.id] || {}), [inp.dataset.key]: inp.value });
    }));
    setTimeout(() => $('input', body)?.focus(), 250);
  }

  function renderChoice(body, q) {
    const multi = q.type === 'multi';
    const opts = [...q.options, ...(q.other ? ['Other'] : [])];
    const isOn = (o) => (multi ? (S.answers[q.id] || []).includes(o) : S.answers[q.id] === o);

    body.innerHTML = `
      <div class="options" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="qt">
        ${opts.map((o, i) => `
          <button class="opt ${multi ? 'multi' : ''}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${isOn(o)}" data-v="${esc(o)}">
            <span class="key">${i < 9 ? i + 1 : ''}</span>
            <span class="label">${esc(o)}</span>
            <span class="tick">${ICON.check}</span>
          </button>`).join('')}
      </div>
      ${q.other ? `
        <div class="other-input ${isOn('Other') ? 'show' : ''}">
          <input class="input" placeholder="Please specify…" maxlength="120" value="${esc(S.answers[q.id + '_other'] || '')}" aria-label="Other, please specify">
        </div>` : ''}`;

    const paint = () => {
      const sel = multi ? S.answers[q.id] || [] : [S.answers[q.id]].filter(Boolean);
      const full = multi && q.max && sel.length >= q.max;
      $$('.opt', body).forEach((b) => {
        b.setAttribute('aria-checked', isOn(b.dataset.v));
        b.classList.toggle('locked', !!full && !isOn(b.dataset.v));
      });
      const c = $('#counter');
      if (c) { c.textContent = `${sel.length} / ${q.max} selected`; c.classList.toggle('full', !!full); }
      const other = $('.other-input', body);
      if (other) {
        const show = isOn('Other');
        if (show && !other.classList.contains('show')) setTimeout(() => $('input', other).focus(), 50);
        other.classList.toggle('show', show);
      }
    };

    const pick = (btn) => {
      $('.nudge')?.remove();
      const o = btn.dataset.v;
      if (multi) {
        const sel = [...(S.answers[q.id] || [])];
        if (sel.includes(o)) sel.splice(sel.indexOf(o), 1);
        else if (q.max && sel.length >= q.max) {
          btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
          return toast(`Up to ${q.max} — unselect one first`);
        } else sel.push(o);
        setAnswer(q.id, sel);
      } else {
        setAnswer(q.id, o);
        clearTimeout(advanceTimer);
        // Picking a single answer moves on by itself, unless "Other" needs typing.
        if (o !== 'Other') advanceTimer = setTimeout(next, 420);
      }
      btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
      paint();
    };

    $$('.opt', body).forEach((b) => b.addEventListener('click', () => pick(b)));
    $('.other-input input', body)?.addEventListener('input', (e) => setAnswer(q.id + '_other', e.target.value));
    body.pickByIndex = (i) => { const b = $$('.opt', body)[i]; if (b) pick(b); };
    paint();
  }

  function renderGrid(body, q) {
    const v = () => S.answers[q.id] || {};
    const firstOpen = q.rows.findIndex((r) => !v()[r]);
    gridActive = firstOpen === -1 ? 0 : firstOpen;

    body.innerHTML = `
      <div class="grid-tools">
        <div class="grid-progress" aria-hidden="true"><span id="gp"></span></div>
        <span class="q-counter" id="gcount"></span>
      </div>
      <div class="rows">
        ${q.rows.map((r, i) => `
          <div class="row" data-row="${esc(r)}" data-i="${i}">
            <div class="rlabel">${esc(r)}<small></small></div>
            <div class="rate" role="radiogroup" aria-label="${esc(r)}">
              ${[1, 2, 3, 4, 5].map((n) => `<button data-v="${n}" aria-pressed="false" role="radio" aria-label="${n} — ${esc(q.scale[n - 1])}" title="${esc(q.scale[n - 1])}">${n}</button>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;

    const paint = () => {
      const val = v();
      const done = q.rows.filter((r) => val[r]).length;
      $('#gp').style.width = (done / q.rows.length) * 100 + '%';
      $('#gcount').textContent = `${done} / ${q.rows.length} rated`;
      $('#gcount').classList.toggle('full', done === q.rows.length);
      $$('.row', body).forEach((row) => {
        const n = val[row.dataset.row];
        row.classList.toggle('rated', !!n);
        if (n) row.classList.remove('missing');
        $('small', row).textContent = n ? q.scale[n - 1] : '';
        $$('.rate button', row).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === n));
      });
      paintGridActive();
    };

    const rate = (i, n) => {
      $('.nudge')?.remove();
      setAnswer(q.id, { ...v(), [q.rows[i]]: n });
      // Hop to the next unrated row so a phone user can just keep tapping.
      const val = v();
      const nextOpen = q.rows.findIndex((r, j) => j > i && !val[r]);
      const anyOpen = q.rows.findIndex((r) => !val[r]);
      const target = nextOpen !== -1 ? nextOpen : anyOpen;
      if (target !== -1) {
        gridActive = target;
        setTimeout(() => $$('.row', body)[target]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
      } else {
        toast('All 16 rated — nice!');
      }
      paint();
    };

    $$('.row', body).forEach((row) => {
      const i = +row.dataset.i;
      $$('.rate button', row).forEach((b) => b.addEventListener('click', () => rate(i, +b.dataset.v)));
      row.addEventListener('pointerenter', () => { gridActive = i; paintGridActive(); });
    });
    body.rateActive = (n) => rate(gridActive, n);
    body.moveActive = (d) => {
      gridActive = Math.max(0, Math.min(q.rows.length - 1, gridActive + d));
      paintGridActive();
      $$('.row', body)[gridActive].scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    paint();
  }

  function paintGridActive() {
    $$('.row').forEach((row, i) => (row.style.boxShadow = i === gridActive ? '0 0 0 3px var(--accent-soft)' : ''));
  }

  function renderText(body, q) {
    const MAX = 500;
    const grid = U.byId[q.suggestFrom];
    const ratings = S.answers[q.suggestFrom] || {};
    const top = grid ? grid.rows.filter((r) => ratings[r] >= 4).sort((a, b) => ratings[b] - ratings[a]).slice(0, 6) : [];

    body.innerHTML = `
      <textarea class="input" id="ta" maxlength="${MAX}" placeholder="${esc(q.placeholder)}">${esc(S.answers[q.id] || '')}</textarea>
      <div class="char-count" id="cc"></div>
      ${top.length ? `
        <div class="suggest">
          <h4>Your highest-rated challenges from Q12 — tap one to use it</h4>
          <div class="suggest-list">
            ${top.map((r) => `<button class="suggest-chip" data-v="${esc(r)}"><b>${ratings[r]}</b>${esc(r)}</button>`).join('')}
          </div>
        </div>` : ''}`;

    const ta = $('#ta', body);
    const count = () => ($('#cc', body).textContent = `${ta.value.length} / ${MAX}`);
    ta.addEventListener('input', () => { setAnswer(q.id, ta.value); count(); $('.nudge')?.remove(); });
    $$('.suggest-chip', body).forEach((c) => c.addEventListener('click', () => {
      ta.value = c.dataset.v + (ta.value && !ta.value.startsWith(c.dataset.v) ? ' — ' + ta.value : '');
      setAnswer(q.id, ta.value);
      count();
      ta.focus();
    }));
    count();
    setTimeout(() => ta.focus(), 250);
  }

  function renderReview(el) {
    const qs = list();
    const missing = qs.filter((q) => q.priority === 1 && !isAnswered(q, S.answers));
    const sections = Object.keys(SURVEY.sections);

    el.innerHTML = `
      <div class="q-head">
        <div class="q-meta"><span class="q-num">Almost done</span></div>
        <h2 class="q-title">Review your answers</h2>
        <p class="q-hint">Tap any answer to change it.${missing.length ? ` <b style="color:var(--p1)">${missing.length} required question${missing.length > 1 ? 's' : ''} still need${missing.length > 1 ? '' : 's'} an answer.</b>` : ''}</p>
      </div>
      ${sections.map((s) => `
        <div class="review-section">
          <h3>Section ${s} · ${esc(SURVEY.sections[s])}</h3>
          ${qs.filter((q) => q.section === s).map((q) => {
            const i = qs.indexOf(q);
            const ans = format(q, S.answers);
            const need = q.priority === 1 && !isAnswered(q, S.answers);
            return `
              <div class="review-item ${need ? 'need' : ''}">
                <div>
                  <div class="rq"><b>Q${q.num}</b> ${esc(q.title)} <span class="badge ${PRIORITY[q.priority].key}">${PRIORITY[q.priority].label}</span></div>
                  <div class="ra ${ans ? '' : 'empty'}">${ans ? esc(ans) : need ? 'Required — not answered yet' : 'Skipped'}</div>
                  ${q.type === 'grid' ? gridSummary(q) : ''}
                </div>
                <button class="btn ghost small" data-edit="${i}">${need ? 'Answer' : 'Edit'}</button>
              </div>`;
          }).join('')}
        </div>`).join('')}`;

    $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => {
      S.fromReview = true;
      go(+b.dataset.edit, -1);
    }));

    backBtn.hidden = false;
    nextBtn.innerHTML = 'Submit survey ' + ICON.right;
    nextBtn.disabled = false;
    nextBtn.dataset.missing = missing.length;
    $('#kbd-hint').textContent = missing.length ? '' : 'Ready to submit';
  }

  function gridSummary(q) {
    const v = S.answers[q.id] || {};
    const top = q.rows.filter((r) => v[r]).sort((a, b) => v[b] - v[a]).slice(0, 5);
    if (!top.length) return '';
    return `<div class="mini-bars" aria-label="Your top-rated challenges">
      ${top.map((r) => `<div><span>${esc(r)}</span><span style="display:flex;align-items:center;gap:6px"><i style="width:${v[r] * 14}px"></i>${v[r]}/5</span></div>`).join('')}
    </div>`;
  }

  async function submit() {
    const qs = list();
    const missing = qs.filter((q) => q.priority === 1 && !isAnswered(q, S.answers));
    if (missing.length) {
      toast(`Please answer Q${missing[0].num} first`);
      S.fromReview = true;
      return go(qs.indexOf(missing[0]), -1);
    }

    // Record hidden questions with their default, and drop "Other" text that
    // no longer belongs to a selected "Other".
    const answers = { ...S.answers };
    for (const q of SURVEY.questions) {
      if (q.showIf && !q.showIf(answers)) answers[q.id] = q.whenHidden;
      const v = answers[q.id];
      const usesOther = Array.isArray(v) ? v.includes('Other') : v === 'Other';
      if (!usesOther) delete answers[q.id + '_other'];
    }

    nextBtn.disabled = true;
    nextBtn.textContent = 'Submitting…';
    const submittedAt = new Date().toISOString();
    const where = await Store.submit({
      id: S.id,
      version: 1,
      answers,
      startedAt: S.startedAt,
      submittedAt,
      durationSec: S.startedAt ? Math.round((Date.parse(submittedAt) - Date.parse(S.startedAt)) / 1000) : null,
    });
    nextBtn.disabled = false;
    Store.clearDraft();
    S.savedTo = where;
    go('done');
  }

  function renderDone(el) {
    const share = encodeURIComponent(`I just took the Next-Gen MFD & IFA Practice Survey — it takes ~12 minutes and shapes tools & training for advisors like us: ${location.origin}${location.pathname}`);
    el.innerHTML = `
      <div class="done">
        <div class="big-tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h1>Thank you!</h1>
        <p>Your response has been recorded. It will be reported only in aggregate, alongside other practitioners like you.</p>
        ${S.savedTo === 'local' ? `<p style="color:var(--warn)">We couldn't reach the server, so your response is saved on this device and will be sent automatically next time this page opens online.</p>` : ''}
        <div class="cta-row">
          <a class="btn" href="https://wa.me/?text=${share}" target="_blank" rel="noopener">Share with a fellow MFD</a>
          <button class="btn ghost" id="again">Submit another response</button>
        </div>
      </div>`;
    $('#again', el).addEventListener('click', () => { S = fresh(); render(); });
    confetti();
  }

  /* ── keyboard ────────────────────────────────────────────── */

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);

    if (S.pos === 'welcome' && e.key === 'Enter' && !typing) { e.preventDefault(); return $('#start')?.click(); }
    if (S.pos === 'done') return;

    const q = current();
    const body = $('#body');

    if (e.key === 'Enter' && !e.shiftKey) {
      if (document.activeElement?.tagName === 'TEXTAREA') return;
      if (!typing && document.activeElement?.tagName === 'BUTTON' && document.activeElement !== nextBtn) return;
      e.preventDefault();
      return next();
    }
    if (typing || !q || !body) return;

    if (q.type === 'grid') {
      if (/^[1-5]$/.test(e.key)) { e.preventDefault(); body.rateActive(+e.key); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); body.moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); body.moveActive(-1); }
    } else if ((q.type === 'single' || q.type === 'multi') && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      body.pickByIndex(+e.key - 1);
    }
  });

  nextBtn.addEventListener('click', next);
  backBtn.addEventListener('click', back);

  /* ── confetti ────────────────────────────────────────────── */

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = $('#confetti');
    const ctx = c.getContext('2d');
    const dpr = devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#2448c9', '#4a6cf0', '#2f8a3c', '#e0a020', '#d23434', '#7d97ff'];
    const parts = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
      r: Math.random() * 6 + 4, a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.3,
      color: colors[(Math.random() * colors.length) | 0],
    }));
    const start = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.color; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      }
      if (t - start < 3500) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(start);
  }

  /* ── boot ────────────────────────────────────────────────── */

  U.initTheme($('#theme'));
  Store.flushLocal();
  render();
})();
