# Kompakte Flight-Ansicht, Spieler-Hinzufügen & Quick-Edit

Nur die Flight-Karten auf „Neue Runde“ ändern sich. Header, Platzwahl, Datum, Löcher, Strafkasse und „Runde starten“ bleiben unverändert.

## 1. Kompakte Flight-Karte

- Suchleiste, „Passiven Spieler anlegen“ und Gast-Eingabe verschwinden aus der Karte.
- Flight 1: „Du“ steht automatisch an erster Stelle (Name aus deinem Profil, HCP und Wunsch-Abschlag aus dem Profil).
- Jede Spieler-Zeile zweizeilig:
  - Zeile 1: Name fett, rechts ein X zum Entfernen (nicht bei dir in Flight 1).
  - Zeile 2: „HCP -17,9 · Gelb“ als Text, daneben Badge Aktiv / Passiv / Gast.
- Keine Abschlags-Dropdowns und keine HCP-Felder mehr direkt in der Zeile.

## 2. Runder Plus-Button „Spieler hinzufügen“

- Unter dem letzten Spieler eines Flights; bei leerem Flight 2, 3 … steht er an erster Stelle.
- Maximal 4 Personen pro Flight (in Flight 1 inkl. dir). Bei 4 wird der Plus-Button ausgeblendet.
- Öffnet ein Fenster mit zwei Tabs:
  - **Auswählen:** Suchleiste plus Schnellauswahl-Liste (aktive Konten und deine passiven Spieler, jeweils zweizeilig mit Badge). Bereits eingeteilte Spieler ausgegraut. Tippen fügt hinzu und schließt das Fenster.
  - **Neu anlegen:** Umschalter „Passiver Spieler“ / „Gast“. Passiv: Name, HCP (Komma/negativ), bevorzugter Abschlag, wird dauerhaft gespeichert und sofort eingefügt. Gast: Name, HCP und Abschlag nur für diese Runde.
- Abschlag-Dropdown neuer Spieler: Profilwunsch, falls der Platz ihn hat, sonst der erste Abschlag.

## 3. Quick-Edit beim Antippen einer Spieler-Zeile

- Ganze Zeile (außer X) antippbar, mit leichtem Hover-/Druck-Effekt. Gilt auch für dich.
- Fenster: Name als Überschrift, Handicap-Feld wie im Profil (z. B. -24,0), Abschlag-Dropdown mit den Abschlägen des gewählten Platzes, Buttons „Abbrechen“ und „Speichern“ mit Abstand.
- Speichern ändert HCP und Abschlag nur für diese Runde (Profile bleiben unverändert) und zeigt sie sofort in der Karte.
- Ohne gewählten Platz ist das Abschlag-Dropdown deaktiviert mit Hinweis „Erst Platz wählen“.

## Technische Umsetzung

- `round.new.tsx`: `FlightSection` verschlankt; neue Komponenten `AddPlayerDialog` (Tabs aus shadcn, nutzt `searchPlayers`, `createPassivePlayer`, Gast-Logik) und `PlayerEditDialog` (HCP-Parsing wie Profil, shadcn `Select` mit `teeOptions`). Die bisherige „Du“-Zeile wird eine normale Zeile mit Flag `isMe`; `myTee` plus neues `myHandicap` (Default aus `getMyProfile`). Limit in `addPlayer` auf 4 inkl. dir.
- `golf.functions.ts` / `createRound`: optionales `myHandicapIndex` ergänzen; falls gesetzt, wird es statt des Profil-HCP für deine Spielvorgabe genutzt. Bestehende Obergrenze pro Flight auf 4 angleichen.
- Keine Datenbank-Änderung.