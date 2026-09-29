# Drei-Punkte-Menü und Gruppenname ändern

## Umsetzung

- Das bisherige Schließen-Symbol oben rechts in der Gruppenansicht durch das gleiche Drei-Punkte-Menü wie in der Rundenansicht ersetzen.
- Im Menü den Eintrag **„Umbenennen“** für Gruppen-Admins anzeigen; der Rückweg zum Profil bleibt als Menüeintrag erhalten.
- Beim Umbenennen einen Dialog mit dem aktuellen Gruppennamen öffnen, den Namen validieren und speichern.
- Die Gruppenansicht und die Gruppenliste im Profil nach dem Speichern sofort aktualisieren.
- Die Änderung serverseitig auf Gruppen-Admins beschränken und anschließend Darstellung sowie Speichern prüfen.

## Technische Details

- Eine authentifizierte Server-Funktion zum Aktualisieren des Gruppennamens ergänzen.
- Bestehende Dropdown-, Dialog-, Eingabe- und Button-Bausteine verwenden.
- Keine Änderungen an Mitgliedern, Rollen oder anderen Gruppenfunktionen.
