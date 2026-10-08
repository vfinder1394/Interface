// Tabellenberechnung nach UEFA-Reglement Nations League 2026/27 (Art. 15)
// Reines ES-Modul ohne DOM – wird auch von scripts/update-snapshot.mjs genutzt.

/** Ein Spiel zählt für die Tabelle, sobald ein Ergebnis vorliegt (beendet oder live). */
export const hasScore = (m) => Number.isInteger(m.hs) && Number.isInteger(m.as);
export const isFinished = (m) => hasScore(m) && m.status !== 'LIVE' && m.status !== 'UPCOMING';

function emptyRow(code) {
  return { code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, awayGf: 0, awayW: 0 };
}

function accumulate(codes, matches) {
  const rows = new Map(codes.map((c) => [c, emptyRow(c)]));
  for (const m of matches) {
    if (!hasScore(m)) continue;
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += m.hs; h.ga += m.as;
    a.gf += m.as; a.ga += m.hs;
    a.awayGf += m.as;
    if (m.hs > m.as) { h.w++; a.l++; h.pts += 3; }
    else if (m.hs < m.as) { a.w++; h.l++; a.pts += 3; a.awayW++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  for (const r of rows.values()) r.gd = r.gf - r.ga;
  return rows;
}

/** Teilt eine sortierte Liste in Blöcke gleicher Schlüssel. */
function partition(list, key) {
  const out = [];
  for (const item of list) {
    const k = key(item);
    const last = out[out.length - 1];
    if (last && last.k === k) last.items.push(item);
    else out.push({ k, items: [item] });
  }
  return out.map((b) => b.items);
}

const cmpDesc = (...keys) => (a, b) => {
  for (const k of keys) {
    const d = b[k] - a[k];
    if (d) return d;
  }
  return 0;
};

/** Kriterien 5–9 (+ alphabetisch als letzte, transparente Notlösung). */
function overallSort(block, rows, names) {
  return [...block].sort((x, y) => {
    const a = rows.get(x), b = rows.get(y);
    return cmpDesc('gd', 'gf', 'awayGf', 'w', 'awayW')(a, b) ||
      String(names?.[x] ?? x).localeCompare(String(names?.[y] ?? y), 'de');
  });
}

/** Kriterien 1–4: direkter Vergleich, rekursiv unter weiterhin Gleichen. */
function rankTied(block, matches, rows, names) {
  if (block.length <= 1) return block;
  const set = new Set(block);
  const h2hMatches = matches.filter((m) => set.has(m.home) && set.has(m.away));
  const h2h = accumulate(block, h2hMatches);
  const sorted = [...block].sort((x, y) => cmpDesc('pts', 'gd', 'gf')(h2h.get(x), h2h.get(y)));
  const parts = partition(sorted, (c) => {
    const r = h2h.get(c);
    return `${r.pts}|${r.gd}|${r.gf}`;
  });
  if (parts.length === 1) return overallSort(block, rows, names); // keine Trennung → Kriterium 5 ff.
  return parts.flatMap((p) => (p.length > 1 ? rankTied(p, matches, rows, names) : p));
}

/**
 * Berechnet die Gruppentabelle.
 * @param {string[]} codes  Teamcodes der Gruppe
 * @param {object[]} matches Spiele der Gruppe ({home, away, hs, as, date, kickoff})
 * @param {Record<string,string>} [names] Anzeigenamen für die letzte Sortierstufe
 */
export function computeTable(codes, matches, names) {
  const scored = matches.filter(hasScore);
  const rows = accumulate(codes, scored);
  const byPts = [...codes].sort((x, y) => rows.get(y).pts - rows.get(x).pts);
  const blocks = partition(byPts, (c) => rows.get(c).pts);
  const order = blocks.flatMap((b) => rankTied(b, scored, rows, names));
  return order.map((code, i) => ({ pos: i + 1, ...rows.get(code), form: formOf(code, scored) }));
}

const matchTime = (m) => m.kickoff || `${m.date}T12:00:00Z`;

/** Formkurve: letzte Ergebnisse (älteste zuerst). */
export function formOf(code, matches, n = 6) {
  return matches
    .filter((m) => hasScore(m) && (m.home === code || m.away === code))
    .sort((a, b) => matchTime(a).localeCompare(matchTime(b)))
    .slice(-n)
    .map((m) => {
      const own = m.home === code ? m.hs : m.as;
      const opp = m.home === code ? m.as : m.hs;
      return { r: own > opp ? 'S' : own < opp ? 'N' : 'U', id: m.id ?? null, live: m.status === 'LIVE' };
    });
}

/**
 * Mögliche Platzierungen bis Ende der Ligaphase (nur Punkte; Gleichstand wird
 * optimistisch bzw. pessimistisch gewertet → konservative Spanne).
 */
export function positionRanges(codes, matches) {
  const base = accumulate(codes, matches.filter(isFinished));
  const open = matches.filter((m) => !isFinished(m));
  const res = Object.fromEntries(codes.map((c) => [c, { best: codes.length, worst: 1 }]));
  if (open.length > 8) return null; // zu viele Kombinationen – Spanne nicht sinnvoll
  const pts = Object.fromEntries(codes.map((c) => [c, base.get(c).pts]));
  const outcomes = [[3, 0], [1, 1], [0, 3]];
  const walk = (i) => {
    if (i === open.length) {
      for (const c of codes) {
        let above = 0, tied = 0;
        for (const o of codes) {
          if (o === c) continue;
          if (pts[o] > pts[c]) above++;
          else if (pts[o] === pts[c]) tied++;
        }
        res[c].best = Math.min(res[c].best, above + 1);
        res[c].worst = Math.max(res[c].worst, above + tied + 1);
      }
      return;
    }
    const m = open[i];
    for (const [h, a] of outcomes) {
      pts[m.home] += h; pts[m.away] += a;
      walk(i + 1);
      pts[m.home] -= h; pts[m.away] -= a;
    }
  };
  walk(0);
  return res;
}

/** Gruppenübergreifender Vergleich (Art. 19, ohne Disziplinar-/Koeffizientenwertung). */
export function crossRank(rows, names) {
  return [...rows].sort((a, b) =>
    cmpDesc('pts', 'gd', 'gf', 'awayGf', 'w', 'awayW')(a, b) ||
    String(names?.[a.code] ?? a.code).localeCompare(String(names?.[b.code] ?? b.code), 'de'));
}
