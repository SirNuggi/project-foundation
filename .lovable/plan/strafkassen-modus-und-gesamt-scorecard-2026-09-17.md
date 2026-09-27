# Strafkassen-Modus und Gesamt-Scorecard

## 1. Runde mit oder ohne Strafkasse

- Beim Anlegen einer Runde gibt es einen deutlich sichtbaren Schalter "Mit Strafkasse spielen" (standardmäßig ein).
- Die Einstellung wird bei der Runde gespeichert und gilt für die ganze Runde.
- Ohne Strafkasse:
  - Auf der Scorecard verschwinden die Chips 3-Putt, Doppel-Par und Girly.
  - Im Leaderboard verschwindet der Tab "Strafen" und die Euro-Spalte.
  - Es werden keine automatischen Strafen gebucht.
- Mit Strafkasse: alles bleibt wie bisher.

## 2. Gesamt-Scorecard

- Im 3-Punkte-Menü der Runde neuer Eintrag "Gesamt-Scorecard anzeigen".
- Die Ansicht öffnet sich bildschirmfüllend, ist quer scrollbar und wie eine echte Scorecard aufgebaut:
  - Kopf: Golfplatzname und Spieldatum.
  - Zeile:Loch ,Spalten: Loch 1–9, "out", Loch 10–18, "in", "tot" (bei 9-Loch-Runden nur 1–9 und "out"/"tot").
  - Zeile:Par ,Spalten parzahl von loch aus platz
  - Pro Spieler ein Block mit Kopfzelle "Name / Abschlag / Handicap-Index / Course-Handicap" (z. B. Nuggi | Blau | 30,5 / 28,5) und den Zeilen: Vorgabe(Vorgabeschläge des Spielers als Striche wie in der Vorlage — Strichanzahl = Vorgabeschläge auf diesem Loch), Schläge, Pkt. Netto, Pkt. Brutto, Puts — jeweils mit out-, in- und tot-Summen.
- Punkte netto = Stableford gegen das persönliche Par, Punkte brutto = Stableford gegen das Loch-Par.

## 3. Beenden und Historie

- "Speichern" im Beenden-Dialog setzt die Runde wie bisher auf beendet.
- Für beendete Runden ist die Gesamt-Scorecard schreibgeschützt: keine Eingabefelder, keine Strafen-Buttons.
- Aus den Statistiken öffnet ein Klick auf eine historische Runde direkt diese Gesamt-Scorecard-Ansicht statt der Eingabemaske.
- Die Werte stammen aus den gespeicherten Loch-Ergebnissen dieser Runde, inklusive der damals gültigen Handicaps, Abschläge und Euro-Beträge — spätere Änderungen an Plätzen oder Preisen verändern eine beendete Runde nicht.

## Technische Umsetzung

- Migration: `rounds.with_penalties boolean NOT NULL DEFAULT true`; Types neu generieren.
- `golf.functions.ts`: `createRoundSchema` um `withPenalties` erweitert und in den Insert übernommen; `saveHoleScore`/`syncAutoPenalties` und `toggleGirly` brechen ab, wenn die Runde `with_penalties = false` hat; `getRoundBoard` liefert `withPenalties` sowie pro Spieler `handicapIndex`, `tee`, `courseHandicap` (bereits vorhanden) und die Strokes-Verteilung pro Loch via `strokesPerHole`.
- Neue Route `src/routes/_authenticated/round.$roundId.scorecard.tsx`: nutzt `getRoundBoard`, rendert eine `overflow-x-auto`-Tabelle mit sticky erster Spalte; Berechnung über `personalPars`/`stablefordPoints` aus `src/lib/stableford.ts` (brutto: gleiche Funktion mit Loch-Par).
- `round.$roundId.tsx`: Menüeintrag zur neuen Route; Chips und Girly-Button nur bei `board.withPenalties`; Strafen-Tab-Flag an `LiveLeaderboard` durchreichen.
- `LiveLeaderboard.tsx`: neues Prop `showPenalties` (Default true) blendet Tab und Euro-Spalte aus.
- `round.new.tsx`: `Switch` (shadcn) "Mit Strafkasse spielen", State `withPenalties`, im Payload mitsenden.
- `stats.tsx`: Links historischer Runden zeigen auf `/round/$roundId/scorecard`.