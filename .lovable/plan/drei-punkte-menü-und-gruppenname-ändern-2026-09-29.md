# Drei-Punkte-Menü und Gruppenname ändern

## Umsetzung

- In der Gruppenansicht ein Drei-Punkte-Menü einfügen  wie in der Rundenansicht.
- Im Menü den Eintrag **„Umbenennen“** für Gruppen-Admins anzeigen;den schließenbutton beibehalten, evtl position anpassen.
- Beim Umbenennen einen Dialog mit dem aktuellen Gruppennamen öffnen, den Namen validieren und speichern.
- Die Gruppenansicht und die Gruppenliste im Profil nach dem Speichern sofort aktualisieren.
- Die Änderung serverseitig auf Gruppen-Admins beschränken und anschließend Darstellung sowie Speichern prüfen.

## Technische Details

- Eine authentifizierte Server-Funktion zum Aktualisieren des Gruppennamens ergänzen.
- Bestehende Dropdown-, Dialog-, Eingabe- und Button-Bausteine verwenden.
- Keine Änderungen an Mitgliedern, Rollen oder anderen Gruppenfunktionen.