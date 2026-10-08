import { esc, flag, scoreCell, fmtDay, fmtRangeMonth, fmtTime, fmtShort, fmtWeekShort, teamName } from '../ui.js';
import { todayBerlin } from '../data.js';

const LEAGUE_FILTERS = [['alle', 'Alle'], ['A', 'Liga A'], ['B', 'Liga B'], ['C', 'Liga C'], ['D', 'Liga D']];
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4 4 9-9"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
const INFO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/></svg>';

export function defaultMatchday(model) {
  const open = model.matches.filter((m) => m.status !== 'FINISHED');
  if (!open.length) return 6;
  return Math.min(...open.map((m) => m.md));
}

export function renderSchedule(model, md, leagueFilter) {
  const mds = [...new Set(model.matches.map((m) => m.md))].sort((a, b) => a - b);
  const current = defaultMatchday(model);
  const list = model.matches.filter((m) => m.md === md && (leagueFilter === 'alle' || m.league === leagueFilter));
  const byDate = new Map();
  for (const m of list) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date).push(m);
  }
  const scope = leagueFilter === 'alle' ? '' : ` (Liga ${leagueFilter})`;

  return `
  <section class="section" aria-labelledby="sched-title">
    <header class="section-head section-head--row">
      <div class="section-head__title">
        <p class="eyebrow">Ligaphase · 6 Spieltage</p>
        <h2 id="sched-title" class="display">Spieltage</h2>
      </div>
      <div class="seg-scroll">
        <div class="filter-chips" role="group" aria-label="Nach Liga filtern">
          ${LEAGUE_FILTERS.map(([id, label]) => `<a class="chip${leagueFilter === id ? ' is-active' : ''}" href="#/spieltage/${md}/${id}" ${leagueFilter === id ? 'aria-current="true"' : ''}>${label}</a>`).join('')}
        </div>
      </div>
    </header>

    <nav class="md-strip" aria-label="Spieltag wählen">
      ${mds.map((d) => {
        const ms = model.matches.filter((m) => m.md === d);
        const dates = ms.map((m) => m.date).sort();
        const fin = ms.every((m) => m.status === 'FINISHED');
        const live = ms.some((m) => m.status === 'LIVE');
        const state = live ? 'live' : fin ? 'done' : d === current ? 'next' : 'open';
        const stateLabel = { live: 'Live', done: 'Beendet', next: 'Nächster', open: 'Geplant' }[state];
        return `<a class="md-tab md-tab--${state}${d === md ? ' is-active' : ''}" href="#/spieltage/${d}/${leagueFilter}" ${d === md ? 'aria-current="page"' : ''}>
          <span class="md-tab__num"><small>Spieltag</small>${d}</span>
          <span class="md-tab__date">${fmtRangeMonth(dates[0], dates[dates.length - 1])}</span>
          ${state === 'done' ? `<span class="md-tab__done" title="Beendet">${CHECK}<span class="sr-only">beendet</span></span>`
            : state === 'live' || state === 'next' ? `<span class="md-tab__state">${stateLabel}</span>` : `<span class="sr-only">${stateLabel}</span>`}
        </a>`;
      }).join('')}
    </nav>

    ${summary(model, list, scope)}

    ${list.length ? [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, ms]) => {
      const allDone = ms.every((m) => m.status === 'FINISHED');
      return `
      <section class="day" aria-label="${esc(fmtDay(date))}">
        <h3 class="day__head"><span class="day__date"><b>${esc(fmtDay(date))}</b></span><span class="day__count">${ms.length} ${ms.length === 1 ? 'Spiel' : 'Spiele'}${allDone ? `<span class="day__final">${CHECK}Endstände</span>` : ''}</span></h3>
        <ul class="match-list">
          ${ms.map((m) => matchRow(model, m)).join('')}
        </ul>
      </section>`;
    }).join('') : emptyState(model, md, leagueFilter)}
  </section>`;
}

function summary(model, list, scope) {
  const done = list.filter((m) => m.status === 'FINISHED');
  const live = list.filter((m) => m.status === 'LIVE');
  if (!done.length && !live.length && list.length) {
    // Kommender Spieltag: nützliche Vorschau statt Nullen
    const first = [...list].sort((a, b) => (a.kickoff || a.date).localeCompare(b.kickoff || b.date))[0];
    const days = Math.round((Date.parse(`${first.date}T00:00:00Z`) - Date.parse(`${todayBerlin()}T00:00:00Z`)) / 864e5);
    // Topspiel: höchste Liga zuerst, dann die meisten Punkte beider Teams zusammen
    const weight = (m) => ({ A: 3, B: 2, C: 1, D: 0 }[m.league] ?? 0) * 100 + (model.teams[m.home]?.row?.pts ?? 0) + (model.teams[m.away]?.row?.pts ?? 0);
    const top = [...list].sort((a, b) => weight(b) - weight(a))[0];
    const hasTop = Boolean(top);
    return `<div class="md-summary">
      <div><b>${list.length}</b><span>Spiele${scope}</span></div>
      ${hasTop ? `<div class="md-summary__top"><b>${esc(top.home)} <small>–</small> ${esc(top.away)}</b><span>Topspiel · ${esc(top.group)} · ${fmtWeekShort(top.date)} ${fmtShort(top.date)}</span></div>` : `<div><b>${new Set(list.map((m) => m.group)).size}</b><span>Gruppen</span></div>`}
      <div><b>${fmtWeekShort(first.date)} ${fmtShort(first.date)}</b><span>Start${first.kickoff ? ` · ${fmtTime(first.kickoff)}` : ''}</span></div>
      <div><b>${days > 1 ? `${days} Tage` : days === 1 ? 'morgen' : days === 0 ? 'heute' : '–'}</b><span>bis zum Anpfiff</span></div>
    </div>`;
  }
  const goals = [...done, ...live].reduce((s, m) => s + m.hs + m.as, 0);
  const n = done.length + live.length;
  return `<div class="md-summary">
    <div><b>${list.length}</b><span>Spiele${scope}</span></div>
    <div><b>${done.length}</b><span>beendet</span></div>
    <div><b>${goals}</b><span>Tore</span></div>
    <div><b>${n ? (goals / n).toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 1 }) : '–'}</b><span>Tore/Spiel</span></div>
  </div>`;
}

function emptyState(model, md, leagueFilter) {
  const next = model.matches.filter((m) => m.md > md && (leagueFilter === 'alle' || m.league === leagueFilter)).sort((a, b) => a.md - b.md)[0];
  return `<div class="empty"><p><b>Keine Spiele${leagueFilter === 'alle' ? '' : ` der Liga ${leagueFilter}`} an Spieltag ${md}.</b></p>
    ${next ? `<p><a class="link-btn" href="#/spieltage/${next.md}/${leagueFilter}">Zu Spieltag ${next.md} →</a></p>` : ''}</div>`;
}

export function matchRow(model, m, { showGroup = true } = {}) {
  const h = model.teams[m.home], a = model.teams[m.away];
  const done = Number.isInteger(m.hs) && m.status !== 'LIVE';
  const res = (side) => {
    if (!done) return '';
    const own = side === 'h' ? m.hs : m.as, opp = side === 'h' ? m.as : m.hs;
    return own > opp ? ' is-win' : own < opp ? ' is-loss' : ' is-draw';
  };
  const live = m.status === 'LIVE';
  return `<li class="match${live ? ' is-live' : ''}${done ? ' is-done' : ''}${m.note ? ' has-note' : ''}">
    <span class="match__meta">
      ${showGroup ? `<a class="match__group" href="#/tabellen/${m.league}/${m.group}" aria-label="Tabelle Gruppe ${m.group}">${m.group}</a>` : ''}
      ${live ? '<span class="match__time is-live"><span class="live-dot"></span>Live</span>' : ''}
    </span>
    <button type="button" class="match__team match__team--h${res('h')}" data-team="${esc(h.code)}">
      ${teamName(h)}${flag(h)}
    </button>
    ${scoreCell(m)}
    <button type="button" class="match__team match__team--a${res('a')}" data-team="${esc(a.code)}">
      ${flag(a)}${teamName(a)}
    </button>
    <span class="match__venue${m.venue ? '' : ' match__venue--country'}" title="${m.venue ? 'Spielort' : 'Gastgeberland'}">${PIN}<span>${esc(m.venue || h.name)}</span></span>
    ${m.note ? `<span class="match__note">${INFO}${esc(m.note)}</span>` : ''}
  </li>`;
}
