import { esc, flag, zoneBadge, signed, teamName, zoneCut, ZONE_ICON } from '../ui.js';
import { CUT_LABELS } from './tables.js';

const rowAt = (model, groupId, pos) => {
  for (const l of model.leagues) for (const g of l.groups) if (g.id === groupId) return g.table.find((r) => r.pos === pos);
  return null;
};
const groupsOf = (model, league) => model.leagues.find((l) => l.id === league)?.groups ?? [];

function chip(model, r, { note = '', zone = null } = {}) {
  if (!r) return '';
  const t = model.teams[r.code];
  const z = zone || r.zone || 'safe';
  return `<li class="team-chip zone-${z}">
    <button type="button" class="team-chip__btn" data-team="${esc(t.code)}">
      ${flag(t, 'md')}
      <span class="team-chip__body">
        <span class="team-chip__name">${esc(t.name)}</span>
        <span class="team-chip__meta">${esc(note || `${r.pos}. Gruppe ${t.group}`)} · ${r.pts} Pkt</span>
      </span>
      ${r.locked ? `<span class="team-chip__lock" title="Rechnerisch sicher">${ZONE_ICON.lock}<span class="sr-only"> rechnerisch sicher</span></span>` : ''}
    </button>
  </li>`;
}

export function renderKnockout(model) {
  const A = groupsOf(model, 'A');
  const B = groupsOf(model, 'B');
  const C = groupsOf(model, 'C');
  const D = groupsOf(model, 'D');
  const third = model.cross.third.map((r) => model.teams[r.code].row);
  const fourth = model.cross.fourth.map((r) => model.teams[r.code].row);
  const poA = [...third.slice(2), ...fourth.slice(0, 2)];
  const poB = B.map((g) => rowAt(model, g.id, 2));
  const poB4 = B.map((g) => rowAt(model, g.id, 4));
  const poC2 = C.map((g) => rowAt(model, g.id, 2));
  const lpDone = model.matches.every((m) => m.status === 'FINISHED');
  const played = model.matches.filter((m) => m.status === 'FINISHED').length;

  return `
  <section class="section" aria-labelledby="ko-title">
    <header class="section-head">
      <p class="eyebrow">Prognose · Stand jetzt</p>
      <h2 id="ko-title" class="display display--ko">K.‑o.‑Phase &amp; Play‑offs</h2>
      <p class="section-head__lead">Wer würde weiterkommen, wenn die Ligaphase heute enden würde? Die Zuordnung wird bei jedem neuen Ergebnis neu berechnet. Häkchen markieren rechnerisch bereits gesicherte Plätze.</p>
    </header>

    <div class="road">
      <ol class="road__steps" aria-label="Zeitplan der Endrunde">
        <li class="road__step ${lpDone ? 'road__step--done' : 'road__step--now'}"${lpDone ? '' : ' aria-current="step"'}><span class="road__when">24.09.–17.11.2026</span><span class="road__what">Ligaphase</span><span class="road__how">${lpDone ? 'abgeschlossen' : `läuft · ${played}/${model.matches.length} Spiele`}</span></li>
        <li class="road__step ${lpDone ? 'road__step--now' : 'road__step--next'}"${lpDone ? ' aria-current="step"' : ''}><span class="road__when">25.–30. März 2027</span><span class="road__what">Viertelfinale</span><span class="road__how">Hin- und Rückspiel</span></li>
        <li class="road__step"><span class="road__when">9./10. Juni 2027</span><span class="road__what">Halbfinale</span><span class="road__how">Finalturnier</span></li>
        <li class="road__step"><span class="road__when">13. Juni 2027</span><span class="road__what">Finale</span><span class="road__how">+ Spiel um Platz 3</span></li>
      </ol>
      <p class="road__holder">Titelverteidiger: <button type="button" class="link-btn" data-team="POR">${flag(model.teams.POR)} Portugal</button></p>
    </div>

    <section class="ko-block" aria-labelledby="qf-title">
      <div class="ko-block__head">
        <h3 id="qf-title"><span class="dot dot--ko" aria-hidden="true"></span>Viertelfinale</h3>
        <p>Gruppensieger der Liga A treffen auf einen Gruppenzweiten einer anderen Gruppe; der Sieger hat Heimrecht im Rückspiel. Die Paarungen werden ausgelost.</p>
      </div>
      <div class="qf-grid">
        ${A.map((g) => `
          <article class="qf-card">
            <h4>Gruppe ${g.id}</h4>
            <ul class="chip-list">
              ${chip(model, rowAt(model, g.id, 1), { note: `Sieger ${g.id} · gesetzt` })}
              ${chip(model, rowAt(model, g.id, 2), { note: `Zweiter ${g.id}` })}
            </ul>
          </article>`).join('')}
      </div>
    </section>

    <section class="ko-block" aria-labelledby="po-ab-title">
      <div class="ko-block__head">
        <h3 id="po-ab-title"><span class="dot dot--pd" aria-hidden="true"></span>Play-off A/B</h3>
        <p>Die zwei schlechtesten Gruppendritten und die zwei besten Gruppenvierten der Liga A gegen die vier Gruppenzweiten der Liga B. Die Sieger spielen 2028/29 in Liga A.</p>
      </div>
      <div class="versus">
        <div class="versus__side">
          <p class="versus__label">Aus Liga A · kämpfen um den Verbleib</p>
          <ul class="chip-list">${poA.map((r) => chip(model, r, { note: `${r.pos}. Gruppe ${model.teams[r.code].group}` })).join('')}</ul>
        </div>
        <div class="versus__vs" aria-hidden="true">vs</div>
        <div class="versus__side">
          <p class="versus__label">Aus Liga B · wollen aufsteigen</p>
          <ul class="chip-list">${poB.map((r) => chip(model, r)).join('')}</ul>
        </div>
      </div>
    </section>

    <section class="ko-block" aria-labelledby="po-bc-title">
      <div class="ko-block__head">
        <h3 id="po-bc-title"><span class="dot dot--pd" aria-hidden="true"></span>Play-off B/C</h3>
        <p>Die vier Gruppenvierten der Liga B gegen die vier Gruppenzweiten der Liga C. Die Sieger spielen 2028/29 in Liga B.</p>
      </div>
      <div class="versus">
        <div class="versus__side">
          <p class="versus__label">Aus Liga B · kämpfen um den Verbleib</p>
          <ul class="chip-list">${poB4.map((r) => chip(model, r)).join('')}</ul>
        </div>
        <div class="versus__vs" aria-hidden="true">vs</div>
        <div class="versus__side">
          <p class="versus__label">Aus Liga C · wollen aufsteigen</p>
          <ul class="chip-list">${poC2.map((r) => chip(model, r)).join('')}</ul>
        </div>
      </div>
    </section>

    <section class="ko-block" aria-labelledby="moves-title">
      <div class="ko-block__head">
        <h3 id="moves-title"><span class="dot dot--up" aria-hidden="true"></span>Direkte Auf- und Abstiege</h3>
        <p>Diese Teams wechseln ohne Play-off die Liga. Aus Liga B und C gibt es in dieser Übergangssaison keine direkten Absteiger.</p>
      </div>
      <div class="moves-grid">
        <article class="move-card move-card--up"><h4><span aria-hidden="true">▲</span> Aufstieg in Liga A</h4><ul class="chip-list">${B.map((g) => chip(model, rowAt(model, g.id, 1))).join('')}</ul></article>
        <article class="move-card move-card--up"><h4><span aria-hidden="true">▲</span> Aufstieg in Liga B</h4><ul class="chip-list">${C.map((g) => chip(model, rowAt(model, g.id, 1))).join('')}</ul></article>
        <article class="move-card move-card--up"><h4><span aria-hidden="true">▲</span> Aufstieg in Liga C</h4><p class="move-card__note">Liga D wird aufgelöst – alle sechs Teams.</p><ul class="chip-list">${D.flatMap((g) => g.table.map((r) => chip(model, r))).join('')}</ul></article>
        <article class="move-card move-card--down"><h4><span aria-hidden="true">▼</span> Abstieg in Liga B</h4><p class="move-card__note">Die zwei schlechtesten Gruppenvierten der Liga A.</p><ul class="chip-list">${fourth.slice(2).map((r) => chip(model, r)).join('')}</ul></article>
      </div>
    </section>

    <section class="ko-block" aria-labelledby="cmp-title">
      <div class="ko-block__head">
        <h3 id="cmp-title"><span class="dot dot--safe" aria-hidden="true"></span>Liga A: Vergleich der Dritten und Vierten</h3>
        <p>Reihenfolge nach Punkten, Tordifferenz, erzielten Toren, Auswärtstoren, Siegen und Auswärtssiegen.</p>
      </div>
      <div class="cmp-grid">
        ${cmpTable(model, 'Gruppendritte', third, CUT_LABELS.third)}
        ${cmpTable(model, 'Gruppenvierte', fourth, CUT_LABELS.fourth)}
      </div>
    </section>
  </section>`;
}

function cmpTable(model, title, rows, [topLabel, bottomLabel]) {
  return `<div class="cmp">
    <table class="cmp-table">
      <caption>${title}</caption>
      <thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col"><abbr title="Gruppe">Gr.</abbr></th><th scope="col"><abbr title="Punkte">Pkt</abbr></th><th scope="col"><abbr title="Tordifferenz">TD</abbr></th><th scope="col"><abbr title="Tore">T</abbr></th><th scope="col"><span class="sr-only">Status</span></th></tr></thead>
      <tbody>
        ${rows.map((r, i) => {
          const t = model.teams[r.code];
          return `${i === 2 ? `<tr class="cmp-cut" aria-hidden="true"><td colspan="7">${zoneCut(topLabel, bottomLabel)}</td></tr>` : ''}
          <tr class="row zone-${r.zone}">
            <td class="c-pos"><span class="pos">${i + 1}</span></td>
            <th scope="row" class="c-team"><button type="button" class="team-link" data-team="${esc(t.code)}">${flag(t)}${teamName(t)}</button></th>
            <td>${t.group}</td>
            <td class="c-pts">${r.pts}</td>
            <td>${signed(r.gd)}</td>
            <td>${r.gf}</td>
            <td class="c-badge">${zoneBadge(r, { league: 'A' })}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}
