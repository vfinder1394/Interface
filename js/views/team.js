import { esc, flag, formPills, signed, scoreCell, fmtShort, fmtWeekShort, fmtTime, resultFor, ZONE_ICON, teamName } from '../ui.js';
import { ZONES } from '../zones.js';
import { todayBerlin } from '../data.js';

const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

export function renderTeam(model, code) {
  const t = model.teams[code];
  if (!t) return '<p class="empty">Team nicht gefunden.</p>';
  const r = t.row;
  const group = model.leagues.find((l) => l.id === t.league).groups.find((g) => g.id === t.group);
  const matches = group.matches.filter((m) => m.home === code || m.away === code);
  const zone = ZONES[r.zone] || ZONES.safe;
  const range = r.range;
  const rangeText = range ? (range.best === range.worst ? `${range.best}.` : `${range.best}.–${range.worst}.`) : '–';
  const remaining = matches.filter((m) => m.status !== 'FINISHED').length;
  const maxPts = r.pts + remaining * 3;
  const above = group.table[r.pos - 2];
  const below = group.table[r.pos];
  const byTime = (a, b) => (a.kickoff || a.date).localeCompare(b.kickoff || b.date);
  const nextMatch = matches.filter((m) => m.status !== 'FINISHED').sort(byTime)[0] || null;
  const daysTo = (iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayBerlin()}T00:00:00Z`)) / 864e5);
  const inDays = (d) => (d > 1 ? `in ${d} Tagen` : d === 1 ? 'morgen' : d === 0 ? 'heute' : '');

  // Eine Zone für die ganze Gruppe (Liga D) → Zonenleiste und Abstände sagen nichts Neues
  const oneZone = new Set(group.table.map((x) => x.zone)).size === 1;
  const showGaps = !oneZone && !r.locked;

  // Zusatztext nur, wenn er Neues sagt (Termin/Modus der Play-offs bzw. des Viertelfinals)
  const extra = ['ko', 'playoff-up', 'playoff-down'].includes(r.zone) ? zone.desc : '';
  const gapItem = (o, dir) => {
    const d = Math.abs(o.pts - r.pts);
    if (!d) return `<li><span class="tp__gap-val">±0</span><span>punktgleich mit Platz ${o.pos}</span></li>`;
    return `<li><span class="tp__gap-val tp__gap-val--${dir}">${dir === 'up' ? '−' : '+'}${d} Pkt</span><span>${dir === 'up' ? 'hinter' : 'vor'} Platz ${o.pos}</span></li>`;
  };
  const gapLine = showGaps ? [above ? gapItem(above, 'up') : '', below ? gapItem(below, 'down') : ''].join('') : '';

  const total = Math.max(1, r.w + r.d + r.l);
  const plural = (n, one, many) => `<b>${n}</b> ${n === 1 ? one : many}`;
  const avg = r.p ? (r.gf / r.p).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;
  const gdRank = 1 + group.table.filter((x) => x.gd > r.gd).length;
  const gdShared = group.table.filter((x) => x.gd === r.gd).length > 1;
  const facts = [
    `<div class="tp__fact"><span>Endplatz möglich</span><b>${rangeText}</b>${remaining ? `<small>bei ${remaining} ${remaining === 1 ? 'offenem Spiel' : 'offenen Spielen'}</small>` : ''}</div>`,
    t.coach ? `<div class="tp__fact"><span>Nationaltrainer</span><b>${esc(t.coach)}</b></div>` : '',
    t.fifaRank ? `<div class="tp__fact"><span>FIFA-Weltrangliste</span><b>${t.fifaRank}.</b></div>` : '',
  ].filter(Boolean);
  const nextOpp = nextMatch ? model.teams[nextMatch.home === code ? nextMatch.away : nextMatch.home] : null;

  return `
  <div class="tp zone-${r.zone}">
    <div class="tp__bar">
      <span class="tp__grab" aria-hidden="true"></span>
      <div class="tp__mini" aria-hidden="true">${flag(t)}<b>${esc(t.name)}</b><span class="pos">${r.pos}</span></div>
      <button type="button" class="icon-btn tp__close" data-close-panel aria-label="Details schließen">${CLOSE_ICON}</button>
    </div>

    <header class="tp__hero tp__anim">
      <div class="tp__flag">${flag(t, 'lg')}</div>
      <div class="tp__id">
        <p class="eyebrow">Liga ${t.league} · Gruppe ${t.group}</p>
        <h2 id="team-panel-title" class="tp__name">${esc(t.name)}</h2>
        <p class="tp__sub">${esc(t.code)} · ${r.pts} ${r.pts === 1 ? 'Punkt' : 'Punkte'} aus ${r.p} ${r.p === 1 ? 'Spiel' : 'Spielen'}</p>
      </div>
      <div class="tp__pos" aria-label="Platz ${r.pos} in Gruppe ${t.group}">
        <span class="tp__pos-label">Platz</span>
        <span class="tp__pos-num">${r.pos}<small>.</small></span>
      </div>
    </header>

    <section class="tp__status tp__anim" aria-label="Status">
      <div class="tp__status-head">
        <span class="status-pill status-pill--${r.zone}">${ZONE_ICON[r.zone] || ''}${esc(r.zoneLabel || zone.label)}${r.locked ? ' · sicher' : ''}</span>
      </div>
      ${oneZone ? '' : `<ol class="pos-track" aria-label="Zonen der Gruppe ${t.group}">
        ${group.table.map((x) => `<li class="pos-track__seg zone-${x.zone}${x.code === code ? ' is-self' : ''}"><span class="pos-track__bar"></span><span class="pos-track__num">${x.pos}.</span><span class="sr-only">${esc(x.zoneLabel || '')}${x.code === code ? ' (dieses Team)' : ''}</span></li>`).join('')}
      </ol>`}
      <p class="tp__reason">${esc(r.zoneReason || zone.desc)}</p>
      ${extra ? `<p class="tp__status-desc">${esc(extra)}</p>` : ''}
      ${gapLine ? `<ul class="tp__gaps">${gapLine}</ul>` : ''}
    </section>

    <section class="tp__stats tp__anim" aria-label="Statistik">
      <dl class="stat-hero">
        <div class="stat stat--hl"><dt>Punkte</dt><dd>${r.pts}</dd><span class="stat__sub">${remaining ? `max. ${maxPts} möglich` : 'Endstand'}</span></div>
        <div class="stat"><dt>Tore</dt><dd>${r.gf}<i>:</i>${r.ga}</dd><span class="stat__sub">${avg ? `Ø ${avg} pro Spiel` : 'noch kein Spiel'}</span></div>
        <div class="stat"><dt>Tordiff.</dt><dd>${signed(r.gd)}</dd><span class="stat__sub">${gdRank === 1 ? (gdShared ? 'Geteilter Bestwert' : 'Bestwert') : `Rang ${gdRank}`} in ${t.group}</span></div>
      </dl>
      <div class="wdl" aria-label="Bilanz: ${r.w} ${r.w === 1 ? 'Sieg' : 'Siege'}, ${r.d} Unentschieden, ${r.l} ${r.l === 1 ? 'Niederlage' : 'Niederlagen'} aus ${r.p} ${r.p === 1 ? 'Spiel' : 'Spielen'}">
        <div class="wdl__bar" aria-hidden="true">
          ${r.p ? `<span class="wdl__s" style="flex:${r.w / total}"></span><span class="wdl__u" style="flex:${r.d / total}"></span><span class="wdl__n" style="flex:${r.l / total}"></span>` : '<span class="wdl__empty"></span>'}
        </div>
        <div class="wdl__legend" aria-hidden="true">
          <span><i class="wdl__dot wdl__dot--s"></i>${plural(r.w, 'Sieg', 'Siege')}</span>
          <span><i class="wdl__dot wdl__dot--u"></i><b>${r.d}</b> Remis</span>
          <span><i class="wdl__dot wdl__dot--n"></i>${plural(r.l, 'Niederlage', 'Niederlagen')}</span>
          <span class="wdl__games">${plural(r.p, 'Spiel', 'Spiele')}</span>
        </div>
      </div>
      <div class="tp__facts">
        <div class="tp__fact tp__fact--wide"><span>Form <em>· neuestes rechts</em></span>${formPills(r.form, { total: matches.length })}</div>
        ${facts.join('')}
      </div>
    </section>

    <section class="tp__matches tp__anim" aria-labelledby="tp-matches-title">
      <h3 id="tp-matches-title">Spiele &amp; Ergebnisse</h3>
      <ol class="fixture-list">
        ${matches.map((m) => {
          const home = m.home === code;
          const opp = model.teams[home ? m.away : m.home];
          const res = m.status === 'LIVE' ? null : resultFor(m, code);
          const resWord = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' }[res];
          const isNext = nextMatch && m === nextMatch && m.status !== 'LIVE';
          const sub = isNext ? `<span class="fixture__tag">Nächstes Spiel${inDays(daysTo(m.date)) ? ` · ${inDays(daysTo(m.date))}` : ''}</span>`
            : m.venue ? `<span class="fixture__venue">${esc(m.venue)}</span>` : '';
          return `<li class="fixture${res ? ` fixture--${res}` : ' fixture--open'}${m.status === 'LIVE' ? ' is-live' : ''}${isNext ? ' is-next' : ''}">
            <span class="fixture__when"><span class="fixture__md">ST ${m.md}</span><span class="fixture__date">${fmtWeekShort(m.date)} ${fmtShort(m.date)}</span></span>
            <span class="fixture__ha fixture__ha--${home ? 'h' : 'a'}"><span aria-hidden="true">${home ? 'Heim' : 'Ausw.'}</span><span class="sr-only">${home ? 'Heimspiel' : 'Auswärtsspiel'}</span></span>
            <span class="fixture__mid">
              <button type="button" class="fixture__opp" data-team="${esc(opp.code)}" aria-label="${home ? 'gegen' : 'bei'} ${esc(opp.name)} – Details öffnen">${flag(opp)}${teamName(opp)}</button>
              ${sub}
            </span>
            ${scoreCell(home ? m : { ...m, hs: m.as, as: m.hs })}
            ${res ? `<span class="fixture__res fixture__res--${res}" title="${resWord}"><span aria-hidden="true">${res}</span><span class="sr-only">${resWord}</span></span>` : '<span class="fixture__res fixture__res--open" aria-hidden="true">–</span>'}
          </li>`;
        }).join('')}
      </ol>
      <p class="tp__note">Ergebnisse aus Sicht von ${esc(t.name)}</p>
    </section>

    <footer class="tp__foot tp__anim">
      <a class="btn-secondary" href="#/tabellen/${t.league}/${t.group}" data-close-panel><span>Zur Tabelle Gruppe ${t.group}</span>${ARROW}</a>
      ${nextMatch ? `<a class="btn-secondary btn-secondary--quiet btn-secondary--2l" href="#/spieltage/${nextMatch.md}/${t.league}" data-close-panel><span class="btn-secondary__body"><span>Nächstes Spiel: ${nextMatch.home === code ? 'gegen' : 'bei'} ${esc(nextOpp.name)}</span><small>Spieltag ${nextMatch.md} · ${fmtWeekShort(nextMatch.date)} ${fmtShort(nextMatch.date)}${nextMatch.kickoff ? `, ${fmtTime(nextMatch.kickoff)} Uhr` : ''} · alle Spiele der Liga ${t.league}</small></span>${ARROW}</a>` : ''}
    </footer>
  </div>`;
}
