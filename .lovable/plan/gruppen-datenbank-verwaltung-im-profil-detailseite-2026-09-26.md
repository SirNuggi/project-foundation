# Gruppen: Datenbank, Verwaltung im Profil, Detailseite

## Was du bekommst

- Im Profil zwei ausklappbare Bereiche (beide anfangs zugeklappt):
  1. "Meine Spieler & Gäste" – die bisherige Verwaltung passiver Spieler, unverändert im Inhalt.
  2. "Meine Gruppen" – neu.
- In "Meine Gruppen":  grüner plus-Button(ähnlich wie bei meine Spieler) öffnet ein Fenster mit dem Gruppennamen (Abbrechen / Speichern, mit Abstand). Nach dem Speichern bist du automatisch Admin der Gruppe.
- Liste aller Gruppen, in denen du Mitglied oder Admin bist. Jede Karte zeigt: Name, Badge "Admin" oder "Mitglied", Anzahl der Mitglieder.
- Tippen auf eine Karte öffnet eine neue Seite `/groups/<id>`: schwarzer Header wie im Dashboard ("GOLF BUDDIES" grün, darüber der Gruppenname weiß, weißes × zurück zum Profil), Inhalt: "Details folgen in Kürze".
- Sonst keine Änderungen (Rundenerstellung bekommt noch keine Gruppenauswahl).

## Technische Details

Migration:

- `groups` (id, name 1–50, created_by → profiles.id, created_at).
- `group_members` (id, group_id → groups ON DELETE CASCADE, user_id → profiles ON DELETE CASCADE, role text check in ('admin','member') default 'member', joined_at, unique(group_id,user_id)).
- `rounds.group_id` uuid nullable → groups ON DELETE SET NULL.
- Trigger AFTER INSERT on groups: trägt Ersteller als `admin` ein (SECURITY DEFINER).
- Helfer `is_group_member(_group_id, _user_id)` und `is_group_admin(...)` als SECURITY DEFINER (keine RLS-Rekursion).
- GRANTs an authenticated/service_role, RLS an.
- Policies groups: SELECT für Mitglieder/Ersteller; INSERT wenn created_by = auth.uid(); UPDATE/DELETE für Gruppen-Admins.
- Policies group_members: SELECT für Mitglieder derselben Gruppe; INSERT/UPDATE/DELETE für Gruppen-Admins; eigener Austritt (DELETE eigene Zeile) erlaubt.
- Zusätzliche SELECT-Policies "Group members read ..." auf rounds, round_players, flights, hole_scores, penalties: Lesen, wenn die Runde eine group_id hat und der Nutzer Mitglied ist (bestehende Policies bleiben).
- Typen neu generieren.

Code:

- `src/lib/groups.functions.ts`: `listMyGroups` (Gruppen mit eigener Rolle + Mitgliederzahl), `createGroup`, `getGroup` – alle mit requireSupabaseAuth.
- `profile.tsx`: bestehende Spieler-Section in shadcn `Accordion` (type multiple, zugeklappt) packen, neue Gruppen-Section + `CreateGroupDialog`.
- Neue Route `src/routes/_authenticated/groups.$groupId.tsx` mit eigenem head(), Daten per useQuery.