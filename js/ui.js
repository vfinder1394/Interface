// Kleine UI-Helfer: Escaping, Flaggen, Datumsformate, Bausteine
import { zoneTerm } from './zones.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function flag(team, size = 'sm') {
  if (!team) return '';
  // Lokale SVG-Flaggen (flag-icons, MIT) – Fallback: flagcdn.com, danach Kürzel-Plakette
  const w = size === 'lg' ? 160 : 80;
  return `<span class="flag flag--${size}" data-code="${esc(team.code)}"><img src="assets/flags/${esc(team.flag)}.svg" data-cdn="https://flagcdn.com/w${w}/${esc(team.flag)}.png" alt="" loading="lazy" decoding="async" width="${w}" height="${Math.round(w * 0.75)}"></span>`;
}

/** Defekte Flaggen → CDN-Fallback → Kürzel-Plakette (einmalig global registriert). */
export function installFlagFallback() {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const wrap = img.closest('.flag');
    if (!wrap || wrap.classList.contains('flag--fallback')) return;
    if (img.dataset.cdn && img.src !== img.dataset.cdn) {
      img.src = img.dataset.cdn;
      img.removeAttribute('data-cdn');
      return;
    }
    wrap.classList.add('flag--fallback');
    wrap.textContent = (wrap.dataset.code || '').slice(0, 3);
  }, true);
}

const dfDay = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' });
const dfShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
const dfShortY = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const dfWeekShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' });
const dfTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const dfMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });

const asDate = (iso) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
export const fmtDay = (iso) => dfDay.format(asDate(iso));
export const fmtShort = (iso) => dfShort.format(asDate(iso));
export const fmtShortY = (iso) => dfShortY.format(asDate(iso));
export const fmtWeekShort = (iso) => dfWeekShort.format(asDate(iso)).replace('.', '');
export const fmtTime = (iso) => dfTime.format(asDate(iso));
export const fmtMonth = (iso) => dfMonth.format(asDate(iso)).replace('.', '');

export function fmtRange(from, to) {
  // Kompakt im dd.mm.-Format wie überall auf der Seite: „24.–26.09.“ bzw. „30.09.–02.10.“
  const a = fmtShort(from), b = fmtShort(to);
  if (a === b) return a;
  if (a.slice(3) === b.slice(3)) return `${a.slice(0, 3)}–${b}`;
  return `${a}–${b}`;
}

const dfMonName = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'Europe/Berlin' });
const monName = (iso) => dfMonName.format(asDate(iso)).replace('.', '').slice(0, 3);
const dayNum = (iso) => Number(fmtShort(iso).slice(0, 2));

/** Zeitraum mit Monatsnamen: „24.–26. Sep“ bzw. „30. Sep – 2. Okt“. */
export function fmtRangeMonth(from, to) {
  const a = fmtShort(from), b = fmtShort(to);
  if (a === b) return `${dayNum(from)}. ${monName(from)}`;
  if (a.slice(3) === b.slice(3)) return `${dayNum(from)}.–${dayNum(to)}. ${monName(to)}`;
  return `${dayNum(from)}. ${monName(from)} – ${dayNum(to)}. ${monName(to)}`;
}

export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** Zonen-Icons (SVG, 24er-Raster) – nie nur Farbe als Bedeutungsträger. */
export const ZONE_ICON = {
  ko: '<svg viewBox="0 0 24 24" aria-hidden="true" class="zi zi--fill"><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9-4.4-4.1 6-.7z"/></svg>',
  promotion: '<svg viewBox="0 0 24 24" aria-hidden="true" class="zi"><path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6"/></svg>',
  'playoff-up': '<svg viewBox="0 0 24 24" aria-hidden="true" class="zi"><path d="M6 15l6-6 6 6"/></svg>',
  'playoff-down': '<svg viewBox="0 0 24 24" aria-hidden="true" class="zi"><path d="M6 9l6 6 6-6"/></svg>',
  relegation: '<svg viewBox="0 0 24 24" aria-hidden="true" class="zi"><path d="M6 5.5l6 6 6-6M6 11.5l6 6 6-6"/></svg>',
  safe: '<svg viewBox="0 0 24 24" aria-hidden="true" class="zi"><path d="M12 3.5l7 2.6v5.4c0 4.4-2.9 7.7-7 9-4.1-1.3-7-4.6-7-9V6.1z"/><path d="M9 12l2.2 2.2L15.2 10"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true" class="zi"><path d="M5.5 12.5l4 4 9-9"/></svg>',
};

/** Tooltip-Attribute: fett gesetzte Titelzeile + Erklärung (ohne Wiederholung). */
export const tipAttrs = (title, body) => `data-tip-title="${esc(title)}" data-tip="${esc(body)}"`;

/** Status-Pill mit fester Breite (Vergleichslisten der Liga A). */
export function zoneBadge(row, { league = 'A' } = {}) {
  if (!row?.zone) return '';
  const label = zoneShort(row.zone, league);
  const body = `${row.zoneReason || ''}${row.locked ? ' Rechnerisch bereits sicher.' : ''}`;
  return `<span class="zone-badge zone-${row.zone}${row.locked ? ' is-locked' : ''}" ${tipAttrs(row.zoneLabel || label, body)} tabindex="0">` +
    `${ZONE_ICON[row.zone] || ''}<span class="zone-badge__text">${esc(label)}</span>` +
    `${row.locked ? `<span class="zone-badge__lock">${ZONE_ICON.lock}</span>` : ''}` +
    `<span class="sr-only">: ${esc(body)}</span></span>`;
}

export const zoneShort = (zone, league) => zoneTerm(zone, league);

const RESULT_WORD = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' };

/**
 * Formkurve als feste Leiste: gespielte Spiele (älteste zuerst) + leere Slots für offene Spiele.
 * Das neueste Ergebnis trägt einen Ring statt einer Unterstreichung.
 */
export function formPills(form, { label = true, total = 0 } = {}) {
  const played = form?.length || 0;
  const slots = Math.max(0, total - played);
  if (!played && !slots) return '<span class="form form--empty" aria-label="Noch keine Spiele">–</span>';
  const desc = played ? (form || []).map((f) => RESULT_WORD[f.r]).join(', ') : 'noch keine Spiele';
  const aria = label ? ` aria-label="Form (älteste zuerst): ${desc}${slots ? `; ${slots} ${slots === 1 ? 'Spiel' : 'Spiele'} offen` : ''}" role="img"` : '';
  return `<span class="form"${aria}>${(form || [])
    .map((f, i) => `<span class="form__pill form__pill--${f.r}${f.live ? ' is-live' : ''}${i === played - 1 ? ' is-latest' : ''}" aria-hidden="true">${f.r}</span>`)
    .join('')}${'<span class="form__pill form__pill--open" aria-hidden="true"></span>'.repeat(slots)}</span>`;
}

/** Kompakte Form (mobil): die letzten 3 Ergebnisse als Punkte, neuestes rechts. */
export function formDots(form, n = 3) {
  const last = (form || []).slice(-n);
  if (!last.length) return '';
  return `<span class="form-dots" role="img" aria-label="Letzte Ergebnisse: ${last.map((f) => RESULT_WORD[f.r]).join(', ')}">${last
    .map((f) => `<span class="form-dot form-dot--${f.r}"></span>`).join('')}</span>`;
}

/** Ergebnis aus Sicht eines Teams: S/U/N oder null */
export function resultFor(m, code) {
  if (!Number.isInteger(m.hs)) return null;
  const own = m.home === code ? m.hs : m.as;
  const opp = m.home === code ? m.as : m.hs;
  return own > opp ? 'S' : own < opp ? 'N' : 'U';
}

const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';

export function scoreCell(m) {
  const val = () => {
    const lo = (a, b) => (m.status !== 'LIVE' && a < b ? ' class="is-lo"' : '');
    return `<span class="score__val"><b${lo(m.hs, m.as)}>${m.hs}</b><i>:</i><b${lo(m.as, m.hs)}>${m.as}</b></span>`;
  };
  if (m.status === 'LIVE') return `<span class="score score--live">${val()}<span class="score__min">${esc(m.minute || 'Live')}</span></span>`;
  if (Number.isInteger(m.hs)) return `<span class="score score--done">${val()}</span>`;
  return `<span class="score score--upcoming"><span class="score__time">${m.kickoff ? `${CLOCK}${fmtTime(m.kickoff)}` : 'offen'}</span></span>`;
}

/** Trennzeile zwischen zwei Zonen in den Vergleichslisten (Tabellen- und K.-o.-Ansicht). */
export const zoneCut = (above, below) =>
  `<span class="zone-cut"><span class="zone-cut__up">▲ ${esc(above)}</span><span class="zone-cut__down">▼ ${esc(below)}</span></span>`;

/** Kurznamen für sehr lange Ländernamen (schmale Viewports). */
export const SHORT_NAMES = { BIH: 'Bosnien-H.', MKD: 'N. Mazedonien' };

export function teamName(team) {
  const short = SHORT_NAMES[team.code];
  return `<span class="tn${short ? ' has-short' : ''}"><span class="tn__full">${esc(team.name)}</span>${short ? `<span class="tn__short" aria-hidden="true">${esc(short)}</span>` : ''}<span class="tn__code" aria-hidden="true">${esc(team.code)}</span></span>`;
}
