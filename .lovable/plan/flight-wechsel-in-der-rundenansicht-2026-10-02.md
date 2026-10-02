# Flight-Wechsel in der Rundenansicht

## Anzeige
- Oben rechts im schwarzen Kopfbereich steht dauerhaft „Flight 1 von 3“ entsprechend dem aktuell sichtbaren Flight.
- Beim Öffnen wird zuerst der eigene Flight angezeigt.

## Wisch-Navigation
- Der Bereich mit den Spielerkarten wechselt per horizontalem Wischen zum vorherigen oder nächsten Flight.
- Der Wechsel erhält eine klare seitliche Slide-Bewegung und aktualisiert gleichzeitig die Flight-Anzeige im Kopfbereich.
- Am ersten und letzten Flight endet die Navigation; ein Wischen darüber hinaus verändert nichts.

## Berechtigungen und Aktionen
- Im eigenen Flight bleiben Schläge, Putts, Strafen, „Spieler hinzufügen“, „Flight beenden“ und „Flight löschen“ wie bisher bedienbar.
- Fremde Flights zeigen Spieler, gespeicherte Werte und Strafen vollständig schreibgeschützt.
- Aktionen für den eigenen Flight werden beim Betrachten eines fremden Flights nicht angezeigt.
- Lochwechsel, Karte, Scorecard, Dashboard-Menü und Leaderboard bleiben unverändert.

## Technische Details
- Die aktive Flight-ID wird als lokaler Zustand geführt und bei neuen Live-Daten sicher mit der Flight-Liste abgeglichen.
- Touch-Gesten werden nur horizontal ausgewertet, damit vertikales Scrollen weiterhin normal funktioniert.
- Die bestehenden Daten aus der gesamten Runde werden nach der aktiven Flight-ID gefiltert; es sind keine Datenbankänderungen nötig.
