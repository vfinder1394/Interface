#!/usr/bin/env node
// Aktualisiert data/snapshot.json aus der (undokumentierten, öffentlichen) UEFA-API.
// Läuft in der GitHub Action .github/workflows/update-data.yml (Node >= 20).
//
// Grundsätze:
//  - Bestehender Snapshot ist die Basis (Gruppen, deutsche Namen, Trainer …).
//  - Nur Ergebnisse/Anstoßzeiten/Status/Orte werden aus UEFA übernommen.
//  - Plausibilitätsprüfungen schlagen fehl → Datei bleibt unverändert (Exit 0 mit Warnung).
//  - Datei wird nur geschrieben, wenn sich inhaltlich etwas geändert hat.
//
// Optionen (Umgebungsvariablen):
//  UEFA_MATCHES_FILE=pfad.json   Matches-Antwort aus Datei statt Netzwerk (Tests)
//  UEFA_STANDINGS_FILE=pfad.json Standings-Antwort aus Datei
//  DRY_RUN=1                     nichts schreiben, nur berichten
//  STRICT=1                      bei Fehlern Exit-Code 1 statt 0
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { UEFA, applyUefaMatches, applyUefaStandings, recomputeTables } from '../js/feeds.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = path.join(ROOT, 'data', 'snapshot.json');
const env = process.env;
const STRICT = env.STRICT === '1';
const DRY = env.DRY_RUN === '1';

const log = (...a) => console.log('[update-snapshot]', ...a);
const warn = (msg) => console.log(`::warning::${msg}`);

async function fetchJson(url, { tries = 3, timeout = 20000 } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; nations-league-monitor/1.0; +https://github.com/)',
          Origin: 'https://www.uefa.com',
          Referer: 'https://www.uefa.com/',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
      const text = await res.text();
      if (!text.trim()) throw new Error(`Leere Antwort von ${url}`);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      log(`Versuch ${i}/${tries} fehlgeschlagen: ${e.message}`);
      if (i < tries) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}

async function loadMatches() {
  if (env.UEFA_MATCHES_FILE) return JSON.parse(await readFile(env.UEFA_MATCHES_FILE, 'utf8'));
  const all = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await fetchJson(UEFA.matchesUrl(offset, 100));
    if (!Array.isArray(page)) throw new Error('Matches-Antwort ist kein Array');
    all.push(...page);
    if (page.length < 100) break;
  }
  return all;
}

async function loadStandings() {
  try {
    if (env.UEFA_STANDINGS_FILE) return JSON.parse(await readFile(env.UEFA_STANDINGS_FILE, 'utf8'));
    return await fetchJson(UEFA.standingsUrl(), { tries: 2 });
  } catch (e) {
    log(`Standings nicht verfügbar (${e.message}) – Tabellen werden aus den Spielen berechnet.`);
    return null;
  }
}

/** Vergleichbare Darstellung ohne Zeitstempel. */
const comparable = (snap) => JSON.stringify({ ...snap, updatedAt: null, asOf: null });

function describeProgress(snap) {
  const ms = snap.leagues.flatMap((l) => l.groups.flatMap((g) => g.matches));
  const done = ms.filter((m) => m.status === 'FINISHED');
  const live = ms.filter((m) => m.status === 'LIVE');
  const mdDone = [1, 2, 3, 4, 5, 6].filter((d) => ms.filter((m) => m.md === d).every((m) => m.status === 'FINISHED'));
  const last = mdDone.length ? Math.max(...mdDone) : 0;
  if (live.length) return `Live: ${live.length} Spiel(e) laufen · ${done.length}/${ms.length} beendet`;
  if (done.length === ms.length) return 'Ligaphase beendet';
  return last ? `Nach Spieltag ${last} (${done.length}/${ms.length} Spiele beendet)` : `${done.length}/${ms.length} Spiele beendet`;
}

function validate(before, after, report) {
  const problems = [];
  const count = (s) => s.leagues.reduce((n, l) => n + l.groups.reduce((k, g) => k + g.matches.length, 0), 0);
  const finished = (s) => s.leagues.reduce((n, l) => n + l.groups.reduce((k, g) => k + g.matches.filter((m) => m.status === 'FINISHED').length, 0), 0);
  if (report.matched < 0.9 * count(before)) problems.push(`Nur ${report.matched} von ${count(before)} Spielen zugeordnet`);
  if (count(after) > count(before) + 6) problems.push(`Unerwartet viele neue Spiele (${count(after) - count(before)})`);
  if (finished(after) < finished(before)) problems.push(`Weniger beendete Spiele als vorher (${finished(after)} < ${finished(before)})`);
  for (const l of after.leagues) {
    for (const g of l.groups) {
      const codes = new Set(g.teams.map((t) => t.code));
      for (const m of g.matches) {
        if (!codes.has(m.home) || !codes.has(m.away)) problems.push(`${g.id}: fremdes Team in ${m.home}-${m.away}`);
        if (m.hs != null && (!Number.isInteger(m.hs) || !Number.isInteger(m.as))) problems.push(`${g.id}: ungültiges Ergebnis ${m.home}-${m.away}`);
      }
    }
  }
  return problems;
}

async function main() {
  const raw = await readFile(SNAPSHOT, 'utf8');
  const before = JSON.parse(raw);
  if (!Array.isArray(before.leagues) || !before.leagues.length) throw new Error('Bestehender Snapshot ist ungültig');
  const snap = structuredClone(before);

  const matches = await loadMatches();
  log(`UEFA: ${matches.length} Spiele geladen`);
  const report = applyUefaMatches(snap, matches);
  log(`Zugeordnet: ${report.matched}, geändert: ${report.changed}, K.-o.: ${report.knockout.length}, nicht zugeordnet: ${report.unmatched.length}`);
  report.unmatched.slice(0, 20).forEach((u) => log(`  nicht zugeordnet: ${u}`));
  report.warnings.slice(0, 20).forEach((w) => warn(w));
  if (report.knockout.length) snap.knockout = report.knockout;

  const standings = await loadStandings();
  if (standings) log(`UEFA-Standings: ${applyUefaStandings(snap, standings)} Gruppen übernommen`);

  recomputeTables(snap);

  const problems = validate(before, snap, report);
  if (problems.length) {
    problems.slice(0, 20).forEach((p) => warn(p));
    throw new Error(`Plausibilitätsprüfung fehlgeschlagen (${problems.length} Probleme) – Snapshot bleibt unverändert`);
  }

  if (comparable(snap) === comparable(before)) {
    log('Keine inhaltlichen Änderungen.');
    return;
  }
  snap.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  snap.asOf = describeProgress(snap);
  snap.dataSource = 'uefa';
  if (DRY) { log(`DRY_RUN: würde schreiben (${snap.asOf})`); return; }
  const tmp = `${SNAPSHOT}.tmp`;
  await writeFile(tmp, `${JSON.stringify(snap, null, 1)}\n`);
  JSON.parse(await readFile(tmp, 'utf8')); // Sicherheitscheck
  await rename(tmp, SNAPSHOT);
  log(`Snapshot aktualisiert: ${snap.asOf}`);
}

main().catch((e) => {
  warn(`Aktualisierung übersprungen: ${e.message}`);
  process.exitCode = STRICT ? 1 : 0;
});
