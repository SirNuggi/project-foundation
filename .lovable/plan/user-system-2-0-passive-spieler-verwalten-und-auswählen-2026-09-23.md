# User-System 2.0: Passive Spieler verwalten und auswählen

## Ziel
Die App unterscheidet in der Oberfläche zwischen:
- **Aktiv** — registrierte Nutzer mit eigenem Login
- **Passiv** — dauerhaft gespeicherte Mitspieler ohne Login, verwaltet durch ihren Ersteller
- **Gast** — bleibt wie bisher eine einmalige, nicht gespeicherte Eingabe innerhalb einer Runde

Neue passive Spieler können sowohl im Profil als auch direkt bei der Spielerauswahl einer neuen Runde angelegt werden.

## Profil: „Meine Spieler“
- Unterhalb des bestehenden eigenen Profilformulars einen Bereich **„Meine Spieler“** ergänzen.
- Dort ausschließlich die vom angemeldeten Nutzer angelegten passiven Spieler auflisten.
- Pro Eintrag Name, Handicap und Badge **„Passiv“** anzeigen.
- Button **„Neuen Spieler anlegen“** öffnet einen Dialog mit:
  - Name als Pflichtfeld
  - Handicap mit Standardwert `54,0`
- Eigene passive Spieler können über denselben Dialog bearbeitet werden.
- Löschen erfolgt erst nach einem Bestätigungsdialog.
- Aktive Konten und passive Spieler anderer Nutzer werden in diesem Verwaltungsbereich nicht angezeigt und können dort weder bearbeitet noch gelöscht werden.
- Die bestehende Bearbeitung des eigenen Profils und der Abmelden-Button bleiben unverändert.

## Rundenanlage: Spielersuche je Flight
- Die vorhandene Spielersuche zeigt Treffer mit einem Badge **„Aktiv“** oder **„Passiv“**.
- Aktive Konten bleiben wie bisher über Name oder Handle auffindbar.
- Von anderen Nutzern angelegte passive Spieler werden nicht in der Suche angeboten; sichtbar sind nur eigene passive Spieler.
- Wenn die Suche keinen passenden Spieler liefert, erscheint analog zur Platzanlage eine klare Option **„Passiven Spieler anlegen“**.
- Zusätzlich bleibt ein gut erreichbarer Schnell-Button zur Anlage eines passiven Spielers im jeweiligen Flight sichtbar.
- Der Schnell-Dialog enthält Name und Handicap, speichert den neuen passiven Spieler und fügt ihn anschließend automatisch dem gerade bearbeiteten Flight hinzu.
- Der passende Abschlag wird wie bei bestehenden Spielern aus dem Profilwunsch gewählt oder auf den ersten verfügbaren Abschlag gesetzt.
- Die bisherige Eingabe **„Gast ohne Konto“** bleibt unverändert bestehen und speichert Gäste weiterhin nur in der jeweiligen Runde.

## Datenzugriff und Validierung
- Neue geschützte Funktionen zum Auflisten, Anlegen, Bearbeiten und Löschen eigener passiver Spieler ergänzen.
- Beim Speichern erhält ein passiver Spieler eine neue UUID, einen intern eindeutigen Handle, `user_type = 'passive'` und `created_by = aktueller Nutzer`.
- Name: 1–50 Zeichen; Handicap: gültiger bestehender Bereich `-60` bis `60`, Anzeige mit deutschem Dezimalkomma.
- Änderungs- und Löschvorgänge prüfen zusätzlich serverseitig Typ und Ersteller; fremde oder aktive Profile können nicht verändert werden.
- Die vorhandenen Datenbankfelder und Zugriffsregeln reichen aus; keine neue Migration ist vorgesehen. Der bereits vorhandene Enum-Wert `guest` bleibt aus Kompatibilitätsgründen bestehen, wird von dieser Oberfläche aber nicht zum Speichern verwendet.

## Technische Umsetzung
- `src/lib/golf.functions.ts`: Funktionen für eigene passive Spieler; Spielersuche um `user_type` erweitern und auf aktive Konten plus eigene passive Spieler begrenzen.
- Neue wiederverwendbare Dialog-/Badge-Komponenten für passive Spieler, damit Profil und Rundenanlage identische Eingaben und Kennzeichnungen nutzen.
- `src/routes/_authenticated/profile.tsx`: Verwaltungsbereich, Bearbeiten und bestätigtes Löschen.
- `src/routes/_authenticated/round.new.tsx`: Typ-Badges, Schnellanlage im jeweiligen Flight und sofortige Auswahl des neu erstellten Spielers.
- Bestehende UI-Komponenten, Farben, große Touch-Ziele und mobile Darstellung beibehalten.

## Prüfung
- Passiven Spieler im Profil anlegen, bearbeiten und nach Bestätigung löschen.
- Nur eigene passive Spieler erscheinen in „Meine Spieler“; aktive und fremde Profile sind dort nicht veränderbar.
- Suche in der Rundenanlage zeigt korrekte Badges und keine fremden passiven Spieler.
- Passiven Spieler direkt in Flight 1 und einem weiteren Flight anlegen; er wird jeweils sofort dem richtigen Flight hinzugefügt.
- Einmaligen Gast wie bisher anlegen; dabei entsteht kein gespeichertes Profil.
- Runde mit aktiven, passiven und einmaligen Gastspielern starten; Handicap- und Abschlagswerte werden unverändert übernommen.
- Profil- und Rundenlisten aktualisieren sich nach Anlage, Bearbeitung und Löschung ohne Neuladen.
