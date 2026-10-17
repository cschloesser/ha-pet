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

## Freund-Pika

Ein paarmal am Tag kommt **Pino** zu Besuch, ein Freund-Pika: etwas kleiner, rötlicher und mit hellem Fleck auf der Stirn.

- **Wann**: Der erste Besuch kommt 2–5 Minuten nach dem Laden, danach liegen 25–60 Minuten zwischen zwei Besuchen. Pino bleibt 1,5–4 Minuten. Er kommt nur, wenn der Pika wach ist, es Tag ist und es nicht regnet oder gewittert.
- **Ankunft**: Pino hoppelt vom linken oder rechten Rand herein und piepst. Der Pika bemerkt ihn, ruft „Pino!“, hoppelt zu ihm, und die beiden stupsen sich mit den Nasen an (Herzchen).
- **Zusammen spielen**: Meistens spielen sie miteinander, ab und zu macht der Pika auch etwas allein.
  - **Fangen**: Abwechselnd hoppelt einer davon und der andere hinterher, mit kleinen Staubwölkchen.
  - **Zusammen sitzen**: Die beiden sitzen nebeneinander, schauen in dieselbe Richtung und wackeln mit den Ohren. Einer putzt den anderen.
  - **Aussichtsstein**: Der Pika springt auf den Stein und pfeift, Pino schaut von unten hoch und piepst zurück. Manchmal hüpft Pino hinterher und setzt sich hinter ihn.
  - **Knabbern**: Der Pika pflückt eine Blume, Pino knabbert an einer anderen oder von der anderen Seite an derselben.
  - **Piep-Duett**: Die beiden piepsen abwechselnd, immer schneller, zum Schluss zusammen.
- **Pinos Eigenleben**: Ist der Pika mit etwas anderem beschäftigt, hoppelt Pino herum, putzt sich, schaut sich um, piepst, blinzelt und zuckt mit den Ohren. Er bleibt auf der Wiese und geht nicht in den Bau.
- **Antippen** streichelt Pino: Herzchen, ein kleiner Freudensprung und ein Piep. Die Balken des Pikas ändern sich dadurch nicht. Wird der Pika gestreichelt, kommt Pino neugierig näher und schaut zu.
- **Abschied**: Pino sagt „tschüss!“ und hoppelt zum Rand hinaus. Der Pika schaut ihm nach und lässt kurz die Ohren hängen. Geht der Pika schlafen oder schlägt das Wetter um, geht Pino sofort.
- Die Besuche laufen auf jedem Gerät für sich. Mit `friend: false` kommt Pino nicht, mit `friend_name` bekommt er einen anderen Namen.

## Beschäftigungen

Höchstens alle 12–20 Minuten (die erste nach 2–6 Minuten) sucht er sich eine Beschäftigung:

- **Buch lesen** am Heuhaufen oder vor der Tür: Der Kopf wandert die Zeilen entlang, er blättert um und kichert. Nachmittags nickt er manchmal mit dem Buch ein. Streicheln weckt ihn.
- **Gameboy**: Die Daumen tippen, kleine Piepser steigen auf. Nach jeder Runde macht er einen Freudensprung („Juhu!“) oder lässt die Ohren hängen („mööp“).
- **Tablet**: Er liegt auf dem Bauch in der Wiese, das Display scheint ihm ins Gesicht, er wischt. Fliegt gerade ein echtes Flugzeug vorbei, zeigt das Tablet die Flugkarte, und er schaut zum Himmel.
- **Drachen** bei Wind ab 20 km/h, trocken und hell: Der Drache steigt in Windrichtung auf, schwankt mit Schwänzchen und zerrt an der Schnur.
- **Fernsehen** im Bau, bei Regen und Gewitter oder in der Dämmerung: Er sitzt mit dem Rücken zu uns im dunklen Eingang. Der Bildschirm leuchtet über seinem Kopf, sein Fell hat einen bunten Lichtsaum, beim Erdhügel flackert auch das Fenster. Ab und zu dreht er sich um und schaut heraus. Streicheln holt ihn kurz an die Tür.

## Haus-Bote

Der Pika zeigt, was Waschmaschine, Trockner und Spülmaschine (Home Connect) gerade machen. Jedes Gerät bekommt ein kleines Requisit am Bau:

| Gerät | Läuft | Fertig, noch zu | Ausgeräumt |
|---|---|---|---|
| Waschmaschine | Holzzuber mit Seifenschaum, Blasen steigen auf | Korb mit nasser Wäsche daneben, es tropft | Wäscheleine mit vier bunten Stücken, die im Wind wehen |
| Trockner | Holztrommel auf einem Gestell dreht sich, im Bullauge purzeln Socken, warme Luft steigt auf | Stapel flauschiger Handtücher, der dampft | Trommel mit offener Luke |
| Spülmaschine | Tisch mit Spülschüssel, ein Teller taucht ein | Stapel glänzender Teller, der funkelt | leere Schüssel, Geschirrtuch über der Tischkante |

- **Läuft**: Unter dem Requisit zeigt ein schmaler Balken den Fortschritt (ohne Prozentwert läuft er hin und her). Ab und zu beschäftigt sich der Pika damit: Er rührt im Zuber und bekommt eine Seifenblase auf die Nase, legt sich vor die Trommel und schaut ihr zu (die Augen drehen mit), oder er tunkt einen Teller in die Schüssel. Bei Pause und Startvorwahl steht alles still, bei Störung oder „Hilfe nötig“ blinkt ein rotes Ausrufezeichen.
- **Fertig**: Das Requisit hüpft alle paar Sekunden kurz. Der Pika hoppelt alle 3–6 Minuten hin, tätschelt oder stupst es, dreht den Kopf zu dir und sagt Bescheid („Wäsche!“, „flauschig!“, „Geschirr!“, „fertig!“).
- **Ausgeräumt**: Sobald das Gerät nicht mehr auf „fertig“ steht oder die Tür aufgeht, ist es ausgeräumt. Siehst du gerade zu, räumt der Pika sichtbar mit auf: Er hängt die Wäsche Stück für Stück an die Leine, trägt ein Handtuch in seinen Bau oder poliert einen Teller und bringt ihn hinein. Danach freut er sich. Alle anderen Geräte zeigen das Ausgeräumt-Requisit, solange das Gerät seit weniger als 20 Minuten auf `ready` oder `inactive` steht (aus `last_changed`). Danach verschwindet alles bis zum nächsten Lauf.
- **Antippen** eines Requisits blendet ein Fähnchen ein (nach 9 s geht es wieder zu): Gerätename und Stand, z. B. „62 % · fertig um 14:35“, „fertig seit 35 Min“ oder „ausgeräumt“.
- Mehrere Geräte stehen nebeneinander zwischen Eingang und Heuhaufen, auf der Wiese vor dem Stein und links neben dem Eingang. Wird es eng, werden alle etwas kleiner.

```yaml
appliances:
  - type: washer                 # washer | dryer | dishwasher
    name: Waschmaschine          # optional, Standard je Typ: Waschmaschine / Trockner / Spülmaschine
    state: sensor.waschmaschine_betriebszustand
    progress: sensor.waschmaschine_programm_fortschritt   # optional, Fortschritt in %
    end: sensor.waschmaschine_programm_endzeit             # optional, Endzeit (Zeitstempel)
  - type: dryer
    state: sensor.trockner_betriebszustand
    progress: sensor.trockner_programm_fortschritt
    end: sensor.trockner_programm_endzeit
  - type: dishwasher
    state: sensor.geschirrspuler_betriebszustand
    progress: sensor.geschirrspuler_programm_fortschritt
    end: sensor.geschirrspuler_programm_endzeit
    door: sensor.geschirrspuler_tur                        # optional, open/closed/locked oder on/off
```

Betriebszustände: `run`, `pause`, `delayedstart`, `actionrequired`, `error`, `aborting` zählen als „läuft“, `finished` als „fertig“, `ready` und `inactive` als „aus“. Schaltet sich ein Gerät nach dem Ausräumen ab (`ready` → `inactive`), verlängert das die 20 Minuten nicht. Ohne `appliances` passiert nichts.

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
- **Glühwürmchen** in Sommernächten (Mai bis September): 10 bis 14 Stück schwirren tief über der Wiese und um den Heuhaufen und blinken unregelmäßig gelbgrün, in der späten Dämmerung schon ein paar schwächer. Bei Regen und Gewitter verschwinden sie. Ist der Pika wach, setzt er sich hin, schaut ihnen nach und hüpft nach einem.
- **Sternschnuppen** nachts bei klarem Himmel (nicht bei dichter Bewölkung, Nebel, Regen oder Schnee): alle paar Minuten eine, ab und zu ein heller Bolide, der kurz aufleuchtet, selten zwei kurz nacheinander. Ein wacher Pika schaut manchmal hoch: „oh!“

## Areale

Mit `areal` wählst du den Bau:

- `huegel` (Standard): Grashügel mit runder Holztür, Namensschild, Rundfenster mit Blumenkasten und Laterne. Nachts brennt Licht, bei unter 12 °C und abends raucht der Schornstein.
- `fels`: Steinhaufen mit Steinbogen als Eingang
- `stumpf`: Baumstumpf mit Höhle zwischen den Wurzeln, Fliegenpilze leuchten nachts
- `alpin`: Geröllhalde mit Bergen im Hintergrund, Enzian und Edelweiß

## Festtage

Über das Jahr schmückt der Pika seinen Bau. Alles richtet sich nach dem Datum in Ortszeit, ist reine Zierde (kostet keine Werte, wird nicht gesammelt) und passt sich Tag und Nacht an. Mit `festive: false` bleibt nur der Geburtstag.

| Wann | Deko | Pika |
| --- | --- | --- |
| **Halloween** 24.–31. 10. | geschnitzter Kürbis neben der Tür, nachts leuchtet das Gesicht flackernd | schnuppert am Kürbis, erschrickt („huch!“), kichert; am 31. 10. mit Hexenhut, nachts flattern Fledermäuse über den Himmel |
| **St. Martin** 11. 11. | bunte Papierlaterne hängt am Bau, leuchtet abends | ab 16 Uhr zieht er mit einer Laterne am Stab über die Wiese: „Laterne, Laterne…“ |
| **Advent** 1. Advent bis 24. 12. | Adventskranz vor dem Bau, so viele Kerzen brennen, wie Adventssonntage waren; Lichterkette an der Bau-Oberkante (bis 6. 1., leuchtet in Dämmerung und Nacht) | |
| **Nikolaus** 5. 12. ab 18 Uhr, 6. 12. | Stiefel vor der Tür, am 6. 12. gefüllt (Löwenzahn, Nüsse, Zuckerstange) | schaut hinein und freut sich („oh!“) |
| **Weihnachten** 24.–26. 12. | Tannenbaum mit Kugeln, Lichterkette und Stern zwischen Heu und Stein, Geschenk darunter | trägt eine Weihnachtsmütze (auch beim Schlafen statt der Zipfelmütze), staunt vor dem Baum |
| **Silvester** 31. 12. ab 23:55 bis 1:00 | Feuerwerk: Raketen, bunte Kugeln mit Funken, Lichtschein auf der Wiese, um Mitternacht ein Finale; am 1. 1. liegen zwei abgebrannte Raketenstäbe im Gras | wacht um Mitternacht auf, schaut aus dem Bau, zuckt bei jedem Knall: „Frohes Neues!“, dann schläft er weiter |
| **Karneval** Weiberfastnacht bis Aschermittwoch | Luftschlangen am Bau, alle paar Minuten regnet Konfetti | Partyhütchen, hüpft im Konfetti: „Helau!“ |
| **Ostern** Karfreitag bis Ostermontag | 4–6 bunt bemalte Eier im Gras (antippen = wackeln) | hoppelt hin, schnuppert, stupst ein Ei an |
| **Maibaum** 30. 4. ab 18 Uhr, 1. 5. | Maibaum mit Kranz hinter dem Bau, die Bänder wehen mit dem Wind | |
| **Sommerfest** 21. 6. | Wimpelkette zwischen Bau und Stein | macht öfter Freudensprünge |
| **Geburtstag** (`birthdays`) | Kuchen mit Kerze vor dem Bau, Girlande „ALLES ♥ GUTE“ | Partyhütchen, pustet die Kerze aus (nach 20 s brennt sie wieder): „Alles Gute, Kim!“ |

Geburtstage stehen in der Konfiguration, mehrere am selben Tag werden zusammen gefeiert („Alles Gute, Kim und Tom!“). Das Datum geht als `MM-TT`, `JJJJ-MM-TT` oder `TT.MM.`; wer am 29. 2. Geburtstag hat, feiert sonst am 28. 2.

```yaml
birthdays:
  - name: Kim
    date: "03-14"
  - name: Tom
    date: "11-02"
```

In `preview.html` stellen die Festtage-Knöpfe die Uhr der Karte auf den jeweiligen Tag (Karneval und Ostern im aktuellen Jahr berechnet), „Mitternacht“ zeigt das Aufwachen zum Feuerwerk, „Aktion!“ startet die passende Fest-Aktion sofort, „Heute“ stellt die echte Zeit wieder her.

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
shooting_stars: true             # Sternschnuppen nachts bei klarem Himmel
fireflies: true                  # Glühwürmchen in Sommernächten
areal: huegel                    # Bau: huegel, fels, stumpf, alpin
flight_entity: sensor.flightradar24_current_in_area   # Flugzeuge (leer = keine)
flight_radius: 15                # Radius der Flightradar24-Integration in km
max_flights: 2                   # höchstens so viele Flugzeuge gleichzeitig
festive: true                    # Festtage-Deko im Jahreslauf (false = nur Geburtstage)
birthdays:                       # Geburtstage: Kuchen, Girlande, „Alles Gute, Kim!“ (Datum MM-TT)
  - { name: Kim, date: "03-14" }
show_stats: true                 # Satt-/Glück-/Sauber-Balken
friend: true                     # Freund-Pika kommt zu Besuch (false = nie)
friend_name: Pino                # Name des Freund-Pikas
height: 180                      # Mindesthöhe in px (im Abschnitts-Layout zählt die Zeilenhöhe)
appliances:                      # Waschmaschine, Trockner, Spülmaschine, siehe Haus-Bote
```

Für `sleep_start` und `sleep_end` gehen feste Uhrzeiten (`"21:00"`) oder `sunset`/`sunrise` aus `sun.sun`, auch mit Versatz: `"sunset+01:00"` (eine Stunde nach Sonnenuntergang), `"sunrise-30"` (30 Minuten vor Sonnenaufgang). Ohne `sun.sun` gilt 21:00 bis 07:00.

Im Text-Helfer steht der Zustand als `satt,zeit,glück,zeit,großputz,maske,teilputz` (Zeiten in Sekunden). Hunger, Glück und Häufchen werden daraus beim Anzeigen berechnet, deshalb braucht es keine Automation. Ältere Werte mit vier Feldern werden weiter gelesen.

## Entwicklung

`preview.html` lädt die Karte mit einem simulierten `hass`-Objekt. Die Häufchen-Knöpfe stellen die Uhr der Häufchen vor (nächstes Häufchen, +4 Std., +1 Tag), die Besuch-Knöpfe holen Vögelchen und Maus sofort, die Hobby-Knöpfe starten eine Beschäftigung sofort (auch ohne passendes Wetter), die Flieger-Knöpfe schicken Testflüge los (Anflug, Abflug, Reiseflug, Hubschrauber, Kleinflugzeug). Dafür den Ordner über einen beliebigen lokalen Webserver öffnen. `areale.html` zeigt alle vier Areale nebeneinander.
