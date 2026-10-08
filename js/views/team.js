import { esc, flag, ZONE_VAR, formPills, signed, scoreCell, fmtShort, fmtWeekShort, fmtRange, resultFor, ZONE_ICON, teamName } from '../ui.js';
import { ZONES, placeZones, zoneTerm, zoneStatusText } from '../zones.js';
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
  // Steht die Folge in jedem Fall fest (rechnerisch gesichert oder Liga D: alle steigen auf), sagt der Status „sicher“
  const certain = r.locked || oneZone;

  // Ein Satz Status-Erklärung (Gegner, Termin, Heimrecht) – keine zweite Zeile, die dasselbe wiederholt
  const statusText = zoneStatusText(r, t.league);
  const gapItem = (o, dir) => {
    const d = Math.abs(o.pts - r.pts);
    if (!d) return `<li><span class="tp__gap-val">±0</span><span>gleichauf mit Platz ${o.pos}</span></li>`;
    return `<li><span class="tp__gap-val tp__gap-val--${dir}">${dir === 'up' ? '−' : '+'}${d}</span><span>Pkt ${dir === 'up' ? 'hinter' : 'vor'} Platz ${o.pos}</span></li>`;
  };
  // Liga A, Platz 3/4: Über das Schicksal entscheidet der Vergleich der Gruppen – Abstand zur Trennlinie dort
  const pool = t.league === 'A' && r.crossPos ? model.cross[r.pos === 3 ? 'third' : 'fourth'] : null;
  const crossItem = () => {
    const ref = pool[r.crossPos <= 2 ? 2 : 1];
    const o = ref && model.teams[ref.code]?.row;
    if (!o || o.code === r.code) return '';
    const d = r.pts - o.pts;
    const word = r.pos === 3 ? 'Dritten' : 'Vierten';
    const val = d === 0 ? '±0' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
    return `<li class="tp__gap--cross"><span class="tp__gap-val">${val}</span><span>${d === 0 ? 'gleichauf mit' : d > 0 ? 'Pkt vor' : 'Pkt hinter'} Rang ${r.crossPos <= 2 ? 3 : 2} der ${word}</span></li>`;
  };
  const gapLine = showGaps ? [above ? gapItem(above, 'up') : '', below ? gapItem(below, 'down') : '', pool ? crossItem() : ''].join('') : '';

  const total = Math.max(1, r.w + r.d + r.l);
  const plural = (n, one, many) => `<b>${n}</b> ${n === 1 ? one : many}`;
  const avg = r.p && r.gf ? (r.gf / r.p).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;
  const gdRank = 1 + group.table.filter((x) => x.gd > r.gd).length;
  const gdShared = group.table.filter((x) => x.gd === r.gd).length > 1;
  // Erreichbare Endplätze als Zonen-Chips: Man sieht sofort, in welche Zonen das Team noch rutschen kann
  const facts = t.fifaRank ? [`<div class="tp__fact"><span>FIFA-Weltrangliste</span><b>${t.fifaRank}.</b></div>`] : [];
  // Erreichbare Endplätze stehen direkt in der Positionsleiste (nicht erreichbare Plätze gedimmt) – keine zweite Karte
  const reach = (p) => !range || (p >= range.best && p <= range.worst);
  const reachText = !range ? ''
    : range.best === range.worst ? (remaining ? `Endplatz steht fest: ${range.best}.` : `Endplatz: ${range.best}.`)
    : `Erreichbar: Platz ${range.best}–${range.worst} · ${remaining} ${remaining === 1 ? 'Spiel' : 'Spiele'} offen`;
  // Unterzeile mit Neuem: Einordnung + Fortschritt (Trainer nur mit Quelle → derzeit nicht angezeigt,
  // nächstes Spiel steht bereits markiert in der Spielliste)
  const sub = `Liga ${t.league} · Gruppe ${t.group} · ${r.p} von ${matches.length} Spielen`;
  // Spielfreie Spieltage (Liga D, Dreiergruppen) als leise Zeilen – die Zeitleiste bleibt lückenlos
  const ownMds = new Set(matches.map((m) => m.md));
  const byes = [...new Set(group.matches.map((m) => m.md))].filter((d) => !ownMds.has(d))
    .map((d) => ({ bye: true, md: d, date: group.matches.filter((m) => m.md === d).map((m) => m.date).sort()[0] }));
  const timeline = [...matches, ...byes].sort((a, b) => a.md - b.md || (a.kickoff || a.date || '').localeCompare(b.kickoff || b.date || ''));
  const zoneName = r.zoneLabel || zone.label;

  return `
  <div class="tp tp--${r.zone}">
    <div class="tp__bar">
      <span class="tp__grab" aria-hidden="true"></span>
      <div class="tp__bar-main">
        <div class="tp__mini" aria-hidden="true">${flag(t)}<b>${esc(t.name)}</b><span class="pos zone-${r.zone}">${r.pos}</span></div>
      </div>
      <button type="button" class="tp__close" data-close-panel aria-label="Details schließen">${CLOSE_ICON}</button>
    </div>

    <header class="tp__hero">
      <div class="tp__flag">${flag(t, 'lg')}</div>
      <div class="tp__id">
        <h2 id="team-panel-title" class="tp__name" lang="de">${esc(t.name)}</h2>
        <p class="tp__sub">${sub}</p>
      </div>
      <div class="tp__pos" aria-label="Platz ${r.pos} in Gruppe ${t.group}">
        <span class="tp__pos-label" aria-hidden="true">Platz</span>
        <span class="tp__pos-num" aria-hidden="true">${r.pos}<small>.</small></span>
      </div>
    </header>

    <section class="tp__status tp__anim" aria-label="Status">
      <div class="tp__status-head">
        <span class="status-pill status-pill--${r.zone}${certain ? ' is-locked' : ''} zone-${r.zone}">${certain ? ZONE_ICON.lock : ZONE_ICON[r.zone] || ''}${certain ? `${esc(zoneName)} sicher` : `<span class="status-pill__pre">Stand jetzt:</span> ${esc(zoneName)}`}</span>
      </div>
      ${oneZone ? '' : `<div class="pos-track-wrap">
      <ol class="pos-track" aria-label="Zonen der Gruppe ${t.group}">
        ${group.table.map((x) => {
          // Mögliche Zonen des Platzes (Liga A, Platz 3/4: zwei Zonen, je nach Gruppenvergleich) – Symbole statt Abkürzungen
          const zs = placeZones(t.league, x.pos);
          const words = zs.map((z) => zoneTerm(z, t.league)).join(' oder ');
          const split = zs.length > 1;
          const self = x.code === code;
          const icons = zs.map((z) => `<span class="pos-track__icon zone-${z}">${ZONE_ICON[z]}</span>`).join('');
          return `<li class="pos-track__seg zone-${zs[0]}${split ? ' is-split' : ''}${self ? ' is-self' : ''}${reach(x.pos) ? '' : ' is-out'}"${split ? ` style="--z1: var(${ZONE_VAR[zs[0]]}); --z2: var(${ZONE_VAR[zs[1]]})"` : ''} title="Platz ${x.pos}: ${esc(words)}${reach(x.pos) ? '' : ' (nicht mehr erreichbar)'}">${self ? '<span class="pos-track__here" aria-hidden="true"></span>' : ''}<span class="pos-track__bar"></span><span class="pos-track__num" aria-hidden="true">${x.pos}.${icons}</span><span class="sr-only">Platz ${x.pos}: ${esc(words)}${self ? ' (dieses Team)' : ''}${reach(x.pos) ? '' : ' – nicht mehr erreichbar'}</span></li>`;
        }).join('')}
      </ol>
      ${reachText ? `<p class="pos-track__caption">${esc(reachText)}</p>` : ''}
      </div>`}
      <p class="tp__reason">${certain ? '' : '<b class="tp__reason-pre">Bliebe es so:</b> '}${esc(statusText)}</p>
    </section>

    <section class="tp__stats tp__anim" aria-label="Statistik">
      <dl class="stat-hero">
        <div class="stat stat--hl"><dt>Punkte</dt><dd>${r.pts}</dd><span class="stat__sub">${remaining ? `max. ${maxPts}` : 'Endstand'}</span></div>
        <div class="stat"><dt>Tore</dt><dd>${r.gf}<i>:</i>${r.ga}</dd><span class="stat__sub">${avg ? `Ø ${avg} pro Spiel` : r.p ? 'noch kein Tor' : 'noch kein Spiel'}</span></div>
        <div class="stat"><dt>Tordifferenz</dt><dd>${signed(r.gd)}</dd><span class="stat__sub">${gdRank === 1 ? (gdShared ? 'Bestwert (geteilt)' : 'Bestwert') : `Rang ${gdRank} von ${group.table.length}`}</span></div>
        ${gapLine ? `<div class="stat stat--gaps"><dt>Abstand</dt><dd><ul class="tp__gaps">${gapLine}</ul></dd></div>` : ''}
      </dl>
      <div class="wdl" role="group" aria-label="Bilanz: ${r.w} ${r.w === 1 ? 'Sieg' : 'Siege'}, ${r.d} Unentschieden, ${r.l} ${r.l === 1 ? 'Niederlage' : 'Niederlagen'} aus ${r.p} ${r.p === 1 ? 'Spiel' : 'Spielen'}">
        <div class="wdl__head"><span aria-hidden="true">Bilanz <span class="wdl__games">· ${plural(r.p, 'Spiel', 'Spiele')}</span></span>${r.p ? `<span class="wdl__form">${formPills(r.form)}</span>` : ''}</div>
        <div class="wdl__bar" aria-hidden="true">
          ${r.p ? `<span class="wdl__s" style="flex:${r.w / total}"></span><span class="wdl__u" style="flex:${r.d / total}"></span><span class="wdl__n" style="flex:${r.l / total}"></span>` : '<span class="wdl__empty"></span>'}
        </div>
        <div class="wdl__legend" aria-hidden="true">
          <span><i class="wdl__dot wdl__dot--s"></i>${plural(r.w, 'Sieg', 'Siege')}</span>
          <span><i class="wdl__dot wdl__dot--u"></i><b>${r.d}</b> <span class="wdl__long">Unentschieden</span><span class="wdl__short">Unentsch.</span></span>
          <span><i class="wdl__dot wdl__dot--n"></i>${plural(r.l, 'Niederlage', 'Niederlagen')}</span>
        </div>
      </div>
      ${facts.length ? `<div class="tp__facts">${facts.join('')}</div>` : ''}
    </section>

    <section class="tp__matches tp__anim" aria-labelledby="tp-matches-title">
      <h3 id="tp-matches-title">Spiele &amp; Ergebnisse</h3>
      <ol class="fixture-list">
        ${timeline.map((m) => {
          if (m.bye) {
            return `<li class="fixture fixture--bye">
            <span class="fixture__when"><span class="fixture__md">Spieltag ${m.md}</span><span class="fixture__date">${m.date ? `${fmtWeekShort(m.date)} ${fmtShort(m.date)}` : ''}</span></span>
            <span class="fixture__bye">spielfrei</span>
          </li>`;
          }
          const home = m.home === code;
          const opp = model.teams[home ? m.away : m.home];
          const res = m.status === 'LIVE' ? null : resultFor(m, code);
          const resWord = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' }[res];
          const isNext = nextMatch && m === nextMatch && m.status !== 'LIVE';
          // Spielorte sind nur für einen Teil der Spiele bekannt → im Panel bewusst weggelassen (keine halb gefüllte Spalte)
          const dIn = inDays(daysTo(m.date));
          const sub = isNext ? `<span class="fixture__tag">${dIn ? `<span class="fixture__tag-long">Nächstes Spiel · </span>${dIn}` : 'Nächstes Spiel'}</span>` : '';
          return `<li class="fixture${res ? ` fixture--${res}` : ' fixture--open'}${m.status === 'LIVE' ? ' is-live' : ''}${isNext ? ' is-next' : ''}">
            <span class="fixture__when"><span class="fixture__md">Spieltag ${m.md}</span><span class="fixture__date">${fmtWeekShort(m.date)} ${fmtShort(m.date)}</span></span>
            <span class="fixture__ha" title="${home ? 'Heimspiel' : 'Auswärtsspiel'}"><span aria-hidden="true">${home ? 'H' : 'A'}</span><span class="sr-only">${home ? 'Heimspiel' : 'Auswärtsspiel'}</span></span>
            <span class="fixture__mid">
              <button type="button" class="fixture__opp" data-team="${esc(opp.code)}" aria-label="${home ? 'gegen' : 'bei'} ${esc(opp.name)} – Details öffnen">${flag(opp)}${teamName(opp)}</button>
              ${sub}
            </span>
            ${scoreCell(home ? m : { ...m, hs: m.as, as: m.hs })}${res ? `<span class="sr-only">${resWord}</span>` : ''}
          </li>`;
        }).join('')}
      </ol>
      <p class="tp__note">Ergebnisse aus Sicht von ${esc(t.name)}</p>
    </section>

    <footer class="tp__foot tp__anim">
      <a class="btn-secondary" href="#/tabellen/${t.league}/${t.group}" data-close-panel><span>Zur Tabelle Gruppe ${t.group}</span>${ARROW}</a>
      ${nextMatch ? `<a class="btn-secondary btn-secondary--quiet btn-secondary--2l" href="#/spieltage/${nextMatch.md}/${t.league}" data-close-panel><span class="btn-secondary__body"><span>Spieltag ${nextMatch.md} – alle Spiele der Liga ${t.league}</span><small>${fmtRangeOf(model, nextMatch.md, t.league)}</small></span>${ARROW}</a>` : ''}
    </footer>
  </div>`;
}

/** Zeitraum eines Spieltags in einer Liga, z. B. „12.–14.11.“ */
function fmtRangeOf(model, md, league) {
  const dates = model.matches.filter((m) => m.md === md && m.league === league).map((m) => m.date).sort();
  return dates.length ? fmtRange(dates[0], dates[dates.length - 1]) : '';
}
