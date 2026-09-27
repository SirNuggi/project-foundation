# Netto-Stableford mit eigenem Platz-Speicher

Die App rechnet künftig automatisch die Spielvorgabe jedes Spielers aus und zählt live Netto-Stableford-Punkte. Fehlende Plätze legen die Spieler selbst beim Rundenstart an — einmal eingetragen, stehen sie allen zur Verfügung.

## 1. Handicap im Profil und Admin

- Jeder Spieler bekommt ein Handicap (Standard -54,0).
- Die Profilseite wird echt: Anzeigename, Handicap und Standard-Abschlag (Gelb/Herren oder Rot/Damen) bearbeitbar.
- Im Admin-Bereich lassen sich Handicap und Abschlag aller Spieler pflegen.
- Beim Hinzufügen eines Gasts kann sein Handicap eingetippt werden, vorbelegt mit -54,0.

## 2. Platzdaten und "Play and Save"

- Die bestehende Platzliste bekommt pro Platz: Par und Stroke-Index (1–18) für jedes Loch, Slope Herren/Damen (Vorgabe 103) und Course Rating Herren 63,1 / Damen 63,9.
- Beim Start einer neuen Runde wird der Platz wie bisher aus dem Dropdown gewählt. Neu: darunter "Platz nicht dabei? Neuen Platz anlegen".
- Das öffnet direkt auf der Seite ein kompaktes Formular: Platzname, 9 oder 18 Löcher, je Loch Par und Stroke-Index, dazu Slope/CR für Herren und Damen (mit den Standardwerten vorbelegt).
- Beim Start der Runde wird der Platz dauerhaft gespeichert und ist danach für alle im Dropdown auswählbar.
- Prüfung im Formular: Stroke-Index 1–18 (bzw. 1–9) darf sich nicht wiederholen, Par zwischen 3 und 6.

## 3. Spielvorgabe und persönliches Par

- Beim Rundenstart wird je Spieler die Spielvorgabe berechnet:
  Spielvorgabe = Runden(Handicap-Index × Slope / 113 + (CR − Gesamt-Par)), mit Slope/CR des gewählten Abschlags.
- Die Vorgabeschläge werden nach Stroke-Index verteilt: Loch mit SI 1 zuerst, bei mehr Schlägen als Löchern folgt eine zweite Runde durch die Reihenfolge.
- Daraus ergibt sich pro Loch das persönliche Par (Loch-Par + Vorgabeschläge auf diesem Loch).
- Die Werte werden beim Rundenstart fest zur Runde gespeichert, damit eine spätere Handicap-Änderung alte Runden nicht verfälscht.
- In der Spielerliste der neuen Runde ist der Abschlag je Spieler umschaltbar (Vorgabe aus dem Profil).

## 4. Scorecard und Leaderboard

- Auf der Scorecard steht neben jedem Spielernamen klein "Mein Par: 5" für das aktuelle Loch; die Schläge sind mit diesem persönlichen Par vorbelegt.
- Das Leaderboard bekommt einen dritten Tab "Stableford Netto", sortiert nach Punkten absteigend.
- Punkte je Loch: persönliches Par = 2, eins besser = 3, zwei besser = 4, drei besser = 5, eins schlechter = 1, zwei oder mehr schlechter = 0.
- Die Strafen-Automatik (Doppel-Par, 3-Putt) bleibt unverändert am echten Loch-Par.

## Technische Umsetzung

- Migration:
  - `profiles`: `handicap_index numeric(4,1) NOT NULL DEFAULT -54.0`, `default_tee text NOT NULL DEFAULT 'herren'` (Check herren/damen). Bestehendes `handicap` bleibt unangetastet.
  - `courses`: `slope_herren int DEFAULT 103`, `cr_herren numeric(4,1) DEFAULT 63.1`, `slope_damen int DEFAULT 103`, `cr_damen numeric(4,1) DEFAULT 63.9`. Par/Stroke-Index bleiben wie bisher zeilenweise in `course_holes` (par, stroke_index) — kein Umbau auf 36 Spalten.
  - `courses`-Policies: INSERT für `authenticated` mit `created_by = auth.uid()` (bisher nur Admin), analog `course_holes` INSERT für den Ersteller des Platzes; Lesen bleibt für alle Angemeldeten.
  - `round_players`: `handicap_index numeric(4,1)`, `tee text`, `course_handicap int` — beim Anlegen der Runde gefüllt.
- Server-Funktionen in `src/lib/golf.functions.ts`:
  - `createCourse` (Zod: Name, holeCount, Löcher mit par/stroke_index, Slope/CR) legt `courses` + `course_holes` an.
  - `createRound` erweitert: optional `newCourse`, pro Spieler `tee` und `handicapIndex`; berechnet Spielvorgabe serverseitig und schreibt sie in `round_players`.
  - `getRoundBoard` liefert zusätzlich `strokeIndex` je Loch sowie pro Spieler `courseHandicap`; persönliches Par und Stableford werden im Frontend aus diesen Werten abgeleitet (reine Anzeige, keine zusätzliche Tabelle).
  - `updateMyProfile` (Anzeigename, handicap_index, default_tee) für die Profilseite.
- `src/lib/admin.functions.ts`: `adminUpdatePlayerHandicaps` (assertAdmin, Array aus profileId/handicapIndex/tee); Admin-Seite bekommt eine Spielerliste mit Eingabefeldern.
- Neue Hilfsdatei `src/lib/stableford.ts` (client-safe): `courseHandicap()`, `personalPar()` (Verteilung nach Stroke-Index), `stablefordPoints()`.
- `round.new.tsx`: Abschnitt "Neuer Platz" als aufklappbares Formular mit Loch-Grid; je Mitspieler Gelb/Rot-Umschalter und HCP-Feld für Gäste.
- `round.$roundId.tsx`: "Mein Par: X" neben dem Spielernamen, Vorbelegung der Schläge auf das persönliche Par.
- `LiveLeaderboard.tsx`: dritter Tab "Stableford Netto"; `BoardRow` um `points` erweitert.
- `profile.tsx`: Platzhalter ersetzt durch Formular mit Anzeigename, Handicap und Abschlag.
