# Nations League Monitor 2026/27

Statische Website, mit der man die **UEFA Nations League 2026/27** durchsuchen kann: alle vier Ligen (A–D), alle 14 Gruppen mit vollständigen Tabellen, sämtliche Spiele und Ergebnisse sowie eine Detailansicht für jede der 54 Nationalmannschaften.

Für jedes Team zeigt die Seite jederzeit an, ob es

- ins **Viertelfinale / die K.-o.-Phase** einzieht (Liga A, Platz 1 und 2),
- **direkt aufsteigt**,
- ins **Play-off um den Aufstieg** muss,
- ins **Play-off um den Klassenerhalt** muss oder
- **direkt absteigt**.

Die Zonen werden bei jedem neuen Ergebnis neu berechnet. Sie folgen den Regeln der Übergangssaison 2026/27 (siehe [`docs/regeln.md`](docs/regeln.md)), einschließlich des gruppenübergreifenden Vergleichs der Dritten und Vierten in Liga A. Jede Zone hat eine eigene Farbe, einen Randbalken, einen getönten Platz-Chip, ein SVG-Symbol in der Legende und eine Textbeschreibung (Tooltip), damit sie nicht nur über die Farbe erkennbar ist. Ein Häkchen am Platz-Chip markiert Plätze, die rechnerisch schon feststehen.

> Inoffizielle Fan-Übersicht, nicht mit der UEFA verbunden. Alle Angaben ohne Gewähr.

## Ansichten

| Route | Inhalt |
|---|---|
| `#/tabellen/A` … `#/tabellen/D` | Liga-Umschalter, Legende, Regeln, Gruppenkarten mit Tabelle, nächsten Spielen und allen Ergebnissen. Liga A hat zusätzlich den Vergleich der Dritten und Vierten. |
| `#/tabellen/B/B3` | springt direkt zu einer Gruppe |
| `#/spieltage/5/A` | Spieltage 1–6, nach Liga filterbar, Spiele nach Datum gruppiert. Topspiel je Gruppe und „kann entscheiden“-Hinweise (siehe unten) |
| `#/ko` | Prognose nach dem aktuellen Stand: Viertelfinale, Play-off A/B und B/C, direkte Auf- und Abstiege, Vergleich der Dritten und Vierten in Liga A |
| `#/team/GER` | öffnet direkt die Teamdetails |

**Topspiel und „kann entscheiden“** (`js/stakes.js`) – berechnet immer mit dem Stand vor dem Spieltag, damit Stern und Hinweise auch während und nach den Spielen gleich bleiben:

- *Topspiel* (★): je Gruppe das Spiel des Spieltags mit der spannendsten Tabellenlage: Punkte beider Teams, Bonus für das Duell zweier Teams auf Platz 1–2, Abzug für großen Punkteabstand, Bonus je möglicher Entscheidung. Spiele, in denen für beide Teams nichts mehr offen ist, werden nie Topspiel. Liga D (ein Spiel pro Gruppe und Spieltag) hat kein Topspiel.
- *Kann entscheiden* (⚡): Alle Ergebniskombinationen des Spieltags in der Gruppe werden durchgespielt. Ein Hinweis erscheint nur, wenn das Ergebnis dieses Spiels **allein** – unabhängig vom Parallelspiel – etwas rechnerisch festlegt, z. B. „Frankreich: Viertelfinale sicher – Remis reicht“ oder „Türkei: Platz 4 steht fest – schon bei Remis“. Geprüft werden die Tabellengrenzen jeder Liga (A: Platz 2 und 3, B: Platz 1–3, C: Platz 1–2). „Verpasst“ wird nur angezeigt, wenn ein Team einen Platz verliert, den es gerade hält. Gleichstände werden vorsichtig gewertet (nur Punkte). In Liga A entscheidet über Platz 3 und 4 hinaus erst der Vergleich der Gruppen.

Ein Klick auf ein Team öffnet die Detailansicht (Flagge, Platz, Status mit Begründung, Statistik, Form, mögliche Endplatzierung, Trainer, alle Spiele). Sie schließt mit `Esc`.

## Lokal starten

Es gibt keinen Build-Schritt: Die Seite besteht aus HTML, CSS und ES-Modulen. Sie muss über einen Webserver laufen, weil `fetch` unter `file://` nicht funktioniert.

```bash
npx http-server . -p 8080 -c-1
# oder
python3 -m http.server 8080
```

Danach http://localhost:8080 öffnen.

## Projektstruktur

```
index.html                     Grundgerüst (Header, Hero, View, Team-Panel)
css/styles.css                 Design-Tokens (Dunkel/Hell), Layout, responsive Regeln
js/app.js                      Routing, Rendering, Interaktionen, Tooltips, Theme
js/data.js                     Datenschicht: Snapshot laden, Live-Abgleich, Modell, Auto-Refresh
js/feeds.js                    Adapter UEFA- und ESPN-Feeds → Snapshot-Format (auch von Node genutzt)
js/standings.js                Tabellenberechnung nach Art. 15 (direkter Vergleich usw.), Platzspannen
js/zones.js                    Zonen nach Liga und Platz, Vergleich der Dritten und Vierten in Liga A
js/stakes.js                   Topspiele je Gruppe und mögliche Entscheidungen eines Spieltags
js/ui.js                       Hilfsfunktionen (Flaggen, Datum, Badges, Form)
js/views/*.js                  Tabellen, Spieltage, K.-o./Play-offs, Teamdetails
data/snapshot.json             Datenbestand (Gruppen, Teams, alle 156 Spiele)
assets/flags/*.svg             Flaggen (flag-icons, MIT-Lizenz)
scripts/update-snapshot.mjs    Aktualisiert den Snapshot aus der UEFA-API
.github/workflows/update-data.yml  Geplante GitHub Action
docs/regeln.md, docs/api.md    Recherche zu Modus und Datenquellen
```

## Datenquellen

1. **`data/snapshot.json`** ist die Basis. Die Datei enthält alle Gruppen, Teams und Spiele mit Ergebnissen und Anstoßzeiten. Die GitHub Action aktualisiert sie regelmäßig aus der öffentlichen (undokumentierten) UEFA-API:
   - `https://match.uefa.com/v5/matches?competitionId=2014&seasonYear=2027…` für Spiele, Ergebnisse und Status
   - `https://standings.uefa.com/v1/standings?groupIds=2014191,…` für die offizielle Tabellenreihenfolge, falls verfügbar
2. **Live-Abgleich im Browser:** Die UEFA-Endpunkte erlauben kein CORS für fremde Domains. Deshalb fragt die Seite im Browser die ESPN-Scoreboard-API ab (`site.web.api.espn.com`, `Access-Control-Allow-Origin: *`). Abgefragt werden heute und die letzten drei Tage, an denen noch offene Spiele stehen. Laufende Spiele und neue Ergebnisse werden über den Snapshot gelegt, die Tabellen werden neu berechnet.
   - Anzeige oben rechts: **„Live – ESPN · hh:mm"**, wenn der Abgleich klappt, sonst **„Stand: TT.MM.JJJJ"** (Stand des Snapshots)
   - Aktualisierung: alle 60 s, solange Spiele laufen, sonst alle 5 min. Der Snapshot selbst wird alle 10 min neu geladen. In Hintergrund-Tabs ist die Aktualisierung pausiert.
   - Ist die Live-Quelle nicht erreichbar, nutzt die Seite ohne Fehlermeldung den Snapshot.
3. **UEFA direkt im Browser (optional):** Mit `?proxy=https://mein-proxy.example/?url=` oder `window.NL_CONFIG = { uefaProxy: '…' }` fragt die Seite die UEFA-API über einen eigenen CORS-Proxy ab. ESPN dient dann als Rückfallebene. `?live=aus` schaltet den Live-Abgleich ganz ab.

Die Tabellen werden im Browser aus den Ergebnissen berechnet, nach Art. 15 des UEFA-Reglements:

1. Punkte
2. direkter Vergleich: Punkte, Tordifferenz, Tore; bei weiterem Gleichstand erneut nur zwischen den betroffenen Teams
3. Tordifferenz
4. erzielte Tore
5. Auswärtstore
6. Siege
7. Auswärtssiege

Liefert UEFA eine offizielle Reihenfolge zum selben Datenstand, wird sie übernommen. Darin sind auch Disziplinarpunkte berücksichtigt, die lokal nicht berechnet werden können.

## Automatische Aktualisierung (GitHub Action)

`.github/workflows/update-data.yml` läuft **alle 3 Stunden** und lässt sich über *Actions → Daten aktualisieren → Run workflow* auch manuell starten. Die Action führt `node scripts/update-snapshot.mjs` aus.

Das Skript geht so vor:

- Es lädt alle Spiele seitenweise, mit Timeout und Wiederholungsversuchen.
- Es ordnet die Spiele über Teamcodes und Gruppen-IDs den bestehenden Spielen zu.
- Es übernimmt nur Ergebnisse, Status, Anstoßzeiten und Spielorte. Ein vorhandenes Endergebnis löscht es nie.
- Bei einer Plausibilitätsprüfung mit Fehler (zu wenige Spiele zugeordnet, weniger beendete Spiele als vorher, fremde Teams) lässt es die Datei unverändert und beendet sich mit einer Warnung.
- Es schreibt die Datei nur, wenn sich inhaltlich etwas geändert hat. Nur dann committet die Action.
- Ab März 2027 sammelt es die K.-o.-Spiele unter `knockout`.

Testen ohne Netzwerk:

```bash
UEFA_MATCHES_FILE=antwort.json DRY_RUN=1 node scripts/update-snapshot.mjs
```

Unter *Settings → Actions → General → Workflow permissions* muss **Read and write permissions** aktiviert sein.

## Deployment auf GitHub Pages

Die Veröffentlichung übernimmt der Workflow `.github/workflows/pages.yml`.

1. Einmalig unter *Settings → Pages → Build and deployment* als Quelle **GitHub Actions** wählen.
2. Der Workflow veröffentlicht die Seite bei jedem Push auf `claude/getting-started-jcwiow`, nach jedem erfolgreichen Lauf von „Daten aktualisieren“ und manuell über *Actions → GitHub Pages → Run workflow*.
3. Die Seite ist dann unter `https://vfinder1394.github.io/Interface/` erreichbar. Alle Pfade sind relativ, deshalb funktioniert sie auch in diesem Unterordner.

## Barrierefreiheit und Design

- Dunkles Navy-Design als Standard, helles Design über den Schalter im Header (die Wahl wird gespeichert)
- Responsiv ab 360 px Breite, ohne horizontales Scrollen. Auf schmalen Displays werden weniger wichtige Spalten (S/U/N, Tore) ausgeblendet. Die vollständige Statistik steht dann in der Teamdetail-Ansicht.
- Komplett per Tastatur bedienbar: sichtbarer Fokus, Pfeiltasten im Liga-Umschalter, Fokusfalle und `Esc` im Detail-Panel
- Zonen haben neben der Farbe ein Symbol, ein Muster (gestreift für Play-offs) und Text für Screenreader
- `prefers-reduced-motion` wird respektiert

## Lizenzen und Hinweise

- Flaggen: [flag-icons](https://github.com/lipis/flag-icons) (MIT), siehe `assets/flags/LICENSE-flag-icons.txt`
- Schriften: Archivo und Inter über Google Fonts
- Spieldaten: UEFA. Die Nutzungsbedingungen der UEFA schränken automatisiertes Sammeln ein. Darum fragt die Action nur alle 3 Stunden ab, und die Quelle ist auf der Seite genannt. Die Seite ist ein privates, nicht-kommerzielles Projekt.
