# User-System 2.0: Aktive, passive Mitglieder und Gäste (Migration)

## Ziel
Unterscheidung von drei Spieler-Arten in `profiles`:
- **active** — registrierte Nutzer mit Login (bisheriger Normalfall)
- **passive** — dauerhafte Gruppenmitglieder ohne Login, von einem aktiven User angelegt und verwaltet
- **guest** — temporäre Spieler für eine Runde

Dieser Schritt betrifft nur Datenbank und Typen — keine UI-Änderungen (Anlage passiver Mitglieder/Gäste im UI folgt in einem späteren Schritt).

## Datenbank-Migration

### 1. Enum `user_type`
```sql
CREATE TYPE public.user_type AS ENUM ('active', 'passive', 'guest');
```

### 2. Neue Spalten in `profiles`
- `user_type public.user_type NOT NULL DEFAULT 'active'` — alle bestehenden Profile bleiben damit automatisch "active".
- `created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL` — wer dieses passive/Gast-Profil angelegt hat.

### 3. Fremdschlüssel auf `auth.users` lösen (zwingend nötig)
Aktuell referenziert `profiles.id` → `auth.users(id)`. Passive Profile und Gäste haben **kein** Login und damit keine Zeile in `auth.users` — mit dem bestehenden Fremdschlüssel ließen sie sich gar nicht erstellen. Die Migration löst daher:
```sql
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
```
- Für aktive User ändert sich nichts: `handle_new_user()` legt weiterhin bei jeder Registrierung das Profil mit derselben ID an.
- Die Datenintegrität bleibt erhalten: Login-Profile entstehen nur über den Auth-Trigger; das Löschen eines Auth-Users entfernt weiterhin abhängige Daten über die bestehenden `created_by`-/`user_id`-FKs anderer Tabellen (die unverändert auf `auth.users` zeigen).

### 4. RLS-Policies für `profiles`
Bestehende Policies (bleiben):
- SELECT für alle angemeldeten User
- INSERT eigenes Profil (`auth.uid() = id`)
- UPDATE eigenes Profil
- DELETE nur Admin

Neu dazu:
```sql
-- Passive/Gast-Profile anlegen
CREATE POLICY "Users insert managed profiles"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_type IN ('passive','guest') AND created_by = auth.uid());

-- Eigene passive/Gast-Profile bearbeiten
CREATE POLICY "Users update managed profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (user_type IN ('passive','guest') AND created_by = auth.uid())
WITH CHECK (user_type IN ('passive','guest') AND created_by = auth.uid());

-- Eigene passive/Gast-Profile löschen
CREATE POLICY "Users delete managed profiles"
ON public.profiles FOR DELETE TO authenticated
USING (user_type IN ('passive','guest') AND created_by = auth.uid());
```
So kann niemand fremde oder "active" Profile über diese Regeln anlegen oder verändern.

## TypeScript-Typen
Nach der Migration `src/integrations/supabase/types.ts` neu generieren lassen (Typen-Generator), sodass `profiles` die Felder `user_type` und `created_by` enthält und der Enum `user_type` bekannt ist. Danach Typecheck (`bunx tsgo --noEmit`).

## Technische Details
- Migrationstool: Lovable-Cloud-Migration (DDL), danach Typen-Regenerierung.
- Keine Datenänderungen, keine UI-Änderungen in diesem Schritt.
- Bestehende Runden, Flights, Gäste-Namen (`guest_name` in `round_players`) bleiben unberührt und funktionieren unverändert weiter.

## Prüfung nach Umsetzung
- Bestehende Profile zeigen `user_type = 'active'`.
- Test-Insert: angemeldeter User legt Profil mit `user_type='passive'`, `created_by = eigene ID` an → erfolgreich; fremdes `created_by` oder `user_type='active'` → abgelehnt.
- Typecheck fehlerfrei.
