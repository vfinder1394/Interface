// Statuszonen gemäß docs/regeln.md (Übergangssaison 2026/27)
import { crossRank } from './standings.js';

/** Zonen: ein Begriff (label) und eine Erklärung (desc). Kurzformen stehen in ZONE_ABBR, Icons in ui.js (ZONE_ICON). */
export const ZONES = {
  ko: { label: 'Viertelfinale', desc: 'Gruppensieger und -zweite der Liga A spielen im März 2027 das Viertelfinale (Hin- und Rückspiel). Die vier Sieger erreichen das Finalturnier im Juni 2027.' },
  promotion: { label: 'Aufstieg', desc: 'Steigt direkt in die nächsthöhere Liga auf (Saison 2028/29).' },
  'playoff-up': { label: 'Play-off', desc: 'Spielt im März 2027 in Hin- und Rückspiel gegen ein Team der höheren Liga um den Aufstieg.' },
  'playoff-down': { label: 'Play-off', desc: 'Muss im März 2027 in Hin- und Rückspiel gegen ein Team der tieferen Liga um den Klassenerhalt spielen (Heimrecht im Rückspiel).' },
  relegation: { label: 'Abstieg', desc: 'Steigt direkt in die nächsttiefere Liga ab.' },
  safe: { label: 'Klassenerhalt', desc: 'Bleibt in der aktuellen Liga.' },
};

/** Ein Begriff pro Zone – identisch in Legende, Status-Pill, Badge und Tooltip-Titel. */
export function zoneTerm(zone, league) {
  if (zone === 'playoff-up') return league === 'C' ? 'Play-off B/C' : 'Play-off A/B';
  if (zone === 'playoff-down') return league === 'B' ? 'Play-off B/C' : 'Play-off A/B';
  return { ko: 'Viertelfinale', promotion: 'Aufstieg', relegation: 'Abstieg', safe: 'Klassenerhalt' }[zone] || '';
}

export const ZONE_ORDER = ['ko', 'promotion', 'playoff-up', 'safe', 'playoff-down', 'relegation'];

/** Welche Zonen in welcher Liga vorkommen (für die Legende). */
export const LEAGUE_ZONES = {
  A: ['ko', 'safe', 'playoff-down', 'relegation'],
  B: ['promotion', 'playoff-up', 'safe', 'playoff-down'],
  C: ['promotion', 'playoff-up', 'safe'],
  D: ['promotion'],
};

export const LEAGUE_INFO = {
  A: {
    rules: [
      'Platz 1 und 2: Viertelfinale (Gruppensieger mit Heimrecht im Rückspiel).',
      'Platz 3: Die zwei besten Gruppendritten bleiben in Liga A, die zwei schlechtesten müssen in das Play-off A/B.',
      'Platz 4: Die zwei besten Gruppenvierten spielen das Play-off A/B, die zwei schlechtesten steigen direkt ab.',
    ],
  },
  B: {
    rules: [
      'Platz 1: direkter Aufstieg in Liga A.',
      'Platz 2: Play-off A/B um den Aufstieg.',
      'Platz 3: Klassenerhalt in Liga B.',
      'Platz 4: Play-off B/C um den Klassenerhalt (kein direkter Abstieg).',
    ],
  },
  C: {
    rules: [
      'Platz 1: direkter Aufstieg in Liga B.',
      'Platz 2: Play-off B/C um den Aufstieg.',
      'Platz 3 und 4: Klassenerhalt in Liga C – in dieser Übergangssaison gibt es keinen Abstieg aus Liga C.',
    ],
  },
  D: {
    rules: [
      'Liga D wird nach dieser Saison aufgelöst: Alle sechs Teams spielen 2028/29 in Liga C.',
      'Gruppen mit drei Teams, jedes Team bestreitet vier Spiele.',
    ],
  },
};

const ordinal = (n) => `${n}.`;

/** Kurzlabel je Zone für enge Stellen (Positionsleiste im Team-Panel) – einheitlich, mit Legende darunter. */
export const ZONE_ABBR = { ko: 'VF', promotion: 'AUF', 'playoff-up': 'PO', 'playoff-down': 'PO', relegation: 'AB', safe: 'KE' };

/**
 * Status-Erklärung für das Team-Panel in einem Satz: Gegner, Termin und Heimrecht zusammen
 * (statt Begründung + Zusatztext, die dasselbe zweimal sagen).
 */
export function zoneStatusText(row, league) {
  const PO_DATE = 'Hin- und Rückspiel im März 2027';
  const QF_END = ' Die vier Sieger erreichen das Finalturnier im Juni 2027.';
  if (row.zone === 'ko') {
    return row.pos === 1
      ? `Als Gruppensieger im Viertelfinale gegen einen Gruppenzweiten, ${PO_DATE} (Rückspiel zu Hause).${QF_END}`
      : `Als Gruppenzweiter im Viertelfinale gegen einen Gruppensieger, ${PO_DATE} (Rückspiel auswärts).${QF_END}`;
  }
  if (row.zone === 'playoff-up') {
    return league === 'C'
      ? `Play-off um den Aufstieg gegen einen Gruppenvierten aus Liga B, ${PO_DATE} (Rückspiel auswärts).`
      : `Play-off um den Aufstieg gegen ein Team aus Liga A, ${PO_DATE} (Rückspiel auswärts).`;
  }
  if (row.zone === 'playoff-down') {
    const vs = league === 'B'
      ? `Play-off um den Klassenerhalt gegen einen Gruppenzweiten aus Liga C, ${PO_DATE} (Rückspiel zu Hause).`
      : `Play-off um den Klassenerhalt gegen einen Gruppenzweiten aus Liga B, ${PO_DATE} (Rückspiel zu Hause).`;
    return league === 'A' && row.crossPos ? `${row.zoneReason.split(' – ')[0]}. ${vs}` : vs;
  }
  return row.zoneReason || ZONES[row.zone]?.desc || '';
}

/**
 * Mögliche Zonen eines Endplatzes (ohne aktuelle Ergebnisse).
 * Liga A, Platz 3/4: hängt vom Vergleich der Gruppen ab → zwei Zonen.
 */
export function placeZones(league, pos) {
  if (league === 'A' && pos === 3) return ['safe', 'playoff-down'];
  if (league === 'A' && pos === 4) return ['playoff-down', 'relegation'];
  const z = simpleZone(league, pos);
  return z ? [z.zone] : ['safe'];
}

/**
 * Weist jeder Tabellenzeile Zone + Begründung zu. Erwartet model.leagues[].groups[].table.
 * Liefert zusätzlich die gruppenübergreifenden Rankings der Liga A.
 */
export function assignZones(model) {
  const names = Object.fromEntries(Object.values(model.teams).map((t) => [t.code, t.name]));
  const cross = { third: [], fourth: [] };

  for (const league of model.leagues) {
    for (const g of league.groups) {
      for (const row of g.table) {
        const z = simpleZone(league.id, row.pos);
        if (z) Object.assign(row, z);
      }
    }
  }

  const leagueA = model.leagues.find((l) => l.id === 'A');
  if (leagueA) {
    for (const [pos, key] of [[3, 'third'], [4, 'fourth']]) {
      const rows = leagueA.groups.map((g) => ({ ...g.table.find((r) => r.pos === pos), group: g.id })).filter((r) => r.code);
      const ranked = crossRank(rows, names);
      cross[key] = ranked.map((r, i) => ({ ...r, crossPos: i + 1 }));
      ranked.forEach((r, i) => {
        const best = i < 2;
        const row = leagueA.groups.find((g) => g.id === r.group).table.find((x) => x.code === r.code);
        row.crossPos = i + 1;
        const zone = pos === 3 ? (best ? 'safe' : 'playoff-down') : (best ? 'playoff-down' : 'relegation');
        row.zone = zone;
        row.zoneLabel = zoneTerm(zone, 'A');
        row.zoneReason = `Aktuell ${ordinal(i + 1)} von 4 im Vergleich der Gruppen${pos === 3 ? 'dritten' : 'vierten'} – ` +
          (pos === 3
            ? 'die zwei besten Dritten bleiben in Liga A, die zwei schlechtesten müssen ins Play-off A/B.'
            : 'die zwei besten Vierten spielen das Play-off A/B, die zwei schlechtesten steigen direkt in Liga B ab.');
      });
    }
  }

  // Rechnerisch gesicherte Zone (Spanne möglicher Plätze liegt komplett in einer Zone)
  for (const league of model.leagues) {
    for (const g of league.groups) {
      for (const row of g.table) {
        const r = g.ranges?.[row.code];
        row.range = r || null;
        row.locked = false;
        if (!r || league.id === 'D') continue; // Liga D: alle steigen ohnehin auf
        const zones = new Set();
        for (let p = r.best; p <= r.worst; p++) zones.add(simpleZone(league.id, p)?.zone ?? 'split');
        // Auch der Klassenerhalt kann feststehen (z. B. Liga C, mögliche Plätze 3–4)
        row.locked = zones.size === 1 && !zones.has('split');
      }
    }
  }
  return cross;
}

function simpleZone(league, pos) {
  // Begründung ohne „Platz n –“-Präfix: Die Folge (Zone) steht immer davor, die Begründung ergänzt sie.
  const m = {
    A: { 1: ['ko', 'Als Gruppensieger – mit Heimrecht im Rückspiel.'], 2: ['ko', 'Als Gruppenzweiter gegen einen Gruppensieger einer anderen Gruppe.'] },
    B: { 1: ['promotion', 'Der Gruppensieger steigt direkt in Liga A auf.'], 2: ['playoff-up', 'Der Gruppenzweite spielt gegen ein Team aus Liga A um den Aufstieg.'], 3: ['safe', 'Der Gruppendritte bleibt in Liga B.'], 4: ['playoff-down', 'Der Gruppenvierte spielt gegen einen Gruppenzweiten der Liga C um den Klassenerhalt in Liga B.'] },
    C: { 1: ['promotion', 'Der Gruppensieger steigt direkt in Liga B auf.'], 2: ['playoff-up', 'Der Gruppenzweite spielt gegen einen Gruppenvierten der Liga B um den Aufstieg.'], 3: ['safe', 'Der Gruppendritte bleibt in Liga C.'], 4: ['safe', 'Auch der Gruppenvierte bleibt in Liga C – in dieser Übergangssaison gibt es keinen Abstieg.'] },
    D: { 1: ['promotion', 'Liga D wird aufgelöst – alle Teams spielen 2028/29 in Liga C.'], 2: ['promotion', 'Liga D wird aufgelöst – alle Teams spielen 2028/29 in Liga C.'], 3: ['promotion', 'Liga D wird aufgelöst – alle Teams spielen 2028/29 in Liga C.'] },
  }[league]?.[pos];
  if (!m) return null;
  return { zone: m[0], zoneLabel: zoneTerm(m[0], league), zoneReason: m[1] };
}
