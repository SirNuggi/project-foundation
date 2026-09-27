# Dashboard, Runden-UI und Euro-Strafkasse

## 1. Dashboard

- Der Text "Neue Runde starten" entfällt; nur noch ein runder grüner "+"-Button.
- Dieser Button schwebt am Übergang zwischen schwarzem Kopfbereich und weißem Inhalt, halb in beiden, direkt unter "Servus, [Name]".
- "Letzte Runden" zeigt sofort die zwei neuesten Runden. Darunter ein dezenter Text-Button "Mehr anzeigen" / "Weniger anzeigen" für die restliche Historie.

## 2. Runden-Ansicht

- Kopfzeile: "‹ Loch 1 · Par 3 ›" — beide Pfeile rahmen den antippbaren Text ein, das 3-Punkte-Menü bleibt ganz rechts.
- Schläge- und Putts-Eingabe rund 25 % kleiner (Buttons und Zahl).
- Das Element Minus–Zahl–Plus passt sich der Breite des Spielerrahmens an, bricht nie um und ragt nie heraus.

## 3. Strafen in Euro statt Punkten

- In der Datenbank bekommt jede Strafregel einen Euro-Betrag (`amount`), Startwerte: 3-Putt 0,50 €, Doppel-Par 0,50 €, Girly 1,00 €. Auch jede erfasste Strafe speichert den Betrag mit, damit spätere Preisänderungen alte Runden nicht verändern.
- Im Admin-Bereich gibt es eine neue Liste "Strafen" mit Bezeichnung und Euro-Feld je Regel und einem Speichern-Button.
- Wird ein Chip (3-Putt, Doppel-Par, Girly) aktiv, wird im Hintergrund der aktuelle Euro-Betrag der Regel für dieses Loch gebucht; wird er inaktiv, verschwindet der Betrag wieder.

## 4. Leaderboard unten

- Zwei Tabs: "Schläge" und "Strafen".
- Sortierung nach Schlägen aufsteigend — der Spieler mit den meisten Schlägen steht unten.
- Neben jedem Namen steht die Gesamtsumme in Euro im Format "4,50 €"; im Tab "Strafen" wird nach Summe absteigend sortiert.
- Die Spalte "Strafpunkte" entfällt komplett.

## Technische Umsetzung

- Migration: `penalty_rules.amount numeric(6,2) NOT NULL DEFAULT 0` und `penalties.amount numeric(6,2) NOT NULL DEFAULT 0`; Seed-Update für three_putt/double_par (0.50) und girly (1.00). `points` bleibt vorerst bestehen, wird aber im UI nicht mehr genutzt.
- `golf.functions.ts`: `getRoundBoard` liefert `amount` bei penalties und rules; `syncAutoPenalties` und `toggleGirly` lesen `amount` aus `penalty_rules` und schreiben es in `penalties`.
- `admin.functions.ts`: `adminOverview` liefert `penalty_rules`; neue Funktion `adminUpdatePenaltyAmounts` (assertAdmin, Zod: Array aus `{ code, amount }`, amount 0–99,99).
- `admin.tsx`: Abschnitt "Strafen" mit Euro-Inputs (`step=0.05`, `inputMode="decimal"`) und Speichern.
- `LiveLeaderboard.tsx`: Tabs-State ("Schläge" / "Strafen"), `BoardRow` bekommt `euro` statt `penaltyPoints`, Formatierung über `Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" })`.
- `round.$roundId.tsx`: Counter-Maße von `h-14 w-14` auf `h-11 w-11`, Zahl von `text-3xl` auf `text-2xl`, Container `flex min-w-0 items-center justify-between gap-1` mit `shrink-0` auf den Buttons und `min-w-0 flex-1` auf der Zahl; Kopfzeile mit Pfeilen direkt um den Popover-Trigger, Menü per `ml-auto`.
- `dashboard.tsx`: Kopfbereich `relative`, FAB `absolute -bottom-7 left-6` (bzw. rechtsbündig nach Look), Inhaltsbereich mit passendem oberen Abstand; Runden-Liste `rounds.slice(0, expanded ? undefined : 2)`.