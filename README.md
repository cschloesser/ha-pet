# Pika Pet Card

Ein kleiner Pika (Pfeifhase) wohnt in deinem Home-Assistant-Dashboard.

- **Antippen** → streicheln: Herzchen, Freudensprung, Glück steigt
- **Löwenzahn-Knopf** → füttern: Futter fällt herunter, er hoppelt hin und frisst
- **Tagsüber** schaut er sich um, hoppelt herum, knabbert Blumen, trägt Blüten zu seinem Heuhaufen, putzt sich und piepst ab und zu
- **Nachts** schläft er mit Zipfelmütze vor seinem Bau
- **Hunger und Glück** sinken langsam. Hat er Hunger, denkt er an Löwenzahn und lässt die Ohren hängen

## Himmel und Wetter

Der Blick geht nach Süden: Osten (Sonnenaufgang) ist links, Westen rechts.

- **Sonne** steht nach Azimut und Höhe aus `sun.sun` am Himmel und geht hinter dem Hügel unter. Der Himmel wechselt zwischen Tag, Dämmerung und Nacht.
- **Mond** mit echter Phase und echtem Stand, berechnet aus Datum und Standort (`hass.config`). Tagsüber ist er blass zu sehen, wenn er über dem Horizont steht.
- **Wetter** aus `weather_entity`:
  - Wolken nach Bedeckung, grauer Himmel bei bedecktem Wetter
  - Regen, Starkregen, Gewitter mit Blitzen, Schnee mit verschneiten Hügeln, Nebelschwaden
  - Wolken ziehen und Blumen biegen sich mit Windstärke und Windrichtung
- **Pika** reagiert darauf:
  - Bei Regen hält er sich ein Blatt als Schirm über den Kopf und bleibt in der Nähe seines Baus.
  - Bei Starkregen und Gewitter wartet er vor dem Bau und erschrickt bei Blitzen.
  - Unter 3 °C trägt er einen Schal.
  - Bei Schnee knabbert er an seinem Heuvorrat.
- Im Sommer gibt es nachts Glühwürmchen.

## Installation (HACS)

1. HACS → ⋮ → *Benutzerdefinierte Repositories* → `https://github.com/cschloesser/ha-pet`, Typ **Dashboard**
2. *Pika Pet Card* herunterladen; die Ressource wird automatisch eingetragen
3. Optional einen Text-Helfer anlegen, damit der Pika auf allen Geräten denselben Zustand hat:
   *Einstellungen → Geräte & Dienste → Helfer → Text*, z. B. `input_text.pika_status` (max. Länge 100)

## Konfiguration

```yaml
type: custom:pika-pet-card
name: Pika                       # Name in der Statusanzeige
entity: input_text.pika_status   # optional, sonst nur lokal im Browser gespeichert
sleep_start: "21:00"             # Schlafenszeit
sleep_end: "07:00"               # Aufwachzeit
sun_entity: sun.sun              # Sonnenstand
weather_entity: weather.forecast_home   # Wetter (Standard: met.no-Integration)
show_stats: true                 # Satt-/Glück-Balken
height: 180                      # Mindesthöhe in px (im Abschnitts-Layout zählt die Zeilenhöhe)
```

Im Text-Helfer steht der Zustand als `satt,zeit,glück,zeit`. Hunger und Glück werden daraus beim Anzeigen berechnet, deshalb braucht es keine Automation.

## Entwicklung

`preview.html` lädt die Karte mit einem simulierten `hass`-Objekt. Dafür den Ordner über einen beliebigen lokalen Webserver öffnen.
