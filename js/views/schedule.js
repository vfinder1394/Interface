import { esc, flag, scoreCell, fmtDay, fmtDayShort, fmtRange, fmtTime, fmtShort, fmtWeekShort, teamName } from '../ui.js';
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
        // Auswahl = Fläche + Ring; Status = nur Punkt/Häkchen + leises Wort (konkurriert nicht mit der Auswahl)
        return `<a class="md-tab md-tab--${state}${d === md ? ' is-active' : ''}" href="#/spieltage/${d}/${leagueFilter}" ${d === md ? 'aria-current="page"' : ''}>
          <span class="md-tab__label">Spieltag</span>
          <span class="md-tab__num">${d}</span>
          ${state === 'done' ? `<span class="md-tab__done" title="Beendet">${CHECK}<span class="sr-only">beendet</span></span>`
            : state === 'live' || state === 'next' ? `<span class="md-tab__state"><span class="md-tab__state-dot" aria-hidden="true"></span><span class="md-tab__state-text">${stateLabel}</span></span>` : `<span class="sr-only">${stateLabel}</span>`}
          <span class="md-tab__date">${fmtRange(dates[0], dates[dates.length - 1])}</span>
        </a>`;
      }).join('')}
    </nav>

    ${summary(model, list, scope)}

    ${list.length ? [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, ms]) => {
      const allDone = ms.every((m) => m.status === 'FINISHED');
      const anyLive = ms.some((m) => m.status === 'LIVE');
      const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayBerlin()}T00:00:00Z`)) / 864e5);
      const when = days > 1 ? `in ${days} Tagen` : days === 1 ? 'morgen' : days === 0 ? 'heute' : 'ausstehend';
      // Jeder Tageskopf trägt einen Status in derselben Form: Endstände · Live · in n Tagen
      const pill = anyLive ? '<span class="day__pill day__pill--live"><span class="live-dot" aria-hidden="true"></span>Live</span>'
        : allDone ? `<span class="day__pill day__pill--final">${CHECK}Endstände</span>`
        : `<span class="day__pill day__pill--upcoming">${when}</span>`;
      // Spielort-Spalte nur, wenn er für mindestens die Hälfte der Spiele des Tages bekannt ist (keine halb leere Spalte)
      const withVenue = ms.filter((m) => m.venue).length * 2 >= ms.length;
      return `
      <section class="day" aria-label="${esc(fmtDay(date))}">
        <h3 class="day__head"><span class="day__date"><b><span class="day__date-long">${esc(fmtDay(date))}</span><span class="day__date-short" aria-hidden="true">${esc(fmtDayShort(date))}</span></b></span><span class="day__count">${ms.length}&nbsp;${ms.length === 1 ? 'Spiel' : 'Spiele'}${pill}</span></h3>
        <ul class="match-list${withVenue ? ' has-venue' : ''}">
          ${ms.map((m) => matchRow(model, m, { venue: withVenue })).join('')}
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
    // Topspiel: höchste Liga zuerst, dann Gewicht der Tabellenlage (Punkte beider Teams, Duell der Spitzenplätze, enges Punkteduell)
    const weight = (m) => {
      const h = model.teams[m.home]?.row, a = model.teams[m.away]?.row;
      const pts = (h?.pts ?? 0) + (a?.pts ?? 0);
      const top2 = h && a && h.pos <= 2 && a.pos <= 2 ? 6 : 0;
      const close = h && a ? -Math.abs(h.pts - a.pts) : 0;
      return ({ A: 3, B: 2, C: 1, D: 0 }[m.league] ?? 0) * 100 + pts + top2 + close;
    };
    const top = [...list].sort((a, b) => weight(b) - weight(a))[0];
    const th = model.teams[top.home], ta = model.teams[top.away];
    const when = days > 1 ? `in ${days} Tagen` : days === 1 ? 'morgen' : days === 0 ? 'heute' : '';
    const leagues = new Set(list.map((m) => m.league)).size;
    const at = (m) => `${fmtWeekShort(m.date)} ${fmtShort(m.date)}${m.kickoff ? ` · ${fmtTime(m.kickoff)}&nbsp;Uhr` : ''}`;
    return `<div class="md-summary md-summary--preview">
      <div><b>${list.length}</b><span>${scope ? `Spiele${scope}` : `Spiele in ${leagues} ${leagues === 1 ? 'Liga' : 'Ligen'}`}</span></div>
      <div class="md-summary__top">
        <span class="md-summary__pair">
          <button type="button" class="md-summary__team" data-team="${esc(th.code)}" aria-label="${esc(th.name)} – Details öffnen">${flag(th)}<b>${esc(th.name)}</b></button>
          <small aria-hidden="true">–</small>
          <button type="button" class="md-summary__team" data-team="${esc(ta.code)}" aria-label="${esc(ta.name)} – Details öffnen"><b>${esc(ta.name)}</b>${flag(ta)}</button>
        </span>
        <span>Topspiel · Gruppe ${esc(top.group)} · ${at(top)}</span>
      </div>
      <div><b class="md-summary__when">${at(first)}</b><span>Anpfiff${when ? ` ${when}` : ''}</span></div>
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

/** Spielort in zwei Teilen: Stadion (darf gekürzt werden) und Stadt (bleibt immer stehen). */
function venueParts(v) {
  const i = v.lastIndexOf(', ');
  return i > 0 ? [v.slice(0, i), v.slice(i + 2)] : ['', v];
}

export function matchRow(model, m, { showGroup = true, venue = false } = {}) {
  const h = model.teams[m.home], a = model.teams[m.away];
  const done = Number.isInteger(m.hs) && m.status !== 'LIVE';
  const res = (side) => {
    if (!done) return '';
    const own = side === 'h' ? m.hs : m.as, opp = side === 'h' ? m.as : m.hs;
    return own > opp ? ' is-win' : own < opp ? ' is-loss' : ' is-draw';
  };
  const live = m.status === 'LIVE';
  const [stadium, city] = m.venue ? venueParts(m.venue) : ['', ''];
  // Anstoß: bei offenen Spielen in der Mitte (statt Ergebnis), bei beendeten leise neben der Gruppe
  return `<li class="match${live ? ' is-live' : ''}${done ? ' is-done' : ''}${m.note ? ' has-note' : ''}">
    <span class="match__meta">
      ${showGroup ? `<a class="match__group" href="#/tabellen/${m.league}/${m.group}" aria-label="Tabelle Gruppe ${m.group}">${m.group}</a>` : ''}
      ${live ? '<span class="match__time is-live"><span class="live-dot"></span>Live</span>' : done && m.kickoff ? `<span class="match__time"><span class="match__sep" aria-hidden="true">·</span>${fmtTime(m.kickoff)}<span class="sr-only">&nbsp;Uhr Anstoß</span></span>` : ''}
    </span>
    <button type="button" class="match__team match__team--h${res('h')}" data-team="${esc(h.code)}">
      ${teamName(h)}${flag(h)}
    </button>
    ${scoreCell(m)}
    <button type="button" class="match__team match__team--a${res('a')}" data-team="${esc(a.code)}">
      ${flag(a)}${teamName(a)}
    </button>
    ${venue ? (m.venue ? `<span class="match__venue" title="Spielort: ${esc(m.venue)}">${PIN}${stadium ? `<span class="match__venue-stadium">${esc(stadium)},&nbsp;</span>` : ''}<span class="match__venue-city">${esc(city)}</span></span>` : '<span class="match__venue" aria-hidden="true"></span>') : ''}
    ${m.note ? `<span class="match__note">${INFO}${esc(m.note)}</span>` : ''}
  </li>`;
}
