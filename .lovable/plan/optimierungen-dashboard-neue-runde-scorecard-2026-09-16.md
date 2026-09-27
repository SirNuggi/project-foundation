# Optimierungen: Dashboard, Neue Runde, Scorecard

## 1. Dashboard

- Handle (@name) unter der Begrüßung entfällt.
- Oben rechts statt Abmelden-Symbol ein 3-Punkte-Menü mit "Profil", "Statistiken", "Abmelden".
- "Profil" führt vorerst auf eine Platzhalterseite ("Kommt in Kürze"), wie bei Statistiken.
- "Neue Runde starten" wird kompakt: runder grüner Button mit "+" und knappem Text daneben statt großer Kachel.
- "Letzte Runden" ist eingeklappt und öffnet sich per Tipp (Akkordeon).

## 2. Neue Runde

- Der Golfplatz wird über ein Auswahlfeld (Dropdown) aus den angelegten Plätzen gewählt; die Platz-Chips entfallen.
- Bei 9-Loch-Plätzen wird die Lochzahl automatisch auf 9 gesetzt.
- Gibt es noch keine Plätze, erscheint ein Hinweis, dass ein Platz im Admin-Bereich angelegt werden muss.

## 3. Aktuelle Runde

- Der schwarze Kopfbereich klebt fest am oberen Rand und scrollt nicht mit; er wird deutlich kompakter, mit kleineren Schriften.
- "← Dashboard" und die breite Lochauswahl-Leiste entfallen.
- Eine Zeile: links button pfeil links(zurück), dann "Loch 1 · Par 3" (antippbar), dann button pfeil rechts (vor), ganz rechts ein 3-Punkte-Menü mit "Dashboard".
- Tipp auf "Loch 1 · Par 3" öffnet ein kompaktes Overlay mit Zahlenraster: 9 Löcher = 5 + 4, 18 Löcher = 5 + 5 + 5 + 3. Auswahl schließt das Overlay.

## 4. Eingabe

- Zahlen für Schläge und Putts ohne Rahmen und mittig; links Minus, rechts Plus als separate runde Buttons.
- Tippen bleibt flüssig: Die Zahl reagiert sofort lokal, gespeichert wird gebündelt kurz danach; das Nachladen vom Server überschreibt keine Eingabe mehr, die noch nicht gespeichert ist.

## 5. Runde beenden

- Tipp auf "Runde beenden" öffnet ein Pop-up mit Sicherheitsabfrage und drei Möglichkeiten: "Speichern" (beendet die Runde), "Löschen" (verwirft die Runde samt Eingaben und führt zurück aufs Dashboard), "Weiter spielen" (schließt das Pop-up).

## Technische Umsetzung

- `dashboard.tsx`: shadcn `DropdownMenu` für das 3-Punkte-Menü, `Collapsible` für "Letzte Runden"; Abmelde-Logik unverändert.
- Neue Route `src/routes/_authenticated/profile.tsx` als Platzhalter analog zu `stats.tsx`, mit eigenem `head()`.
- `round.new.tsx`: shadcn `Select` für Plätze, `courseId`/`courseName` aus der Auswahl gesetzt; Freitext-Input entfällt.
- `round.$roundId.tsx`: Header als `fixed top-0` mit Platzhalter-Padding im Main; Loch-Raster als `Popover`; `DropdownMenu` mit Link auf `/dashboard`.
- Eingabe-State: Drafts pro Spieler+Loch bleiben bis zum bestätigten Speichern erhalten (kein Löschen des Drafts bei jeder Invalidierung), Debounce auf ~500 ms, Speichern via Mutation mit Pending-Zähler; Realtime-Invalidierung überschreibt keine offenen Drafts.
- Counter-Komponente neu gestylt: runde Buttons (`h-14 w-14 rounded-full`), rahmenlose Zahl dazwischen.
- Neuer Serverfunktions-Eintrag `deleteRound` in `src/lib/golf.functions.ts` (mit `requireSupabaseAuth`, nur der Ersteller darf löschen); abhängige Zeilen entfernt über bestehende Fremdschlüssel-Kaskade.
- Abschluss-Dialog über shadcn `AlertDialog` mit drei Aktionen.