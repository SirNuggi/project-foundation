# Flights einzeln löschen statt ganze Runde

Heute gibt es im Beenden-Dialog nur den Knopf „Löschen“, und der verwirft die komplette Runde mit allen Flights. Das wird durch ein echtes Flight-Löschen ersetzt.

## Verhalten

- Im Drei-Punkt-Menü der Runde gibt es den Eintrag **„Flight löschen“** — auch wenn der Flight bereits beendet ist.
- Es kommt eine Sicherheitsabfrage: „Flight X wirklich löschen? Alle Eingaben dieses Flights gehen verloren.“
- Gelöscht wird nur dieser Flight samt seiner Spieler, Schläge, Putts und Strafen. Die Runde und alle anderen Flights bleiben unverändert bestehen.
- War es der letzte Flight der Runde, wird die Runde selbst mitgelöscht.
- Löschen darf, wer die Runde angelegt hat, wer den Flight angelegt hat, oder ein Admin.
- Nach dem Löschen: Bleibt die Runde bestehen und man ist noch in einem anderen Flight, landet man wieder in der Rundenansicht; sonst zurück aufs Dashboard. Leaderboard, Scorecard und Dashboard aktualisieren sich automatisch — auch auf den Handys der anderen Flights.
- Der bisherige Knopf „Löschen“ im Beenden-Dialog entfällt nicht. Die Logik ist die selbe wie im Drei-Punkt Menü außer das er bei beendeten Flights nicht mehr sichtbar ist.

## Technische Umsetzung

**Datenbank (additiv)**

- `flights.created_by uuid NULL REFERENCES auth.users(id)`; Backfill mit `rounds.created_by`.
- DELETE-Policy auf `flights` ersetzen: erlaubt für Rundenersteller, `created_by = auth.uid()` oder Admin.

**Server (`src/lib/golf.functions.ts`)**

- `createRound` und `addFlight` setzen `created_by = context.userId`.
- Neue Funktion `deleteFlight({ roundId, flightId })` mit `requireSupabaseAuth`:
  1. Berechtigung prüfen (Rundenersteller / Flight-Ersteller / Admin), sonst Fehler.
  2. `round_player`-IDs des Flights laden; dazu `penalties`, `hole_scores`, `player_locations` löschen, dann die `round_players`.
  3. Flight löschen.
  4. Verbleibende Flights der Runde zählen; sind es 0, `rounds`-Zeile löschen.
  5. Rückgabe `{ ok: true, roundDeleted: boolean }`.
- `deleteRound` bleibt unverändert bestehen (Nutzung nur noch intern/für Admin).

**UI**

- `round.$roundId.tsx`: Menüeintrag „Flight löschen“ (Trash-Icon, destruktiv) im vorhandenen `DropdownMenu`, sichtbar wenn `board.myFlightId` gesetzt ist und der Nutzer löschberechtigt ist (Flag `canDeleteMyFlight` aus `getRoundBoard`). Bestätigungsdialog; danach `queryClient.invalidateQueries` für `["round-board", roundId]` und `["my-rounds"]`, Toast, Navigation je nach `roundDeleted`.
- `getRoundBoard` liefert zusätzlich `canDeleteMyFlight`.
- Destruktiven Knopf aus dem Beenden-Dialog entfernen, Beschreibungstext anpassen.
- Realtime auf `flights`/`round_players` besteht bereits, damit aktualisieren sich andere Geräte automatisch.

**Prüfung**

Playwright-Durchlauf: Runde mit zwei Flights anlegen, Flight 2 löschen (Runde bleibt, Leaderboard zeigt nur noch Flight-1-Spieler), Flight 1 beenden und löschen (Runde verschwindet aus dem Dashboard), Dashboard-Liste nach beiden Schritten prüfen.