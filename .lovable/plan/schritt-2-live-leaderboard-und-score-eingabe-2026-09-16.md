# Schritt 2: Live-Leaderboard und Score-Eingabe

Die Rundenseite wird zur eigentlichen Spielseite: Loch für Loch Schläge und Putts eintragen, Strafpunkte automatisch und manuell setzen, und unten ein Live-Leaderboard, das alle Mitspieler in Echtzeit sehen.

## Was du danach sehen wirst

1. **Loch-Navigation oben**: Eine Reihe mit Loch 1 bis 9 bzw. 18 zum Durchtippen, das aktuelle Loch leuchtet signalgrün. Darunter Pfeile "Zurück"/"Weiter" und die Anzeige "Loch 7 · Par 4". Das Par kommt aus dem angelegten Platz, sonst Par 4.

2. **Eingabe je Spieler**: Pro Mitspieler eine Karte mit zwei großen Zählern:
   - Schläge (vorbelegt mit dem Par des Lochs)
   - Putts (vorbelegt mit 0)
   Jeweils mit großen Plus/Minus-Feldern, mit Handschuh bedienbar. Jede Änderung wird sofort gespeichert.

3. **Strafpunkt-Chips unter jedem Namen**:
   - "Doppel-Par" leuchtet automatisch, sobald die Schläge das Doppelte des Pars erreichen (2 Punkte)
   - "3-Putt" leuchtet automatisch ab 3 Putts (1 Punkt)
   - "Girly" ist antippbar und leuchtet rot, wenn aktiv (1 Punkt)
   Die Punktewerte kommen aus der Regeltabelle, sind also später änderbar.

4. **Live-Leaderboard unten**: Eine dauerhaft sichtbare Leiste am unteren Rand, die sich hochklappen lässt. Zeigt je Spieler Gesamt-Schläge, Differenz zum Par, Putts und Strafpunkte – sortiert zuerst nach Schlägen, bei Gleichstand nach Strafpunkten. Aktualisiert sich automatisch, wenn ein Mitspieler auf seinem Handy etwas einträgt.

5. **Runde beenden**: Ein Button setzt die Runde auf "beendet"; danach ist die Ansicht nur noch lesbar.

## Technische Umsetzung

- Migration: `hole_scores` und `penalties` in die Realtime-Veröffentlichung aufnehmen (`REPLICA IDENTITY FULL`), plus eindeutiger Index auf `penalties(round_player_id, hole_number, code)` für konfliktfreies Upsert.
- Neue Server-Funktionen in `src/lib/golf.functions.ts` (alle mit `requireSupabaseAuth`, Zod-validiert):
  - `getRoundBoard` – Runde, Spieler, Pars aus `course_holes`, alle `hole_scores`, `penalties` und `penalty_rules` in einem Aufruf
  - `saveHoleScore` – Upsert von Schlägen/Putts für Spieler+Loch, berechnet danach die automatischen Strafen (`double_par`, `three_putt`) und setzt bzw. entfernt sie
  - `toggleGirly` – manuelle Strafe pro Spieler und Loch an/aus
  - `finishRound` – Status auf `finished`
- Rundenseite `src/routes/_authenticated/round.$roundId.tsx` wird umgebaut: lokaler State pro Loch, optimistisches Update, Speichern mit ~400 ms Debounce über eine Mutation, danach `invalidateQueries`.
- Realtime: ein `supabase.channel` je Runde in `useEffect` (mit Aufräumen beim Verlassen), gefiltert auf `round_id`, das die Abfrage neu lädt.
- Leaderboard als eigene Komponente `src/components/round/LiveLeaderboard.tsx`, fixiert unten, ein-/ausklappbar.
- Strafpunkte werden serverseitig aus `penalty_rules` bepunktet, nicht im Frontend hartkodiert.
