# Golf-App – Schritt 1: Login & Dashboard

Mobile-first Web-App für Golfrunden mit Freunden. In diesem Schritt entsteht die Anmeldung, das Dashboard und das Anlegen einer neuen Runde mit Mitspielern. Es entsteht auch ein Adminbereich. Hier können neue Golfplätze angelegt werden. Spieler oder Runden gelöscht werden. Leaderboard, Strafpunkte-Eingabe und GPS-Karte kommen später – die Datenbank wird dafür aber schon jetzt vollständig vorbereitet. Die Golfplätze sollen später über Schnittstellen imortierbar sein.

## Optik

Sportlicher Kontrast-Look: Weiß, tiefes Schwarz, Signalgrün (#00E05A) als Akzent. Große Flächen, kräftige Schrift, sehr große Tippziele – auch mit Handschuh und bei Sonne gut bedienbar.

## Was du nach Schritt 1 sehen wirst

1. **Anmeldung**: Registrieren und Einloggen mit E-Mail und Passwort, dazu ein Anzeigename (Handle), unter dem dich Freunde finden.
2. **Dashboard**: Begrüßung mit deinem Namen, zwei große Buttons – "Neue Runde starten" und "Statistiken" (Statistiken zeigt vorerst eine Platzhalterseite mit Hinweis "kommt in Kürze"). Darunter eine Liste deiner letzten Runden.
3. **Neue Runde**:
  - Name des Golfplatzes eingeben,wird als Liste angezeigt(kommt aus Datenbank) Datum (heute voreingestellt), Lochanzahl (9 oder 18). 
  - Mitspieler hinzufügen: Suche nach registrierten Spielern per Name/Handle **oder** Gastspieler frei eintippen.
  - Du selbst bist automatisch dabei. Hinzugefügte Spieler erscheinen als entfernbare Chips.
  - "Runde starten" legt die Runde an und führt auf eine vorbereitete Rundenseite mit der Spielerliste und dem Hinweis, dass die Loch-Eingabe im nächsten Schritt kommt.
4. **Abmelden** über das Dashboard.
5. Admin-Bereich: Hier können mit einem Super-Passwort eingestiegen werden und Runden,Spieler gelöscht werden. Außerdem werden hier die Plätze angelegt. Das bedeutet alle Daten die zur Auswertung eines Scores nötig sind.

## Datenbank (schon jetzt zukunftssicher angelegt)

- **profiles** – Spielerprofil je Konto (Anzeigename, Handle, Handicap, Avatar), wird bei Registrierung automatisch erstellt.
- **rounds** – Runde: Platzname, Datum, Lochanzahl, Ersteller, Status (laufend/beendet).
- **round_players** – Teilnehmer einer Runde; entweder ein registriertes Profil oder ein Gastname.
- **hole_scores** – pro Spieler und Loch: Par, Schläge, Putts (für das spätere Live-Leaderboard).
- **penalties** – Strafpunkte pro Spieler/Loch mit Typ: `three_putt`, `double_par`, `girly`; automatische Typen werden später aus den Scores berechnet, `girly` ist manuell. Punktewerte liegen in einer kleinen Regeltabelle **penalty_rules**, damit sich die Wertung später ohne Umbau ändern lässt.
- **player_locations** – vorbereitet für die spätere GPS-Karte (Spieler, Runde, Koordinaten, Zeitstempel).
- **friendships** – für die Freundesliste/Spielersuche.
- places - golfplatz wird vom admin angelegt

Alle Tabellen mit Zugriffsschutz: Jeder sieht nur seine eigenen Daten und die Runden, an denen er teilnimmt. Langzeitstatistiken je Spieler bleiben dauerhaft gespeichert.

## Technische Umsetzung

- Lovable Cloud (Supabase) aktivieren; E-Mail/Passwort-Anmeldung einschalten.
- Migration mit allen Tabellen oben, inkl. GRANTs, RLS-Policies und Security-Definer-Funktion `is_round_participant(round_id, user_id)`, um Rekursion in den Policies zu vermeiden. Trigger `handle_new_user` erzeugt das Profil bei Registrierung. Seed der `penalty_rules` mit Doppel-Par, Girly, Dreiputt.
- Routen: `/` (Landing mit Login-CTA bzw. Weiterleitung), `/auth` (Login/Registrieren), `_authenticated/dashboard`, `_authenticated/round/new`, `_authenticated/round/$roundId` (Platzhalter), `_authenticated/stats` (Platzhalter).
- Datenzugriff über `createServerFn` mit `requireSupabaseAuth`; Listen über TanStack Query. Spielersuche als server function mit Mindestlänge 2 Zeichen, liefert nur Anzeigename/Handle/Avatar.
- Eingaben mit Zod validiert (Platzname 1–100 Zeichen, Gastname 1–50, max. 6 Spieler pro Runde).
- Design-Tokens (Weiß/Schwarz/Signalgrün, Radius, Schrift) in `src/styles.css`; keine harten Farbklassen in Komponenten. Sonner für Rückmeldungen.
- Eigene Titel/Beschreibungen je Seite für Vorschau und Suche.

## Nächste Schritte (nach deiner Freigabe von Schritt 1)

Schritt 2: Live-Leaderboard mit Schlag- und Putt-Eingabe pro Loch. Schritt 3: Strafpunkte automatisch und manuell. Schritt 4: Langzeitstatistiken. Schritt 5: GPS-Karte.