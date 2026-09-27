# Schritt 4: Langzeitstatistiken

Die Seite "Statistiken" wird von einer Platzhalterseite zur echten Auswertung. Es zählen ausschließlich Runden mit dem Status "beendet".

## 1. Übersicht (oben)

Drei Kacheln für den angemeldeten Spieler:
- Gespielte Runden insgesamt
- Gesamt eingezahltes Geld in die Strafkasse (Summe aller Euro-Strafen)
- Lieblings-Golfplatz (häufigster Platz in der Historie)

## 2. Hall of Shame

Dauerhafte Rangliste aller registrierten Spieler, sortiert nach insgesamt gezahltem Geld über alle beendeten Runden. Platz 1 bekommt ein Geldsack-Symbol, daneben jeweils Name und Betrag ("Max Mustermann · 42,50 €"). Spieler ohne Strafen stehen mit 0,00 € am Ende.

## 3. Strafen-Analyse

Auflistung, wofür der Spieler gezahlt hat, je Strafart mit Anzahl und Summe, plus ein einfacher Balken je Zeile für den Anteil:
"12× Drei-Putt · 6,00 €", "8× Girly · 8,00 €", "5× Doppel-Par · 2,50 €".

## 4. Historische Runden

Liste "Deine historischen Runden" (nur beendete) mit Platz, Datum, Löcherzahl und eigenem Strafbetrag. Ein Tippen öffnet die bestehende Rundenansicht, die bei beendeten Runden bereits schreibgeschützt ist (Scorecard + Strafkasse dieser Runde).

## 5. Navigation

Oben links "← Dashboard" bleibt erhalten; der Weg über das Drei-Punkte-Menü des Dashboards funktioniert bereits und wird geprüft.

## Technische Umsetzung

- Migration: SQL-Funktion `public.penalty_hall_of_shame()` (SECURITY DEFINER, STABLE, `search_path = public`, EXECUTE nur für `authenticated`). Sie liefert je Profil `profile_id, display_name, handle, total_amount`, aggregiert über `penalties` → `round_players` → `rounds` mit `rounds.status = 'finished'`, per LEFT JOIN auf `profiles`, damit auch Spieler ohne Strafen erscheinen. Nötig, weil die RLS-Policies von `penalties` nur Teilnehmer lesen lassen — eine appweite Rangliste ist sonst nicht möglich. Gäste ohne Profil fließen nicht ein.
- `src/lib/stats.functions.ts` (neu), alle mit `requireSupabaseAuth`:
  - `getMyStats` — beendete Runden des Nutzers über `round_players` + `rounds`, Rundenzahl, Summe der eigenen `penalties.amount`, häufigster `course_name`, Aufschlüsselung je `code` (Anzahl + Summe, Label aus `penalty_rules`) und die Rundenliste (id, course_name, played_on, hole_count, eigener Betrag).
  - `getHallOfShame` — Aufruf von `supabase.rpc("penalty_hall_of_shame")`, Beträge als Number gemappt, absteigend sortiert.
- `src/routes/_authenticated/stats.tsx`: Route-Loader primt beide Queries über `context.queryClient.ensureQueryData`, Komponente liest mit `useSuspenseQuery`; `errorComponent` und `notFoundComponent` ergänzen. Aufbau: schwarzer Kopfbereich mit Zurück-Pfeil, Kachel-Raster, Hall of Shame, Strafen-Analyse, Rundenliste als `Link to="/round/$roundId"`.
- Formatierung durchgehend `Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" })`.
- Kein neues Diagramm-Paket: die Analyse nutzt schlanke Balken aus Tailwind-Divs.
