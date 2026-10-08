// Adapter für externe Feeds (UEFA, ESPN) → Snapshot-Format (data/snapshot.json).
// Reines ES-Modul ohne DOM: wird im Browser (js/data.js) und in der GitHub Action
// (scripts/update-snapshot.mjs) verwendet. Alle Funktionen sind defensiv: unbekannte
// Strukturen werden übersprungen statt Fehler zu werfen.
import { computeTable, hasScore } from './standings.js';

export const UEFA = {
  competitionId: '2014',
  seasonYear: '2027',
  groupIds: {
    2014191: 'A1', 2014192: 'A2', 2014193: 'A3', 2014194: 'A4',
    2014195: 'B1', 2014196: 'B2', 2014197: 'B3', 2014198: 'B4',
    2014199: 'C1', 2014200: 'C2', 2014201: 'C3', 2014202: 'C4',
    2014203: 'D1', 2014204: 'D2',
  },
  matchesUrl(offset = 0, limit = 100) {
    return `https://match.uefa.com/v5/matches?competitionId=${this.competitionId}&seasonYear=${this.seasonYear}&phase=ALL&order=ASC&limit=${limit}&offset=${offset}`;
  },
  standingsUrl() {
    return `https://standings.uefa.com/v1/standings?groupIds=${Object.keys(this.groupIds).join(',')}`;
  },
};

export const ESPN = {
  scoreboardUrl: (yyyymmdd) =>
    `https://site.web.api.espn.com/apis/site/v2/sports/soccer/uefa.nations/scoreboard?dates=${yyyymmdd}`,
};

/** Abweichende Kürzel externer Anbieter → UEFA-teamCode. */
const CODE_ALIASES = {
  KVX: 'KOS', XKX: 'KOS', ROM: 'ROU', FAR: 'FRO', SLO: 'SVN', SWI: 'SUI', MAC: 'MKD',
  HOL: 'NED', LAT: 'LVA', MOL: 'MDA', LIT: 'LTU', MAL: 'MLT', TRK: 'TUR', CZR: 'CZE',
  BOS: 'BIH', ICE: 'ISL', BLS: 'BLR', SMA: 'SMR', MNT: 'MNE', GRC: 'GRE', DNK: 'DEN',
  DEU: 'GER', PRT: 'POR', HRV: 'CRO', CHE: 'SUI', NLD: 'NED', IRE: 'IRL',
};

/** Zusätzliche englische Schreibweisen → UEFA-teamCode. */
const NAME_ALIASES = {
  turkey: 'TUR', turkiye: 'TUR', 'czech republic': 'CZE', czechia: 'CZE',
  'republic of ireland': 'IRL', ireland: 'IRL', 'bosnia and herzegovina': 'BIH',
  'bosnia-herzegovina': 'BIH', 'bosnia & herzegovina': 'BIH', 'faroe islands': 'FRO', 'faroes': 'FRO',
  'north macedonia': 'MKD', macedonia: 'MKD', moldova: 'MDA', kosovo: 'KOS',
  belarus: 'BLR', 'northern ireland': 'NIR', holland: 'NED',
};

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

export function teamIndex(snap) {
  const byCode = new Map();
  const byName = new Map(Object.entries(NAME_ALIASES));
  for (const l of snap.leagues ?? []) {
    for (const g of l.groups ?? []) {
      for (const t of g.teams ?? []) {
        byCode.set(t.code, t);
        byName.set(norm(t.nameEn), t.code);
        byName.set(norm(t.name), t.code);
      }
    }
  }
  return {
    resolve(code, ...names) {
      const c = String(code ?? '').toUpperCase();
      if (byCode.has(c)) return c;
      if (CODE_ALIASES[c] && byCode.has(CODE_ALIASES[c])) return CODE_ALIASES[c];
      for (const n of names) {
        const hit = byName.get(norm(n));
        if (hit) return hit;
      }
      return null;
    },
    team: (code) => byCode.get(code),
  };
}

/** Kalenderdatum in Europe/Berlin (YYYY-MM-DD). */
/**
 * Spielorte einheitlich als „Stadion, Stadt“ (kurzer Stadionname, deutsche Stadt). Stadionnamen: offizieller Name in der
 * Landessprache (lateinische Schrift), sonst deutsche Transkription – keine englischen Namen für nicht-englischsprachige Länder. Die UEFA liefert teils
 * überlange Namen oder Namen ohne Stadt – diese werden hier vereinheitlicht (auch beim Snapshot-Update).
 */
const VENUE_FIX = {
  'Augsburg Arena': 'Augsburg Arena, Augsburg',
  'Astana Arena, Nur–Sultan': 'Astana Arena, Astana',
  'Boris Paichadze National Stadium Dinamo Arena, Tiflis': 'Boris-Paitschadse-Stadion, Tiflis',
  'Cardiff City Stadium': 'Cardiff City Stadium, Cardiff',
  'Estádio Municipal de Braga': 'Estádio Municipal, Braga',
  'Fußball Arena München': 'Fußball Arena, München',
  'GSP, Nikosia': 'GSP-Stadion, Nikosia',
  'Gradski Stadion Podgorica': 'Gradski Stadion, Podgorica',
  'Helsinki Football Stadium': 'Bolt Arena, Helsinki',
  'Helsinki Olympic Stadium': 'Olympiastadion, Helsinki',
  'Kocaeli Stadium': 'Kocaeli Stadyumu, İzmit',
  'Limassol Stadium': 'Limassol Stadium, Limassol',
  'Luzern Arena': 'Luzern Arena, Luzern',
  'National Arena Bucharest, Bukarest': 'Arena Națională, Bukarest',
  'National Arena Todor Proeski , Skopje': 'Toše-Proeski-Arena, Skopje',
  'National Football Stadium at Windsor Park, Belfast': 'Windsor Park, Belfast',
  'Republican Stadium after Vazgen Sargsyan, Yerevan': 'Republikanisches Stadion, Jerewan',
  'Stade de Bordeaux': 'Stade de Bordeaux, Bordeaux',
  'Stadion HNK Rijeka': 'Stadion Rujevica, Rijeka',
  'Stadion Miejski we Wrocławiu, Wroclaw': 'Stadion Miejski, Breslau',
  'Tatran, Prešov': 'Tatran-Stadion, Prešov',
  'Tofiq Bahramov Republican Stadium, Baku': 'Tofiq-Bəhramov-Stadion, Baku',
  // Englische Namen für Stadien in nicht-englischsprachigen Ländern → Landessprache bzw. deutsche Transkription
  'King Baudouin Stadium, Brüssel': 'Koning-Boudewijnstadion, Brüssel',
  'King Baudouin Stadium, Brussels': 'Koning-Boudewijnstadion, Brüssel',
  'Gürsel Aksel Stadium, Izmir': 'Gürsel Aksel Stadyumu, İzmir',
  'Toumba Stadium, Thessaloniki': 'Toumba-Stadion, Thessaloniki',
  'Republican Stadium, Jerewan': 'Republikanisches Stadion, Jerewan',
  'Limassol Stadium': 'Limassol-Stadion, Limassol',
  'Limassol Stadium, Limassol': 'Limassol-Stadion, Limassol',
  'Hristo Botev Stadium, Plovdiv': 'Christo-Botew-Stadion, Plowdiw',
  'Lilleküla Stadium, Tallinn': 'Lilleküla staadion, Tallinn',
  '8 KM Stadium, Baku': '8-km-Stadion, Baku',
};
export const normalizeVenue = (v) => (v ? VENUE_FIX[v] ?? VENUE_FIX[v.trim()] ?? v.replace(/\s+,/g, ',').trim() : v);

export function berlinDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const int = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n >= 0 && n < 100 ? n : null;
};

function findGroup(snap, groupId) {
  for (const l of snap.leagues) for (const g of l.groups) if (g.id === groupId) return g;
  return null;
}

function findMatch(snap, home, away) {
  for (const l of snap.leagues) {
    for (const g of l.groups) {
      const m = g.matches.find((x) => x.home === home && x.away === away);
      if (m) return { match: m, group: g, swapped: false };
      const r = g.matches.find((x) => x.home === away && x.away === home);
      if (r) return { match: r, group: g, swapped: true };
    }
  }
  return null;
}

/** Überträgt Status/Ergebnis auf ein Snapshot-Spiel, ohne bestätigte Ergebnisse zu löschen. */
function applyResult(target, { status, hs, as, minute, warn }) {
  const before = JSON.stringify(target);
  if (status === 'FINISHED' || status === 'LIVE') {
    if (hs === null || as === null) {
      warn?.(`Ergebnis fehlt für ${target.home}-${target.away} (${status})`);
      return false;
    }
    target.hs = hs; target.as = as; target.status = status;
    if (status === 'LIVE' && minute) target.minute = minute; else delete target.minute;
  } else if (status === 'UPCOMING') {
    if (target.status === 'FINISHED' && hasScore(target)) {
      warn?.(`${target.home}-${target.away}: Quelle meldet UPCOMING, vorhandenes Ergebnis bleibt erhalten`);
    } else {
      target.status = 'UPCOMING'; target.hs = null; target.as = null; delete target.minute;
    }
  } else if (status === 'ABANDONED') {
    // UEFA-Wertung kann vom abgebrochenen Spielstand abweichen → vorhandene Wertung behalten.
    if (!hasScore(target) && hs !== null && as !== null) { target.hs = hs; target.as = as; }
    target.status = 'FINISHED';
    target.note = 'Spiel abgebrochen – Wertung gemäß UEFA prüfen';
    delete target.minute;
  } else if (status === 'POSTPONED' || status === 'CANCELED') {
    if (!hasScore(target)) { target.status = 'UPCOMING'; target.note = status === 'CANCELED' ? 'Spiel abgesagt' : 'Spiel verschoben'; }
  }
  return JSON.stringify(target) !== before;
}

const UEFA_STATUS = { FINISHED: 'FINISHED', LIVE: 'LIVE', CURRENT: 'LIVE', UPCOMING: 'UPCOMING', ABANDONED: 'ABANDONED', CANCELED: 'CANCELED', CANCELLED: 'CANCELED', POSTPONED: 'POSTPONED' };

/**
 * Wendet den UEFA-Matches-Feed (Array von Match-Objekten) auf einen Snapshot an.
 * @returns {{changed:number, matched:number, unmatched:string[], knockout:object[], warnings:string[]}}
 */
export function applyUefaMatches(snap, list) {
  const idx = teamIndex(snap);
  const out = { changed: 0, matched: 0, unmatched: [], knockout: [], warnings: [] };
  const warn = (w) => out.warnings.push(w);
  if (!Array.isArray(list)) { warn('UEFA-Antwort ist kein Array'); return out; }

  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const home = idx.resolve(m.homeTeam?.teamCode, m.homeTeam?.internationalName, m.homeTeam?.translations?.displayName?.EN);
    const away = idx.resolve(m.awayTeam?.teamCode, m.awayTeam?.internationalName, m.awayTeam?.translations?.displayName?.EN);
    const status = UEFA_STATUS[String(m.status ?? '').toUpperCase()] ?? 'UPCOMING';
    const total = m.score?.total ?? m.score?.regular ?? {};
    const hs = int(total.home), as = int(total.away);
    const kickoff = typeof m.kickOffTime?.dateTime === 'string' ? new Date(m.kickOffTime.dateTime).toISOString().replace('.000Z', 'Z') : null;
    const minute = Number.isInteger(m.minute?.normal) ? `${m.minute.normal}${m.minute.injury ? '+' + m.minute.injury : ''}'` : null;
    const roundType = m.round?.metaData?.type;
    const groupId = UEFA.groupIds[String(m.group?.id ?? '')] ??
      (String(m.group?.metaData?.groupName ?? '').match(/\b([A-D][1-4])\b/) || [])[1] ?? null;

    if (!groupId || (roundType && roundType !== 'GROUP_STANDINGS')) {
      if (home && away) {
        out.knockout.push({
          id: String(m.id ?? ''), round: roundType ?? null, leg: m.leg?.number ?? null,
          date: kickoff ? berlinDate(kickoff) : null, kickoff, status: status === 'ABANDONED' ? 'FINISHED' : status,
          home, away, hs: status === 'UPCOMING' ? null : hs, as: status === 'UPCOMING' ? null : as,
          aggregate: m.score?.aggregate ? { home: int(m.score.aggregate.home), away: int(m.score.aggregate.away) } : null,
          penalties: m.score?.penalty ? { home: int(m.score.penalty.home), away: int(m.score.penalty.away) } : null,
          winner: idx.resolve(m.winner?.aggregate?.team?.teamCode ?? m.winner?.match?.team?.teamCode) ?? null,
        });
      }
      continue;
    }
    if (!home || !away) { out.unmatched.push(`${m.homeTeam?.teamCode}-${m.awayTeam?.teamCode}`); continue; }

    const group = findGroup(snap, groupId);
    if (!group) { out.unmatched.push(`${groupId}:${home}-${away}`); continue; }
    let target = group.matches.find((x) => x.home === home && x.away === away) ??
      (m.id ? group.matches.find((x) => x.id === String(m.id)) : null);
    if (!target) {
      const md = Number(String(m.matchday?.name ?? '').replace(/\D/g, '')) || null;
      const inGroup = group.teams.some((t) => t.code === home) && group.teams.some((t) => t.code === away);
      if (!inGroup || !md) { out.unmatched.push(`${groupId}:${home}-${away}`); continue; }
      target = { id: String(m.id ?? ''), md, date: null, kickoff: null, status: 'UPCOMING', home, away, hs: null, as: null, venue: null };
      group.matches.push(target);
      warn(`Neues Spiel ergänzt: ${groupId} ${home}-${away}`);
    }
    out.matched++;
    const before = JSON.stringify(target);
    if (m.id) target.id = String(m.id);
    if (kickoff) { target.kickoff = kickoff; target.date = berlinDate(kickoff); delete target.tentativeDate; }
    const stadium = m.stadium?.translations?.officialName?.DE ?? m.stadium?.translations?.name?.DE ?? null;
    const city = m.stadium?.city?.translations?.name?.DE ?? null;
    // Einheitlich „Stadion, Stadt“; ohne Stadion nur die Stadt – nie das Land
    if (stadium) target.venue = normalizeVenue(city && !stadium.includes(city) ? `${stadium}, ${city}` : stadium);
    else if (city) target.venue = city;
    applyResult(target, { status, hs, as, minute, warn });
    if (JSON.stringify(target) !== before) out.changed++;
  }
  return out;
}

/**
 * Wendet UEFA-Standings an: speichert die offizielle Reihenfolge je Gruppe (inkl. Kriterien,
 * die lokal nicht berechenbar sind, z. B. Disziplinarpunkte).
 */
export function applyUefaStandings(snap, list) {
  const idx = teamIndex(snap);
  let applied = 0;
  if (!Array.isArray(list)) return applied;
  for (const entry of list) {
    const groupId = UEFA.groupIds[String(entry?.group?.id ?? '')];
    const group = groupId && findGroup(snap, groupId);
    if (!group || !Array.isArray(entry.items) || entry.items.length !== group.teams.length) continue;
    const rows = entry.items
      .map((it) => ({ code: idx.resolve(it.team?.teamCode, it.team?.internationalName), rank: it.rank, played: it.played, points: it.points }))
      .filter((r) => r.code && Number.isInteger(r.rank));
    if (rows.length !== group.teams.length) continue;
    group.official = {
      order: rows.sort((a, b) => a.rank - b.rank).map((r) => r.code),
      played: rows.reduce((s, r) => s + (r.played || 0), 0),
      points: Object.fromEntries(rows.map((r) => [r.code, r.points])),
    };
    applied++;
  }
  return applied;
}

/** Wendet ein ESPN-Scoreboard (ein Tag) an. */
export function applyEspnScoreboard(snap, json) {
  const idx = teamIndex(snap);
  const out = { changed: 0, matched: 0, live: 0 };
  for (const ev of json?.events ?? []) {
    const comp = ev?.competitions?.[0];
    const cs = comp?.competitors;
    if (!Array.isArray(cs) || cs.length !== 2) continue;
    const h = cs.find((c) => c.homeAway === 'home'), a = cs.find((c) => c.homeAway === 'away');
    if (!h || !a) continue;
    const home = idx.resolve(h.team?.abbreviation, h.team?.displayName, h.team?.shortDisplayName, h.team?.name);
    const away = idx.resolve(a.team?.abbreviation, a.team?.displayName, a.team?.shortDisplayName, a.team?.name);
    if (!home || !away) continue;
    const hit = findMatch(snap, home, away);
    if (!hit) continue;
    out.matched++;
    const type = comp.status?.type ?? ev.status?.type ?? {};
    const name = String(type.name ?? '');
    let status = 'UPCOMING';
    if (type.state === 'in') status = 'LIVE';
    else if (type.state === 'post' && type.completed) status = 'FINISHED';
    if (/POSTPONED/.test(name)) status = 'POSTPONED';
    if (/CANCEL/.test(name)) status = 'CANCELED';
    if (/ABANDON/.test(name)) status = 'ABANDONED';
    let hs = int(h.score?.value ?? h.score), as = int(a.score?.value ?? a.score);
    if (hit.swapped) [hs, as] = [as, hs];
    const clock = comp.status?.displayClock ?? ev.status?.displayClock;
    const minute = status === 'LIVE' ? (/HALFTIME/.test(name) ? 'HZ' : clock || 'Live') : null;
    if (status === 'LIVE') out.live++;
    if (applyResult(hit.match, { status, hs, as, minute })) out.changed++;
  }
  return out;
}

/** Berechnet alle Gruppentabellen im Snapshot-Format neu. */
export function recomputeTables(snap) {
  for (const l of snap.leagues) {
    for (const g of l.groups) {
      const names = Object.fromEntries(g.teams.map((t) => [t.code, t.name]));
      g.table = computeTable(g.teams.map((t) => t.code), g.matches, names)
        .map(({ pos, code, p, w, d, l: lost, gf, ga, gd, pts }) => ({ pos, code, p, w, d, l: lost, gf, ga, gd, pts }));
    }
  }
}
