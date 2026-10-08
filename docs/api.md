# Datenquellen & API-Integration – UEFA Nations League 2026/27

> Stand: 07.10.2026. Recherche über GitHub-Code-Suche (Open-Source-Projekte, die die UEFA-Feeds 2026 produktiv nutzen), Websuche und die TypeScript-Typdefinitionen des npm-Pakets `uefa-api` (ErikMichelson/uefa-api, MIT).
> Die UEFA-Hosts selbst waren aus der Build-Umgebung **nicht** erreichbar (Egress-Proxy). Alle Angaben unten sind aus Dritt-Code/-Doku mit Datum belegt, aber nicht von hier live gemessen.
> Modus/Regeln (wer steigt auf/ab, Play-offs, Viertelfinale): siehe [`regeln.md`](regeln.md).

## TL;DR – Empfehlung

| Rang | Quelle | Läuft im Browser (CORS)? | Rolle |
|---|---|---|---|
| 1 | **Eigene JSON-Datei `data/nl-2027.json`**, alle 10–15 min per **GitHub Action** aus den UEFA-Feeds erzeugt | ✅ same-origin | **Primärquelle** der Seite (offizielle UEFA-Daten, inkl. deutscher Namen, Flaggen, Rang, `qualified`) |
| 2 | **ESPN** `site.web.api.espn.com` (Slug `uefa.nations`) | ✅ `Access-Control-Allow-Origin: *` | **Live-Overlay** im Browser (laufende Spiele / Ergebnisse zwischen zwei Action-Läufen) |
| 3 | UEFA-Feeds direkt (`match.uefa.com`, `standings.uefa.com`) | ❌ ACAO fest auf `https://www.uefa.com` | nur serverseitig (Action) oder über CORS-Proxy |
| 4 | Eingebetteter Seed-Snapshot (im JS gebündelt) | ✅ | **Offline-Fallback**, Seite ist nie leer |

Kernaussage: **Kein UEFA-Endpunkt kann direkt aus einem Browser auf GitHub Pages gelesen werden.** UEFA liefert `access-control-allow-origin: https://www.uefa.com` fest, unabhängig vom gesendeten `Origin` (belegt in Ondo-Control-Backlog, Sept. 2026; ic-nightfury/shock-and-fade report; AhmetDemirci34/formax-backend, 11.09.2026). Darum: UEFA serverseitig per Action abholen → als statisches JSON neben die Seite legen. Das ist zugleich die „öffentliche API“, an die die Seite gebunden ist und die sich selbst aktualisiert.

---

## 1. UEFA-Feeds (offizielle Quelle, undokumentiert, ohne Key)

### IDs
| Parameter | Wert | Hinweis |
|---|---|---|
| `competitionId` | **`2014`** = UEFA Nations League | **Nicht** 96! (96 ist eine alte/andere ID; 2014 ist in mehreren Projekten für 2026/27 verifiziert: oh77/sports, devlorz/football-bench, DavidZenz/xGelo) |
| `seasonYear` | **`2027`** | Jahr, in dem die Saison **endet** (2026/27 → 2027) |
| Weitere | UCL `1`, UEL `14`, UECL `2019`, EURO `3` | nur zur Einordnung |

Gruppen-IDs 2026/27 (aus dem Matches-Feed, Snapshot 05.10.2026):

| Gruppe | ID | Gruppe | ID | Gruppe | ID |
|---|---|---|---|---|---|
| A1 | 2014191 | B1 | 2014195 | C1 | 2014199 |
| A2 | 2014192 | B2 | 2014196 | C2 | 2014200 |
| A3 | 2014193 | B3 | 2014197 | C3 | 2014201 |
| A4 | 2014194 | B4 | 2014198 | C4 | 2014202 |
| | | | | D1 | 2014203 |
| | | | | D2 | 2014204 |

### 1a. Spiele – `match.uefa.com/v5/matches`

```
GET https://match.uefa.com/v5/matches?competitionId=2014&seasonYear=2027&phase=ALL&order=ASC&limit=100&offset=0
GET https://match.uefa.com/v5/matches?competitionId=2014&seasonYear=2027&phase=ALL&order=ASC&limit=100&offset=100
```
- Paginierung über `limit`/`offset` (Ligaphase = **156 Spiele**, also 2 Seiten à 100; `limit=200` funktioniert laut xGelo ebenfalls in einem Request). Solange Ergebnisse == `limit`, weiterblättern.
- Optionale Filter: `groupId=2014191`, `matchId=1,2,3` (dann ohne Paging), `fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`, `utcOffset=2`, `opponentTeamIds=…`.
- Antwort: **Array** von Match-Objekten.

Feld-Mapping Match:

| Zweck | Feld |
|---|---|
| ID | `id` (String) |
| Status | `status`: `UPCOMING` · `LIVE` · `FINISHED` · `ABANDONED` · `CANCELED` · `CURRENT` |
| Anstoß (UTC) | `kickOffTime.dateTime` (ISO), `kickOffTime.date`, `kickOffTime.utcOffsetInHours` |
| Spieltag | `matchday.name` (`MD1`…`MD6`; KO: `MD7`/`MD8`, dann `SF`, `3rd place`, `Final`), `matchday.longName`, `matchday.translations.name.DE` |
| Gruppe | `group.id`, `group.metaData.groupName` (`Group A2`), `group.metaData.groupShortName` (`GrpA2`), `group.translations.name.DE` |
| Liga | `group.league.metaData.leagueName` (`League A`), `…leagueShortName` (`LA`), `group.league.translations` |
| Runde | `round.metaData.type` (`GROUP_STANDINGS`, `QUARTER_FINALS`, `SEMIFINAL`, `FINAL`, `FINAL_TOURNAMENT_PLAY_OFF`…), `round.mode` (`GROUP`/`KNOCK_OUT`/`FINAL`) |
| Teams | `homeTeam`, `awayTeam` (Team-Objekt, s. u.) |
| Ergebnis | `score.total.home/away` (inkl. Verlängerung), `score.regular` (90 min), `score.penalty`, `score.aggregate` (Hin/Rück) |
| Sieger | `winner.match.reason` (`WIN_REGULAR`, `WIN_ON_PENALTIES`, `DRAW`…), `winner.match.team.id`, `winner.aggregate` |
| Live-Minute | `minute.normal`, `minute.injury`, `phase` (`FIRST_HALF`, `HALF_TIME_BREAK`…), `translations.phaseName.DE` |
| Stadion | `stadium.translations.officialName.DE`, `stadium.city.translations.name.DE` |
| Torschützen | `playerEvents.scorers[]` (`player.internationalName`, `teamId`, `time.minute`, `goalType`) |
| KO-Spiele | `type`: `FIRST_LEG`/`SECOND_LEG`/`SINGLE`, `leg.number` |

Achtung: Ein `ABANDONED`-Spiel kann bei 0:0 stehen bleiben, obwohl UEFA es 3:0 gewertet hat (Fall Rumänien–Kosovo 2024/25) – in der UEFA-Tabelle ist die Wertung enthalten, im Matches-Feed nicht.

### 1b. Tabellen – `standings.uefa.com/v1/standings`

```
GET https://standings.uefa.com/v1/standings?competitionId=2014&seasonYear=2027
# robuster/expliziter:
GET https://standings.uefa.com/v1/standings?groupIds=2014191,2014192,2014193,2014194,2014195,2014196,2014197,2014198,2014199,2014200,2014201,2014202,2014203,2014204
```
Optional: `phase=TOURNAMENT`, `roundId=…`. Antwort: **Array** – ein Element je Gruppe:

```json
[{
  "group": { "id": "2014192", "competitionId": "2014", "seasonYear": "2027", "roundId": "…",
             "order": 2, "teamsQualifiedNumber": 2,
             "metaData": { "groupName": "Group A2", "groupShortName": "GrpA2" },
             "league": { "metaData": { "leagueName": "League A", "leagueShortName": "LA" }, "translations": {…} },
             "translations": { "name": { "DE": "Gruppe A2", "EN": "Group A2", … } } },
  "round": { … },
  "status": "OFFICIAL",
  "items": [{
    "rank": 1, "previousRank": 1, "rankTrend": "SAME",
    "played": 4, "won": 2, "drawn": 2, "lost": 0,
    "goalsFor": 7, "goalsAgainst": 4, "goalDifference": 3, "points": 8,
    "qualified": false, "isQualifying": true, "isLive": false, "isTied": false,
    "team": { "id": "95", "teamCode": "NED", "internationalName": "Netherlands",
              "logoUrl": "https://img.uefa.com/imgml/flags/70x70/NED.png",
              "mediumLogoUrl": "https://img.uefa.com/imgml/flags/240x240/NED.png",
              "bigLogoUrl":   "https://img.uefa.com/imgml/flags/700x700/NED.png",
              "translations": { "displayName": { "DE": "Niederlande", … }, "displayOfficialName": {…}, "displayTeamCode": {…}, "countryName": {…} } }
  }]
}]
```
(Zahlen illustrativ; Feldnamen laut oh77/sports-Doku, live erfasst 08.07.2026, und `uefa-api`-Typen.)

Vollständige `items[]`-Felder: `rank`, `previousRank`, `rankTrend`, `played`, `won`, `drawn`, `lost`, `wonHome`, `wonAway`, `lostHome`, `lostAway`, `goalsFor`, `goalsAgainst`, `goalDifference`, `goalsForHome`, `goalsForAway`, `points`, `qualified`, `isQualifying`, `isLive`, `isTied`, `isBanned`, `rankingCoefficient`, `groupFairPlayCoefficient`, `opponentsPoints`, `opponentsGoalDifference`, `opponentsGoalScored`, `team`.

**Wichtig:** Es heißt `goalsFor`/`goalsAgainst` – **nicht** `goalsScored`/`goalsConceded`.
`qualified`/`isQualifying` bilden nur „weiter“ (z. B. Viertelfinale) ab, **nicht** Auf-/Abstieg/Play-off. Die Zonen (Aufstieg, Play-off, Abstieg, Viertelfinale) muss die Seite selbst aus `rank` + Liga gemäß `regeln.md` ableiten; für Liga A Platz 3/4 zusätzlich das gruppenübergreifende Ranking (Art. 19).

Status für Nations League konkret: Der Standings-Host ist für UCL/EURO mehrfach verifiziert; für `competitionId=2014` speziell ist **kein** Live-Beleg gefunden (oh77 integriert NL nur über Matches). → Der Action-Job soll Standings versuchen und bei leerer/fehlerhafter Antwort die Tabelle **aus den Spielen berechnen** (Abschnitt 4).

### 1c. Team-Objekt (in Matches und Standings identisch)

| Zweck | Feld |
|---|---|
| ID | `id` (z. B. `"47"` = Deutschland) |
| Code | `teamCode` (`GER`, `ENG`, `KOS`, `IRL`, `SCO`…), `countryCode` |
| Name (EN) | `internationalName` |
| **Name (DE)** | `translations.displayName.DE` · offiziell: `translations.displayOfficialName.DE` · Kürzel: `translations.displayTeamCode.DE` |
| Flagge | `logoUrl` (70×70), `mediumLogoUrl` (240×240), `bigLogoUrl` (700×700); Nationalteams → `https://img.uefa.com/imgml/flags/{70x70|240x240|700x700}/{teamCode}.png` |
| Verbandslogo | `https://img.uefa.com/imgml/uefacom/elements/logos/ma/{teamCode}.svg` |
| Platzhalter | `isPlaceHolder` (KO-Runden vor Auslosung) |

Übersetzungs-Schlüssel: `EN, FR, DE, ES, PT, IT, RU, ZH, AR` (Großbuchstaben).
Bilder von `img.uefa.com` sind normale `<img>`-Ressourcen (kein CORS nötig). Fallback-Flaggen: `https://flagcdn.com/w80/{iso2}.png` (England `gb-eng`, Schottland `gb-sct`, Wales `gb-wls`, Nordirland `gb-nir`, Kosovo `xk`).

### 1d. Weitere UEFA-Hosts
| Host | Zweck | Hinweis |
|---|---|---|
| `match.uefa.com/v5/livescore` | nur laufende Spiele ±1 h, leichtgewichtig, mit `hash` | gut zum Pollen in der Action |
| `match.uefa.com/v5/matches/{id}/events` / `/lineups` | Ereignisse, Aufstellungen | |
| `comp.uefa.com/v2/{competitions,teams,players}` | Stammdaten | **Origin-gesperrt**: liefert leeren Body ohne `Origin: https://www.uefa.com` – in der Action Header setzen oder weglassen |
| `compstats.uefa.com/v2/player-ranking` | Torjäger etc. | ebenfalls Origin-gesperrt |

### 1e. CORS / Rechtliches
- `match.uefa.com`: `access-control-allow-origin: https://www.uefa.com` (fest). Browser-Fetch von `*.github.io` → blockiert. `standings.uefa.com` gleiche Infrastruktur, gleiches Verhalten anzunehmen.
- Kein API-Key, kein Rate-Limit dokumentiert, keine SLA. UEFA-Nutzungsbedingungen (Abschn. 6.2) untersagen automatisiertes Sammeln/Datenbankaufbau → im Footer Quelle „Daten: UEFA“ nennen, sparsam abfragen (≤ alle 10 min), privat/nicht-kommerziell.

---

## 2. ESPN – Live-Quelle mit offenem CORS

```
# Spiele eines Tages (Datumsbereiche liefern für uefa.nations HTTP 400 → Tag für Tag abfragen)
GET https://site.web.api.espn.com/apis/site/v2/sports/soccer/uefa.nations/scoreboard?dates=20261112
# Tabellen
GET https://site.web.api.espn.com/apis/v2/sports/soccer/uefa.nations/standings
```
- Host **`site.web.api.espn.com`** verwenden: liefert `access-control-allow-origin: *`. `site.api.espn.com` antwortet von Rechenzentrums-IPs teils 403 ohne CORS-Header (roni-altshuler/soccer_predictor, gemessen 08.08.2026).
- **Keine eigenen Header** im Browser setzen (sonst Preflight, den ESPN nicht beantwortet).
- Scoreboard: `events[].id`, `events[].date`, `events[].status.type.state` (`pre`/`in`/`post`), `status.type.name` (`STATUS_HALFTIME`, `STATUS_POSTPONED`…), `status.displayClock`, `competitions[0].competitors[]` mit `homeAway`, `score` (String), `team.displayName`, `team.abbreviation`, `team.logo`.
- Standings: `children[]` = Gruppen (`name`, `abbreviation`), `children[].standings.entries[]` mit `team.displayName/abbreviation` und `stats[]` (`name`: `gamesPlayed`, `wins`, `ties`, `losses`, `pointsFor`, `pointsAgainst`, `pointDifferential`, `points`, `rank`).
- Zuordnung zu UEFA-Teams über `abbreviation` ↔ `teamCode` (bei Abweichung über englischen Namen normalisieren). Gruppenzugehörigkeit immer aus UEFA-Daten nehmen.
- Liga-Phase-Tage 2026: 24.09.–06.10. und 12.–17.11. (Beispielimplementierung: RyanKorir/Nations-League-Tracker `lib/espn.ts`).

## 3. Weitere Alternativen (bewertet)
| Quelle | Bewertung |
|---|---|
| football-data.org | Nations League nur im teuersten Tarif, Key nötig, CORS restriktiv → **ungeeignet** |
| openfootball/football.json (raw.githubusercontent.com, CORS ok) | kein Nations-League-2026/27-Datensatz vorhanden → **ungeeignet** |
| TheSportsDB | Live-Daten nur im Bezahltarif; Free-Key `3` mit veralteten Tabellen → höchstens Notbehelf |
| FIFA `api.fifa.com/api/v3/calendar/matches` | offenes CORS, keine Tabellen, unsaubere Namen → nicht nötig |
| Öffentliche CORS-Proxys (corsproxy.io, allorigins) | unzuverlässig, Ratenlimits → nur optionaler letzter Live-Versuch |
| martj42/international_results (GitHub CSV) | monatlich aktualisiert → nur Historie |

---

## 4. Integrations-Spezifikation (für die Seite)

### 4a. Datei-Layout
```
/data/nl-2027.json          ← von der GitHub Action erzeugt (Primärquelle)
/js/seed.js                 ← eingebetteter Snapshot (Offline-Fallback)
/scripts/fetch-uefa.mjs     ← Node-Skript, das die Action ausführt
/.github/workflows/data.yml ← cron
```

### 4b. Normalisiertes Schema (`data/nl-2027.json`)
```json
{
  "updatedAt": "2026-10-07T20:15:00Z",
  "source": "uefa",                       // "uefa" | "espn" | "seed"
  "competitionId": "2014", "seasonYear": "2027",
  "groups": [ { "id": "2014191", "league": "A", "name": "A1", "nameDE": "Gruppe A1",
                "teams": ["13","43","66","135"],
                "table": [ { "teamId": "43", "rank": 1, "played": 4, "won": 3, "drawn": 1, "lost": 0,
                             "goalsFor": 6, "goalsAgainst": 1, "goalDifference": 5, "points": 10,
                             "isLive": false, "form": ["W","D","W","W"] } ] } ],
  "teams": [ { "id": "47", "code": "GER", "nameEN": "Germany", "nameDE": "Deutschland",
               "groupId": "2014192", "flag": "https://img.uefa.com/imgml/flags/240x240/GER.png",
               "flagFallback": "https://flagcdn.com/w80/de.png" } ],
  "matches": [ { "id": "2047873", "groupId": "2014191", "matchday": 5,
                 "kickoff": "2026-11-12T17:00:00Z", "status": "UPCOMING",
                 "homeTeamId": "135", "awayTeamId": "13",
                 "score": { "home": 1, "away": 0 }, "minute": "67'",
                 "stadium": "…", "city": "…" } ]
}
```
`score` nur bei `LIVE`/`FINISHED`. `table` vorzugsweise direkt aus UEFA-Standings (`rank` offiziell inkl. direktem Vergleich); fehlt sie, aus `matches` berechnen.

### 4c. GitHub Action (Primärquelle)
```yaml
# .github/workflows/data.yml
on:
  schedule: [{ cron: "*/10 * * * *" }]   # GitHub-Minimum 5 min; real oft verzögert
  workflow_dispatch: {}
permissions: { contents: write }
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node scripts/fetch-uefa.mjs
      - run: |
          git config user.name "nl-data-bot"; git config user.email "actions@users.noreply.github.com"
          git add data/nl-2027.json
          git diff --cached --quiet || (git commit -m "data: update" && git push)
```
`fetch-uefa.mjs` (Node 22, natives `fetch`): Matches Seiten 0/100 laden (Header `User-Agent: Mozilla/5.0`, `Accept: application/json`), Standings per `groupIds` laden, normalisieren, nur schreiben, wenn sich der Inhalt geändert hat (sonst kein Commit). Bei UEFA-Fehler: bestehende Datei unverändert lassen (exit 0), damit nie kaputte Daten veröffentlicht werden.
Hinweis: GitHub deaktiviert Cron-Workflows nach 60 Tagen ohne Repo-Aktivität – Daten-Commits zählen als Aktivität.

### 4d. Lade-Strategie im Browser
1. Sofort rendern aus **Seed** (`js/seed.js`), Badge „Stand: Snapshot“.
2. `fetch('data/nl-2027.json?t=' + Date.now(), {cache:'no-store'})` → ersetzt Seed; Badge „Stand: hh:mm (UEFA)“.
3. Falls heute/gestern/morgen ein Spieltag ist **oder** ein Spiel `LIVE` ist: **ESPN-Scoreboard** für gestern/heute/morgen laden (Timeout 8 s), Ergebnisse/Live-Minuten per Team-Code-Matching überlagern, Tabellen der betroffenen Gruppen **neu berechnen**, Live-Badge zeigen.
4. Polling: alle 60 s (Live) bzw. 10 min (sonst); bei `document.hidden` pausieren.
5. Jeder Schritt in `try/catch` mit `AbortSignal.timeout(8000)`; schlägt ein Schritt fehl, bleibt der vorherige Stand sichtbar (mit dezentem Hinweis „Live-Daten nicht erreichbar“).
6. Optional: letzten guten Stand in `localStorage` cachen (try/catch).

### 4e. Tabelle aus Spielen berechnen (Fallback/Live)
Sieg 3, Remis 1. Sortierung gemäß Art. 15 (`regeln.md`): Punkte → direkter Vergleich (Punkte, Tordifferenz, Tore; ggf. rekursiv unter den weiterhin Gleichen) → Tordifferenz → Tore → Auswärtstore → Siege → Auswärtssiege → (Disziplinar/Koeffizient nicht verfügbar → alphabetisch). Wenn UEFA-`rank` vorliegt und keine Live-Änderung, immer den UEFA-Rang verwenden.

---

## 5. Seed-Snapshot (verfügbar)
Ein normalisierter Snapshot aller **14 Gruppen, 54 Teams, 156 Spiele** liegt unter
`/tmp/claude-0/-home-user-Interface/053be4a9-4b63-5081-91a9-4ff488037e54/scratchpad/seed-nl-2027.json`
(Quelle: UEFA-Matches-Feed `competitionId=2014&seasonYear=2027`, archiviert durch DavidZenz/xGelo am 05.10.2026 08:29 UTC; enthält UEFA-Team-IDs, Team-Codes, Flaggen-URLs, Anstoßzeiten, 86 Ergebnisse).
**Lücke:** Die 18 Spiele vom 05./06.10.2026 (Rest von Spieltag 4) sind darin noch `UPCOMING` – Ergebnisse waren hier nicht recherchierbar. Die Seite muss sie aus der Action bzw. ESPN nachladen; im Seed ehrlich als „Ergebnis ausstehend“ zeigen.

## Quellen
- ErikMichelson/uefa-api – `src/constants.ts`, `src/api.d.ts`, `src/helpers/{matches,standings}.ts` (Endpunkte, Parameter, Typen)
- oh77/sports – `kickoff/docs/endpoints/uefa_champions_league_api.md` (Live-Erfassung 08.07.2026; competitionId 2014 für NL 2026/27, Feldliste Standings, Bild-URLs, Origin-Sperre comp/compstats)
- devlorz/football-bench – ADR-0057 (NL 2026/27 über `match.uefa.com`, 156 Spiele, MD1–MD6, ABANDONED-Sonderfall)
- DavidZenz/xGelo – `data/competition/accepted/uefa_nations_league_2026_27/*` (Gruppen-IDs, Snapshot 05.10.2026)
- Ondo-Control/Ondo-Control – Backlog Punkt 84 (CORS von match.uefa.com fest auf www.uefa.com)
- ic-nightfury/shock-and-fade – `research/european-soccer-apis/report.md` (CORS restricted to www.uefa.com)
- roni-altshuler/soccer_predictor – `src/lib/espnHost.ts` (site.web.api.espn.com mit ACAO *)
- RyanKorir/Nations-League-Tracker – `lib/espn.ts` (ESPN `uefa.nations`, nur Einzeltage)
- topless/event-schedule – `docs/research-2026-10-02.md` (UEFA-AGB 6.2)
- UEFA Übergangsdokument: https://editorial.uefa.com/resources/02a9-21985b7e3370-3f0fda209606-1000/promotion_and_relegation_unl_website.pdf
