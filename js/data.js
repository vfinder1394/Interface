// Datenschicht: Snapshot (data/snapshot.json, per GitHub Action aus der UEFA-API aktualisiert)
// + Live-Abgleich im Browser (ESPN mit offenem CORS; UEFA optional über Proxy).
import { computeTable, positionRanges, hasScore, annotateTies } from './standings.js';
import { assignZones } from './zones.js';
import { UEFA, ESPN, applyUefaMatches, applyEspnScoreboard, berlinDate } from './feeds.js';

const SNAPSHOT_URL = 'data/snapshot.json';
const TIMEOUT_MS = 7000;

/** Konfiguration (überschreibbar per window.NL_CONFIG oder URL-Parameter). */
function config() {
  const q = new URLSearchParams(location.search);
  const c = { ...(globalThis.NL_CONFIG || {}) };
  if (q.has('proxy')) c.uefaProxy = q.get('proxy');
  if (q.get('live') === 'aus') c.live = false;
  if (q.get('quelle') === 'uefa') c.uefaDirect = true;
  return { live: true, uefaProxy: '', uefaDirect: false, ...c };
}

async function getJson(url, { timeout = TIMEOUT_MS, cache = 'no-cache' } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    // Keine eigenen Header → kein CORS-Preflight
    const res = await fetch(url, { signal: ctrl.signal, cache, credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
export const todayBerlin = () => berlinDate(new Date().toISOString());

function shiftDate(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- Live-Anbieter */

/** Kein Fehler: Es gibt gerade nichts abzugleichen (zwischen den Spieltagen). */
class IdleError extends Error {
  constructor() { super('idle'); this.idle = true; }
}

const providers = {
  async uefa(snap, cfg) {
    const wrap = (u) => (cfg.uefaProxy ? cfg.uefaProxy + encodeURIComponent(u) : u);
    const all = [];
    for (let offset = 0; offset < 400; offset += 100) {
      const page = await getJson(wrap(UEFA.matchesUrl(offset, 100)));
      if (!Array.isArray(page)) throw new Error('Ungültige UEFA-Antwort');
      all.push(...page);
      if (page.length < 100) break;
    }
    const r = applyUefaMatches(snap, all);
    if (r.matched < 100) throw new Error('UEFA-Daten unvollständig');
    if (r.knockout.length) snap.knockout = r.knockout;
    return { provider: 'UEFA', live: snap.leagues.some((l) => l.groups.some((g) => g.matches.some((m) => m.status === 'LIVE'))) };
  },

  async espn(snap) {
    const today = todayBerlin();
    const dates = new Set();
    for (const l of snap.leagues) {
      for (const g of l.groups) {
        for (const m of g.matches) {
          // offene Spiele der letzten 3 Tage (Ergebnis evtl. noch nicht im Snapshot) + heute
          if (m.date && m.date <= today && m.date >= shiftDate(today, -3) && m.status !== 'FINISHED') dates.add(m.date);
        }
      }
    }
    // Kein Spiel im Fenster → keine Anfrage (spart Netz und vermeidet Konsolenfehler bei gesperrten Feeds)
    if (!dates.size) throw new IdleError();
    let live = 0, ok = 0;
    for (const d of [...dates].sort().slice(-4)) {
      const json = await getJson(ESPN.scoreboardUrl(d.replaceAll('-', '')));
      if (!json || !Array.isArray(json.events)) throw new Error('Ungültige ESPN-Antwort');
      live += applyEspnScoreboard(snap, json).live;
      ok++;
    }
    if (!ok) throw new Error('keine Daten');
    return { provider: 'ESPN', live: live > 0 };
  },
};

/* ---------------------------------------------------------------- Modell */

const LEAGUE_NAMES = { A: 'Liga A', B: 'Liga B', C: 'Liga C', D: 'Liga D' };

/** Snapshot-JSON → internes Modell inkl. Tabellen, Spannen und Zonen. */
export function buildModel(snap, source) {
  const teams = {};
  const matches = [];
  const leagues = (snap.leagues || []).map((l) => {
    const groups = (l.groups || []).map((g) => {
      for (const t of g.teams) {
        teams[t.code] = { ...t, group: g.id, league: l.id };
      }
      const gm = g.matches.map((m) => ({
        ...m,
        status: m.status || (hasScore(m) ? 'FINISHED' : 'UPCOMING'),
        group: g.id,
        league: l.id,
      }));
      matches.push(...gm);
      const codes = g.teams.map((t) => t.code);
      const names = Object.fromEntries(g.teams.map((t) => [t.code, t.name]));
      let table = computeTable(codes, gm, names);
      // Offizielle UEFA-Reihenfolge übernehmen, wenn sie zum selben Datenstand gehört
      const off = g.official;
      const played = table.reduce((s, r) => s + r.p, 0);
      if (off?.order?.length === codes.length && off.played === played && table.every((r) => off.points?.[r.code] === r.pts)) {
        table = off.order.map((c, i) => ({ ...table.find((r) => r.code === c), pos: i + 1 }));
      }
      annotateTies(table, gm);
      const finished = gm.filter((m) => hasScore(m) && m.status !== 'LIVE');
      const mdPlayed = Math.max(0, ...finished.map((m) => m.md));
      return {
        id: g.id,
        league: l.id,
        uefaId: g.uefaId,
        teams: codes,
        matches: gm.sort(byKickoff),
        table,
        ranges: positionRanges(codes, gm),
        mdPlayed,
        mdTotal: Math.max(...gm.map((m) => m.md)),
      };
    });
    return { id: l.id, name: LEAGUE_NAMES[l.id] || l.name, groups };
  });

  const model = {
    season: snap.season,
    updatedAt: snap.updatedAt,
    asOf: snap.asOf,
    calendar: snap.calendar,
    verification: snap.verification,
    knockout: snap.knockout || [],
    leagues,
    teams,
    matches: matches.sort(byKickoff),
    source,
  };
  model.cross = assignZones(model);
  for (const l of leagues) for (const g of l.groups) for (const r of g.table) Object.assign(teams[r.code], { row: r });
  return model;
}

export const byKickoff = (a, b) =>
  (a.kickoff || `${a.date}T23:59:00Z`).localeCompare(b.kickoff || `${b.date}T23:59:00Z`) ||
  a.group.localeCompare(b.group);

/* ---------------------------------------------------------------- Store */

/**
 * Lädt Daten und hält sie aktuell.
 * @param {(model) => void} onData wird bei jedem neuen Stand aufgerufen
 */
export function createStore(onData) {
  const cfg = config();
  let raw = null;
  let snapshotStamp = null;
  let timer = null;
  let liveState = { ok: false, provider: null, at: null, live: false, error: null };

  async function loadSnapshot() {
    const json = await getJson(`${SNAPSHOT_URL}`, { timeout: 15000, cache: 'no-cache' });
    if (!json?.leagues?.length) throw new Error('Snapshot leer');
    if (json.updatedAt !== snapshotStamp) {
      raw = json;
      snapshotStamp = json.updatedAt;
      return true;
    }
    return false;
  }

  function emit() {
    const snap = clone(raw);
    if (liveState.ok && liveState.overlay) {
      // Live-Overlay erneut anwenden (gecachte Rohdaten)
      liveState.overlay(snap);
    }
    onData(buildModel(snap, {
      kind: liveState.ok ? 'live' : 'snapshot',
      provider: liveState.provider,
      liveNow: liveState.live,
      fetchedAt: liveState.at,
      snapshotAt: raw.updatedAt,
      error: liveState.error,
      idle: Boolean(liveState.idle),
    }));
  }

  async function tryLive() {
    if (!cfg.live) return;
    const order = cfg.uefaProxy || cfg.uefaDirect ? ['uefa', 'espn'] : ['espn'];
    for (const name of order) {
      try {
        const probe = clone(raw);
        const res = await providers[name](probe, cfg);
        // Ergebnis als Overlay speichern: geänderte Spiele übernehmen
        const changes = diffMatches(raw, probe);
        liveState = {
          ok: true, provider: res.provider, live: res.live, at: new Date().toISOString(), error: null,
          overlay: (snap) => applyChanges(snap, changes, probe.knockout),
        };
        return;
      } catch (e) {
        liveState = { ...liveState, ok: false, provider: null, live: false, idle: Boolean(e?.idle), error: e?.idle ? null : String(e?.message || e), overlay: null };
      }
    }
  }

  function schedule() {
    clearTimeout(timer);
    const ms = liveState.live ? 60_000 : liveState.ok ? 5 * 60_000 : 10 * 60_000;
    timer = setTimeout(refresh, ms);
  }

  async function refresh() {
    if (document.hidden) { schedule(); return; }
    let changed = false;
    try { changed = await loadSnapshot(); } catch { /* alter Stand bleibt sichtbar */ }
    const wasOk = liveState.ok;
    await tryLive();
    if (changed || liveState.ok || wasOk !== liveState.ok) emit();
    schedule();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && raw) refresh();
  });

  return {
    async start() {
      await loadSnapshot();
      emit(); // sofort aus Snapshot rendern
      await tryLive();
      if (liveState.ok || liveState.idle) emit(); // Status-Chip/Tooltip auf den tatsächlichen Live-Zustand bringen
      schedule();
    },
    refresh,
    config: cfg,
  };
}

function diffMatches(a, b) {
  const map = new Map();
  for (const l of b.leagues) for (const g of l.groups) for (const m of g.matches) map.set(`${m.home}-${m.away}`, m);
  const changes = [];
  for (const l of a.leagues) {
    for (const g of l.groups) {
      for (const m of g.matches) {
        const n = map.get(`${m.home}-${m.away}`);
        if (n && JSON.stringify(n) !== JSON.stringify(m)) changes.push(n);
      }
    }
  }
  return changes;
}

function applyChanges(snap, changes, knockout) {
  const map = new Map(changes.map((m) => [`${m.home}-${m.away}`, m]));
  for (const l of snap.leagues) {
    for (const g of l.groups) {
      g.matches = g.matches.map((m) => {
        const n = map.get(`${m.home}-${m.away}`);
        // Ein neuerer Snapshot mit Endergebnis hat Vorrang vor einem älteren Live-Stand
        if (!n) return m;
        if (m.status === 'FINISHED' && n.status !== 'FINISHED') return m;
        return { ...m, ...n };
      });
    }
  }
  if (knockout?.length) snap.knockout = knockout;
}
