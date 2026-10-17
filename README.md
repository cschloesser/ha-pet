# Pika Pet Card

Ein kleiner Pika (Pfeifhase) wohnt in deinem Home-Assistant-Dashboard.

- **Antippen** → streicheln: Herzchen, Freudensprung, Glück steigt
- **Löwenzahn-Knopf** → füttern: Futter fällt herunter, er hoppelt hin und frisst
- **Tagsüber** schaut er sich um, hoppelt herum, knabbert Blumen, trägt Blüten zu seinem Heuhaufen, putzt sich und piepst ab und zu
- **Bau**: Ab und zu verschwindet er in seinem Bau und schaut ein paarmal heraus, bevor er wieder rauskommt
- **Aussichtsstein**: Wie echte Pikas springt er auf den Stein mit Geröll, richtet sich auf und pfeift
- **Nachts** (Standard: Sonnenuntergang bis Sonnenaufgang) schläft er mit Zipfelmütze im Eingang seines Baus
- **Hunger und Glück** sinken langsam. Hat er Hunger, denkt er an Löwenzahn und lässt die Ohren hängen

## Häufchen und Sauberkeit

- Über den Tag macht er kleine Häufchen: etwa alle 80–140 Minuten, solange er wach ist (5–6 am Tag). Das erste kommt 10–30 Minuten nach dem Aufwachen, nachts keins.
- Wie echte Pikas geht er dafür in seine **Klo-Ecke** am Aussichtsstein. Liegen dort schon drei, sucht er sich einen Platz auf der Wiese. Höchstens 8 liegen gleichzeitig.
- Schaut man gerade zu, sieht man es live: hinhoppeln, umschauen, Hocke, Po-Wackeln, *plopp*.
- **Häufchen antippen** → Schaufel, weg, Funkeln. Ist alles sauber, funkelt die Wiese, er macht einen Freudensprung und Glück steigt um 10.
- Der **Sauber-Balken** (hellblau) verliert 10 % pro Häufchen und 2 % pro Stunde, die es liegt. Nach 4 Stunden kreist tagsüber eine kleine Fliege darüber.
- Schmutz **deckelt das Glück**: Höchstens 60 % + 0,4 × Sauberkeit sind zu sehen. Streicheln zählt trotzdem; nach dem Putzen zeigt der Balken wieder den vollen Wert. Unter 60 % schnuppert er an Häufchen und wendet sich mit „iih!“ ab, unter 30 % lässt er die Ohren hängen.
- Wann und wo Häufchen liegen, wird aus dem gespeicherten Zustand berechnet. Darum sehen alle Geräte dieselben Häufchen an denselben Stellen.

## Besuch

- **Vögelchen**: Alle paar Minuten fliegt ein kleines, rundes Rotkehlchen, eine Blaumeise oder ein Spatz im Bogen heran. Es landet auf Laterne, Schornstein, Schild, Blumenkasten, Hügelkuppe oder dem Aussichtsstein (je nach Areal andere Plätze), legt den Kopf schief, pickt, hüpft, plustert sich auf und zwitschert. Nach 15–45 Sekunden fliegt es weiter. Es kommt nur bei Tag und nicht bei Regen.
- **Maus**: Hinter dem Aussichtsstein schaut eine kleine Maus seitlich oder über die Kuppe hervor, schnuppert und wackelt mit den Ohren. Manchmal flitzt sie auf die Wiese, macht Männchen und läuft zurück. Sie kommt auch nachts, aber nicht bei Regen.
- Der Pika schaut hin, piepst das Vögelchen an (es zwitschert zurück) und geht neugierig ein Stück auf die Maus zu. Kommt er zu nah, flitzt sie mit „piep!“ zurück. Springt er auf den Stein, fliegt ein Vögelchen dort vorher weg.
- **Antippen** verscheucht Vögelchen und Maus.
- Die Besuche sind Zufall und laufen auf jedem Gerät für sich.

## Beschäftigungen

Höchstens alle 12–20 Minuten (die erste nach 2–6 Minuten) sucht er sich eine Beschäftigung:

- **Buch lesen** am Heuhaufen oder vor der Tür: Der Kopf wandert die Zeilen entlang, er blättert um und kichert. Nachmittags nickt er manchmal mit dem Buch ein. Streicheln weckt ihn.
- **Gameboy**: Die Daumen tippen, kleine Piepser steigen auf. Nach jeder Runde macht er einen Freudensprung („Juhu!“) oder lässt die Ohren hängen („mööp“).
- **Tablet**: Er liegt auf dem Bauch in der Wiese, das Display scheint ihm ins Gesicht, er wischt. Fliegt gerade ein echtes Flugzeug vorbei, zeigt das Tablet die Flugkarte, und er schaut zum Himmel.
- **Drachen** bei Wind ab 20 km/h, trocken und hell: Der Drache steigt in Windrichtung auf, schwankt mit Schwänzchen und zerrt an der Schnur.
- **Fernsehen** im Bau, bei Regen und Gewitter oder in der Dämmerung: Er sitzt mit dem Rücken zu uns im dunklen Eingang. Der Bildschirm leuchtet über seinem Kopf, sein Fell hat einen bunten Lichtsaum, beim Erdhügel flackert auch das Fenster. Ab und zu dreht er sich um und schaut heraus. Streicheln holt ihn kurz an die Tür.

## Flugzeuge

Echte Flüge aus der Umgebung ziehen über den Himmel. Die Daten kommen aus der [Flightradar24-Integration](https://github.com/AlexandrErohin/home-assistant-flightradar24) (HACS), Sensor `sensor.flightradar24_current_in_area`.

- **Position**: Osten links, Westen rechts. Der Bildrand liegt bei `flight_radius` (Standard 15 km, so groß wie der Radius der Integration).
- **Höhe und Größe**: Ein Anflug steht knapp über den Hügeln und ist groß, ein Flieger in Reiseflughöhe steht weit oben und ist klein, ab etwa 8000 m mit Kondensstreifen.
- **Bewegung**: Zwischen den Meldungen der Integration (alle 10–30 s) fliegen sie mit Kurs, Geschwindigkeit und Steig- oder Sinkrate weiter.
- **Antippen** blendet ein Fähnchen ein (nach 9 s geht es wieder zu): Flugnummer und Ziel, z. B. „EW 9542 → Palma de Mallorca“. Landet der Flug in der Nähe (unter 30 km), steht stattdessen die Herkunft da, z. B. „aus Katowice“. Darunter stehen Airline, Flugzeugtyp, Strecke, Höhe und Tempo. Ohne Antippen sieht man nur die Flugzeuge.
- **Aussehen**: Leitwerk in Airline-Farbe. Kleinflugzeuge und Hubschrauber haben eigene Grafiken. Nachts leuchten Kabinenfenster, Blitzer und Rundumleuchte. Bei bedecktem Himmel sind hohe Flieger nur blass zu sehen, bei Nebel alle.
- **Anzahl**: höchstens `max_flights` gleichzeitig (Standard 2), die nächsten zuerst. Flugzeuge am Boden zählen nicht.
- **Pika**: Er schaut tief fliegenden Flugzeugen nach und sagt manchmal „brumm!“. Ist eins ganz nah, erschrickt er kurz.

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
  - Bei Starkregen und Gewitter verkriecht er sich im Bau, schaut ab und zu heraus und erschrickt bei Blitzen.
  - Unter 3 °C trägt er einen Schal.
  - Bei Schnee knabbert er an seinem Heuvorrat.
- Im Sommer gibt es nachts Glühwürmchen.

## Areale

Mit `areal` wählst du den Bau:

- `huegel` (Standard): Grashügel mit runder Holztür, Namensschild, Rundfenster mit Blumenkasten und Laterne. Nachts brennt Licht, bei unter 12 °C und abends raucht der Schornstein.
- `fels`: Steinhaufen mit Steinbogen als Eingang
- `stumpf`: Baumstumpf mit Höhle zwischen den Wurzeln, Fliegenpilze leuchten nachts
- `alpin`: Geröllhalde mit Bergen im Hintergrund, Enzian und Edelweiß

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
sleep_start: sunset              # Schlafenszeit (Standard: Sonnenuntergang)
sleep_end: sunrise               # Aufwachzeit (Standard: Sonnenaufgang)
sun_entity: sun.sun              # Sonnenstand
weather_entity: weather.forecast_home   # Wetter (Standard: met.no-Integration)
areal: huegel                    # Bau: huegel, fels, stumpf, alpin
flight_entity: sensor.flightradar24_current_in_area   # Flugzeuge (leer = keine)
flight_radius: 15                # Radius der Flightradar24-Integration in km
max_flights: 2                   # höchstens so viele Flugzeuge gleichzeitig
show_stats: true                 # Satt-/Glück-/Sauber-Balken
height: 180                      # Mindesthöhe in px (im Abschnitts-Layout zählt die Zeilenhöhe)
```

Für `sleep_start` und `sleep_end` gehen feste Uhrzeiten (`"21:00"`) oder `sunset`/`sunrise` aus `sun.sun`, auch mit Versatz: `"sunset+01:00"` (eine Stunde nach Sonnenuntergang), `"sunrise-30"` (30 Minuten vor Sonnenaufgang). Ohne `sun.sun` gilt 21:00 bis 07:00.

Im Text-Helfer steht der Zustand als `satt,zeit,glück,zeit,großputz,maske,teilputz` (Zeiten in Sekunden). Hunger, Glück und Häufchen werden daraus beim Anzeigen berechnet, deshalb braucht es keine Automation. Ältere Werte mit vier Feldern werden weiter gelesen.

## Entwicklung

`preview.html` lädt die Karte mit einem simulierten `hass`-Objekt. Die Häufchen-Knöpfe stellen die Uhr der Häufchen vor (nächstes Häufchen, +4 Std., +1 Tag), die Besuch-Knöpfe holen Vögelchen und Maus sofort, die Hobby-Knöpfe starten eine Beschäftigung sofort (auch ohne passendes Wetter), die Flieger-Knöpfe schicken Testflüge los (Anflug, Abflug, Reiseflug, Hubschrauber, Kleinflugzeug). Dafür den Ordner über einen beliebigen lokalen Webserver öffnen. `areale.html` zeigt alle vier Areale nebeneinander.
