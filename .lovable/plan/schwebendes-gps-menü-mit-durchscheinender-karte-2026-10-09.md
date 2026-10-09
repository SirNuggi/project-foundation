# Schwebendes GPS-Menü mit durchscheinender Karte

## Was entsteht

- **GPS-Button oben (grüner Pin) wird zum Schalter:** Antippen blendet ein kleines, schwebendes Menü ein, nochmal Antippen blendet es wieder aus (inkl. Karte). Der Button zeigt sichtbar an, ob er aktiv ist.
- **Schwebendes Menü:** kompakte, abgerundete Pille mit Schatten, die man mit dem Finger frei auf dem Bildschirm verschieben kann (bleibt im sichtbaren Bereich, Position wird gemerkt). Enthält nur zwei Symbole:
  1. **Karte** – blendet die Karte über der Runde ein/aus.
  2. **Einstellungen** – öffnet ein kleines Fenster mit einem Regler für die Deckkraft der Karte (30 % bis 100 %, Standard 85 %). Der Wert bleibt auf dem Handy gespeichert.
- **Karte als Glas-Überlagerung:** Statt des bildschirmfüllenden Fensters legt sich die Karte mit weichem Ein-/Ausblenden, abgerundeten Ecken, feinem hellem Rand und Unschärfe-Effekt über die Runde; je nach Regler scheint die Scorecard durch. Das schwebende Menü liegt immer über der Karte.
- **Bestehendes bleibt:** eigener Punkt „Ich“, Mitführen der Position, Ziel-Marker per Tippen mit Entfernung und „Marker entfernen“ funktionieren unverändert an ihren Plätzen. GPS läuft nur, solange die Karte offen ist; nichts wird gespeichert.

Hinweis: Eigene Buttons „Zentrieren“ oder Entfernung zu Grün/Tee gibt es derzeit nicht – die Karte zentriert sich automatisch. Diese werden hier nicht neu erfunden.

## Technische Details

- Neue Komponente `src/components/round/GpsFloatingMenu.tsx`: Drag über Pointer-Events (`setPointerCapture`, Begrenzung auf Viewport, `touch-action: none`), Position + Opacity in `localStorage` (Lesen in `useEffect`, hydration-sicher). Popover + Slider aus shadcn/ui; Icons `Map`, `SlidersHorizontal`.
- `round.$roundId.tsx`: `mapOpen` ersetzt durch `gpsActive` + `mapVisible` + `mapOpacity`; Header-Button toggelt `gpsActive`. Overlay `fixed inset-2 z-40 rounded-3xl border border-white/20 backdrop-blur-md overflow-hidden` mit `style={{opacity}}` und Transition (opacity/scale); LiveMap weiter per `lazy` + `<ClientOnly>`, nur gemountet wenn sichtbar (stoppt GPS). Menü `z-50`, Schließen-X im Overlay entfällt (Steuerung über Menü).
- Keine Datenbank- oder Server-Änderungen, kein neues Paket (kein framer-motion nötig).
