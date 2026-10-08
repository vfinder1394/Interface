// Einstieg: Routing, Rendering, Interaktionen
import { createStore, todayBerlin } from './data.js';
import { renderTables } from './views/tables.js';
import { renderGroupMatches } from './views/tables.js';
import { renderSchedule, defaultMatchday } from './views/schedule.js';
import { renderKnockout } from './views/knockout.js';
import { renderTeam } from './views/team.js';
import { esc, fmtRange, fmtShort, fmtShortY, fmtTime, installFlagFallback } from './ui.js';

const $ = (s, root = document) => root.querySelector(s);
const view = $('#view');
const hero = $('#hero');
const panel = $('#team-panel');
const scrim = $('#scrim');
const tooltip = $('#tooltip');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  model: null,
  route: { view: 'tabellen', league: 'A', group: null, md: null, filter: 'alle' },
  pushedTeam: false,
  prevHash: null,
  focusTab: null,
  skipGroupScroll: false,
  openGroups: new Set(),
  team: null,
  lastFocus: null,
  error: null,
};

/* ------------------------------------------------------------------ Routing */

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [v, a, b] = parts;
  if (v === 'spieltage') return { view: 'spieltage', team: null, md: Number(a) || null, filter: ['A', 'B', 'C', 'D'].includes(b) ? b : 'alle' };
  if (v === 'ko') return { view: 'ko', team: null };
  if (v === 'team' && a) return { view: 'tabellen', league: null, team: a.toUpperCase() };
  const league = ['A', 'B', 'C', 'D'].includes((a || '').toUpperCase()) ? a.toUpperCase() : state.route.league || 'A';
  return { view: 'tabellen', team: null, league, group: b ? b.toUpperCase() : null };
}

function onRoute() {
  const r = parseHash();
  const prevView = state.route.view;
  if (r.team && state.model?.teams[r.team]) {
    if (state.team === r.team && !panel.hidden) return;
    r.league = state.model.teams[r.team].league;
    state.route = { ...state.route, ...r };
    render();
    openTeam(r.team, { fromRoute: true });
    return;
  }
  if (!panel.hidden) closeTeam({ fromRoute: true });
  const skipScroll = state.skipGroupScroll;
  state.skipGroupScroll = false;
  const cur = state.route;
  if (skipScroll && ['view', 'league', 'group', 'md', 'filter'].every((k) => r[k] === undefined || r[k] === cur[k])) {
    return; // Rückkehr aus dem Team-Panel: Ansicht unverändert lassen (Fokus & Scrollposition bleiben)
  }
  state.route = { ...state.route, ...r };
  render({ scrollTop: prevView !== r.view });
  if (r.group && !skipScroll) {
    const el = document.getElementById(`gruppe-${r.group}`);
    if (el) {
      el.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      el.classList.add('is-flash');
      setTimeout(() => el.classList.remove('is-flash'), 1600);
    }
  }
}

/* ------------------------------------------------------------------ Render */

function render({ scrollTop = false } = {}) {
  const m = state.model;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const active = a.dataset.nav === state.route.view;
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (!m) return;

  const showHero = state.route.view === 'tabellen';
  hero.hidden = !showHero;
  if (showHero) renderHero(m);
  view.classList.toggle('view--top', !showHero);
  let html = '';
  if (state.route.view === 'spieltage') {
    const md = state.route.md || defaultMatchday(m);
    html = renderSchedule(m, md, state.route.filter);
    document.title = `Spieltag ${md} · Nations League Monitor 2026/27`;
  } else if (state.route.view === 'ko') {
    html = renderKnockout(m);
    document.title = 'K.-o.-Phase & Play-offs · Nations League Monitor 2026/27';
  } else {
    html = renderTables(m, state.route.league || 'A', { openGroups: state.openGroups });
    document.title = `Liga ${state.route.league || 'A'} · Nations League Monitor 2026/27`;
  }
  const focusTab = state.focusTab;
  const oldGlider = $('.league-switch__glider');
  const from = oldGlider ? { t: oldGlider.style.transform, w: oldGlider.style.width, h: oldGlider.style.height } : null;
  const wasStuck = $('.league-switch-wrap')?.classList.contains('is-stuck');
  view.innerHTML = html;
  view.dataset.view = state.route.view;
  if (wasStuck) $('.league-switch-wrap')?.classList.add('is-stuck');
  const g = $('.league-switch__glider');
  if (g && from?.t && !reducedMotion.matches) {
    // Glider gleitet vom alten zum neuen Tab, obwohl der Umschalter neu gerendert wurde
    g.style.transition = 'none';
    Object.assign(g.style, { transform: from.t, width: from.w, height: from.h });
    void g.offsetWidth;
    g.style.transition = '';
    positionGlider();
  } else positionGlider(true);
  observeSwitch();
  if (focusTab) { state.focusTab = null; document.getElementById(`tab-${focusTab}`)?.focus(); }
  if (scrollTop) window.scrollTo({ top: 0, behavior: 'auto' });
  if (state.team && !panel.hidden) panel.innerHTML = renderTeam(m, state.team);
  fitNames();
}

function renderHero(m) {
  const total = m.matches.length;
  const done = m.matches.filter((x) => x.status === 'FINISHED');
  const live = m.matches.filter((x) => x.status === 'LIVE').length;
  const goals = done.reduce((s, x) => s + x.hs + x.as, 0);
  const mds = [1, 2, 3, 4, 5, 6].map((d) => {
    const ms = m.matches.filter((x) => x.md === d);
    const fin = ms.length && ms.every((x) => x.status === 'FINISHED');
    const part = ms.some((x) => x.status !== 'UPCOMING');
    const dates = ms.map((x) => x.date).sort();
    return { d, fin, part, from: dates[0], to: dates[dates.length - 1] };
  });
  const next = mds.find((x) => !x.fin);
  const mdDone = mds.filter((x) => x.fin).length;
  const today = todayBerlin();
  const days = next ? Math.round((Date.parse(`${next.from}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5) : null;
  const rows = m.leagues.flatMap((l) => l.groups.flatMap((g) => g.table.map((r) => ({ ...r, league: l.id }))));
  // Liga D steigt geschlossen auf – zählt nicht als „durch Ergebnisse entschieden“
  const zoneRows = rows.filter((r) => r.league !== 'D');
  const decided = zoneRows.filter((r) => r.locked).length;
  const phase = live ? `Live · ${live} ${live === 1 ? 'Spiel läuft' : 'Spiele laufen'}`
    : !next ? 'Ligaphase beendet'
    : next.part || days <= 0 ? `Ligaphase · Spieltag ${next.d} läuft`
    : `Ligaphase · Pause bis ${fmtShort(next.from)}`;
  const daysText = days === null ? '' : days > 1 ? `in ${days} Tagen` : days === 1 ? 'morgen' : days === 0 ? 'heute' : 'läuft';

  hero.innerHTML = `
  <div class="hero__inner">
    <div class="hero__main">
      <p class="eyebrow eyebrow--accent"><span class="pulse${live ? ' is-live' : ''}" aria-hidden="true"></span>${phase}</p>
      <h1 id="hero-title" class="hero__title">UEFA Nations League <span class="hero__season">2026/27</span></h1>
      <p class="hero__lead">54 Nationen, 4 Ligen, 14 Gruppen: alle Tabellen und Spiele – und auf einen Blick, wer ins Viertelfinale einzieht, aufsteigt, in die Play-offs muss oder absteigt.</p>
    </div>
    <div class="hero__panel">
      <div class="md-track" role="img" aria-label="${mdDone} von 6 Spieltagen der Ligaphase absolviert">
        ${mds.map((x) => `<a class="md-track__seg${x.fin ? ' is-done' : x.part ? ' is-part' : ''}${next && x.d === next.d ? ' is-next' : ''}" href="#/spieltage/${x.d}" tabindex="-1" aria-hidden="true">
          <span class="md-track__bar"></span><span class="md-track__label">ST ${x.d}</span></a>`).join('')}
      </div>
      ${next ? `<a class="hero__next" href="#/spieltage/${next.d}">
        <span class="hero__next-label">${next.part ? 'Aktueller' : 'Nächster'} Spieltag</span>
        <span class="hero__next-main">Spieltag ${next.d}<span class="hero__next-date">${fmtRange(next.from, next.to)}</span></span>
        <span class="hero__next-count">${daysText}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </a>` : ''}
      <dl class="kpis">
        <div><dt>Spieltag</dt><dd>${mdDone}<small>/6</small></dd></div>
        <div><dt>Spiele</dt><dd>${done.length}<small>/${total}</small></dd></div>
        <div><dt>Tore</dt><dd>${goals}</dd></div>
        <div data-tip-title="Zonen rechnerisch fix" data-tip="Teams der Ligen A–C, deren Zone (Viertelfinale, Aufstieg, Play-off, Abstieg) durch die Ergebnisse bereits feststeht. Liga D ist nicht mitgezählt – dort steigen ohnehin alle sechs Teams auf." tabindex="0"><dt>Zonen fix</dt><dd>${decided}<small>/${zoneRows.length}</small></dd></div>
      </dl>
    </div>
  </div>`;
}

function renderStatus(m) {
  const el = $('#data-status');
  const s = m.source;
  const snapLong = s.snapshotAt ? `${fmtShortY(s.snapshotAt)}, ${fmtTime(s.snapshotAt)} Uhr` : 'unbekannt';
  el.className = `data-status data-status--${s.kind}${s.liveNow ? ' is-live-now' : ''}`;
  const txt = el.querySelector('.data-status__text');
  if (s.kind === 'live') {
    txt.innerHTML = `<b>Live</b><span class="data-status__long"> · ${esc(s.provider)}</span><span class="data-status__time"> · ${fmtTime(s.fetchedAt)}</span>`;
    el.dataset.tipTitle = s.liveNow ? 'Live – Spiele laufen' : 'Live-Abgleich aktiv';
    el.dataset.tip = [
      `Datenstand: ${m.asOf || 'UEFA-Daten'}`,
      `Live-Quelle: ${s.provider}, zuletzt ${fmtTime(s.fetchedAt)} Uhr`,
      `Basis: UEFA-Snapshot, ${snapLong}`,
      `Aktualisierung alle ${s.liveNow ? '60 Sekunden' : '5 Minuten'}`,
    ].join('\n');
  } else {
    const ageH = s.snapshotAt ? (Date.now() - Date.parse(s.snapshotAt)) / 36e5 : Infinity;
    const stale = ageH > 24;
    el.classList.toggle('is-stale', stale);
    txt.innerHTML = `<b>Stand</b><span class="data-status__time"> · ${s.snapshotAt ? fmtShort(s.snapshotAt) : '–'}</span>${s.snapshotAt ? `<span class="data-status__clock"> ${fmtTime(s.snapshotAt)}</span>` : ''}`;
    el.dataset.tipTitle = stale ? 'Datenstand älter als 24 Stunden' : 'Gespeicherter Datenstand';
    el.dataset.tip = [
      `Datenstand: ${m.asOf || 'UEFA-Daten'}`,
      `Quelle: UEFA-Snapshot, ${snapLong}`,
      'Live-Abgleich: derzeit nicht erreichbar – neuer Versuch alle 10 Minuten',
    ].join('\n');
  }
  el.setAttribute('aria-label', `${el.dataset.tipTitle}. ${el.dataset.tip.replaceAll('\n', '. ')}`);
  el.tabIndex = 0;
  $('#footer-note').textContent = `Datenstand: ${m.asOf || snapLong}. Alle Angaben ohne Gewähr; Tabellen werden nach dem UEFA-Reglement (Art. 15) aus den Ergebnissen berechnet. Disziplinarpunkte sind nicht berücksichtigt.`;
}

/* ------------------------------------------------------------------ Team panel */

function openTeam(code, { fromRoute = false, opener = null } = {}) {
  if (!state.model?.teams[code]) return;
  const wasHidden = panel.hidden;
  if (wasHidden) {
    // Fokus kehrt beim Schließen zum auslösenden Element zurück (auch bei angetippten Tabellenzeilen)
    state.lastFocus = opener || document.activeElement;
    state.prevHash = fromRoute ? null : location.hash || '#/tabellen';
    state.pushedTeam = false;
  }
  clearTimeout(state.closeTimer);
  state.team = code;
  panel.innerHTML = renderTeam(state.model, code);
  panel.classList.remove('is-closing');
  panel.style.transform = '';
  panel.hidden = false;
  scrim.hidden = false;
  document.body.classList.add('has-panel');
  if (wasHidden) {
    void panel.offsetWidth; // Reflow erzwingen, damit der Übergang sicher startet
    panel.classList.add('is-open');
    scrim.classList.add('is-open');
  } else {
    panel.classList.add('is-open', 'is-swap');
    setTimeout(() => panel.classList.remove('is-swap'), 50);
  }
  panel.scrollTop = 0;
  fitNames(panel);
  onPanelScroll();
  panel.focus({ preventScroll: true });
  if (!fromRoute) {
    // Teilbare URL + Zurück-Taste schließt das Panel
    if (state.pushedTeam) history.replaceState(null, '', `#/team/${code}`);
    else { history.pushState({ team: code }, '', `#/team/${code}`); state.pushedTeam = true; }
  }
}

function closeTeam({ fromRoute = false, navigate = null } = {}) {
  if (panel.hidden || panel.classList.contains('is-closing')) return;
  state.team = null;
  panel.classList.remove('is-open');
  panel.classList.add('is-closing');
  panel.style.transform = '';
  scrim.classList.remove('is-open');
  document.body.classList.remove('has-panel');
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    panel.removeEventListener('transitionend', onEnd);
    panel.hidden = true; scrim.hidden = true; panel.innerHTML = '';
    panel.classList.remove('is-closing');
  };
  const onEnd = (e) => { if (e.target === panel && e.propertyName === 'transform') done(); };
  if (reducedMotion.matches) done();
  else { panel.addEventListener('transitionend', onEnd); state.closeTimer = setTimeout(done, 480); }

  if (!fromRoute) {
    if (navigate) {
      history.replaceState(null, '', navigate);
      state.pushedTeam = false;
      onRoute();
    } else if (state.pushedTeam) {
      state.pushedTeam = false;
      state.skipGroupScroll = true;
      history.back();
    } else if (location.hash.startsWith('#/team/')) {
      history.replaceState(null, '', `#/tabellen/${state.route.league || 'A'}`);
    }
  } else {
    state.pushedTeam = false;
  }
  if (!navigate && state.lastFocus && state.lastFocus !== document.body && document.contains(state.lastFocus)) state.lastFocus.focus({ preventScroll: true });
}

/** Kompakte Kopfzeile im Panel, sobald der Hero aus dem Bild scrollt. */
function onPanelScroll() {
  const tp = panel.querySelector('.tp');
  if (!tp) return;
  const heroEl = panel.querySelector('.tp__hero');
  const condensed = heroEl ? panel.scrollTop > heroEl.offsetTop + heroEl.offsetHeight - 70 : false;
  tp.classList.toggle('is-condensed', condensed);
  tp.classList.toggle('is-scrolled', panel.scrollTop > 4);
}

/** Bottom-Sheet (mobil): an der Griffleiste nach unten ziehen schließt das Panel. */
function bindSheetDrag() {
  let startY = null, dy = 0, pid = null;
  const isSheet = () => matchMedia('(max-width: 720px)').matches;
  panel.addEventListener('pointerdown', (e) => {
    if (!isSheet() || !e.target.closest('.tp__bar') || e.target.closest('button')) return;
    if (panel.scrollTop > 0) return;
    startY = e.clientY; dy = 0; pid = e.pointerId;
    panel.setPointerCapture(pid);
    panel.classList.add('is-dragging');
  });
  panel.addEventListener('pointermove', (e) => {
    if (startY === null || e.pointerId !== pid) return;
    dy = Math.max(0, e.clientY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  });
  const end = (e) => {
    if (startY === null || e.pointerId !== pid) return;
    panel.classList.remove('is-dragging');
    try { panel.releasePointerCapture(pid); } catch { /* egal */ }
    startY = null;
    if (dy > 110) closeTeam();
    else panel.style.transform = '';
  };
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
}

function trapFocus(e) {
  if (panel.hidden || e.key !== 'Tab') return;
  const f = [...panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ------------------------------------------------------------------ Tooltip */

let tipTarget = null;
let tipTimer = null;
function showTip(target) {
  const text = target?.dataset.tip;
  if (!text) return;
  clearTimeout(tipTimer);
  tipTarget = target;
  const title = target.dataset.tipTitle;
  tooltip.innerHTML = `${title ? `<b class="tooltip__title">${esc(title)}</b>` : ''}<span class="tooltip__body">${esc(text)}</span>`;
  tooltip.hidden = false;
  const r = target.getBoundingClientRect();
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const headerH = $('#site-header').getBoundingClientRect().bottom;
  let x, y, side;
  if (target.dataset.tipSide === 'right' && r.right + 12 + tw < vw - 8) {
    // rechts neben dem Element – verdeckt keine Kopfzeilen
    x = r.right + 10; y = r.top + r.height / 2 - th / 2; side = 'right';
  } else {
    x = Math.max(12, Math.min(r.left + r.width / 2 - tw / 2, vw - tw - 12));
    y = r.bottom + 10; side = 'below';
    if (y + th > window.innerHeight - 8 && r.top - th - 10 > headerH) { y = r.top - th - 10; side = 'above'; }
  }
  const ty = Math.max(8, y);
  tooltip.style.transform = `translate(${Math.round(x)}px, ${Math.round(ty)}px)`;
  tooltip.dataset.side = side;
  // Pfeil zeigt immer auf die Mitte des Auslösers – auch wenn der Tooltip am Rand eingeklemmt wird
  tooltip.style.setProperty('--caret-x', `${Math.round(Math.min(tw - 14, Math.max(14, r.left + r.width / 2 - x)))}px`);
  tooltip.style.setProperty('--caret-y', `${Math.round(Math.min(th - 14, Math.max(14, r.top + r.height / 2 - ty)))}px`);
  tooltip.classList.add('is-visible');
  target.setAttribute('aria-describedby', 'tooltip');
}
function hideTip() {
  clearTimeout(tipTimer);
  if (tipTarget) tipTarget.removeAttribute('aria-describedby');
  tipTarget = null;
  tooltip.classList.remove('is-visible');
  tooltip.hidden = true;
}

/* ------------------------------------------------------------------ Misc UI */

function positionGlider(instant = false) {
  const sw = $('.league-switch');
  if (!sw) return;
  const active = sw.querySelector('.league-tab.is-active');
  const glider = sw.querySelector('.league-switch__glider');
  if (!active || !glider) return;
  if (instant) glider.style.transition = 'none';
  glider.style.width = `${active.offsetWidth}px`;
  glider.style.height = `${active.offsetHeight}px`;
  glider.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  if (instant) { void glider.offsetWidth; glider.style.transition = ''; }
}

/** Liga-Umschalter klebt unter dem Header und wird dabei kompakt. */
let switchObserver = null;
function observeSwitch() {
  switchObserver?.disconnect();
  const wrap = $('.league-switch-wrap');
  if (!wrap) { $('#site-header').classList.remove('has-subbar'); return; }
  if (!('IntersectionObserver' in window)) return;
  let sentinel = $('.league-switch-sentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.className = 'league-switch-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
  }
  wrap.before(sentinel);
  const top = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
  switchObserver = new IntersectionObserver(([e]) => {
    const stuck = !e.isIntersecting && e.boundingClientRect.top < top() + 1;
    $('#site-header').classList.toggle('has-subbar', stuck);
    if (wrap.classList.contains('is-stuck') !== stuck) {
      wrap.classList.toggle('is-stuck', stuck);
      requestAnimationFrame(() => positionGlider(true));
      clearTimeout(observeSwitch.t);
      observeSwitch.t = setTimeout(() => positionGlider(true), 320); // nach dem Padding-Übergang erneut messen
    }
  }, { rootMargin: `-${top() + 1}px 0px 0px 0px`, threshold: 0 });
  switchObserver.observe(sentinel);
}

/** Lange Namen: auf den Kurznamen wechseln, sobald der volle Name abgeschnitten würde. */
function fitNames(root = document) {
  const over = (el) => el && el.offsetParent && el.scrollWidth > el.clientWidth + 1;
  root.querySelectorAll('.tn').forEach((tn) => {
    tn.classList.remove('use-short', 'use-code');
    if (!over(tn.querySelector('.tn__full'))) return;
    if (tn.classList.contains('has-short')) {
      tn.classList.add('use-short');
      if (!over(tn.querySelector('.tn__short'))) return;
      tn.classList.remove('use-short');
    }
    tn.classList.add('use-code');
  });
}

function toggleGroup(id, btn) {
  const box = document.getElementById(`gm-${id}`);
  const open = !state.openGroups.has(id);
  if (open) state.openGroups.add(id); else state.openGroups.delete(id);
  btn.setAttribute('aria-expanded', String(open));
  btn.querySelector('span').textContent = open ? 'Spiele ausblenden' : 'Alle Spiele & Ergebnisse';
  if (open) {
    const g = state.model.leagues.flatMap((l) => l.groups).find((x) => x.id === id);
    box.innerHTML = renderGroupMatches(state.model, g);
    box.hidden = false;
    fitNames(box);
  } else {
    box.hidden = true;
    box.innerHTML = '';
  }
}

function setTheme(t) {
  const root = document.documentElement;
  if (!reducedMotion.matches) {
    root.classList.add('theme-anim');
    clearTimeout(setTheme.timer);
    setTheme.timer = setTimeout(() => root.classList.remove('theme-anim'), 320);
  }
  root.dataset.theme = t;
  try { localStorage.setItem('nl-theme', t); } catch { /* egal */ }
  updateThemeButton();
}
function updateThemeButton() {
  const light = document.documentElement.dataset.theme === 'light';
  const btn = $('#theme-toggle');
  btn.setAttribute('aria-pressed', String(light));
  btn.setAttribute('aria-label', 'Helles Design');
  btn.dataset.tip = light ? 'Zum dunklen Design wechseln' : 'Zum hellen Design wechseln';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3f5fb' : '#050a1a');
}

function goLeague(id, { focus = true } = {}) {
  const hash = `#/tabellen/${id}`;
  if (location.hash !== hash) history.pushState(null, '', hash);
  if (focus) state.focusTab = id;
  onRoute();
  revealLeagueHead();
}

/** Nach einem Ligawechsel im angehefteten Zustand: Liga-Kopf vollständig unter der Leiste zeigen. */
function revealLeagueHead() {
  const wrap = $('.league-switch-wrap');
  const sentinel = $('.league-switch-sentinel');
  if (!wrap?.classList.contains('is-stuck') || !sentinel) return;
  const top = sentinel.getBoundingClientRect().top + window.scrollY - headerHeight();
  window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

const headerHeight = () => Math.round($('#site-header').getBoundingClientRect().height);

/** --header-h folgt der tatsächlichen Header-Höhe → angeheftete Leisten schließen nahtlos an. */
function trackHeaderHeight() {
  const apply = () => {
    const h = headerHeight();
    if (!h) return;
    const cur = parseFloat(document.documentElement.style.getPropertyValue('--header-h'));
    if (cur === h) return;
    document.documentElement.style.setProperty('--header-h', `${h}px`);
    observeSwitch();
  };
  apply();
  if ('ResizeObserver' in window) new ResizeObserver(apply).observe($('#site-header'));
}

function bind() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.data-status')) return; // Tooltip statt Navigation
    const closer = e.target.closest('[data-close-panel]');
    if (closer) {
      const link = closer.closest('a[href]');
      if (link) { e.preventDefault(); closeTeam({ navigate: link.getAttribute('href') }); }
      else closeTeam();
      return;
    }
    const leagueTab = e.target.closest('a.league-tab');
    if (leagueTab && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      goLeague(leagueTab.dataset.league, { focus: false });
      return;
    }
    const scrollTo = e.target.closest('[data-scroll-to]');
    if (scrollTo) {
      document.getElementById(scrollTo.dataset.scrollTo)?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const teamBtn = e.target.closest('[data-team]');
    if (teamBtn && !e.target.closest('a[href]:not([data-team])') && !e.target.closest('.xrank, .zone-badge')) {
      e.preventDefault();
      hideTip();
      const opener = teamBtn.matches('button, a[href]') ? teamBtn : teamBtn.querySelector('button[data-team]') || null;
      openTeam(teamBtn.dataset.team, { opener });
      return;
    }
    const tg = e.target.closest('[data-toggle-group]');
    if (tg) { toggleGroup(tg.dataset.toggleGroup, tg); return; }
  });
  scrim.addEventListener('click', () => closeTeam());
  panel.addEventListener('scroll', onPanelScroll, { passive: true });
  bindSheetDrag();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!tooltip.hidden) hideTip(); else closeTeam(); }
    trapFocus(e);
    // Pfeiltasten, Pos1 und Ende im Liga-Umschalter
    const tab = e.target.closest?.('.league-tab');
    if (tab && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      const ids = ['A', 'B', 'C', 'D'];
      const i = ids.indexOf(tab.dataset.league);
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length;
      e.preventDefault();
      goLeague(ids[n]);
    }
  });
  const toggle = $('#theme-toggle');
  toggle.addEventListener('pointerleave', () => { delete toggle.dataset.tipMuted; });
  toggle.addEventListener('click', () => {
    toggle.dataset.tipMuted = '1'; // Tooltip erst nach erneutem Überfahren wieder zeigen
    hideTip();
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });

  // Tooltips: Maus mit kurzer Verzögerung, Tastatur sofort, Touch per Tipp
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    let t = e.target.closest('[data-tip]');
    if (t?.dataset.tipMuted) t = null;
    if (t === tipTarget) return;
    clearTimeout(tipTimer);
    if (t) tipTimer = setTimeout(() => showTip(t), tipTarget ? 0 : 280);
    else if (tipTarget) hideTip();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.data-status, .pos[data-tip], .xrank, .zone-badge, .kpis [data-tip]')) hideTip();
  }, true);
  document.addEventListener('focusin', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (t && e.target.matches(':focus-visible')) showTip(t); else if (tipTarget) hideTip();
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.data-status[data-tip], .pos[data-tip], .xrank[data-tip], .zone-badge[data-tip], .kpis [data-tip]');
    if (t && t !== tipTarget) { e.stopPropagation(); showTip(t); }
  }, true);
  window.addEventListener('scroll', () => tipTarget && hideTip(), { passive: true });
  let rz = null;
  window.addEventListener('resize', () => {
    positionGlider(true); hideTip();
    cancelAnimationFrame(rz); rz = requestAnimationFrame(() => fitNames());
  });
  window.addEventListener('hashchange', onRoute);
  window.addEventListener('popstate', () => { if (!location.hash.startsWith('#/team/') && !panel.hidden) closeTeam({ fromRoute: true }); });

  // Header: transparent oben, beim Scrollen deckend mit Linie
  const header = $('#site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ------------------------------------------------------------------ Start */

async function main() {
  installFlagFallback();
  trackHeaderHeight();
  updateThemeButton();
  bind();
  state.route = { ...state.route, ...parseHash() };
  render();
  const store = createStore((model) => {
    const first = !state.model;
    state.model = model;
    renderStatus(model);
    if (first) onRoute(); else render();
  });
  try {
    await store.start();
  } catch (e) {
    view.innerHTML = `<div class="error-box" role="alert"><h2>Daten konnten nicht geladen werden</h2><p>Bitte die Seite über einen Webserver öffnen (siehe README) und erneut laden.</p><p class="muted">${esc(e?.message || e)}</p><button type="button" class="ghost-btn" onclick="location.reload()">Erneut laden</button></div>`;
    $('#data-status .data-status__text').textContent = 'Offline';
  }
  document.fonts?.ready.then(() => { positionGlider(true); fitNames(); });
}

main();
