import { esc, flag, zoneBadge, formPills, formDots, signed, scoreCell, fmtShort, fmtWeekShort, teamName, tipAttrs, zoneCut, ZONE_ICON } from '../ui.js';
import { ZONES, LEAGUE_ZONES, LEAGUE_INFO, zoneTerm } from '../zones.js';

const LEAGUES = ['A', 'B', 'C', 'D'];

const UP = new Set(['ko', 'promotion', 'playoff-up']);
const DOWN = new Set(['playoff-down', 'relegation']);

export function renderTables(model, leagueId, state) {
  const league = model.leagues.find((l) => l.id === leagueId) || model.leagues[0];
  const info = LEAGUE_INFO[league.id];
  return `
  <section class="section section--tables" aria-labelledby="league-title">
    <div class="league-switch-wrap">
      <nav class="league-switch" aria-label="Liga wählen">
        ${LEAGUES.map((id) => {
          const l = model.leagues.find((x) => x.id === id);
          const sel = id === league.id;
          const leaders = l ? l.groups.map((g) => model.teams[g.table[0]?.code]).filter(Boolean) : [];
          const leaderTip = leaders.length ? tipAttrs(`Tabellenführer Liga ${id}`, leaders.map((t) => `${t.group}: ${t.name}`).join('\n')) : '';
          return `<a class="league-tab${sel ? ' is-active' : ''}" href="#/tabellen/${id}" ${sel ? 'aria-current="page"' : 'tabindex="-1"'} data-league="${id}" id="tab-${id}">
            <span class="league-tab__letter" aria-hidden="true">${id}</span>
            <span class="league-tab__meta"><span class="league-tab__name">Liga ${id}</span><span class="league-tab__sub">${esc(TAB_SUB[id])}</span></span>
            <span class="league-tab__aside" ${leaderTip}><span class="league-tab__aside-label" aria-hidden="true">Spitze</span><span class="league-tab__flags" aria-hidden="true">${leaders.map((t) => flag(t)).join('')}</span></span>
          </a>`;
        }).join('')}
        <span class="league-switch__glider" aria-hidden="true"></span>
      </nav>
    </div>

    <div id="league-panel" class="league-panel">
      <header class="league-head">
        <p class="eyebrow">${esc(info.tagline)}</p>
        <h2 id="league-title" class="display">Liga ${league.id}</h2>
      </header>
      ${renderLegend(league.id, league)}

      <details class="rules-box"${state.rulesOpen ? ' open' : ''}>
        <summary><span class="rules-box__icon" aria-hidden="true">i</span>So funktioniert Liga ${league.id}<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>
        <ul>${info.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        <p class="rules-box__foot">Bei Punktgleichheit: direkter Vergleich (Punkte, Tordifferenz, Tore), dann Tordifferenz, Tore, Auswärtstore, Siege und Auswärtssiege gesamt.${league.id === 'A' ? ' Plätze 3 und 4 werden zusätzlich über alle vier Gruppen verglichen (Punkte, Tordifferenz, Tore …).' : ''}</p>
      </details>

      <div class="group-grid group-grid--${league.groups.length}">
        ${league.groups.map((g) => renderGroupCard(model, g, state)).join('')}
      </div>

      ${league.id === 'D' ? renderPromoBanner(model, league) : ''}
      ${league.id === 'A' ? renderCrossPanel(model) : ''}
    </div>
  </section>`;
}

const TAB_SUB = { A: 'Viertelfinale', B: 'Aufstieg in Liga A', C: 'Aufstieg in Liga B', D: 'Letzte Austragung' };

/** Legende = dieselben Positions-Chips wie in der Tabelle (Ziffern der betroffenen Plätze). */
const LEGEND = {
  A: { ko: ['1–2', ''], safe: ['3', 'zwei beste Dritte'], 'playoff-down': ['3–4', 'um den Verbleib'], relegation: ['4', 'in Liga B'] },
  B: { promotion: ['1', 'in Liga A'], 'playoff-up': ['2', 'um den Aufstieg'], safe: ['3', ''], 'playoff-down': ['4', 'um den Verbleib'] },
  C: { promotion: ['1', 'in Liga B'], 'playoff-up': ['2', 'um den Aufstieg'], safe: ['3–4', 'kein Abstieg'] },
  D: { promotion: ['1–3', 'alle Teams in Liga C'] },
};

export function renderLegend(leagueId, league) {
  const zones = LEAGUE_ZONES[leagueId];
  const item = (z) => {
    const [pos, hint] = LEGEND[leagueId]?.[z] || ['', ''];
    return `<li class="legend-item zone-${z}">
      <span class="pos pos--sample" aria-hidden="true">${pos}</span>
      <span class="legend-item__label">${esc(zoneTerm(z, leagueId))}${hint ? `<span class="legend-item__hint"> ${esc(hint)}</span>` : ''}</span>
      <span class="sr-only">: Platz ${pos}</span>
    </li>`;
  };
  const anyLocked = league?.groups.some((g) => g.table.some((r) => r.locked));
  return `<div class="legend-wrap"><ul class="status-legend" aria-label="Legende der Tabellenzonen">
    ${zones.map(item).join('')}
    ${anyLocked ? `<li class="legend-item legend-item--lock zone-safe"><span class="pos pos--sample" aria-hidden="true">1<span class="pos__lock">${ZONE_ICON.lock}</span></span><span class="legend-item__label">rechnerisch sicher</span></li>` : ''}
    ${leagueId === 'A' ? '<li class="legend-item legend-item--note"><button type="button" class="legend-link" data-scroll-to="cross-title"><span class="xrank xrank--sample" aria-hidden="true">2/4</span>Dritte &amp; Vierte im Vergleich<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button></li>' : ''}
  </ul></div>`;
}

function renderPromoBanner(model, league) {
  const teams = league.groups.flatMap((g) => g.table.map((r) => model.teams[r.code]));
  return `<aside class="promo-banner zone-promotion" aria-label="Aufstieg aller Teams der Liga D">
    <span class="promo-banner__icon" aria-hidden="true">${ZONE_ICON.promotion}</span>
    <div class="promo-banner__text">
      <p class="promo-banner__title">Alle ${teams.length} Teams steigen auf <span aria-hidden="true">→</span> Liga C 2028/29</p>
      <p>Liga D wird nach dieser Saison aufgelöst. Die Platzierung ändert nichts am Aufstieg – 2028/29 spielen alle sechs Teams in Liga C.</p>
    </div>
    <ul class="promo-banner__teams">${teams.map((t) => `<li><button type="button" class="promo-banner__team" data-team="${esc(t.code)}">${flag(t)}<span>${esc(t.name)}</span></button></li>`).join('')}</ul>
  </aside>`;
}

export function renderGroupCard(model, g, state) {
  const open = state.openGroups?.has(g.id);
  const upcoming = g.matches.filter((m) => m.status !== 'FINISHED');
  const nextMd = upcoming.length ? Math.min(...upcoming.map((m) => m.md)) : null;
  const nextMatches = nextMd ? g.matches.filter((m) => m.md === nextMd) : [];
  const liveCount = g.matches.filter((m) => m.status === 'LIVE').length;
  const nextDate = nextMatches.length ? nextMatches.map((m) => m.date).sort()[0] : null;
  const sub = liveCount ? '<span class="live-tag"><span class="live-dot"></span>Live</span> · Spiele laufen'
    : nextDate ? `Nächstes Spiel: ${fmtWeekShort(nextDate)} ${fmtShort(nextDate)}` : 'Ligaphase beendet';

  return `
  <article class="group-card" id="gruppe-${g.id}" aria-labelledby="gt-${g.id}" data-group="${g.id}">
    <header class="group-card__head">
      <div class="group-card__id" aria-hidden="true"><span>${g.id[0]}</span>${g.id[1]}</div>
      <div class="group-card__title">
        <h3 id="gt-${g.id}">Gruppe ${g.id}</h3>
        <p>${sub}</p>
      </div>
      <span class="group-card__md" aria-label="Spieltag ${g.mdPlayed} von ${g.mdTotal} absolviert"><small>ST</small><span class="group-card__md-val">${g.mdPlayed}<span>/${g.mdTotal}</span></span></span>
    </header>

    <table class="standings">
      <caption class="sr-only">Tabelle Gruppe ${g.id}</caption>
      <thead>
        <tr>
          <th scope="col" class="c-pos"><abbr title="Platz">#</abbr></th>
          <th scope="col" class="c-team">Team</th>
          <th scope="col" class="c-num c-sec"><abbr title="Spiele">Sp</abbr></th>
          <th scope="col" class="c-num c-sec c-wdl"><abbr title="Siege">S</abbr></th>
          <th scope="col" class="c-num c-sec c-wdl"><abbr title="Unentschieden">U</abbr></th>
          <th scope="col" class="c-num c-sec c-wdl"><abbr title="Niederlagen">N</abbr></th>
          <th scope="col" class="c-goals">Tore</th>
          <th scope="col" class="c-num"><abbr title="Tordifferenz">TD</abbr></th>
          <th scope="col" class="c-pts"><abbr title="Punkte">Pkt</abbr></th>
          <th scope="col" class="c-form"><abbr title="Alle Spiele der Ligaphase – neuestes Ergebnis rechts, leere Felder sind offene Spiele">Form</abbr></th>
          <th scope="col" class="c-fm"><abbr title="Letzte drei Ergebnisse, neuestes rechts">Form</abbr></th>
        </tr>
      </thead>
      <tbody>
        ${g.table.map((r, i) => renderRow(model, r, g.table[i + 1], g)).join('')}
      </tbody>
    </table>

    ${nextMatches.length ? `
    <div class="group-next">
      ${miniMatchList(model, nextMatches, `${nextMatches.some((m) => m.status === 'LIVE') ? 'Jetzt' : 'Nächste Spiele'} · Spieltag ${nextMd}`)}
    </div>` : ''}

    <div class="group-card__foot">
      <button type="button" class="ghost-btn" data-toggle-group="${g.id}" aria-expanded="${open}" aria-controls="gm-${g.id}">
        <span>${open ? 'Spiele ausblenden' : 'Alle Spiele & Ergebnisse'}</span>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    </div>
    <div class="group-matches" id="gm-${g.id}"${open ? '' : ' hidden'}>
      ${open ? renderGroupMatches(model, g) : ''}
    </div>
  </article>`;
}

const rangeText = (r) => (r ? (r.best === r.worst ? `${r.best}.` : `${r.best}.–${r.worst}.`) : '');

function renderRow(model, r, next, g) {
  const t = model.teams[r.code];
  const zone = r.zone || 'safe';
  // Trennlinie nur an Grenzen, die zählen: unter der letzten „Aufwärts“-Zeile und über der ersten „Abwärts“-Zeile
  const cut = next && ((UP.has(zone) && !UP.has(next.zone)) || (DOWN.has(next.zone) && !DOWN.has(zone))) ? ' has-cut' : '';
  const range = rangeText(r.range);
  const tipBody = `${r.zoneReason || ''}${r.locked ? ' Rechnerisch bereits sicher.' : ''}${range && !r.locked ? ` Mögliche Endplatzierung: ${range}` : ''}`;
  const pool = r.pos === 3 ? 'Dritte' : 'Vierte';
  const cross = r.crossPos && t.league === 'A'
    ? `<span class="xrank" ${tipAttrs(`Vergleich der Gruppen${pool.toLowerCase()}n`, `Aktuell ${r.crossPos}. von 4 – ${r.pos === 3 ? 'die zwei besten Dritten bleiben in Liga A, die anderen spielen das Play-off A/B.' : 'die zwei besten Vierten spielen das Play-off A/B, die anderen steigen direkt ab.'}`)}><span class="xrank__pool">${pool}</span>${r.crossPos}<small>/4</small></span>`
    : '';
  const total = (g.teams.length - 1) * 2;
  return `<tr class="row zone-${zone}${cut}${r.locked ? ' is-locked' : ''}" data-team="${esc(r.code)}">
    <td class="c-pos"><span class="pos" data-tip-side="right" ${tipAttrs(`${r.zoneLabel || zoneTerm(zone, t.league)}${r.locked ? ' · sicher' : ''}`, tipBody)}>${r.pos}${r.locked ? `<span class="pos__lock">${ZONE_ICON.lock}</span>` : ''}</span></td>
    <th scope="row" class="c-team"><div class="c-team__in">
      <button type="button" class="team-link" data-team="${esc(r.code)}" aria-label="${esc(t.name)}, Platz ${r.pos}, ${r.pts} Punkte, ${esc(r.zoneLabel || zoneTerm(zone, t.league))}${r.locked ? ' (rechnerisch sicher)' : ''} – Details öffnen">
        ${flag(t)}${teamName(t)}
      </button>
      ${cross}
    </div></th>
    <td class="c-num c-sec">${r.p}</td>
    <td class="c-num c-sec c-wdl">${r.w}</td>
    <td class="c-num c-sec c-wdl">${r.d}</td>
    <td class="c-num c-sec c-wdl">${r.l}</td>
    <td class="c-goals"><span class="goals"><span>${r.gf}</span><i>:</i><span>${r.ga}</span></span></td>
    <td class="c-num c-gd">${signed(r.gd)}</td>
    <td class="c-pts">${r.pts}</td>
    <td class="c-form">${formPills(r.form, { total })}</td>
    <td class="c-fm">${formDots(r.form)}</td>
  </tr>`;
}

/** Spiele nach Datum gruppiert – das Datum steht einmal als Kopfzeile, nicht in jeder Zeile. */
export function miniMatchList(model, ms, label) {
  const byDate = new Map();
  for (const m of [...ms].sort((a, b) => (a.kickoff || a.date).localeCompare(b.kickoff || b.date))) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date).push(m);
  }
  const dates = [...byDate.keys()];
  const fmt = (d) => `${fmtWeekShort(d)} ${fmtShort(d)}`;
  if (dates.length === 1) {
    return `<p class="mini-head"><span>${label}</span><span class="mini-head__date">${fmt(dates[0])}</span></p>
      <ul class="mini-matches">${byDate.get(dates[0]).map((m) => miniMatch(model, m)).join('')}</ul>`;
  }
  return `<p class="mini-head"><span>${label}</span></p>` + dates.map((d) => `
      <p class="mini-sub">${fmt(d)}</p>
      <ul class="mini-matches">${byDate.get(d).map((m) => miniMatch(model, m)).join('')}</ul>`).join('');
}

export function miniMatch(model, m) {
  const h = model.teams[m.home], a = model.teams[m.away];
  const done = Number.isInteger(m.hs);
  const win = (side) => (done && m.status !== 'LIVE' ? ((side === 'h' ? m.hs > m.as : m.as > m.hs) ? ' is-win' : (m.hs === m.as ? '' : ' is-loss')) : '');
  return `<li class="mini-match${m.status === 'LIVE' ? ' is-live' : ''}">
    <button type="button" class="mini-match__team mini-match__team--h${win('h')}" data-team="${esc(h.code)}">${teamName(h)}${flag(h)}</button>
    ${scoreCell(m)}
    <button type="button" class="mini-match__team mini-match__team--a${win('a')}" data-team="${esc(a.code)}">${flag(a)}${teamName(a)}</button>
  </li>`;
}

export function renderGroupMatches(model, g) {
  const byMd = new Map();
  for (const m of g.matches) {
    if (!byMd.has(m.md)) byMd.set(m.md, []);
    byMd.get(m.md).push(m);
  }
  return [...byMd.entries()].sort((a, b) => a[0] - b[0]).map(([md, ms]) => `<section class="md-block">
      ${miniMatchList(model, ms, `Spieltag ${md}`)}
    </section>`).join('');
}

export const CUT_LABELS = { third: ['Bleiben in Liga A', 'Play-off A/B'], fourth: ['Play-off A/B', 'Abstieg in Liga B'] };

function renderCrossPanel(model) {
  const block = (title, rows, pos, [above, below]) => `
    <section class="cross-card" aria-labelledby="cross-${pos}">
      <h3 id="cross-${pos}">${title}</h3>
      <ol class="cross-list">
        ${rows.map((r, i) => {
          const t = model.teams[r.code];
          return `${i === 2 ? `<li class="cross-cut" aria-hidden="true">${zoneCut(above, below)}</li>` : ''}
          <li class="cross-item zone-${r.zone}">
            <span class="cross-item__rank pos" aria-label="Rang ${i + 1}">${i + 1}</span>
            <button type="button" class="team-link" data-team="${esc(t.code)}">${flag(t)}${teamName(t)}</button>
            <span class="cross-item__group">${r.group}</span>
            <span class="cross-item__stat"><b>${r.pts}</b> Pkt · ${signed(r.gd)}</span>
            ${zoneBadge(model.teams[r.code].row, { league: 'A' })}
          </li>`;
        }).join('')}
      </ol>
    </section>`;
  const third = model.cross.third.map((r) => ({ ...r, zone: model.teams[r.code].row.zone }));
  const fourth = model.cross.fourth.map((r) => ({ ...r, zone: model.teams[r.code].row.zone }));
  return `
  <section class="cross-panel" aria-labelledby="cross-title">
    <header class="section-head">
      <p class="eyebrow">Gruppenübergreifend</p>
      <h3 id="cross-title" class="display display--sm">Dritte &amp; Vierte im Vergleich</h3>
      <p class="section-head__lead">In Liga A entscheidet der Vergleich über alle vier Gruppen, wer als Dritter in der Liga bleibt und wer als Vierter noch ins Play-off darf.</p>
    </header>
    <div class="cross-grid">
      ${block('Gruppendritte', third, 3, CUT_LABELS.third)}
      ${block('Gruppenvierte', fourth, 4, CUT_LABELS.fourth)}
    </div>
  </section>`;
}
