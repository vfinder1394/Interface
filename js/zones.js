// Statuszonen gemäß docs/regeln.md (Übergangssaison 2026/27)
import { crossRank } from './standings.js';

export const ZONES = {
  ko: {
    label: 'Viertelfinale',
    short: 'VF',
    icon: '★',
    legend: 'Viertelfinale · K.-o.-Phase',
    desc: 'Gruppensieger und -zweite der Liga A spielen im März 2027 das Viertelfinale (Hin- und Rückspiel). Die vier Sieger erreichen das Finalturnier im Juni 2027.',
  },
  promotion: {
    label: 'Aufstieg',
    short: 'AUF',
    icon: '▲',
    legend: 'Direkter Aufstieg',
    desc: 'Steigt direkt in die nächsthöhere Liga auf (Saison 2028/29).',
  },
  'playoff-up': {
    label: 'Play-off',
    short: 'PO',
    icon: '△',
    legend: 'Play-off um den Aufstieg',
    desc: 'Spielt im März 2027 in Hin- und Rückspiel gegen ein Team der höheren Liga um den Aufstieg.',
  },
  'playoff-down': {
    label: 'Play-off',
    short: 'PO',
    icon: '▽',
    legend: 'Play-off um den Klassenerhalt',
    desc: 'Muss im März 2027 in Hin- und Rückspiel gegen ein Team der tieferen Liga um den Verbleib spielen (Heimrecht im Rückspiel).',
  },
  relegation: {
    label: 'Abstieg',
    short: 'AB',
    icon: '▼',
    legend: 'Direkter Abstieg',
    desc: 'Steigt direkt in die nächsttiefere Liga ab.',
  },
  safe: {
    label: 'Klassenerhalt',
    short: '–',
    icon: '',
    legend: 'Klassenerhalt',
    desc: 'Bleibt in der aktuellen Liga.',
  },
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
    tagline: 'Elite · 16 Teams · Viertelfinale',
    rules: [
      'Platz 1 und 2: Viertelfinale (Gruppensieger mit Heimrecht im Rückspiel).',
      'Platz 3: Die zwei besten Gruppendritten bleiben in Liga A, die zwei schlechtesten müssen in das Play-off A/B.',
      'Platz 4: Die zwei besten Gruppenvierten spielen das Play-off A/B, die zwei schlechtesten steigen direkt ab.',
    ],
  },
  B: {
    tagline: '16 Teams · Aufstieg in Liga A',
    rules: [
      'Platz 1: direkter Aufstieg in Liga A.',
      'Platz 2: Play-off A/B um den Aufstieg.',
      'Platz 3: Verbleib in Liga B.',
      'Platz 4: Play-off B/C um den Klassenerhalt (kein direkter Abstieg).',
    ],
  },
  C: {
    tagline: '16 Teams · Aufstieg in Liga B',
    rules: [
      'Platz 1: direkter Aufstieg in Liga B.',
      'Platz 2: Play-off B/C um den Aufstieg.',
      'Platz 3 und 4: Verbleib in Liga C – in dieser Übergangssaison gibt es keinen Abstieg aus Liga C.',
    ],
  },
  D: {
    tagline: '6 Teams · letzte Austragung',
    rules: [
      'Liga D wird nach dieser Saison aufgelöst: Alle sechs Teams spielen 2028/29 in Liga C.',
      'Gruppen mit drei Teams, jedes Team bestreitet vier Spiele.',
    ],
  },
};

const ordinal = (n) => `${n}.`;

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
        row.locked = zones.size === 1 && !zones.has('split') && !zones.has('safe');
      }
    }
  }
  return cross;
}

function simpleZone(league, pos) {
  // Begründung ohne „Platz n –“-Präfix: Die Folge (Zone) steht immer davor, die Begründung ergänzt sie.
  const m = {
    A: { 1: ['ko', 'Als Gruppensieger – mit Heimrecht im Rückspiel.'], 2: ['ko', 'Als Gruppenzweiter gegen einen Gruppensieger einer anderen Gruppe.'] },
    B: { 1: ['promotion', 'Der Gruppensieger steigt direkt in Liga A auf.'], 2: ['playoff-up', 'Der Gruppenzweite spielt gegen ein Team aus Liga A um den Aufstieg.'], 3: ['safe', 'Der Gruppendritte bleibt in Liga B.'], 4: ['playoff-down', 'Der Gruppenvierte spielt gegen einen Gruppenzweiten der Liga C um den Verbleib in Liga B.'] },
    C: { 1: ['promotion', 'Der Gruppensieger steigt direkt in Liga B auf.'], 2: ['playoff-up', 'Der Gruppenzweite spielt gegen einen Gruppenvierten der Liga B um den Aufstieg.'], 3: ['safe', 'Der Gruppendritte bleibt in Liga C.'], 4: ['safe', 'Auch der Gruppenvierte bleibt in Liga C – in dieser Übergangssaison gibt es keinen Abstieg.'] },
    D: { 1: ['promotion', 'Liga D wird aufgelöst – alle Teams spielen 2028/29 in Liga C.'], 2: ['promotion', 'Liga D wird aufgelöst – alle Teams spielen 2028/29 in Liga C.'], 3: ['promotion', 'Liga D wird aufgelöst – alle Teams spielen 2028/29 in Liga C.'] },
  }[league]?.[pos];
  if (!m) return null;
  return { zone: m[0], zoneLabel: zoneTerm(m[0], league), zoneReason: m[1] };
}
