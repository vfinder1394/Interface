// Topspiele und Entscheidungsspiele je Gruppe und Spieltag
import { positionRanges, isFinished } from './standings.js';
import { placeZones, ZONE_ORDER } from './zones.js';

const OUTCOMES = [[1, 0], [0, 0], [0, 1]];
const GOAL = { ko: 'das Viertelfinale', promotion: 'den Aufstieg', 'playoff-up': 'das Play-off um den Aufstieg', safe: 'den Klassenerhalt' };
const FATE = { 'playoff-down': 'das Play-off um den Klassenerhalt', relegation: 'den Abstieg' };

/** Zonen, die mit den Plätzen best…worst noch erreichbar sind (Liga A, Platz 3/4: beide Vergleichszonen). */
function reachable(league, range) {
  const zones = new Set();
  for (let p = range.best; p <= range.worst; p++) for (const z of placeZones(league, p)) zones.add(z);
  return zones;
}

const bestOf = (zones) => ZONE_ORDER.find((z) => zones.has(z));
const worstOf = (zones) => [...ZONE_ORDER].reverse().find((z) => zones.has(z));

/**
 * Was ein offenes Spiel entscheiden kann: Für jedes Ergebnis dieses Spiels (kombiniert mit den übrigen
 * offenen Spielen der Gruppe am selben Spieltag) wird geprüft, ob sich die erreichbaren Zonen eines der
 * beiden Teams schon nach dem Spieltag rechnerisch festlegen. Gleichstände zählen konservativ (nur Punkte).
 * @returns {{team: string, text: string}[]} leer, wenn das Spiel noch nichts entscheiden kann
 */
function stakesOf(group, m) {
  if (group.league === 'D' || !group.ranges) return [];
  const sameDay = group.matches.filter((x) => x.md === m.md && !isFinished(x));
  const others = sameDay.filter((x) => x !== m);
  const later = group.matches.filter((x) => x.md > m.md && !isFinished(x));
  if (later.length > 8) return []; // zu früh in der Ligaphase – nichts kann feststehen

  const out = [];
  for (const code of [m.home, m.away]) {
    const now = reachable(group.league, group.ranges[code]);
    if (now.size < 2) continue; // steht bereits fest
    const finals = [];
    for (const [hs, as] of OUTCOMES) {
      const walk = (i, fixed) => {
        if (i < others.length) {
          for (const [h, a] of OUTCOMES) walk(i + 1, [...fixed, { ...others[i], hs: h, as: a, status: 'FINISHED' }]);
          return;
        }
        const hyp = group.matches.map((x) => fixed.find((f) => f.home === x.home && f.away === x.away) || x);
        const ranges = positionRanges(group.teams, hyp);
        if (ranges) finals.push(reachable(group.league, ranges[code]));
      };
      walk(0, [{ ...m, hs, as, status: 'FINISHED' }]);
    }
    const best = bestOf(now), worst = worstOf(now);
    // Bestes Ziel rechnerisch sichern (nur noch eine Zone möglich, und zwar die beste)
    if (GOAL[best] && finals.some((z) => z.size === 1 && z.has(best))) out.push({ team: code, kind: 'goal', text: `kann ${GOAL[best]} sichern` });
    // Schlechtestes Szenario kann feststehen
    else if (FATE[worst] && finals.some((z) => z.size === 1 && z.has(worst))) out.push({ team: code, kind: 'fate', text: `droht ${FATE[worst]}` });
    // Oder ein Team kann den Platz, den es gerade belegt, endgültig verlieren
    else if (GOAL[best] && group.table.find((r) => r.code === code)?.zone === best && finals.some((z) => !z.has(best))) out.push({ team: code, kind: 'miss', text: `kann ${GOAL[best]} verpassen` });
  }
  return out;
}

/** Gewicht der Tabellenlage: Punkte beider Teams, Duell der Spitzenplätze, enges Punkteduell. */
function weight(model, m, decisive) {
  const h = model.teams[m.home]?.row, a = model.teams[m.away]?.row;
  if (!h || !a) return 0;
  return h.pts + a.pts + (h.pos <= 2 && a.pos <= 2 ? 6 : 0) - Math.abs(h.pts - a.pts) + (decisive ? 4 : 0);
}

/**
 * Für alle offenen Spiele der Liste: Entscheidungsgehalt und je Gruppe ein Topspiel.
 * @returns {Map<object, {stakes: object[], top: boolean}>}
 */
export function analyzeMatches(model, list) {
  const info = new Map();
  const groups = new Map(model.leagues.flatMap((l) => l.groups.map((g) => [g.id, g])));
  const byGroup = new Map();
  for (const m of list) {
    if (isFinished(m) || m.status === 'LIVE') continue;
    const g = groups.get(m.group);
    if (!g) continue;
    info.set(m, { stakes: stakesOf(g, m), top: false });
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(m);
  }
  for (const [g, ms] of byGroup) {
    if (!g.mdPlayed || ms.length < 2) continue; // vor dem 1. Spieltag oder nur ein Spiel: kein Vergleich
    const top = [...ms].sort((a, b) => weight(model, b, info.get(b).stakes.length) - weight(model, a, info.get(a).stakes.length))[0];
    info.get(top).top = true;
  }
  return info;
}
