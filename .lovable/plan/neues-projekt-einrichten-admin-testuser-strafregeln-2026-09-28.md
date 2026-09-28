# Neues Projekt einrichten: Admin, Testuser, Strafregeln

## Ist-Zustand (geprüft)
- 1 Benutzer und 1 Profil vorhanden, keine Rollen, keine Strafregeln, keine Golfplätze.
- Das Admin-Passwort (für "Admin freischalten") ist in diesem Projekt nicht hinterlegt.
- Die Projekt-Einstellungsdatei zeigt noch auf das alte Projekt.

## Was ich einrichte
1. **Admin-Zugang für dich**: Dein bestehendes Konto bekommt direkt die Admin-Rolle. Zusätzlich hinterlegst du ein neues Admin-Passwort (Eingabefeld erscheint), damit die Freischaltung per Passwort wieder funktioniert.
2. **Strafregeln** wie im alten Projekt:
   - Dreiputt – 0,50 €, automatisch
   - Doppel-Par – 0,50 €, automatisch
   - Girly – 1,00 €, manuell
3. **Eigener Testuser** für meine Testläufe (z. B. `testuser@birdie.test`, aktives Mitglied, bestätigt, ohne Admin-Rechte). Ich verwende ihn nur für Tests und melde mich damit im Vorschaufenster an.
4. **Projekt-Einstellungsdatei** auf dein neues Supabase-Projekt umstellen.

## Was dir sonst noch auffallen sollte
- **Golfplätze**: Die Datenbank ist leer – ohne Platz kann keine Runde gestartet werden. Du legst sie im Admin-Bereich an (oder ich übernehme sie, wenn du mir die Daten gibst).
- **E-Mail-Bestätigung**: In neuen Supabase-Projekten ist sie meist eingeschaltet; Mitspieler müssen dann erst eine Mail bestätigen. Bei Bedarf in Supabase unter Authentication ausschalten.
- **Weiterleitungs-Adresse**: In Supabase unter Authentication > URL Configuration die Adresse deiner veröffentlichten App eintragen, sonst führen Bestätigungsmails ins Leere.

## Technische Details
- `user_roles`-Eintrag (admin) für die vorhandene User-ID per Datenänderung.
- `penalty_rules`-Insert (code, label, points, is_automatic, description, amount) per Datenänderung.
- Testuser über Auth-Admin (bestätigte E-Mail), Profil entsteht per Trigger `handle_new_user`; Passwort nur in einem Secret.
- Secret `ADMIN_PASSWORD` anfordern.
- `supabase/config.toml` project_id -> `oujxikrlstyqaikwymmc`.
- Danach Login-Test mit Testuser im Vorschaufenster.
