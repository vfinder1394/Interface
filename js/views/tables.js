import { esc, flag, ZONE_VAR, zoneBadge, formPills, formDots, signed, scoreCell, fmtShort, fmtWeekShort, teamName, tipAttrs, zoneCut, ZONE_ICON } from '../ui.js';
import { LEAGUE_ZONES, LEAGUE_INFO, zoneTerm } from '../zones.js';

const LEAGUES = ['A', 'B', 'C', 'D'];

/**
 * Häkchen „rechnerisch sicher“ nur, wo etwas auf dem Spiel stand: In Liga C ist der Klassenerhalt für jedes Team
 * garantiert (kein Abstieg) – ein Häkchen am Tabellenletzten würde Spannung vortäuschen.
 */
export const showLock = (r, league) => Boolean(r?.locked) && !(league === 'C' && (r.zone || 'safe') === 'safe');

const UP = new Set(['ko', 'promotion', 'playoff-up']);

export function renderTables(model, leagueId, state) {
  const league = model.leagues.find((l) => l.id === leagueId) || model.leagues[0];
  const info = LEAGUE_INFO[league.id];
  // Ein Muster für alle Ligen: Teams · Gruppen · Fortschritt (keine Wiederholung der Tab-Unterzeile)
  const nTeams = league.groups.reduce((s, g) => s + g.teams.length, 0);
  const mdDone = Math.min(...league.groups.map((g) => g.mdPlayed));
  const mdTotal = Math.max(...league.groups.map((g) => g.mdTotal));
  const tagline = `${nTeams} Teams · ${league.groups.length} Gruppen · Spieltag ${mdDone}/${mdTotal}`;
  return `
  <section class="section section--tables" aria-labelledby="league-title">
    <div class="league-switch-wrap">
      <nav class="league-switch" aria-label="Liga wählen">
        ${LEAGUES.map((id) => {
          const l = model.leagues.find((x) => x.id === id);
          const sel = id === league.id;
          const leaders = l ? l.groups.map((g) => model.teams[g.table[0]?.code]).filter(Boolean) : [];
          const leaderText = leaders.map((t) => `${t.group}: ${t.name}`).join('\n');
          const leaderTip = leaders.length ? tipAttrs(`Tabellenführer Liga ${id}`, leaderText) : '';
          // Alle vier Links sind per Tab erreichbar (Navigation, keine Tabliste); Pfeiltasten sind nur eine Abkürzung
          return `<a class="league-tab${sel ? ' is-active' : ''}" href="#/tabellen/${id}" ${sel ? 'aria-current="page"' : ''} data-league="${id}" id="tab-${id}">
            <span class="league-tab__letter" aria-hidden="true">${id}</span>
            <span class="league-tab__meta"><span class="league-tab__name"><span class="league-tab__liga">Liga </span>${id}</span><span class="league-tab__sub">${esc(TAB_SUB[id])}</span></span>
            <span class="league-tab__aside" ${leaderTip}><span class="league-tab__flags" aria-hidden="true">${leaders.map((t) => flag(t)).join('')}</span><span class="sr-only">, ${esc(TAB_SUB[id])}. Tabellenführer: ${esc(leaders.map((t) => t.name).join(', '))}</span></span>
          </a>`;
        }).join('')}
        <span class="league-switch__glider" aria-hidden="true"></span>
      </nav>
    </div>

    <div id="league-panel" class="league-panel">
      <header class="league-head">
        <div class="league-head__title">
          <p class="eyebrow">${esc(tagline)}</p>
          <h2 id="league-title" class="display">Liga ${league.id}</h2>
          <p class="section-head__lead">${esc(LEAGUE_LEAD[league.id])}</p>
        </div>
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

/** Unterzeile je Liga beantwortet immer dieselbe Frage: Worum geht es in dieser Liga? */
const TAB_SUB = { A: 'Viertelfinale & Abstieg', B: 'Aufstieg in Liga A', C: 'Aufstieg in Liga B', D: 'Alle steigen auf' };

/** Die Frage der Liga als Unterzeile der Überschrift – ergänzt den Tab, statt ihn zu wiederholen. */
const LEAGUE_LEAD = {
  A: 'Platz 1 und 2 ziehen ins Viertelfinale ein. Bei den Dritten und Vierten entscheidet der Vergleich über alle vier Gruppen.',
  B: 'Gruppensieger steigen direkt auf, Zweite spielen um den Aufstieg, Vierte um den Klassenerhalt.',
  C: 'Gruppensieger steigen direkt auf, Zweite spielen um den Aufstieg. Absteigen kann in dieser Saison niemand.',
  D: 'Letzte Saison der Liga D: Alle sechs Teams spielen 2028/29 in Liga C.',
};

/**
 * Legende = dieselben Positions-Chips wie in der Tabelle (Ziffern der betroffenen Plätze) + ein kurzer Hinweis.
 * Ein Wortschatz überall: „Klassenerhalt“; Liga A nennt die Ränge im Vergleich („Dritte 1–2“) wie die Chips in der Tabelle.
 * Liga D hat keine Legende – das Aufstiegs-Banner sagt alles.
 */
const LEGEND = {
  A: { ko: ['1–2', 'Gruppensieger & -zweite'], safe: ['3', 'Dritte 1–2'], 'playoff-down': ['3–4', 'Dritte 3–4, Vierte 1–2'], relegation: ['4', 'Vierte 3–4'] },
  B: { promotion: ['1', 'in Liga A'], 'playoff-up': ['2', 'um den Aufstieg'], safe: ['3', 'bleibt in Liga B'], 'playoff-down': ['4', 'um den Klassenerhalt'] },
  C: { promotion: ['1', 'in Liga B'], 'playoff-up': ['2', 'um den Aufstieg'], safe: ['3–4', 'kein Abstieg'] },
  D: {},
};

/**
 * Positions-Chip mit fester Breite: Ziffer + Zonen-Symbol (nie nur Farbe als Bedeutungsträger; Klassenerhalt ohne Symbol).
 * „rechnerisch sicher“ als kleines Häkchen-Abzeichen an der Ecke (Ziffern bleiben in einer Flucht).
 */
export function posChip(pos, { locked = false, attrs = '', zone = null, sample = false } = {}) {
  const icon = zone && zone !== 'safe' ? ZONE_ICON[zone] || '' : '';
  return `<span class="pos pos--z${icon ? '' : ' pos--plain'}${locked ? ' pos--locked' : ''}${sample ? ' pos--sample' : ''}" ${attrs}><span class="pos__n">${pos}</span>${icon}${locked ? `<span class="pos__lock" aria-hidden="true">${ZONE_ICON.lock}</span>` : ''}</span>`;
}

export function renderLegend(leagueId, league) {
  const zones = leagueId === 'D' ? [] : LEAGUE_ZONES[leagueId];
  const item = (z) => {
    const [pos, hint] = LEGEND[leagueId]?.[z] || ['', ''];
    return `<li class="legend-item zone-${z}">
      <span aria-hidden="true">${posChip(pos, { zone: z, sample: true })}</span>
      <span class="legend-item__label"><span class="legend-item__term">${esc(zoneTerm(z, leagueId))}</span>${hint ? `<span class="legend-item__sep" aria-hidden="true">·</span><span class="legend-item__hint">${esc(hint)}</span>` : ''}</span>
      <span class="sr-only">: Platz ${pos}</span>
    </li>`;
  };
  // Zweite, leisere Zeile: Zeichen in der Tabelle (Häkchen, Vergleichsrang, direkter Vergleich) + Link zum Vergleich
  const rows = league?.groups.flatMap((g) => g.table) || [];
  const lockRow = rows.find((r) => showLock(r, leagueId));
  const formSample = '<span class="form form--sample" aria-hidden="true"><span class="form__pill form__pill--S">S</span><span class="form__pill form__pill--U">U</span><span class="form__pill form__pill--S is-latest">S</span></span>';
  const keys = [
    lockRow ? `<li class="legend-key"><span aria-hidden="true">${posChip(lockRow.pos, { zone: lockRow.zone, locked: true, sample: true }).replace('class="pos ', `class="pos zone-${lockRow.zone} `)}</span>rechnerisch sicher</li>` : '',
    leagueId === 'A' ? '<li class="legend-key"><span class="xrank xrank--sample" aria-hidden="true"><span class="xrank__pool">Dritte</span>1<small>/4</small></span>Rang im Vergleich aller Dritten bzw. Vierten</li>' : '',
    rows.some((r) => r.tieH2H) ? `<li class="legend-key"><span class="tie-mark tie-mark--sample" aria-hidden="true">${ZONE_ICON.h2h}</span>bei Punktgleichheit vorn dank direktem Vergleich</li>` : '',
    `<li class="legend-key">${formSample}<span>Form: neuestes Ergebnis rechts, gefüllt<span class="legend-key__mobile"> · letzte 3</span></span></li>`,
  ].filter(Boolean);
  const link = leagueId === 'A' ? '<button type="button" class="legend-link" data-scroll-to="cross-title">Dritte &amp; Vierte im Vergleich<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>' : '';
  if (!zones.length && !keys.length && !link) return '';
  return `<div class="legend-wrap">
    ${zones.length ? `<ul class="status-legend" aria-label="Legende der Tabellenzonen">${zones.map(item).join('')}</ul>` : ''}
    ${keys.length || link ? `<div class="legend-meta">${keys.length ? `<ul class="legend-keys" aria-label="Zeichen in der Tabelle">${keys.join('')}</ul>` : ''}${link}</div>` : ''}
  </div>`;
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
  // Unterzeile mit Neuem (Termin steht schon unten bei „Nächste Spiele“): Lage an der Spitze + gesicherte Zonen
  const [first, second] = g.table;
  const lead = first && second ? first.pts - second.pts : 0;
  const nameOf = (r) => esc(model.teams[r.code]?.name || r.code);
  // Ein Muster für alle Gruppen (auch Liga D): „<Spitzenreiter> führt · +N Pkt“ bzw. „A und B punktgleich vorn“
  const leadText = !first?.p ? 'Noch keine Spiele'
    : lead > 0 ? `${nameOf(first)} führt<span class="nowrap"> · +${lead}&nbsp;Pkt</span>`
    : `${nameOf(first)} und ${nameOf(second)} punktgleich vorn`;
  const sub = liveCount ? '<span class="live-tag"><span class="live-dot"></span>Live</span> · Spiele laufen'
    : !upcoming.length ? `Ligaphase beendet · ${nameOf(first)} Gruppensieger`
    : leadText;
  // Spieltag-Chip nur, wenn diese Gruppe vom Stand der Liga abweicht (sonst steht er schon im Liga-Kopf)
  const league = model.leagues.find((l) => l.id === g.league);
  const leagueMd = league ? Math.max(...league.groups.map((x) => x.mdPlayed)) : g.mdPlayed;
  const outOfSync = g.mdPlayed !== leagueMd;

  return `
  <article class="group-card" id="gruppe-${g.id}" aria-labelledby="gt-${g.id}" data-group="${g.id}">
    <header class="group-card__head">
      <div class="group-card__id" aria-hidden="true"><span>${g.id[0]}</span>${g.id[1]}</div>
      <div class="group-card__title">
        <h3 id="gt-${g.id}">Gruppe ${g.id}</h3>
        <p>${sub}</p>
      </div>
      ${outOfSync ? `<span class="group-card__md"><small>Spieltag</small><span class="group-card__md-val">${g.mdPlayed}<span>/${g.mdTotal}</span></span><span class="sr-only"> absolviert</span></span>` : ''}
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
          <th scope="col" class="c-num c-gd"><abbr title="Tordifferenz">TD</abbr></th>
          <th scope="col" class="c-num c-pts"><abbr title="Punkte">Pkt</abbr></th>
          <th scope="col" class="c-form"><abbr title="Ergebnisse, neuestes rechts (gefüllt); Punkte = offene Spiele">Form</abbr></th>
          <th scope="col" class="c-fm"><abbr title="Letzte Ergebnisse (bis zu 3), neuestes rechts">Form</abbr></th>
        </tr>
      </thead>
      <tbody>
        ${g.table.map((r, i) => renderRow(model, r, g.table[i - 1], g)).join('')}
      </tbody>
    </table>

    ${nextMatches.length ? `
    <div class="group-next">
      ${miniMatchList(model, nextMatches, `${nextMatches.some((m) => m.status === 'LIVE') ? 'Jetzt' : nextMatches.length === 1 ? 'Nächstes Spiel' : 'Nächste Spiele'} · Spieltag ${nextMd}`)}
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

function renderRow(model, r, prev, g) {
  const t = model.teams[r.code];
  const zone = r.zone || 'safe';
  // Trennlinie an jedem Zonenwechsel (gleiche Regel wie im Gruppenvergleich), getönt in der „wichtigeren“ Zone:
  // unter Aufwärts-Zonen in deren Farbe, sonst in der Farbe der Zone darunter. Gezeichnet als Innenschatten der
  // unteren Zeile – so liegt sie über der Hover-Fläche und wirkt nicht wie ein Auswahlrahmen.
  // Nur Trennlinien, die etwas bedeuten: zwischen zwei Aufwärts-Zonen (z. B. Aufstieg | Play-off) keine – sonst drei
  // konkurrierende Farblinien in einer Vierergruppe. Getönt in der „wichtigeren“ Zone (oberhalb Aufwärts-Zonen, sonst darunter).
  const pz = prev ? prev.zone || 'safe' : null;
  const cutZone = pz && pz !== zone && !(UP.has(pz) && UP.has(zone)) ? (UP.has(pz) ? pz : zone) : null;
  const cut = cutZone ? ' has-cut' : '';
  const cutStyle = cutZone ? ` style="--cut: var(${ZONE_VAR[cutZone]})"` : '';
  const range = rangeText(r.range);
  // Gleichstand per direktem Vergleich entschieden → sichtbar machen, damit die Reihenfolge nicht wie ein Fehler wirkt
  const tieBelow = r.tieH2H ? model.teams[r.tieH2H.below] : null;
  const tieText = tieBelow ? `Punktgleich mit ${tieBelow.name} – ${t.name} steht dank direktem Vergleich (Art. 15) davor.` : '';
  const zoneName = r.zoneLabel || zoneTerm(zone, t.league);
  const lockShown = showLock(r, t.league);
  const lockNote = r.locked ? (lockShown ? ' Rechnerisch bereits sicher.' : ` Die Plätze 1–2 sind nicht mehr erreichbar (mögliche Endplätze: ${range}).`) : '';
  const tipBody = `${r.zoneReason || ''}${lockNote}${range && !r.locked ? ` Mögliche Endplatzierung: ${range}` : ''}${tieText ? `\n${tieText}` : ''}`;
  const pool = r.pos === 3 ? 'Dritte' : 'Vierte';
  // Pool-Wort immer ausgeschrieben („Dritte 2/4“) – keine Abkürzungen, die mit „Liga D“ verwechselt werden
  const cross = r.crossPos && t.league === 'A'
    ? `<span class="xrank" ${tipAttrs(`Vergleich der Gruppen${pool.toLowerCase()}n`, `Aktuell ${r.crossPos}. von 4 – ${r.pos === 3 ? 'die zwei besten Dritten bleiben in Liga A, die anderen spielen das Play-off A/B.' : 'die zwei besten Vierten spielen das Play-off A/B, die anderen steigen direkt ab.'}`)}><span class="xrank__pool">${pool}</span>${r.crossPos}<small>/4</small></span>`
    : '';
  const tie = tieBelow ? `<span class="tie-mark" tabindex="0" ${tipAttrs('Direkter Vergleich', tieText)}>${ZONE_ICON.h2h}<span class="sr-only">${esc(tieText)}</span></span>` : '';
  const reasonId = `zr-${esc(r.code)}`;
  return `<tr class="row zone-${zone}${cut}${r.locked ? ' is-locked' : ''}" data-team="${esc(r.code)}"${cutStyle}>
    <td class="c-pos">${posChip(r.pos, { zone, locked: lockShown, attrs: `data-tip-side="right" ${tipAttrs(r.locked ? `${zoneName} · sicher` : `Aktuell: ${zoneName}`, tipBody)}` })}</td>
    <th scope="row" class="c-team"><div class="c-team__in">
      <button type="button" class="team-link" data-team="${esc(r.code)}" aria-label="${esc(t.name)}, Platz ${r.pos}, ${r.pts} Punkte, ${r.locked ? '' : 'aktuell '}${esc(zoneName)}${lockShown ? ' (rechnerisch sicher)' : ''} – Details öffnen" aria-describedby="${reasonId}">
        ${flag(t)}${teamName(t)}
      </button>
      ${cross || tie ? `<span class="c-team__tags${cross ? '' : ' c-team__tags--inline'}">${cross}${tie}</span>` : ''}
      <span class="sr-only" id="${reasonId}">${esc(tipBody)}</span>
    </div></th>
    <td class="c-num c-sec">${r.p}</td>
    <td class="c-num c-sec c-wdl">${r.w}</td>
    <td class="c-num c-sec c-wdl">${r.d}</td>
    <td class="c-num c-sec c-wdl">${r.l}</td>
    <td class="c-num c-goals"><span class="goals"><span>${r.gf}</span><i>:</i><span>${r.ga}</span></span></td>
    <td class="c-num c-gd">${signed(r.gd)}</td>
    <td class="c-num c-pts">${r.pts}</td>
    <td class="c-form">${formPills(r.form, { total: (g.table.length - 1) * 2 })}</td>
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

export const CUT_LABELS = {
  third: [['Klassenerhalt', 'safe'], ['Play-off A/B', 'playoff-down']],
  fourth: [['Play-off A/B', 'playoff-down'], ['Abstieg', 'relegation']],
};

function renderCrossPanel(model) {
  return `<section class="cross-panel" aria-labelledby="cross-title">${crossSection(model)}</section>`;
}

/** Dritte & Vierte im Vergleich (Liga A) – ein Bauteil, eine Überschrift; in der K.-o.-Ansicht einklappbar. */
export function crossSection(model, { collapsible = false, idPrefix = 'cross' } = {}) {
  const third = model.cross.third.map((r) => model.teams[r.code].row);
  const fourth = model.cross.fourth.map((r) => model.teams[r.code].row);
  const lead = 'In Liga A entscheidet der Vergleich über alle vier Gruppen, wer als Dritter in der Liga bleibt und wer als Vierter noch ins Play-off darf. Reihenfolge: Punkte, Tordifferenz, erzielte Tore, Auswärtstore, Siege, Auswärtssiege.';
  const head = `<span class="dot dot--neutral" aria-hidden="true"></span>Dritte &amp; Vierte im Vergleich`;
  const grid = `<div class="cmp-grid">
      ${cmpTable(model, 'Gruppendritte', third, CUT_LABELS.third)}
      ${cmpTable(model, 'Gruppenvierte', fourth, CUT_LABELS.fourth)}
    </div>`;
  if (collapsible) {
    return `<details class="ko-block ko-block--fold">
      <summary class="ko-block__head"><h3 id="${idPrefix}-title">${head}<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></h3><span class="ko-block__lead">${lead}</span></summary>
      ${grid}
    </details>`;
  }
  return `<div class="ko-block">
      <header class="ko-block__head"><h3 id="${idPrefix}-title">${head}</h3><p>${lead}</p></header>
      ${grid}
    </div>`;
}

/** Vergleich der Dritten/Vierten der Liga A – ein Bauteil für Tabellen- und K.-o.-Ansicht. */
export function cmpTable(model, title, rows, [topLabel, bottomLabel]) {
  return `<div class="cmp">
    <table class="cmp-table">
      <caption>${title}</caption>
      <thead><tr><th scope="col" class="c-pos c-rank">Rang</th><th scope="col" class="c-team">Team</th><th scope="col"><abbr title="Gruppe">Gr.</abbr></th><th scope="col" class="c-num"><abbr title="Punkte">Pkt</abbr></th><th scope="col" class="c-num"><abbr title="Tordifferenz">TD</abbr></th><th scope="col" class="c-num"><abbr title="Erzielte Tore">T</abbr></th><th scope="col" class="c-badge"><span class="sr-only">Status</span></th></tr></thead>
      <tbody>
        ${rows.map((r, i) => {
          const t = model.teams[r.code];
          return `${i === 2 ? `<tr class="cmp-cut" aria-hidden="true" style="--cut: var(${ZONE_VAR[bottomLabel[1]]})"><td colspan="7">${zoneCut(topLabel, bottomLabel)}</td></tr>` : ''}
          <tr class="row zone-${r.zone}">
            <td class="c-pos c-rank">${i + 1}.</td>
            <th scope="row" class="c-team"><button type="button" class="team-link" data-team="${esc(t.code)}">${flag(t)}${teamName(t)}</button></th>
            <td class="c-grp">${t.group}</td>
            <td class="c-num c-pts">${r.pts}</td>
            <td class="c-num">${signed(r.gd)}</td>
            <td class="c-num">${r.gf}</td>
            <td class="c-badge">${zoneBadge(r, { league: 'A' })}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}
