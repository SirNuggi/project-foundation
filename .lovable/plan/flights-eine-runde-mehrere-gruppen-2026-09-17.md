# Flights: Eine Runde, mehrere Gruppen

Eine Runde wird zum Gesamt-Event. Spieler werden in Flights (Gruppen) eingeteilt. Jeder trägt nur seinen eigenen Flight ein, das Leaderboard rechnet über alle Flights der Runde.

## Neue Runde anlegen

1. Oben wie bisher: Platz, Datum, Löcher, Strafkasse ja/nein.
2. Darunter die Sektion **Flight 1** — hier stehst du selbst drin, dazu kommen Mitspieler und Gäste wie gewohnt (inkl. Abschlag und Handicap pro Person).
3. Button **"+ Weiteren Flight hinzufügen"** erzeugt Flight 2, 3, … mit eigener Spielerliste. Beliebig viele Flights, jeder braucht mindestens eine Person. Ein Flight lässt sich wieder entfernen (Flight 1 bleibt).
4. Eine Person kann nur in einem Flight der Runde stehen; bereits vergebene Spieler werden in der Suche ausgegraut.

## Während der Runde

- Die Eingabeseite zeigt nur die Spieler **deines eigenen Flights** — große Zähler für Schläge/Putts, Strafen-Chips wie bisher.
- Oben steht klein, in welchem Flight du bist (z. B. "Flight 1 von 3").
- Neuer kleiner Button **"Spieler zu meinem Flight hinzufügen"** — registrierte Person suchen oder Gast anlegen, inkl. Abschlagswahl; die Spielvorgabe wird sofort berechnet.
- Wer in keinem Flight steht (z. B. der Ersteller, wenn er sich selbst nicht eingetragen hat), sieht den ersten Flight schreibgeschützt und kann über das Dropdown alle Flights ansehen.

## Leaderboard

- Rechnet über die **gesamte Runde**, alle Flights zusammen.
- Hinter dem Namen steht klein der Flight, z. B. "Nuggi (F1)".
- Live-Aktualisierung bleibt: Trägt jemand aus Flight 1 etwas ein, sehen es Flight 2 und 3 sofort.

## Gesamt-Scorecard

- Öffnet standardmäßig den eigenen Flight.
- Oben ein Dropdown "Flight 1 / Flight 2 / … / Alle Flights", um andere Gruppen anzusehen.
- Aufbau (Löcher 1–9, out, 10–18, in, tot; Schläge, Netto, Brutto, Putts) bleibt unverändert.

## Runde beenden

Eine Runde wird nicht mehr direkt beendet. Einer aus dem Flight beendet den Flight. Gleich wie bisher nur flight statt Runde. Sind alle Flights beendet wird die Runde automatisch beendet. Die komplette Runde wird archiviert und ist in den Statistiken schreibgeschützt abrufbar. DIe einzelen Flight sind ebenfalls einzeln abrufbar so wie aktuell dir Runde.

## Technische Umsetzung

**Datenbank (additiv, nichts wird gelöscht)**

- Neue Tabelle `public.flights`: `id uuid PK`, `round_id uuid FK -> rounds ON DELETE CASCADE`, `flight_number int NOT NULL`, `created_at`; Unique `(round_id, flight_number)`; Index auf `round_id`.
- `round_players.flight_id uuid NULL REFERENCES flights(id) ON DELETE SET NULL` (nullable, damit bestehende Runden weiterlaufen); `round_id` bleibt bestehen und führend für RLS.
- Backfill: für jede bestehende Runde ein Flight 1 anlegen und alle vorhandenen `round_players` darauf setzen.
- GRANTs für `authenticated`/`service_role`, RLS an: SELECT für Teilnehmer der Runde (`is_round_participant(round_id, auth.uid())` oder Admin), INSERT/UPDATE/DELETE für Teilnehmer bzw. Ersteller. `flights` zur Realtime-Publikation hinzufügen.

**Server (`src/lib/golf.functions.ts`)**

- `createRoundSchema`: `players` wird ersetzt durch `flights: z.array(z.object({ players: z.array(playerSchema).min(1) })).min(1)`; der Ersteller wird in Flight 1 eingefügt, falls dort nicht bereits enthalten. Obergrenze pro Flight: 6 Personen.
- `createRound`: legt Flights der Reihe nach an, schreibt `round_players` mit `flight_id` und fortlaufender `position`.
- `getRoundBoard`: selektiert `flights(id, flight_number)` und `round_players.flight_id`; liefert `flights[]`, pro Spieler `flightId`/`flightNumber` und `myFlightId` (Flight des eingeloggten Users, sonst kleinste Flight-Nummer).
- Neue Server-Funktion `addPlayerToFlight` (Teilnehmer-geschützt): Spieler/Gast + Abschlag, berechnet `course_handicap` über dieselbe `hcpFor`-Logik, verhindert Doppelzuordnung in derselben Runde.

**UI**

- `round.new.tsx`: State `flights: FlightDraft[]` statt einer flachen Spielerliste; vorhandene Spielerzeile/TeeSelect-Komponenten pro Flight wiederverwenden; Buttons zum Hinzufügen/Entfernen von Flights.
- `round.$roundId.tsx`: Spielerkarten auf `myFlightId` filtern, Flight-Anzeige im Kopf, Dialog "Spieler zu meinem Flight hinzufügen"; Realtime-Kanal zusätzlich auf `round_players` und `flights` hören.
- `LiveLeaderboard.tsx`: `BoardRow` um `flight?: number`, Anzeige "(F1)" hinter dem Namen; Datenquelle bleibt alle Spieler der Runde.
- `round.$roundId_.scorecard.tsx`: Flight-Dropdown oben, Default `myFlightId`, Option "Alle Flights".