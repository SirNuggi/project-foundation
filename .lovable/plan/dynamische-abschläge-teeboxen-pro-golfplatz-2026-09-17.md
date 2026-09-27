# Dynamische Abschläge (Teeboxen) pro Golfplatz

Statt fest verdrahteter Werte für "Herren" und "Damen" bekommt jeder Golfplatz eigene Abschläge mit frei wählbarem Namen, Slope und CR. Beim Rundenstart wählt jeder Spieler seinen eigenen Abschlag, und die Spielvorgabe wird genau damit gerechnet.

## 1. Abschläge je Platz

- Neue Liste "Abschläge" pro Golfplatz: Name (z. B. Gelb, Rot, Weiß), Slope, CR.
- Maximal 6 Abschläge pro Platz.
- Die alten Felder Slope/CR Herren und Damen entfallen.
- Bereits angelegte Plätze werden automatisch übernommen: aus den bisherigen Werten entstehen die Abschläge "Gelb" (Herren-Werte) und "Rot" (Damen-Werte), danach frei änderbar.

## 2. Admin-Bereich

- Im Platz-Formular ersetzt ein Abschlags-Block die bisherigen vier Slope/CR-Felder.
- Beim Neuanlegen erscheinen 2 leere Zeilen, vorbelegt mit "Gelb" und "Rot" (Slope 103, CR 63,1 / 63,9).
- Jede Zeile: Name, Slope, CR und ein Papierkorb-Symbol zum Entfernen (mindestens eine Zeile bleibt).
- "+ Abschlag hinzufügen" bis maximal 6.
- Beim Bearbeiten eines bestehenden Platzes werden dessen Abschläge geladen und können geändert, ergänzt oder gelöscht werden.

## 3. Neue Runde

- Die bisherige globale Gelb/Rot-Umschaltung entfällt.
- Nach Auswahl des Platzes erscheint neben jedem Spieler (auch neben dir selbst und neben Gästen) ein Dropdown mit genau den Abschlägen dieses Platzes.
- Vorauswahl: der im Profil hinterlegte Wunsch-Abschlag, falls der Platz einen Abschlag mit diesem Namen hat, sonst der erste in der Liste.
- Wird der Platz gewechselt, werden die Zuordnungen auf die Abschläge des neuen Platzes gesetzt.
- Im Formular "Neuer Platz" (Play-and-Save) gibt es denselben Abschlags-Block wie im Admin-Bereich.

## 4. Profil

- Statt "Gelb (Herren) / Rot (Damen)" wird ein bevorzugter Abschlagsname als Text gespeichert (Vorschläge Gelb/Rot/Weiß/Blau).
- Dieser Wunsch wird beim Rundenstart nur als Vorauswahl genutzt.
- Gleiches Feld auch in der Admin-Spielerliste.

## 5. Handicap-Berechnung

- Beim Rundenstart wird pro Spieler gerechnet: Spielvorgabe = Runden(Handicap-Index × Slope/113 + (CR − Gesamt-Par)) mit Slope und CR genau des zugewiesenen Abschlags.
- Der Abschlagsname wird zur Runde gespeichert und auf Scorecard und Leaderboard angezeigt; persönliches Par und Netto-Stableford bleiben unverändert in der Logik.
- Bereits gespielte Runden behalten ihre gespeicherten Werte.

## Technische Umsetzung

- Migration:
  - Neue Tabelle `public.tee_boxes` (id, course_id -> courses(id) ON DELETE CASCADE, name text, slope int, course_rating numeric(4,1), created_at). GRANT SELECT/INSERT/UPDATE/DELETE an `authenticated`, ALL an `service_role`; RLS an; Lesen für alle Angemeldeten, Schreiben für Admin oder den Ersteller des Platzes. Max. 6 je Platz über BEFORE-INSERT-Trigger.
  - Datenübernahme: je bestehendem Platz zwei Zeilen aus `slope_herren/cr_herren` ("Gelb") und `slope_damen/cr_damen` ("Rot").
  - `courses`: `slope_herren`, `cr_herren`, `slope_damen`, `cr_damen` entfallen (DROP COLUMN, nach der Übernahme).
  - `round_players`: `tee_box_id uuid NULL REFERENCES tee_boxes(id) ON DELETE SET NULL`; bestehendes `tee text` speichert künftig den Abschlagsnamen (alte Werte bleiben stehen).
  - `profiles.default_tee`: Check-Constraint auf herren/damen entfernen, Default auf `'Gelb'`; bestehende Werte auf "Gelb"/"Rot" abbilden.
- `src/lib/golf.functions.ts`: `teeSchema` (Union herren/damen) entfällt; `newCourseSchema` bekommt `teeBoxes: [{name, slope, courseRating}]` (1–6) statt der vier Slope/CR-Felder; `listCourses` liefert `teeBoxes` je Platz; `createRound` nimmt je Spieler `teeBoxId`, liest die Teebox-Werte und rechnet `courseHandicap` damit, schreibt `tee` (Name) + `tee_box_id`; `getMyProfile`/`updateMyProfile` mit freiem Text für `default_tee`; `getRoundBoard` gibt den Abschlagsnamen zurück.
- `src/lib/admin.functions.ts`: `courseFieldsSchema` ersetzt slope/cr-Felder durch `teeBoxes`; `adminGetCourse` lädt Teeboxen; `adminCreateCourse`/`adminUpdateCourse` schreiben Teeboxen (bei Update: vorhandene ersetzen); `adminUpdatePlayerHandicaps` akzeptiert freien Abschlagsnamen.
- `src/routes/_authenticated/admin.tsx`: neue Teilkomponente `TeeBoxRows` (Zeilen mit Name/Slope/CR, Trash-Button, "+ Abschlag hinzufügen", Limit 6) in `CourseForm`; Spielerliste mit Textfeld statt Gelb/Rot-Umschalter.
- `src/routes/_authenticated/round.new.tsx`: globalen Tee-Umschalter entfernen; pro Spielerzeile ein shadcn-`Select` mit den Teeboxen des gewählten Platzes; State `teeByPlayer` wird bei Platzwechsel neu gesetzt; `TeeBoxRows` auch im "Neuer Platz"-Block.
- `src/routes/_authenticated/profile.tsx`: Abschlagsfeld als Eingabe/Select mit freien Namen.
- `src/lib/stableford.ts` bleibt unverändert (Formel identisch).
