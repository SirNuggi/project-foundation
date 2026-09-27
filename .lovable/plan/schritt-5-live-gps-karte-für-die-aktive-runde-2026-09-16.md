# Schritt 5: Live-GPS-Karte für die aktive Runde

## Was entsteht

In der laufenden Runde gibt es oben einen gut sichtbaren Button "Live-Karte". Ein Tippen öffnet eine bildschirmfüllende Karte mit kostenlosem OpenStreetMap-Kartenmaterial:

- Beim Öffnen fragt das Smartphone nach der Standortfreigabe.
- Bei Zustimmung erscheint die eigene Position als leuchtend grüner Punkt mit der Aufschrift "Ich"; die Karte zentriert sich beim ersten Laden automatisch darauf und folgt der Position.
- Verweigert jemand die Freigabe, zeigt die Karte einen freundlichen Hinweis; die Karte bleibt trotzdem sichtbar.
- Schließt man die Karte, beendet oder löscht man die Runde, stoppt das GPS-Tracking sofort — der Standort wird nicht gespeichert und nirgends geteilt.

Im Unterschied zur vorherigen Version: Es werden **keine Standorte in die Datenbank geschrieben** und **keine Mitspieler-Positionen** angezeigt. Die Karte zeigt nur "Wo bin ich gerade?" — sie bleibt rein lokal auf dem eigenen Handy.

## Ablauf

```text
[Runde] --Button "Live-Karte"--> [Vollbild-Karte mit OpenStreetMap]
   Browser fragt Standortfreigabe --> eigener grüner Punkt "Ich"
[Schließen / Runde beendet] --> Tracking stoppt sofort, nichts gespeichert
```

## Technische Umsetzung

- Pakete: `leaflet` + `react-leaflet` + `@types/leaflet`.
- Neue Kartenkomponente `src/components/round/LiveMap.tsx`, ausschließlich per `React.lazy` innerhalb von `<ClientOnly>` geladen (Leaflet darf nicht im SSR-Graph landen); Leaflet-CSS per `<link>` im Root-Route-`head()`. Keine statischen Imports aus dieser Datei in Routen.
- GPS via `navigator.geolocation.watchPosition` (hohe Genauigkeit) in `useEffect`; `clearWatch` beim Schließen/Unmount — das stoppt den GPS-Empfang und schont den Akku.
- Anzeige: grüner Kreis (DivIcon) mit "Ich"-Label, plus Genauigkeitskreis; Karte zentriert beim ersten Fix per `setView`, danach folgt sie sanft der Position.
- Integration in `round.$roundId.tsx`: Button "Live-Karte" in der schwarzen Kopfleiste neben dem Menü; Karte als Vollbild-Overlay (Dialog ohne Inhaltspadding) über der Scorecard, sodass der Scorecard-Zustand erhalten bleibt.
- Keine Datenbankänderungen: keine Server-Funktionen, keine Migration; `player_locations` bleibt ungenutzt für eine spätere Erweiterung.
