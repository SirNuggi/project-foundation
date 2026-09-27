# 9-Loch-Plätze als 18-Loch-Runde korrekt rechnen

Aktuell werden auf einem 9-Loch-Platz die Löcher 10–18 mit Par 4 geschätzt und bekommen den Vorgabe-Index des jeweiligen Lochs nicht richtig zugewiesen. Das wird auf die offizielle Golf-Logik umgestellt.

## 1. Par für die Löcher 10–18 spiegeln

- Wird eine 18-Loch-Runde auf einem 9-Loch-Platz gespielt, übernimmt Loch 10 das Par von Loch 1, Loch 11 von Loch 2 usw. bis Loch 18 von Loch 9.
- Kein geschätztes Par 4 mehr. Das gespiegelte Par gilt überall: Scorecard-Anzeige, Gesamt-Par der Runde, persönliches Par, automatische Strafen (Doppel-Par).

## 2. Zweiter Stroke-Index pro Loch

- Bei der Platz-Anlage (Admin und "Neuer Platz" beim Rundenstart) bekommt ein 9-Loch-Platz pro Loch zwei Felder: "Index Hinrunde (1–9)" und "Index Rückrunde (10–18)".
- Beispiel Drautal/Berg: Loch 1 Hinrunde Index 13, Rückrunde Index 14.
- Bei einem echten 18-Loch-Platz bleibt es wie bisher bei einem Index 1–18 pro Loch; die zweite Spalte wird gar nicht angezeigt.
- Bestehende 9-Loch-Plätze: fehlt der Rückrunden-Index, wird ersatzweise der Hinrunden-Index verwendet, bis er im Admin ergänzt wird.

## 3. Verteilung der Vorgabeschläge

- 18-Loch-Runde auf 9-Loch-Platz: volles Course Handicap, verteilt über alle 18 Löcher — Löcher 1–9 nach Index Hinrunde, Löcher 10–18 nach Index Rückrunde.
- 18-Loch-Runde auf 18-Loch-Platz: unverändert.
- Reine 9-Loch-Runde: Course Handicap wird nach WHS halbiert und gerundet und nur auf die Indizes der Hinrunde (Löcher 1–9) verteilt.
- Gesamt-Par in der Formel ist immer das Par der tatsächlich gespielten Löcher (bei 18 auf 9 also das doppelte Neuner-Par).
- Annahme: Slope und CR einer Abschlagsbox sind 18-Loch-Werte; bei einer 9-Loch-Runde wird daher erst das 18er-Handicap gerechnet und dann halbiert.

## Technische Umsetzung

- Migration (additiv): `course_holes.stroke_index_back int NULL` (Check 1–18). Kein Umbau bestehender Spalten.
- Neue Hilfsfunktion in `src/lib/stableford.ts`:
  - `buildRoundHoles(courseHoles, courseHoleCount, roundHoleCount): HoleInfo[]` — spiegelt Par für 10–18 und wählt je Loch `stroke_index` bzw. `stroke_index_back` (Fallback: Hinrunden-Index).
  - `playingHandicap(courseHcp, roundHoleCount)` — halbiert und rundet bei 9 Löchern.
  - `personalPars()`/`strokesPerHole()` bleiben, arbeiten künftig mit den gespiegelten Löchern.
- `src/lib/golf.functions.ts`:
  - `createRound`: Löcher nicht mehr per `hole_number <= holeCount` abschneiden, sondern über `buildRoundHoles` aufbauen; `parTotal` daraus; `course_handicap` mit `playingHandicap` speichern; `newCourse.holes` akzeptiert zusätzlich `strokeIndexBack`.
  - `getRoundBoard`: liefert `pars` und `strokeIndexes` bereits für alle gespielten Löcher (gespiegelt), plus `courseHoleCount`.
- `src/lib/admin.functions.ts`: `holeSchema` um `stroke_index_back` erweitern; `adminGetCourse`/`adminCreateCourse`/`adminUpdateCourse` lesen und schreiben das Feld.
- `src/routes/_authenticated/admin.tsx` und `round.new.tsx`: bei `holeCount === 9` ein zweites Index-Raster "Index Rückrunde" anzeigen; Validierung wie bisher (Werte 1–18, keine Dopplung innerhalb eines Rasters).
- `round.$roundId.tsx`: `personalParMap` nutzt die vom Server gelieferten gespiegelten Pars/Indizes; `par` je Loch kommt aus denselben Werten, damit auch Doppel-Par-Strafen auf 10–18 stimmen.
