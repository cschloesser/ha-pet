# Änderungen

Jede Version der Pika Pet Card, die neueste zuerst.

## 0.37.0 (2026-11-12)

Haus-Signale: Was im Haus passiert, sieht man auch beim Pika. Eine eigene Schicht neben dem Haus-Boten, in der ein Zustand in HA ein Requisit, eine Pose oder einen Spruch auslöst und er nach festen Regeln daran erinnert. Die ersten vier Signale passen zu dem, was das Haus hergibt (gesucht und 7 Tage Verlauf gelesen): Müllabfuhr-Kalender, Wettervorhersage, Saugroboter, Kontakt an der Haustür. Eine Türklingel und eine PV-Anlage gibt es nicht, „Lüften“ wechselte in 7 Tagen nur zweimal und bleibt weg, ebenso eine Begrüßung mit Namen (der Standort einer Person sprang mehrmals für wenige Minuten, und das Audit hatte Anwesenheit ausgeschlossen).

- Neue Option `signals` (Standard: nichts; im Editor die Gruppe „Haus-Signale“): `waste` (Kalender), `wardrobe` (true), `vacuum` (vacuum.*), `door` (binary_sensor.*).
- Mülltonne: ab 14 Uhr am Tag vor der Abholung bis zu ihrem Beginn rechts vorn, Farbe aus dem Namen (Wertstoff gelb, Rest grau, Bio braun, Papier blau, Glas grün). Er erinnert wach alle 8–12 Minuten (hinhoppeln, anstupsen, „Tonne raus!“). Antippen = „steht draußen“, auf allen Geräten: das Bit `tonne` in den Erlebnissen des Tags (`cute.m`). Damit das auch am Morgen der Abholung gilt, wenn um 6 Uhr jemand streichelt und ein neuer Pika-Tag beginnt, nimmt der neue Tag es als `tonne2` mit (einmal, nicht weiter). Beide Bits behalten auch ältere Karten; das Mitnehmen über 4 Uhr können sie nicht. Kein zusätzliches Zeichen im Tagesplan (die Erlebnisse brauchen höchstens eins mehr, gemessen: Vollplan weiter unter 255, ohne Verlauf unter `PLAN_MIN`). Gelesen wird `calendar.abfall` wie am 12. 11.: `start_time` „2026-11-18 07:00:00“, `message` „Wertstofftonne“.
- Garderobe: 6 bis 10 Uhr links an der Tür, aus der stündlichen Vorhersage für 7 bis 19 Uhr: Gummistiefel ab 0,5 mm Regen, Schirm ab 2 mm, Mütze und Schal ab 3 °C oder kälter, Sonnenhut ab UV 5. Wach probiert er alle 20–40 Minuten etwas an und hält es hoch („Gummistiefel heute!“). Die Vorhersage kommt über `weather/subscribe_forecast` (stündlich); met.no lieferte am 12. 11. 48 Stunden mit Temperatur, Niederschlag und UV, ohne Regenwahrscheinlichkeit. Für den 13. 11. (7 Uhr 2,3 °C, trocken) wäre es die Mütze.
- Saugroboter: `cleaning` fährt ein kleiner Roboter vorn hin und her (ein Fünftel der Kartenhöhe je Sekunde, an den Enden kurz warten), `returning` rollt er links hinaus, `paused`/`idle` steht er, `error` blinkt er rot. Wach springt der Pika höchstens alle 5 Minuten auf und fährt ein Stück mit, bei einer Störung schiebt er an. Im Tagebuch jeder Lauf von `cleaning` bis `docked` mit Dauer; Läufe unter 2 Minuten zählen nicht, Läufe mit weniger als 10 Minuten Abstand sind einer (am 11. 11. abends dreimal kurz hintereinander gestartet: ein Lauf von 13 Minuten).
- Haustür: Öffnen (`off` → `on`, höchstens 30 Sekunden alt) lässt ihn die Ohren spitzen und zum Rand schauen („Hallo?“), im Schlaf zuckt ein Ohr. Höchstens alle 2 Minuten, nur aus ruhigen Aktionen heraus. Nicht im Tagebuch. Am Haus etwa sechsmal am Tag.
- Nachts und im Schlaf ruhig, im Urlaub ruhen Tonne, Garderobe und Tür (der Roboter fährt ohne Reiter). Die Haushaltsgeräte rücken nicht unter die Tonne.
- Vorschau: Zeile „Haus-Signale“ (Tonne in 2 Std., Garderobe kalt/Regen/Sonne, Sauger putzt/heim/steckt fest/Station, Mitfahren, Haustür auf).
- Entwicklung: 76 Module (je ein neues `signale.js` in `src/logik/`, `src/karte/`, `src/grafik/` und `src/stil/`), 130 Tests (3 neue mit Daten aus dem Haus), grün auch mit `TZ=Asia/Tokyo`, `TZ=UTC` und `TZ=America/Santiago`.

## 0.36.0 (2026-11-12)

Ein Haus-Bote, der mitdenkt: Ausgeräumt ist, was wirklich ausgeräumt ist, auch nach dem Neuladen; über jedem Gerät steht, wie lange es noch dauert; nasse Wäsche wird lauter statt leiser; und der zweite Kaffee stellt sich hinten an. Geprüft am Verlauf der drei Geräte im Haus (7 Tage aus dem Recorder) und an den Befunden des Audits (dort Etappe „0.34“).

- Befund, neu gefunden im Verlauf: Die Spülmaschine (Home Connect) meldet eine Minute nach „fertig“ von selbst „ready“, die Tür bleibt zu (Sa 7. 11. 22:59:53 → 23:00:53, Mi 11. 11. 17:47:14 → 17:48:14). Die Karte hielt sie damit für ausgeräumt; ausgeräumt wurde am nächsten Mittag bzw. um 20:28. Jetzt gilt für Geräte mit Tür `empty_on: door` (Standard, sobald `door` eingetragen ist): fertig, bis die Tür nach Programmende aufgeht, auch über „ready“ hinweg, höchstens einen Tag lang. Den AutoOpen-Spalt der ersten 2 Minuten ignoriert der Pika weiter; das Schließen danach zählt immer (sonst bliebe „fertig“, wer gleich nach dem Ende ausräumt und zumacht). Ohne Tür bleibt es bei `empty_on: idle` (fertig → aus), so ändert sich bei Waschmaschine und Trockner nichts.
- Befund: Nach dem Neuladen galt jede Änderung der Tür nach Programmende als Öffnen. Bei der Spülmaschine springt die Tür ab und zu kurz auf `unavailable` und zurück auf `closed` (Mi 11. 11. 17:50:06/07, drei Minuten nach dem Ende): Ein Gerät, das danach lud, zeigte „ausgeräumt“. Jetzt liest die Karte beim Laden einmal den Verlauf von Zustand und Tür der letzten 24 Stunden (ein Abruf je Gerät mit Haus-Boten) und spielt ihn mit denselben Regeln nach, ohne etwas zu zeigen oder zu melden. Bis er da ist (oder wenn er scheitert) zählt nach dem Laden nur eine Tür, die jetzt offen ist; ein Gerät mit Tür, das schon „aus“ meldet, gilt dann nicht als ausgeräumt.
- Befund: Fristen liefen ab dem Eintreffen der Meldung. Ein eingefrorener Handy-Tab, der Stunden später aufwachte, räumte dann sichtbar auf, was längst ausgeräumt war. Jetzt gilt der Zeitpunkt in HA (`last_changed` von Zustand bzw. Tür), sichtbar mit aufgeräumt wird nur, was höchstens 3 Minuten her ist.
- Befund: Fortschritt und Endzeit vom letzten Lauf zählten beim nächsten Start mit: Ein Abbruch gleich danach galt mit „100 %“ als Programmende. Jetzt zählen nur Werte, die nach dem Start gemeldet wurden. Bei den Geräten im Haus kam das nicht vor (ihr Fortschritt steht im Ruhezustand auf `unavailable`, nach dem Start erst `unknown`, dann 0).
- Befund: Einschalten konnte nach dem Neuladen als ausgeräumt gelten, wenn das Gerät beim Einschalten einen alten Fortschritt von 100 neu meldete. Jetzt muss der Fortschritt mindestens 30 Sekunden vor dem Ausschalten gekommen sein. Bei den Geräten im Haus kam auch das nicht vor.
- Befund: Im Fähnchen stand „fertig um 14:35“, auch wenn 14:35 schon vorbei war. Jetzt „gleich fertig“.
- Befund: Im Tagebuch stand „fertig“ zweimal, wenn der Trockner im Knitterschutz kurz „pause“ meldete. Jetzt gilt dort wie live: fertig → Pause → fertig ist ein Ende. (In den 7 Tagen im Haus kam es nicht vor.)
- Befund: Die Erinnerung wurde leiser statt lauter: Nach einer Stunde stand alles still, er erinnerte nur noch alle 20–30 Minuten. Für nasse Wäsche jetzt umgekehrt: ab 30 Minuten Müffel-Wölkchen über dem Korb, ab 2 Stunden mehr und dichter, und beim Erinnern hält er sich die Nase zu („puh!“). Er erinnert weiter alle 3–6 Minuten, nachts und im Schlaf ruht es. Trockner und Spülmaschine bleiben, wie sie waren (nach einer Stunde ruhig): Trockene Handtücher und sauberes Geschirr haben keine Eile.
- Befund: Ein zweiter Kaffee kurz nach dem ersten verfiel. Er wurde seit 0.17 zwar eingereiht, behielt aber seine Zeitleiste ab seinem eigenen Bezugsende; bis der Pika den ersten ausgetrunken hatte, war sie zum Teil oder ganz um. Gerechnet: Ein Espresso eine halbe Minute nach einem Latte (Bezug 1:43 wie am 12. 11.) verfiel meist ganz, ein zweiter Latte wurde nur halb getrunken. Jetzt beginnt seine Zeitleiste 15 Sekunden nach dem letzten Schluck des ersten (`coffeeQueue`); jedes Gerät, das beide Bezüge sah, rechnet gleich. In der Vorschau gemessen: Der Espresso beginnt 213 Sekunden nach dem Ende seines Bezugs, direkt nach dem Latte. Grenze: Ein Gerät, das genau in diesen Minuten neu lädt, kennt nur den letzten Bezug und trinkt ihn nach dessen eigener Zeitleiste.
- Schilder: Über jedem Gerät steht die Restzeit („0:42“, aus der Endzeit), ohne Endzeit der Fortschritt („62 %“), angehalten „Pause“, „wartet“, „Hilfe!“ oder „Störung“, fertig „fertig“, „fertig 35 Min“, „fertig 2 Std.“ (gelb hinterlegt). Schrift fett, Ziffern gleich breit, 6,8 % der Kartenhöhe, zwischen 11 und 20 px (in der Vorschau bei 248 px Höhe 16,9 px).
- Neue Option `appliance_labels` (im Editor „Anzeige an den Geräten“, eine Auswahl): `all` (Standard) Fortschrittsbalken, Restzeit und „fertig“; `done` nur das Schild „fertig“, ohne Balken und Restzeit, für ein Dashboard, das Fortschritt und Restzeit schon zeigt (dass ein Gerät fertig ist, sieht man dem Requisit allein nicht sofort an); `none` nichts davon, auch kein Balken. `true`/`false` und `2`/`1`/`0` gehen auch. Den Fortschrittsbalken unter dem Requisit gab es schon vorher; ohne Balken, aber mit Restzeit-Schild geht nicht.
- Neue Optionen je Gerät: `empty_on` (`door` oder `idle`; `door` ohne `door` geht nicht, Hinweis in der Konsole) und `state_map` (eigene Zustandsnamen auf die von Home Connect, z. B. `{ Spülen: run, Ende: finished }`; auch im Tagebuch). Ausgeräumt per Antippen (`empty_on: tap`, für Steckdosen-Sensoren) gibt es nicht: Es bräuchte etwa 6 Zeichen im Tagesplan, und die Geräte im Haus brauchen es nicht.
- Gespeichert wird nichts Neues: Alles folgt aus den Zuständen in HA und dem Recorder, darum zeigen alle Geräte dasselbe. Die Chronik bleibt, wie sie ist.
- Vorschau: Waschmaschine „fertig seit 40 Min“ und „seit 2½ Std.“, Spülmaschine „fertig → ready nach 1 Min (Tür zu)“ und „Tür kurz unavailable“, „Schilder: alles → nur fertig → nichts“, „Neuladen (Verlauf nachspielen)“, Kaffee „Latte, gleich danach Espresso“.
- Entwicklung: 127 Tests (5 neue, zwei davon mit den Verläufen aus dem Recorder), grün auch mit `TZ=Asia/Tokyo`, `TZ=UTC` und `TZ=America/Santiago`. Die Regeln (`boteState`, `boteMap`, `boteEmptyOn`, `boteLabel`, `boteLabelMode`, `boteSmell`, `coffeeQueue`) liegen als reine Funktionen in `src/logik/`.

## 0.35.1 (2026-11-12)

Jeder Kaffee im Tagebuch: Bisher stand dort nur der erste Kaffee des Tags. Das Tagebuch kannte Kaffee nur als ein Bit im Tagesplan („heute Kaffee“), das beim ersten Bezug gesetzt wird; der zweite Latte macchiato um 8:55 am 12. 11. änderte nichts mehr und kam darum nicht vor.

- Das Tagebuch liest jetzt beim Aufschlagen auch den Verlauf des aktiven Programms des Kaffeeautomaten (`coffee.active`, im selben Abruf wie die Helfer und die Haushaltsgeräte). Jeder Bezug steht mit Uhrzeit und Getränk da („8:57 · Latte macchiato“), der erste des Tags mit den bisherigen Sätzen, jeder weitere mit „Noch ein Kaffee! …“, „Schon wieder Kaffeeduft …“ oder „Kaffee Nummer 2 …“. Gespeichert wird dafür nichts, auch nicht im Tagesplan.
- Ein Bezug ist, wie live erkannt, ein Getränkeprogramm, das 15 Sekunden bis 15 Minuten lief und dann in einen anderen Zustand als „unavailable“ wechselte; auch zwei Getränke ohne Pause dazwischen. Nicht dazu: Spülen und Reinigen (kein Getränkeprogramm), ein Programm, das schon zu Beginn des gelesenen Verlaufs lief, eins nach einem Neustart von HA (kam aus „unavailable“) und eins, das in „unavailable“ endete.
- Gemessen am Recorder vom 12. 11. 2026: aktives Programm 7:08:39 bis 7:10:22 und 8:55:19 bis 8:57:02 Latte macchiato, dazwischen „unknown“. Das ergibt zwei Einträge, 7:10 und 8:57 (Ende des Bezugs, dann holt er sich seine Tasse).
- Liefert der Recorder für das Programm keinen einzigen Stand, steht wie bisher nur der erste Kaffee da (aus dem Tagesplan). Während eines Urlaubs steht kein Kaffee im Tagebuch, mit `diary_house: false` wie bisher keiner. Die Chronik bleibt, wie sie ist.
- Entwicklung: 122 Tests (einer neu, mit dem echten Verlauf vom 12. 11.).

## 0.35.0 (2026-11-12)

Faire Päckchen: Gold hängt an sieben guten Tagen statt an sieben lückenlosen, der Fortschritt ist zu sehen, Pech hat eine Grenze, Meilensteine werden gefeiert, und wer verreist, schickt den Pika so lange zu Pino. Dazu fünf Befunde aus dem Audit (dort Etappe „0.33“), alle vorher am Code nachgestellt.

- Gute Tage (Freundschaftstage): Ein Pika-Tag ist gut, wenn er gefüttert und gestreichelt wurde und einmal alle drei Werte zugleich über 50 % lagen. Er zählt in dem Augenblick, in dem das zusammenkommt; ein Riss der Pflege-Serie ist dafür egal. Jeder siebte gute Tag bringt ein goldenes Päckchen (höchstens zwei im Vorrat), die Tage müssen nicht am Stück sein und zählen nur hoch. Gerechnet für einen Werktag im November (aufwachen 7:40, schlafen 16:40, gefüttert vor der Arbeit, zurück um 17:30): Sauber fällt gegen 13:10 unter 50 %, die Serie reißt gegen 14:10. Mit „sieben Tage am Stück“ gab es so werktags nie Fortschritt, jetzt ist jeder dieser Tage gut. Die normalen Päckchen (alle 6 Stunden Wachzeit ohne Riss) bleiben, wie sie waren.
- Übernahme: Die erste Karte mit 0.35 macht die ganzen Tage der laufenden Serie einmal zu Freundschaftstagen (`gmig`). Der Weg zum nächsten goldenen geht so nicht verloren; mit dem Stand im Helfer vom 12. 11. (Serie seit dem 9. 11.) sind es 2 von 7. Vorrat, Album, Stufen und goldene Schätze bleiben unangetastet. Das alte Feld `d` (belohnte Wochen) schreibt 0.35 nicht mehr fort.
- Fortschritt sichtbar: Im Album stehen sieben Punkte bis zum goldenen Päckchen, die Zahl der Freundschaftstage und was heute noch fehlt („Heute: gefüttert ✓ · gestreichelt – · alles über 50 % ✓“), dazu die ausgepackten Päckchen und der nächste Meilenstein. Läuft die Toleranz, zeigt der Ring am Knopf in Orange, wie viel davon übrig ist, und das Album nennt die Minuten („noch 42 Min. Toleranz: bitte füttern“).
- Pech-Schutz: nie mehr als zwei Leckerli hintereinander (`giftTre`, hängt nur an der Nummer des Päckchens, auf allen Geräten gleich). Bis 0.34 waren bis zu vier möglich. Weil der Schutz die Schätze nach vorn zieht, ist knapp jedes zweite Päckchen ein Schatz (gemessen: 894 der ersten 2000, vorher eins von dreien); das Album füllt sich entsprechend schneller.
- Meilensteine: Das 10., 25., 50. und 100. ausgepackte Päckchen (danach jedes hundertste) feiert er mit Konfetti, zwei Luftsprüngen und Herzchen („Mein 10. Päckchen!“), ebenso den letzten goldenen Schatz („Alles golden!“, dabei funkeln alle Schätze in der Szene). Beides steht im Tagebuch. Gespeichert wird dafür nichts, es folgt aus Album, Stufen und Zahl der ausgepackten.
- Urlaub bei Pino: Im Tagebuch (Seite Heute, unten) schaltet „Ferien bei Pino“ mit Rückfrage den Urlaub für alle Geräte ein, oben auf derselben Seite holt „Zurückholen“ ihn zurück. Solange er läuft, sinken Satt und Glück nicht (der Abbau rechnet die Urlaubszeit heraus, `_decayH`), Häufchen bleiben auf dem Stand vom Beginn, die Serie wartet, der Blütenvorrat verfällt nicht, Pino kommt nicht. Wer zusieht, sieht ihn winken und aus dem Bild hoppeln, an der Tür hängt ein Schild „Bin bei Pino“. Futterknopf, Häufchen und Päckchen-Knopf antworten mit „nein“, das Schild mit „Bin bei Pino!“; Füttern holt ihn absichtlich nicht zurück. Bei der Rückkehr rücken Fortschritt und schon verbrauchte Toleranz der Serie um die Urlaubszeit (dieselbe Wachzeit, rückwärts gerechnet: `_awakeBack`), der Zustand wird neu angesetzt (Werte von der Abreise, alles sauber), er hoppelt herein („Da bin ich wieder!“), und nach einem Urlaub ab einer halben Stunde steckt 24 Stunden lang eine Postkarte an der Tür (Sommer: Meer, sonst Berge). Im Tagebuch stehen Abreise, „Ich bin bei Pino.“ an jedem Tag dort und die Rückkehr mit der Postkarte; das Neuansetzen zählt nicht als Putzen, Hunger und Geheimnisse gibt es in der Urlaubszeit nicht, ein Urlaub unter einer halben Stunde steht gar nicht da.
- Neue Option `vacation` (Standard `true`, im Editor „Urlaubsschalter“): `false` blendet den Schalter aus. Ein laufender Urlaub gilt trotzdem auf diesem Gerät, sonst rechneten die Geräte verschieden. Ohne Tagebuch und mit `entity`, aber ohne `plan_entity` gibt es keinen Schalter.
- Format: Der Zustandshelfer bleibt, wie er war (ein achtes Feld läse eine frisch geladene 0.34-Karte als ungültig und überschriebe den Helfer mit Startwerten). Im Tagesplan kommt dazu, und zwar so, dass 0.34 nichts davon zerstört: die Freundschaftstage als f + 1 in den Bits ab 8 von `u` (0.34 rechnet mit `u` nur über Bits und schreibt die Zahl unverändert zurück), die Kennung des Schenkers mit „_“ hinter `x` (0.34 lässt sie weg), das Bit 9 „gut“ in den Erlebnissen des Tags (bleibt erhalten) und der Urlaub als siebter Abschnitt `u<Beginn>` bzw. nach der Rückkehr 24 Stunden lang `u<Beginn>.<Minuten>`. Eine 0.34-Karte hält einen siebten Abschnitt für das Format einer neueren und schreibt den Plan dann nicht: Während des Urlaubs kann ein vergessenes Gerät mit alter Karte so weder die Serie reißen noch den Urlaub herauslöschen. Schreibt es genau in der Sekunde des Einschaltens, trägt eine neue Karte den Urlaub wieder ein (bis 15 Minuten, nachdem sie ihn zuletzt im Helfer sah, und nur, wenn kein Ende darin stand).
- Zeichenbudget gemessen: Der Vollplan des Tests („Tagesplan 0.35: passt in den Helfer“: alle Felder belegt, 1500 Freundschaftstage, Ende eines Urlaubs, vier Beschäftigungen) belegt 232 von 255 Zeichen (bis 0.34 216), ohne Verlauf 175. `PLAN_MIN` steigt darum von 165 auf 180: Ein kürzer eingestellter Helfer wird nicht beschrieben (Hinweis in der Konsole). Viermal Malen mit dem Motiv „regenbogen“ ergäbe 265 Zeichen; dann lässt `_planFit` wie bisher den ältesten Eintrag des Verlaufs weg (getestet: drei bleiben). Live auf dem Flur-Tablet waren es vor dem Wechsel 168 Zeichen.
- Chronik: Felder `gut=1` (guter Tag) und `urlaub=1` (an dem Tag bei Pino, auch zeitweise), nur wenn sie zutreffen. Ein Urlaubstag wird geschrieben, auch wenn sich sonst nichts tat. 0.34 kennt die Felder nicht und erhält sie beim Zusammenführen. Gute Tage, Meilensteine und Urlaub brauchen die Chronik nicht.
- Befund: Das Tagebuch zählte doppelt, wenn zwei Geräte fast gleichzeitig schrieben. Im Verlauf stehen dann drei Stände, im mittleren fehlt das Neue des ersten Geräts, im dritten ist es wieder da; nachgestellt standen Pino und das Päckchen zweimal da. Jetzt zählt jedes Ereignis erst, wenn ein Höchststand steigt (Erlebnis-Bits je Tag, ausgepackte und verschenkte Päckchen, Verdientes je Serie, Sammelfenster und Blütenfarben, Blumengeschenk, Großputz, Einzelputze je Großputz). Da die Chronik ihre Bilanz aus demselben Verlauf ableitet, gilt das auch dort.
- Befund: „Ein neues Päckchen wartet“ stand auch bei vollem Vorrat im Tagebuch (`a` wächst weiter, in den Vorrat kommt nichts). Jetzt nur, wenn vorher Platz war.
- Befund: Der rote Punkt am Buch leuchtete bei Schätzen zweimal, beim Verschenken (Album und Stufen ändern sich dort schon) und beim Auspacken. Die Signatur besteht jetzt aus Tag und ausgepackten Päckchen.
- Befund: Schenkten zwei Geräte in derselben Sekunde, hatten beide dasselbe `z`, `x` und `i` und gaben beide Leckerli und Glück. Jetzt legt das schenkende Gerät eine Kennung (0–35) in den Plan, nur das Gerät, dessen Kennung dort steht, belohnt. Fehlt sie (eine ältere Karte schrieb inzwischen), gilt die alte Prüfung.
- Befund: Hunger war bei Dauerbetrieb nicht zu erreichen, weil Selbstfressen Satt bei knapp 50 hielt (`SELF_MAX`). Die Grenze liegt jetzt bei 25: Wer nicht füttert, sieht ihn hungrig, die hängenden Ohren (unter 15 %) verhindert das Knabbern weiter. Für die Serie zählt Selbstgefressenes ohnehin nicht.
- Ruhigere Signale: Der Ring am Päckchen-Knopf pulsiert nicht mehr. Beim Wiedersehen nach über drei Stunden sagt er „Da bist du ja!“ oder „Schön, dass du da bist!“ statt „Du warst lange weg!“. Im Album stehen statt „Hunger!“, „Streicheln!“, „Putzen!“ ruhige Hinweise („bitte füttern und putzen“), „Serie gerissen“ heißt „die Serie fängt neu an, sobald alles über 50 % ist“, und im Tagebuch steht beim Neubeginn „Das macht nichts, meine guten Tage behalte ich.“
- Mehrere Geräte, in der Vorschau mit zwei Karten geprüft: Urlaub links ein- und rechts ausgeschaltet; Rückkehr mit verschobenem Fortschritt und neu angesetztem Zustand auf beiden; ein Plan ohne siebten Abschnitt, wie ihn eine alte Karte in der Sekunde des Einschaltens schriebe, kommt im Helfer an (der Urlaub kommt zurück); ein Gerät holt zurück, während das andere den Urlaub gerade wieder einträgt (beide stehen ein paar Sekunden verschieden da, nach der Wiederholung beim Speichern gleich).
- Grenzen: Den Zustandshelfer schreibt eine ältere Karte im Urlaub weiter, wenn dort gefüttert wird oder er knabbert, die Werte sinken dann um den Abbau bis zu diesem Zeitpunkt. Solange 0.34 noch irgendwo offen ist, kann sie nach der alten Regel ein zusätzliches goldenes Päckchen vergeben. Schreibt eine ältere Karte den Plan, fehlt danach die Kennung des Schenkers (dann gilt die alte Prüfung, zwei Geräte in derselben Sekunde belohnen wieder beide). Haushaltsgeräte zeigen im Urlaub weiter, was sie tun.
- Vorschau: neue Zeile „Gute Tage, Urlaub“ (Urlaub an/aus links und rechts, Urlaub seit drei Tagen, heute guter Tag, +1 und 6 gute Tage, Leckerli-Folge der ersten 36 Päckchen, Meilenstein, alles golden, Stand). Meilenstein und „alles golden“ nehmen ihre Vorschau-Änderung aus den eigenen Änderungen, sobald sie im Helfer steht: `gdbg` ist nicht wiederholbar und hätte das Verschenkte sonst 15 Sekunden lang wieder überschrieben.
- Entwicklung: 72 Module (je ein neues `urlaub.js` in `src/logik/`, `src/karte/`, `src/grafik/` und `src/stil/`), 121 Tests (10 neue), grün auch mit `TZ=Asia/Tokyo`, `TZ=UTC` und `TZ=America/Santiago`. Ein Test lädt die Karte von 0.34 aus git (`f95604f`) und prüft, was ein Gerät mit zwischengespeicherter alter Version mit den neuen Ständen macht.

## 0.34.0 (2026-11-12)

Pikas Chronik: Mit der neuen Option `chronicle_entity` schreibt die Karte für jeden vergangenen Pika-Tag eine Tagesbilanz in eine To-do-Liste von Home Assistant, als Langzeitgedächtnis neben den beiden Helfern. Angezeigt wird die Chronik noch nirgends, sie wird nur geschrieben und gelesen.

- Neue Option `chronicle_entity` (Standard: leer), im Editor ein Feld für eine To-do-Liste unter den beiden Helfern. Ohne sie bleibt alles, wie es ist: kein Aufruf mehr an HA als bisher, kein Zeitgeber, nichts im Browser, Zustand und Tagesplan in den Helfern unverändert. Auch mit ihr schreibt die Chronik nie in die Helfer, sie liest nur deren Verlauf. Sie braucht `entity` und `plan_entity` in HA: Ohne gemeinsame Helfer hat jedes Gerät seinen eigenen Pika, der gehört nicht in eine gemeinsame Liste. Ist `chronicle_entity` keine `todo.`-Entität, zeigt die Karte eine Fehlermeldung wie bei den Helfern. Die Vorschau-Karte im Editor von HA (dort setzt das Frontend `preview = true`) schreibt nichts: Wer im Editor versehentlich eine andere Liste auswählt, findet dort keine Einträge, bevor er gespeichert hat.
- Format: je Pika-Tag ein Eintrag, alles im Titel, zum Beispiel `Pika-Tag 2026-11-10 · futter=3 streicheln=12 putzen=2 paeckchen=1 besuch=pino,vogel`. Das Datum ist der Kalendertag, an dem der Pika-Tag um 4 Uhr beginnt. Gezählt werden Füttern, Streicheln (99 heißt „99 oder mehr“), weggemachte Häufchen und ausgepackte Päckchen; `besuch` nennt Pino, Vögelchen (`vogel`) und Schmetterling (`falter`), `-` steht für niemanden. Beim Lesen ist die Karte großzügig mit Leerzeichen und streng beim Inhalt.
- Wann geschrieben wird: einmal je Pika-Tag und Browser (gemerkt unter `pika-pet-chronik:<Name>`), frühestens zehn Minuten nach Tagesbeginn plus ein Versatz je Gerät von bis zu zehn Minuten, und nur, wenn die Karte zu sehen ist und Zustand und Tagesplan geladen sind. Ein Lauf liest die Liste mit einem Aufruf. Nur wenn von den letzten sieben Tagen einer fehlt, folgt ein Abruf des Verlaufs der beiden Helfer, vom Beginn des ältesten fehlenden Tags bis jetzt. Die Bilanz entsteht daraus wie das Tagebuch. Ein Tag ohne jede Änderung im Verlauf wird nicht geschrieben: Was kein Gerät gezeigt hat, erfindet die Chronik nicht.
- Zwei Geräte: Legen zwei denselben Tag im selben Augenblick an, stehen zwei Einträge in der Liste. Jedes Gerät, das geschrieben hat, liest darum nach 30 bis 60 Sekunden noch einmal (höchstens drei solche Runden). Für jeden Tag bleibt der Eintrag mit der kleinsten Kennung (uid) und bekommt den zusammengeführten Titel, die anderen werden gelöscht, und zwar erst, wenn frisch gelesen ist, dass der bleibende alles enthält. Zusammengeführt heißt: bei den Zahlen das Größere, Besuch und unbekannte Felder vereinigt. Das Zusammenführen selbst hängt nicht von der Reihenfolge ab, und alle Geräte treffen dieselbe Wahl: Bei zwei Geräten ist es gleich, welches zuerst kommt. Ein Test spielt für zwei Geräte jede Reihenfolge ihrer Aufrufe durch (drei Fälle, zusammen mindestens 3 200 Reihenfolgen): Am Ende steht je Tag genau ein Eintrag, und nichts fehlt. Für drei und mehr Geräte gilt das nicht in jeder Reihenfolge, siehe den nächsten Punkt.
- Frischer Lesestand: Geändert und gelöscht wird nur aus einem Stand der Liste, der höchstens zehn Sekunden alt ist. Ist er älter (das Anlegen davor hing, das Handy schlief ein), lässt die Karte die restlichen Schritte, liest neu und plant neu. Sonst könnte ein spät eintreffender Titel aus altem Stand einem Eintrag wieder nehmen, was ein drittes Gerät inzwischen ergänzt hat, während die Dopplung mit dem Rest schon gelöscht ist. Das Fenster wird damit klein, ganz zu ist es nicht. Anlegen bleibt davon unberührt: Ein spätes Anlegen kostet höchstens eine Dopplung, die abgeräumt wird. Schreibt auch die dritte Runde Nachprüfen noch etwas, ist nicht bewiesen, dass die Liste sauber ist: Der Tag gilt dann nicht als geprüft, das Gerät versucht es nach einer Pause von vorn. Beim Abräumen einer Dopplung gehen Beschreibung, Haken und Fälligkeit des gelöschten Eintrags verloren.
- Was unangetastet bleibt: alles, was nicht mit „Pika-Tag JJJJ-MM-TT“ beginnt; Einträge mit diesem Kopf, die sich nicht sauber lesen lassen (der Tag gilt dann als belegt, die Karte legt keinen zweiten an); Beschreibung, Fälligkeit und Status jedes Eintrags, abhaken und Notizen sind also erlaubt. Felder, die 0.34 nicht kennt, bleiben erhalten, auch beim Zusammenführen. Ein einzelner Eintrag, der nur anders formatiert ist, wird nicht umgeschrieben.
- Liste fehlt oder ist nicht erreichbar: Es beginnt gar kein Lauf, und sobald sie wieder da ist, geht es beim nächsten Takt weiter. Scheitert ein Lauf (HA lehnt ab, die Verbindung reißt, der Recorder zeichnet die Helfer nicht auf), folgt der nächste Versuch nach einer Stunde, bei wiederholtem Fehlschlag in wachsenden Abständen (2, 4, 8, 16 Stunden) bis zu einem Tag; ein fertiger Lauf fängt wieder bei einer Stunde an. Nichts davon ist ein Fehler der Karte: Im Fehlerspeicher steht nichts, in der Konsole höchstens eine `debug`-Zeile. Ein Lauf, der länger als zehn Minuten hängt, wird aufgegeben und zählt als Fehlschlag. Wird die Karte abgehängt oder die Liste gewechselt, endet der laufende Lauf und schreibt nichts mehr.
- Keine Meldungen am Bildschirm: Das Frontend von HA zeigt bei jedem abgelehnten Dienstaufruf zehn Sekunden lang eine Meldung, wenn man es nicht abbestellt (`callService`, fünfter Parameter `notifyOnError`). Die Chronik ruft ihre drei Dienste mit `false` auf. Sonst erschiene auf dem Wandtablet auch dann eine Meldung, wenn nur das andere Gerät schneller war.
- Schutz gegen eine andere Zeitzone: Pika-Tag und Tagesbeginn rechnet die Karte in der Zeitzone des Geräts. Ein Handy in Tokio hielte den Tag von zu Hause schon am Abend für abgeschlossen und trüge ihn halb nach. Darum schreibt und liest nur ein Gerät, dessen Ortszeit zur Zeitzone von HA passt (`hass.config.time_zone`): gleicher Abstand zur Weltzeit jetzt und zu Beginn des ältesten Tags, der nachgetragen würde, damit zwei Zonen mit verschiedener Sommerzeitregel nicht durchrutschen. Nennt HA keine Zone oder kennt der Browser sie nicht, bleibt es wie ohne Prüfung.
- Schutz gegen eine vorgehende Geräteuhr: Welcher Tag „heute“ ist, sagt die Uhr von HA, und das ist gleich nach dem Laden noch die Geräteuhr. Ginge sie einen Tag vor, trüge die Karte den laufenden Tag als abgeschlossen nach, und der halbe Eintrag bliebe stehen. Geprüft wird darum erst, wenn Home Assistant den neuen Pika-Tag selbst erreicht hat: Der jüngste `last_updated` unter den Zuständen, die die Karte ohnehin liest (Sonne, die beiden Helfer, Wetter, die Liste), liegt bei oder nach dem Tagesbeginn. Ohne einen solchen Stempel wartet sie.
- Gemessen an der To-do-Schnittstelle von HA 2026.11.1 (Integration `local_todo`), darauf beruht der Ablauf: Ein Eintrag hat `summary`, `uid` und `status`, dazu nur wenn gesetzt `due`, `description` und `completed`. Eine Längengrenze war nicht zu finden (20 000 Zeichen im Titel und 100 000 in der Beschreibung wurden angenommen). `add_item` gibt keine uid zurück. Eindeutigkeit gibt es nicht: Zwei gleiche Titel im selben Augenblick ergeben zwei Einträge. Zwei gleichzeitige Änderungen desselben Eintrags melden beide Erfolg, eine geht still verloren. `remove_item` mit mehreren uids löscht nichts, wenn eine davon fehlt. „Den Eintrag gibt es nicht“ sagt HA auf zwei Arten: für eine uid, die die Liste nicht kennt, als `service_validation_error` („Unable to find to-do list item“), und wenn eine andere Verbindung denselben Eintrag eben erst gelöscht hat, als `unknown_error` („No existing item with uid/recurrence_id“). Die zweite ist der Fall, in dem zwei Karten dieselbe Dopplung abräumen. Die Karte erkennt beide an der Meldung und macht weiter. Eine Zeile im Recorder entsteht nur, wenn sich die Zahl der offenen Einträge ändert (anlegen, löschen, abhaken), nicht beim Lesen und nicht beim Umbenennen.
- Tagebuch unverändert: `_diaryHist` hat einen Schalter bekommen, mit dem die Chronik nur die beiden Helfer abfragt (ohne die Geräte des Haus-Boten) und ein Fehlschlag nur leise in der Konsole steht. Das Tagebuch ruft es wie bisher auf.
- Vorschau: `preview.html` stellt die To-do-Liste mit dem gemessenen Verhalten nach (jeder Aufruf antwortet nach etwa 150 ms). Neue Zeile Chronik: an/aus, Verlauf für vier vergangene Tage füllen, „Mensch schreibt“, beide Karten gleichzeitig prüfen, Liste leeren. Unter den Karten stehen die Liste und die Aufrufe mit Absender, so sieht man die Dopplung entstehen und verschwinden. Ohne Zutun ist die Chronik dort aus. Die Attrappe kennt beide Formen der Ablehnung, den fünften Parameter von `callService` und `completed` an abgehakten Einträgen.
- Entwicklung: 68 Module (`src/karte/` 27, `src/logik/` 18, neu ist je ein `chronik.js`), 111 Tests (23 neue zur Chronik); sie laufen auch mit `TZ=Asia/Tokyo`, `TZ=UTC` und `TZ=America/Santiago` grün. Der Testexport gibt die Funktionen der Chronik und `diaryDerive` heraus. Die README hat einen Abschnitt Chronik und nennt die neuen Zahlen.

## 0.33.1 (2026-11-11)

Aufgeräumt: Nach dem Schnitt in Module stehen die Kommentare wieder bei dem, was sie beschreiben. Am Verhalten der Karte ändert sich nichts.

- Nur Kommentare und drei reine Umzüge, sonst kein Code: 45 der 57 geänderten Module sind Token für Token gleich geblieben (mit acorn verglichen, Kommentare sind keine Token). In den übrigen zwölf weicht nur ab, was umgezogen ist, und die Versionsnummer. Zustand und Tagesplan in den Helfern bleiben, wie sie sind.
- Kommentare beim falschen Nachbarn: Beim Schnitt waren einige vor einer fremden Konstante oder Methode gelandet. Sie stehen jetzt bei dem, was sie beschreiben: der Takt der Häufchen bei `POOP` (`src/logik/zustand.js`, stand bei den Besuchern), die Städtenamen bei `CITY_DE` (`src/logik/flugzeuge.js`, stand beim Himmel), die Reihe der Requisiten bei `boteRow` (`src/logik/haus-bote.js`, stand in den Hilfen), die Flüge bei `_readFlights` (`src/karte/flugzeuge.js`, stand beim Himmel), die Besucher bei `_startCritters` (`src/karte/besucher.js`, stand bei den Festtagen) und die Parameter von `_visit` bei `_visit` (standen über `_festClear`). Was Pinos Grafik und die Geräte-Grafiken des Haus-Boten beschreibt, steht bei `FRIEND_SVG` und `BOTE_SVG` unter `src/grafik/` statt bei den Konstanten unter `src/logik/`. Von den zwei Fassungen desselben Kommentars vor `_away` bleibt die genauere.
- Abschnittsüberschriften der alten Datei: 54 Zeilen sind weg. Das sind alle Schlusszeilen („Ende Festtage“), die Anfangsüberschriften, die nur den Modulkopf wiederholten oder die falsche Schicht nannten („Konstanten, Grafiken und Stil“ in einem Modul unter `src/logik/`, „Methoden“ in einem Teil der Klasse), und die, unter denen nichts mehr stand (etwa „Stil“ in `src/logik/haus-bote.js`). Der erklärende Text darunter ist geblieben. Über `_now` steht statt der Überschrift „Häufchen“, was es ist: die Uhr der Häufchen. Überschriften, die ein Modul gliedern, bleiben (zum Beispiel die einzelnen Beschäftigungen).
- Verweise auf Orte der alten Datei („siehe Abschnitt …“, „weiter oben in set hass“) nennen jetzt das Modul oder die Methode.
- Modulköpfe über 120 Zeichen stehen auf zwei Zeilen (14 Module).
- Neues Modul `src/logik/bewegung-reduzieren.js`: `RED_MOTION` und `calmMotion` sind aus `hilfen.js` dorthin gezogen. `RED_MOTION` fragt beim Laden `window.matchMedia`; solange es in den Hilfen stand, ließen sich in node nur 5 der 16 Logik-Module einzeln laden, jetzt 16 von 17 (alle außer dem neuen). Die neun Teile der Klasse, die `calmMotion` brauchen, importieren es von dort.
- `_hassAct` (liest `screen_entity`) steht in `src/karte/lebensschleife.js` hinter `_visSync`, das es aufruft, statt bei den Beschäftigungen.
- `src/index.js` beginnt ohne Leerzeile, die gebaute Datei damit direkt mit dem Kopfkommentar.
- Entwicklung: 66 Module (`src/logik/` 17), weiterhin 88 Tests. Die README nennt die neuen Zahlen.

## 0.33.0 (2026-11-11)

Baukasten: Der Quelltext liegt jetzt in 65 Modulen unter `src/`, `pika-pet-card.js` wird daraus gebaut. Am Verhalten der Karte ändert sich nichts.

- Reiner Umzug: Die Karte tut dasselbe wie 0.32.0, Zustand und Tagesplan in den Helfern bleiben, wie sie sind.
- Quelltext in Modulen: `src/index.js` ist der Einstieg (Kopfkommentar, `customElements.define`, Testexport), `src/version.js` nennt die Versionsnummer (nur noch dort), `src/karte.js` enthält die Klasse `PikaPetCard` mit constructor, `setConfig`, `set hass`, Ein- und Aushängen und Fehlernetz. Dazu vier Ordner: `src/karte/` (26 Module, je ein Gebiet der Klasse, nur Methoden), `src/logik/` (16, Konstanten und reine Funktionen), `src/grafik/` (11, SVG-Bausteine) und `src/stil/` (9, die Stilblöcke). Die Liste `TEILE` in `src/karte.js` hängt die Methoden der 26 Teile an die Klasse; für die Karte bleibt es eine einzige.
- `pika-pet-card.js` im Wurzelverzeichnis ist jetzt die gebaute Datei (esbuild, eine IIFE, nicht verkleinert). Sie bleibt im Repo und wird mit jeder Änderung neu gebaut und mit committet, weil HACS genau diese Datei ausliefert. Sie ist ein Achtel kleiner (895 statt 1 023 kB), weil esbuild die Kommentare weglässt; der Kopfkommentar steht unverändert am Anfang.
- Bauen: einmal `npm install` (esbuild 0.28.2 und acorn 8.19.0, beide fest gepinnt), dann `node dev/build.mjs` oder `npm run build`. `node dev/build.mjs --pruefen` vergleicht nur und endet mit Code 1, wenn die Datei im Wurzelverzeichnis veraltet ist. Neu sind `package.json` (`private`, `type: module`, Skripte `build` und `test`) und `package-lock.json`; `node_modules/` steht in `.gitignore`.
- Der Bau bricht ab, wenn die Teile der Klasse nicht zusammenpassen: derselbe Methodenname in zwei Modulen oder zweimal in einem; ein Feld `this._x`, das eine Methode `_x` überdeckt (die Karte liefe damit scheinbar weiter, weil das Fehlernetz den Fehler fängt); ein Modul unter `src/karte/`, das nicht in `TEILE` steht; ein Teil mit constructor, `extends`, `super` oder Klassenfeld. Eine gewollte Ausnahme ist eingetragen: `_step`, das `_festForce` für einen Schritt überdeckt.
- Vorschau: `dev/serve.mjs` baut beim Start und vor jeder Auslieferung von `pika-pet-card.js` neu, wenn sich unter `src/` etwas geändert hat. `preview.html` und `areale.html` laden unverändert die Datei im Wurzelverzeichnis. Ein Baufehler steht im Terminal und in der Konsole der Vorschau. Ohne `npm install` liefert der Server die Dateien aus, wie sie sind.
- Gleichheitsbeweis: `dev/gleichheit.mjs` schickt die Karte von 0.32.0 und das neue Bündel durch denselben esbuild-Drucker und vergleicht. Die Versionsnummer ausgenommen, gibt es keine Abweichung: 424 Konstanten und Funktionen der oberen Ebene wertgleich, alle zehn Stil-Strings zeichengleich, 586 Einträge am Prototyp der Klasse (Methoden und Setter) und die beiden statischen Methoden mit gleichem Quelltext, Testexport mit 118 Schlüsseln, `getConfigForm` und eine frisch erzeugte Instanz gleich.
- Entwicklung: `node --test` braucht jetzt `npm install` und prüft zusätzlich den Bau (`test/bau.test.mjs`): Ein Test baut im Speicher und vergleicht mit `pika-pet-card.js`; ist die Datei veraltet oder von Hand geändert, ist er rot. Weitere prüfen Kopfkommentar und `VERSION` im Bündel und die Namensprüfung. `test/pika.test.mjs` lädt weiter das gebaute Bündel; vier Tests, die im Quelltext nach JS-Schreibweise suchen, lesen jetzt die Module unter `src/`, weil esbuild Strings mit doppelten Anführungszeichen und die obere Ebene mit `var` druckt. Neu ist `.gitattributes`: `*.js` und `*.mjs` werden immer mit LF ausgecheckt, damit die Textsuchen der Tests auch auf einem frischen Klon unter Windows greifen (88 Tests).
- README: Der Abschnitt Entwicklung beschreibt, wo was liegt, Bauen, Testen, Vorschau, Ausliefern und wie ein neues Stück Klasse angelegt wird.

## 0.32.0 (2026-11-11)

Sauberer Auftritt: Kein Teleport mehr nach „Bildschirm an“, Häufchen warten das Ende einer Beschäftigung ab, Hopser enden auf dem Boden, und Requisiten werden hervorgekramt. Dazu acht neue kleine Beschäftigungen und ein eigenes Programm für Regen und Schnee.

- Bildschirm an ohne Teleport: Bisher winkte der Pika nach einer längeren Pause an seiner alten Stelle und stand dann samt Requisit mitten in der Beschäftigung woanders. Meldet `screen_entity` „an“, sind Tagesplan und Wetter so frisch wie die Meldung: Er steht im selben Augenblick am richtigen Platz. Muss die Karte erst auf einen frischen Stand warten (App nach langer Zeit wieder geöffnet), wartet er still, statt zu grüßen, und hoppelt dann zu seinem Platz. Ohne Hinlaufen steigt er nur noch ein, wenn ihn vorher niemand woanders sah (frisch geladen, oder sofort beim Sichtbarwerden); das gilt auch nach dem Aufwachen und beim Kaffee.
- Zurück aus dem Zwischenspeicher von HA (Ansicht gewechselt und wieder zurück): Die Schleife wählt erst, wenn HA den frischen Stand gesetzt hat (höchstens 0,6 s), statt gelegentlich eine andere Beschäftigung als die übrigen Geräte zu zeigen.
- Häufchen warten das Ende einer Beschäftigung ab: Ein fälliges Häufchen brach bisher Malen, Musik, Seilspringen und das Auspacken ab (gesperrt waren nur fünf Aktionen); die Beschäftigung begann danach von vorn, das Seilspringen war ganz weg. Jetzt bricht es nur Kleinigkeiten ab. Alles andere bringt er zu Ende, das Häufchen kommt danach. Dauert das länger als drei Minuten oder ruht die Karte inzwischen (Bildschirm aus, andere Ansicht), liegt es einfach da. Solange es wartet, zählt es auf diesem Gerät noch nicht bei Sauberkeit und Glück. Wo es liegt, steht weiter im Zustand: Alle Geräte zeigen dasselbe an derselben Stelle.
- Breite Karten: Zum Platz einer Beschäftigung läuft er so schnell, dass er nach fünf Sekunden dort ist (nie langsamer als bisher, höchstens gut dreimal so schnell). Bei 5:1 kam er über zehn Sekunden zu spät, der Hampelmann zählte ab „6!“. Kehrt er mittendrin an seinen Platz zurück (nach dem Füttern, einer Aufgabe des Haus-Boten), geht er kurze Wege im gewohnten Tempo und beeilt sich nur bei weiten (höchstens doppelt so schnell, ohne große Hopser).
- Hopser enden auf dem Boden: Ein Weg dauert immer ganze Hopser (auch bei Pino), er schnappt am Ziel nicht mehr aus der Luft herunter. Ein Sprung auf der Stelle beginnt nicht neu, solange der letzte in der Luft ist. Seilspringen und Hampelmann hören mit einer Landung auf (der Hampelmann springt genau im Takt des Zählers, bisher lief er ihm bis zu 80 ms davon), das Laufen auf der Stelle im Frühsport dauert ganze Hopser; wer mitten im Hampelmann einsteigt, springt im Takt der gezählten Zahlen. Wird die Karte mitten in einem Sprung unsichtbar, steht er beim Wiedersehen am Boden.
- Requisiten werden hervorgekramt: Buch, Gameboy, Tablet, Ukulele, Pinsel und Palette, Seifenblasenring, Stirnband, Springseil und Hantel kommen in einer Viertelsekunde aus dem Fell (leicht überschwingend) und verschwinden am Ende auf demselben Weg, statt hart zu erscheinen. Die Staffelei stellt er genauso hin. Wird eine Beschäftigung abgebrochen (Regen, Schlafenszeit), sind sie wie bisher sofort weg.
- Acht neue kleine Beschäftigungen bei trockenem Wetter: Hula-Hoop (manchmal rutscht der Reifen herunter), Jo-Jo (manchmal bleibt es unten hängen), Pusteblume (drei Puster, die Schirmchen fliegen mit dem Wind), Purzelbaum (zwei oder drei, danach kurz schwindlig), Steintürmchen (vier bunte Kiesel, manchmal fällt es um), Jonglieren (drei Beeren über den Kopf, manchmal eine auf die Nase), Blumenkranz (flechten, aufsetzen, sich zeigen) und Papierflieger (werfen, hinterher, zurückwerfen; auf schmalen Karten steil nach oben, er landet vor den Füßen statt hinter dem Kartenrand). Bisher wechselten sich Seilspringen und Gewichtheben ab, je rund 40-mal am Tag (ohne Platz im Vorrat 60-mal); jetzt ist an einem trockenen Tag keine kleine Beschäftigung öfter als etwa 14-mal dran, Seil und Hantel je rund 9-mal.
- Regenprogramm: Bei Regen (nicht bei Starkregen und Gewitter, da bleibt er im Bau) geht er hinaus zum Pfützenspringen (fünf bis neun Sprünge im festen Takt, bei jeder Landung spritzt es) oder lässt ein Papierschiffchen schwimmen (er pustet es in Etappen über die Pfütze, es treibt zurück, er fischt es heraus). Das Blatt behält er dabei über dem Kopf. Zusammen etwa viermal in der Stunde; bisher gab es bei Regen keine kleine Beschäftigung.
- Schneeprogramm: Solange Schnee liegt, baut er ab und zu einen Schnee-Pika (Bauch, Kopf, Ohren, Gesicht), tritt zurück und ist stolz. Im Schnee gab es bisher nur Gewichtheben (77-mal am Tag); jetzt wechseln sieben Beschäftigungen.
- Pfütze, Schiffchen, Schnee-Pika und Steintürmchen stehen am Boden zwischen Vorrat und Aussichtsstein, an einer Stelle aus dem Fenster des Tagesplans (in der Regel auf allen Geräten dieselbe), neben Geräten des Haus-Boten, Festdeko, Schätzen und Häufchen statt darauf (das Wollknäuel zählt nicht, es liegt auf jedem Gerät woanders). Auf engen Karten rücken Schnee-Pika und Steintürmchen vom Stein weg, so weit die Tür frei bleibt. Pfützenspringen, Papierschiffchen und Schnee-Pika laufen nach der Planzeit: Ein später geladenes Gerät steigt mittendrin ein, das Schiffchen liegt dann genau dort, wo es auf den anderen gerade ist. Setzten Regen oder Schnee erst nach Beginn des Fensters ein, lässt es dieses Fenster aus (die anderen haben dort schon etwas anderes gezeigt). Ändert sich die Größe der Karte, während etwas am Boden steht, der Papierflieger unterwegs ist oder er Purzelbäume schlägt, bricht er ab, statt mit alten Pixeln weiterzurechnen. Die neuen Beschäftigungen stehen nicht im Helfer `plan_entity`.
- Hört der Regen auf oder ist der Schnee getaut, endet das Programm: Bisher brach nur beginnender Regen oder Schnee eine Beschäftigung ab, jetzt jeder Wechsel, nach dem sie nicht mehr geht.
- In der Regel nicht dieselbe kleine Beschäftigung zweimal hintereinander, auch nicht nach dem Neuladen: Die Kette der Fenster begann bisher fest vier Fenster vorher, zwei Fenster konnten sich deshalb über ihren gemeinsamen Vorgänger uneins sein. Jetzt beginnt sie nach dem letzten Fenster ohne Beschäftigung und hängt nur an der Uhr. Gewählt wird aus dem ganzen Programm des Wetters (trocken, Regen, Schnee); nur wo die Gewählte gerade nicht geht (Papierflieger bei Wind ab 40 km/h, auch im Schnee; Blumenkranz bei Kälte und im Winter; Blüte sammeln bei vollem Vorrat), tritt eine andere an ihre Stelle. Ein solcher Schalter ändert damit nur die Fenster, die er trifft (etwa jedes zehnte), statt die ganze Folge zu verschieben. Wiederholen kann sich eine nur, wenn zwischen zwei Fenstern das Wetter umschlägt (Schnee fällt oder taut). Der Festtagshut gehört nicht mehr zur Auswahl: Auf einer Karte mit Hut fällt der Blumenkranz aus, alles andere wählen zwei Dashboards mit verschiedenen Geburtstagen gleich. Solange Geräte mit 0.31 und 0.32 nebeneinander laufen, wählen sie verschiedene kleine Beschäftigungen (andere Auswahl, andere Gewichte); die großen und alles im Helfer bleiben gleich.
- Vorschau: Knöpfe für die elf neuen Beschäftigungen.
- Ohren schwingen bei jedem Sprung auf der Stelle nach, auch bei Pino: Beim Absprung bleiben sie zurück, bei der Landung klappen sie nach vorn und pendeln aus. Das kommt zu ihrer Haltung dazu (hängende Ohren schwingen hängend) und stört keine andere Ohrbewegung: Angetippt flappen sie auch kurz nach einem Sprung. Beim Seilspringen und beim Hampelmann wippen sie mit.
- Feinschliff: Beim Fernsehen dreht er sich um, statt dass Vorder- und Rückansicht hart wechseln. Vom fertigen Bild tritt er rückwärts zurück, den Blick auf der Staffelei. Beim Drachensteigen lehnt er sich gegen den Zug der Schnur, bei einem Ruck deutlich; die Schnur bleibt dabei an seiner Pfote.
- Seilspringen: Zähler und Sprünge laufen auf derselben Uhr (bisher liefen sie über bis zu 29 Sprünge auseinander), und alle Geräte beginnen zur selben Zeit. Dasselbe gilt für die neuen kleinen Beschäftigungen: Wer schon am Platz steht, wartet mit Reifen, Jo-Jo oder Flieger in der Pfote, bis die fünf Sekunden fürs Hinlaufen um sind. Der zweite Wurf des Papierfliegers und „schneller!“ beim Hula-Hoop kommen ebenfalls zur festen Zeit.
- Mitternachts-Finale an Neujahr und „Helau!“ am 11. 11. kommen auf allen Geräten in derselben Sekunde, nach der Uhr von HA. Bisher hingen sie am 20-Sekunden-Takt, der auf jedem Gerät eine andere Phase hat.
- Pino geht überall gleichzeitig: Der Besuch endet nach der Uhr, auch mitten in einem Spiel; in den letzten 25 Sekunden (statt 10) beginnen die beiden kein neues (ein langes Spiel bricht der Abschied trotzdem ab). Wird die Uhr erst nach seiner Ankunft mit HA abgeglichen, geht er trotzdem zur Zeit aus dem Besuchsplan. Beim Fangen läuft die erste Runde nicht mehr durch den Fänger hindurch.
- Halloween dauert die Nacht durch: Kürbis, Hexenhut und Fledermäuse bleiben am 1. 11. bis 6 Uhr, statt um Mitternacht zu verschwinden.
- Ein Vögelchen im Anflug lässt sich verscheuchen und dreht in der Luft ab; es landet nicht mehr auf dem Stein, auf den der Pika gerade springt.
- Beginnt ein Gewitter, während er fernsieht, geht der Fernseher nicht mehr aus und wieder an. Die Wiesenblume, die er für den Vorrat pflückt, wechselt nicht mehr vorher die Farbe. Die Traumblase zeigt beim Aufwecken nicht mehr kurz den Löwenzahn.
- Der Bodenschatten liegt unter den Füßen statt halb im Grasstreifen: Man sieht jetzt, wie er bei jedem Hopser schrumpft.
- „Bewegung reduzieren“ deckt mehr ab: Der Fernseher flackert nicht (und wechselt seltener das Bild), der Drachen steht still, an den Geräten des Haus-Boten ruht, was von selbst läuft, Rotoren und Propeller stehen, die Fliege sitzt, die zzz stehen als feste Zeichen da. Requisiten blenden nur ein und aus, die Ohren schwingen nicht nach. Bei den neuen Beschäftigungen kreist, pendelt und schaukelt nichts von selbst (Reifen schräg um den Bauch, Jo-Jo an halber Schnur, drei Beeren im Bogen); statt des Purzelbaums hüpft er die Strecke, der Papierflieger gleitet gerade, in der Pfütze spritzt es nicht.
- Schonender fürs Tablet: Was der Pika für den Haus-Boten trägt (Handtuch, Teller), fragt den Stil nicht mehr viermal in jedem Bild ab; steht er, wird gar nichts gerechnet.
- Entwicklung: `node --test` prüft zusätzlich, wann ein Häufchen wartet (und dass ein zurückgehaltenes nicht Stunden später vorgeführt wird), das Lauftempo aus der Strecke und beim Wiedereinstieg, ganze Hopser (samt Abgleich mit den Dauern im Stil), Sprünge in der Luft, das Einsteigen ohne Hinlaufen, das Warten auf den Plan (der frische Stand bricht keine fremde Aktion ab, eine zurückgestellte Geräteuhr hält nichts auf), Hervorkramen und Wegräumen der Requisiten samt Abbruch, das Nachschwingen der Ohren, den Schnuranfang des Drachens, die Fluchtseite beim Fangen, Pinos Abschied nach einer Uhrkorrektur, die Wecker für Mitternacht und „Helau!“, die Halloween-Nacht, die kleinen Beschäftigungen (jede wählbare hat Methode, Länge und räumt ihre Klassen ab; Auswahl nach Wetter; Verteilung über den Tag; Abbruch, wenn Regen oder Schnee enden: auch an der Karte selbst; ein Schalter wie Wind oder voller Vorrat ändert nur die Fenster, die er trifft; keine kleine dicht an einer großen; gemeinsamer Beginn zur Planzeit; Landeplätze des Papierfliegers auf fünf Kartengrößen; Lage des Papierschiffchens beim Späteinstieg; kein Späteinstieg nach einem Wetterumschwung im Fenster; Abbruch bei Größenwechsel; Aufräumen der Requisiten am Boden und mitten im Purzelbaum) und den Platz der Requisiten am Boden samt Sperren (82 Tests).

## 0.31.0 (2026-11-11)

Wetter mit Gewicht: Die Dämmerung kommt stufenlos, Gewitter wird dunkel, Schnee bleibt liegen, und die Wiese hat Jahreszeiten.

- Dämmerung stufenlos aus der Sonnenhöhe: Abendrot ab 10° (ganz bei 2°), Nacht von −1° bis −9°. Himmel, Hügel, Wiese, Blumen, die Berge im Areal `alpin` und das Licht auf Bau, Stein und Requisiten gehen gemeinsam mit, statt bei 4° und −5° in 2,5 Sekunden umzuschalten.
- Gewitter und Starkregen dunkeln Himmel, Wolken, Land und Berge ab (bisher sah Gewitter aus wie bedeckt); nachts bleibt es, wie es ist. Hinter dichten Wolken sind Mond und Sterne ganz weg: Bei Regen blieben 15 % der Sterne, der Mond schien durchs Gewitter, und Sterne schienen durch die dunkle Seite des Mondes.
- „Teils bewölkt“ und „sonnig“ bleiben hell, auch wenn die Wetter-Entität dazu 70 % Bedeckung und mehr meldet (hohe Schleier): Die Bedeckung zählt nur noch im Rahmen der Wetterlage.
- Wolken behalten bei Windwechsel ihren Platz. Bisher standen alle sechs bei jeder Änderung der Windstärke schlagartig woanders, bei gedrehtem Wind gespiegelt.
- Niederschlag blendet über, statt hart umzuschalten; von Regen auf Starkregen kommen nur Tropfen dazu.
- Jahreszeiten: Hügel und Wiese wechseln übers Jahr gleitend die Farbe (Mai und Juni wie bisher, Herbst gelbgrün, Winter matt), die Blumen blühen im Herbst als Goldrute, Heide und Aster und stehen im Winter als verblasste Samenstände. Südhalbkugel um ein halbes Jahr versetzt. Im Tagesplan stehen weiter nur die Nummern der Farben.
- Schnee bleibt liegen und taut: Die Decke wächst bei Schneefall in zehn Minuten zu und hält danach je nach Temperatur anderthalb Stunden bis drei Tage (Regen und Sonne tauen schneller). Getaut wird Stück für Stück mit der Temperatur, die jeweils gemeldet war: Ohne neuen Schneefall nimmt die Decke nie zu, auch wenn es abends abkühlt, und Sensorrauschen schaltet sie nicht hin und her. Solange sie liegt, verhält sich der Pika wie bei Schnee.
- Regenbogen nach dem Schauer, 20 Minuten lang gegenüber der tief stehenden Sonne; er bleibt, wenn die Lage in der Zeit zwischen sonnig und teils bewölkt wechselt.
- Schneedecke und Regenbogen kommen aus dem Verlauf der Wetter-Entität: jede Meldung mit neuer Lage oder neuer Temperatur (ganze Grad) mit dem Zeitstempel von HA, mitgeschrieben und aus dem Recorder gelesen (drei Tage; beim Laden, nach einer Verbindungslücke, bei verspäteten Meldungen und beim Wiedersehen nach einer Viertelstunde). Ein frisch geladenes Gerät steht danach da wie eines, das mitlief: auf allen Geräten gleich, ohne neuen Eintrag in den Helfern. Scheitert der Abruf, folgt der nächste Versuch nach 1, 5, 15 und dann alle 30 Minuten; bis dahin weiß ein Gerät nur, was es selbst gesehen hat.
- Fällt die Wetter-Entität länger als die Haltefrist von 30 Minuten aus, wächst die Schneedecke nicht weiter und taut (nach Schneefall wie bei unbekannter Temperatur); ohne Wetter-Entität liegt kein Schnee. `temperature: null` gilt als unbekannt, nicht als 0 °C.
- Flugzeuge: Ein Flug, den die Integration mit alter Position weiterführt, startet nicht mehr alle 75 s von vorn (und erschreckt den Pika nicht mehr jedes Mal). Kommt eine Position verspätet, gleitet der Flieger nicht mehr kurz rückwärts; die 75 s zählen dabei weiter ab der Meldung, ein bremsender Anflug fliegt also nicht vorzeitig aus. Ein schwebender Hubschrauber bleibt am Himmel (bisher flog alles unter 30 Knoten heraus).
- Areal `alpin`: Die Wintersonne steht über dem Grat (auf 50° Nord stand sie mittags von Ende November bis Mitte Januar ganz hinter den Bergen), der Mond ebenso. Die Berge liegen jetzt hinter Wolken und Flugzeugen, ein tiefer Anflug verschwindet nicht mehr hinter dem Grat; Wolken vor den Bergen lassen sich antippen.
- Schonender fürs Tablet: Über den schaukelnden Blumen liegt kein Filter mehr (bei Dämmerung und bedecktem Himmel wurde die ganze Ebene in jedem Bild neu gefiltert), ihre Farben sind fertig gerechnet. Hügel, Berge und Grasstreifen kommen ganz ohne Filter aus, der Filter auf Bau, Stein und Requisiten schaltet sich erst zu, wenn er sichtbar etwas ändert. Hinter dichten Wolken funkeln die Sterne nicht unsichtbar weiter.
- Vorschau: Die Wetter-Knöpfe melden `last_changed`, neu sind „Schnee taut“ und „nach dem Schauer“.
- Entwicklung: `node --test` prüft zusätzlich Dämmerung, Farben der Landschaft und der Berge, Jahreszeit, Schneedecke (ein ganzer Tag mit Abkühlung am Abend, Sensorrauschen), Wetterverlauf (zwei Geräte mit verschiedenen Temperaturen beim Laden, fehlende Temperatur, Ausfall der Wetter-Entität, Recorder scheitert, Verbindungslücke), Regenbogen, Bedeckung, Flugzeug-Filter samt Meldezeit und Vorlauf und den Sonnenstand im Areal alpin (50 Tests).

## 0.30.0 (2026-11-11)

Fingerspitzengefühl: Der Pika antwortet schon beim Aufsetzen des Fingers, Kraulen klappt auch am Handy, und die Welt um ihn lässt sich antippen.

- Sofortantwort: Setzt der Finger auf, gibt er ein wenig nach, die Bäckchen werden rot, die Augen wandern zum Finger. Das ist nur ein Zustand am Pika, keine Aktion: Was er gerade tut, läuft unverändert weiter. Mit „Bewegung reduzieren“ entfällt das Nachgeben.
- Lang drücken am Handy: Der Tipp hängt nicht mehr am Klick des Browsers (Android schickt nach langem Drücken keinen), sondern entsteht beim Loslassen. Auf einem beschäftigten Pika zählt langes Drücken jetzt nach gut einer halben Sekunde wie Antippen; bisher blieb es dort ohne Reaktion.
- Kraulen bricht nicht mehr ab, wenn der Finger ein wenig rutscht: Sobald gekrault wird, rollt die Seite nicht mehr mit. Vorher lässt sie sich über dem Pika wie gewohnt schieben. Meldet der Browser den Zeiger trotzdem ab, läuft das Kraulen weiter, bis der Finger wirklich weg ist. Am Gerät noch nicht nachgeprüft (in der Vorschau nur mit nachgestellten Ereignissen).
- Nach dem Kraulen lässt er sich sofort wieder kraulen (bisher war er bis zu zwei Sekunden taub).
- Weiterstreicheln ohne Augenblitzen: Bei schnellen Tipps hintereinander bleiben geschlossene Augen und Lächeln stehen, statt zwischen zwei Reaktionen kurz aufzuspringen.
- Kraulen lohnt mehr als Dauerfeuer: Glück fürs Streicheln hängt an der Zeit statt an der Zahl der Tipps. Ein Tipp zählt voll (8), wenn seit der letzten Berührung anderthalb Sekunden vergangen sind, schneller anteilig; abgezogen wird nie etwas. Kraulen gibt 6 je Takt (0,9 s) und zählt fürs Tagebuch etwa alle 4,5 s einmal.
- Tastatur: Eine gehaltene Taste streichelt nur einmal. Häufchen, Blumengeschenk, Pino, Besucher, Geräte, Flugzeuge und Ostereier lassen sich mit Tab anwählen und mit Enter oder Leertaste auslösen (Putzen ging bisher nur mit Zeiger).
- Die Welt antwortet: Blume staubt (steht er daneben, niest er), Wolke tröpfelt, Stern fällt, an der Tür klopft es (im Bau linst er heraus), das Windrad dreht sich, das Wollknäuel kullert. Alles bleibt auf dem Gerät, nichts steht in den Helfern, Beschäftigungen und Schlaf werden nicht gestört. Vorhandene Tippziele behalten den Vorrang.
- Mimik: zwei Brauenstriche und ein Mundpfad zeigen Trauer, Trotz, Stolz und Staunen (Hunger, „hmpf!“, fertiges Bild, Sternschnuppe und mehr). Gespiegelt und beim Umschauen sitzen sie mit dem Gesicht, in der Rückansicht und im Schlaf fehlen sie.
- Tagebuch: neuer Reiter „Entdeckungen“ statt einer Einführung. Er zählt auf, was man mit dem Pika und seiner Welt tun kann; ein Pfotenabdruck steht vor dem, was auf diesem Gerät schon ausprobiert wurde (nur im Browser gemerkt). `diary: false` sperrt auch diese Seite.
- Entwicklung: `node --test` prüft zusätzlich das Glück fürs Streicheln, die Trefferwahl der Welt-Tipps, Mimik, Entdeckungen und das Wiederaufsetzen beim Kraulen (32 Tests).

## 0.29.0 (2026-11-11)

Freie Sicht: Nichts verdeckt mehr den Pika oder das, was er sagt, und schmale Karten passen.

- Haus-Bote: Die Geräte sparen den Eingang, die Bodendeko der Festtage und den Vorrat (Nische bzw. Heuhaufen) aus. Bisher stand das zweite Gerät vor der Tür und verdeckte den schlafenden Pika, das dritte im Advent den Kranz. Ein drittes Gerät steht jetzt rechts hinter dem Vorrat am Rand der Wiese; Häufchen liegen dann erst rechts davon.
- Sprech- und Denkblase, „zzz“ und die Zeichen über dem Kopf liegen in einer eigenen Ebene über Regen, Schnee und Nebel, Pinos Sprechblase ebenso. Pino läuft nicht mehr vor der Traumblase vorbei.
- Ebenen haben Namen (`--z-back` bis `--z-tag`) statt Zahlen und Querverweisen in den Kommentaren der Stilblöcke.
- Frosch, Schnecke und Maus setzen sich neben Kürbis, Stiefel, Kranz, Kuchen und Geschenk statt dahinter.
- Plüsch-Pino liegt direkt vor dem Pika statt vor Regen und Geräten. Das rote Ausrufezeichen bei einer Störung bleibt nachts rot. Herzchen steigen über die Knöpfe statt darunter weg.
- Schmale Karten: Unter einem Seitenverhältnis von 3:2 (Handy im Abschnitts-Layout, Hochformat) bemisst sich die Szene an der Breite statt an der Höhe; bisher passte der Pika dort nicht mehr zwischen Bau und Stein. Karten ab 3:2 bleiben, wie sie waren.
- Statusleiste: läuft nie mehr unter den Futterknopf. Ein langer Name endet mit „…“, auf schmalen Karten werden erst die Balken kürzer, dann fällt der Name weg. Ohne Weichzeichner (der rechnete hinter ziehenden Wolken jedes Bild neu), dafür etwas deckender.
- Abschnitts-Layout: mindestens 9 statt 6 Spalten.
- Tippziele: Futter-, Päckchen- und Buch-Knopf und die Statusleiste lassen sich auf mindestens 44 px antippen (unsichtbarer Rand).
- Flugzeuge: Die Tippflächen liegen immer unter den Knöpfen (ein offenes Fähnchen hob sie bisher neun Sekunden lang darüber) und reichen Tipps an alles Antippbare darunter durch: Pika, Pino, Vögel, Maus, Frosch, Schnecke, Häufchen, Geräte, Ostereier.
- Entwicklung: `node --test` prüft zusätzlich die Plätze der Geräte, das Ausweichen der Besucher und die Größeneinheit (25 Tests).

## 0.28.0 (2026-11-11)

Netz und doppelter Boden: Die Karte hält Fehler aus, zeigt sie an und verliert nichts mehr beim Schließen.

- Lebensschleife: Ein Fehler beim Aufräumen nach einer Beschäftigung beendet sie nicht mehr (der Pika stand sonst bis zum Neuladen still). Blinzeln, Ohrenzucken und der 20-Sekunden-Takt laufen nach einem Fehler weiter, ein Wachhund startet eine hängende Schleife neu.
- Tagebuch: Im Fuß steht die Version der Karte auf diesem Gerät, die letzten Fehler lassen sich dort aufklappen.
- Haus-Bote: Nach „Programm abgebrochen und neu gestartet“ lag das Requisit ohne Platz riesig oben links.
- Tiefe (`depth: true`): Die Wolken klebten alle am oberen Rand.
- Der Frosch blinzelt wieder (seine Animation hieß wie das Blinken der Lichterkette).
- Pause bei dunklem Bildschirm hält jetzt auch die Fliege am Häufchen und den Lichthof des Blumengeschenks an.
- Speichern: Beim Verstecken oder Schließen der Seite geht Ungesendetes sofort hinaus; Dauerstreicheln schiebt das Speichern höchstens 4 Sekunden auf.
- Tagesplan: Fehlt der Helfer kurz (Neustart von HA), bleiben offene Änderungen erhalten. Steht im Helfer das Format einer neueren Karte, wird er nicht überschrieben. Namen wie „constructor“ im Verlauf legen die Geräte nicht mehr lahm. Mindestlänge des Helfers jetzt 165 (vorher 120, das reichte nicht mehr).
- Häufchen: Machen zwei Geräte fast gleichzeitig die letzten einzeln weg, zählt das als Großputz (sonst kam nie wieder eins).
- Selbst Gefressenes schreibt den Helfer nur noch bei ganzen Bissen statt im Minutentakt.
- Päckchen: Füttern und Schlafenszeit brechen das Auspacken nicht mehr ab. Ein Schatz bleibt nach einem Abbruch nicht unsichtbar, das Wollknäuel nach dem Kopfball nicht in der Luft hängen. Das Funkeln beim ersten Päckchen sitzt am Knopf.
- `diary: false`: Lang drücken auf den Päckchen-Knopf zeigt nur noch die Schätze, ohne Heute und Gestern.
- Kleinigkeiten: „einen goldenen Plüsch-Pino“ im Tagebuch, kein „Pino…“ im Schlaf bei `friend: false`, Pino wird nach einer Uhrkorrektur neu geplant, unmögliche Geburtstage („31.04.“) werden gemeldet, bei Hagel kommen Frosch und Schnecke nicht.
- Entwicklung: `node --test` prüft Tagesplan, Zustand, Päckchen, Feste, Sonnenzeiten und die Fehlerbehandlung.

## 0.27.2 (2026-11-11)

Bildschirm-Pause nur auf dem Tablet selbst

- screen_entity „aus“ hielt die Karte auf allen Geräten mit diesem Dashboard an (z. B. kiosk-modern am PC: Standbild)
- Rechner mit Maus beachten screen_entity nicht mehr (Fully Kiosk mit JS-Schnittstelle immer)
- Andere Touch-Geräte: Antippen, Scrollen oder Taste bei „aus“ lässt die Karte bis zur nächsten Meldung des Schalters laufen

## 0.27.1 (2026-11-11)

Tagebuch ohne Linienraster, Linien gehören zu den Einträgen

- Das Linienraster hinter dem Inhalt entfällt: Es passte beim Scrollen nie zu den Zeilen
- Jeder Eintrag hat unten eine gestrichelte Linie und links die rote Randlinie, die über die Einträge einer Tageszeit durchläuft
- Nachts sind beide Linien heller

## 0.27.0 (2026-11-11)

Tagebuch (Leiste antippen), Schätze ziehen dorthin um

- Tipp auf die Statusleiste öffnet „Pikas Tagebuch“ als Fenster über dem Dashboard: Heute, Gestern, Schätze
- Einträge aus seiner Sicht mit Icon und Uhrzeit, nach Tageszeit gegliedert; oben ein Satz zur Stimmung und Zähler (gefüttert, gestreichelt, geputzt); das gemalte Bild klebt dabei
- Nichts Neues gespeichert: Die Einträge entstehen beim Öffnen aus dem Verlauf der beiden Helfer in HA (history/history_during_period); ohne Helfer schreibt das Gerät die Stände 3 Tage im Browser mit
- Lange Lücke in der Wachzeit (über 100 Minuten nichts im Verlauf) wird „mein Geheimnis“, erfunden wird nichts
- Schätze: alle acht mit Name, Trick und Gold, Päckchen-Vorrat, Serie, Blüten; lang drücken auf den Päckchen-Knopf schlägt sie auf (die Album-Blase entfällt)
- Roter Punkt am Buch bei neuem Tag oder ausgepacktem Päckchen; schließt sich nach 60 s ohne Berührung; nachts dunkles Papier, schmal als Blatt von unten
- Streicheln zählt fürs Tagebuch bis 99 (anhänglich weiter ab 10)
- Neue Optionen diary und diary_house; ohne Leiste (show_stats: false) ein kleiner Buch-Knopf
- Vorschau: Verlauf wie der Recorder von HA, Knopfzeile Tagebuch mit Beispieltagen

## 0.26.0 (2026-11-10)

Geräte besser im Gleichschritt, Leckerli im Maul

- Im Maul ist jetzt das Leckerli aus dem Päckchen bzw. Heu statt immer einer Blüte
- Futter steht im Tagesplan: fällt auf allen Geräten, er frisst überall, liegt nach dem Neuladen noch da
- Auspacken zeigt jedes Gerät, auf dem jemand zuschaut, zu Ende
- Gemeinsame Uhr ab 250 ms nachgestellt (früher 2 s), Besuche und Beschäftigungen planen danach neu
- Besucher kommen nach kurzem Wegscrollen wieder und steigen über die Dauer des Besuchs ein
- Festtage laufen auf der Uhr von HA
- Pinos Abgang vor der Zeit gilt für alle Geräte; kein Abschied mehr von einem Pino, der schon weg ist
- Haus-Bote: Tür nach Programmende bewegt gilt auch nach dem Neuladen als ausgeräumt

## 0.25.2 (2026-11-10)

Päckchen-Ring nach dem Laden gleich richtig

- Nach dem Neuladen stand der Ring bis zu 20 s auf 0 (als Punkt), bis der nächste Takt den Fortschritt

## 0.25.1 (2026-11-10)

Sonne scheint nicht mehr durch die ferne Hügelkette

- Die dunstige Hügelkette (depth: true) war halbdurchsichtig, die tiefstehende Sonne schien hindurch.

## 0.25.0 (2026-11-10)

Prototyp Tiefe (depth: true)

- Kulisse in Ebenen: Hügel, Berge und Wolken wandern mit dem Pika ein wenig mit, ferne mehr als nahe;
- Hintere Spur: Beim Herumhoppeln geht er manchmal nach hinten zwischen Heu und Stein, höher, kleiner,
- Hinten liegt er hinter Blumen, Futter, Geschenken und Mäusen vorn (Wechsel auf halbem Weg),
- Standard aus, nur im YAML; Vorschau: Knopfzeile Tiefe

## 0.24.0 (2026-11-10)

Knöpfe oben rechts, Blumengeschenk auffälliger und auf allen Geräten

- Futter- und Päckchen-Knopf oben rechts nebeneinander und kleiner (36 px), auf sehr schmalen Karten untereinander; Album klappt darunter auf
- Unten rechts frei: Stein rückt an den Rand, Pika, Pino, Staffelei, Geräte und Festdeko dürfen bis an den Rand
- Blumengeschenk größer, ganz vorn im Gras, große Schleife, Lichthof, Funken und Wackeln; nachts weniger gedimmt
- Blumengeschenk im Tagesplan (Anhang an hay.m): gleiche Stelle und Farbe auf allen Geräten, angenommen überall, 90 Minuten Pause für alle zusammen
- Vorschau: Geschenk nur links, rechts kommt es über den Helfer

## 0.23.0 (2026-11-10)

Stufen für die Schätze

- Ist das Album voll, bringen die Schatz-Päckchen einen Trick (Stufe 2), goldene Päckchen machen einen Schatz mit Trick golden (Stufe 3): 16 weitere Ziele
- Tricks: Kopfball, Windrad anpusten, mit Plüsch-Pino kuscheln, Brille lupfen und zwinkern, Sterngucken in der Dämmerung, Schaukeln in der Hängematte, Regenbogen beim Gießen, Glockenspiel
- Gold: Schatz golden mit Funkeln, Sonnenbrille, Fernrohr und Gießkanne golden; Album zeigt Tricks und Gold
- Plan: Stufen als Anhang "u_v", Geräte bis 0.22 lesen weiter, fehlende Stufen trägt die Karte wieder ein
- Vorschau: Knopfzeile Stufen

## 0.22.1 (2026-11-10)

Pika im Bau liegt hinter Pino

- Hoppelt Pino vor dem Eingang vorbei (z. B. beim Gehen), verdeckt er den Pika im Bau statt umgekehrt

## 0.22.0 (2026-11-09)

Schatten und Füße in Bewegung, Nacht-Accessoires, kleine Zwischenposen

- Schatten schrumpft und verblasst bei jedem Hopser und Sprung (auch bei Pino), Füße bewegen sich beim Hoppeln und werden in der Luft angezogen, Seilspringen mit Schwung statt linear
- Nachts und im Bau gedimmt wie das Fell: Rand und Bommel der Zipfelmütze, Schal, Hüte, Tasse, Milchschaum
- Verbeugung nach der Musik, Gähnen und Blick zurück beim Schlafengehen, Schnuppern vor dem Pflücken, Farbklecks auf der Nase beim Malen

## 0.21.0 (2026-11-09)

Regen-Besucher Frosch und Schnecke

- Frosch (nur bei Regen): hüpft etwa alle 6 Min hinter dem Aussichtsstein hervor, quakt mit Schallblase,
- Schnecke (nur bei Regen): kriecht etwa alle 10 Min ein Stück über die Wiese, reckt die Fühler und kriecht
- Beide kommen auch nachts und bei Starkregen, nicht bei Gewitter, Schneeregen oder unter 3 °C; wie die
- Pika: piepst den Frosch an und zuckt beim Quaken zusammen; schnuppert an der Schnecke und wartet,
- Der Frosch setzt sich nicht auf die Schnecke und hüpft zur Seite, wenn sie herankriecht
- Maus: lief nach dem Wechsel auf die Wiese nicht, sondern sprang ohne Übergang ans Ziel
- Vorschau: Knöpfe für Frosch und Schnecke (sofort, nächster Besuch), README ergänzt

## 0.20.1 (2026-11-09)

Audit-Fixes: Päckchen-Sync, Begrüßung nach der Nacht, St. Martin vor der Schlafenszeit

- Päckchen: Füttern auf einem Gerät ließ auf dem anderen die Warnung stehen (Serie riss trotz Pflege); ein während des Auspackens verschenktes Päckchen bekommt seinen Ballon
- Bildschirm nachts aus, morgens an: er wacht auf und begrüßt dann (auch das Wiedersehen); nachts liegt er gleich im Bett; kein falsches „Du warst lange weg!“ mehr
- St. Martin und Nikolaus-Stiefel beginnen bei früher Schlafenszeit (sunset) 90 Min bzw. 2 Std davor
- Schmollen („hmpf!“) lässt sich nicht mehr wegtippen
- Wetter unavailable/unknown: das letzte gilt 30 Min weiter
- Pino bleibt vor der Knopfspalte
- CSS: Blumen wachsen und werden auch bei Wind gepflückt, keine doppelten Augen, Wolken bleiben bei „Bewegung reduzieren“ am Himmel, Szene nicht mehr scrollbar (overflow: clip)
- Umbenennen im Editor nimmt den Stand im Browser mit

## 0.20.0 (2026-11-09)

Audit-Fixes, Sonnenzeiten aus dem Standort, ruhigere Nächte, Karten-Editor

- Kaffee verfällt nach Unterbrechung, Regen beendet Beschäftigungen, Heuvorrat verfällt täglich
- Bildschirm aus (screen_entity) pausiert alles; Helfer-Schreiben mit Wiederholung bis zum Echo
- Sync: kein doppelter Gewinn, kein Endlos-Senden, neue/unerreichbare Helfer, Uhrversatz zu HA
- Schlafenszeiten deterministisch aus Datum und Standort (Zeitumstellung), Südhalbkugel
- Balance: nachts halber Abbau, Päckchen-Glück zählt nicht als Pflege, Gold-Päckchen als Zähler
- Sprechblasen im Bild, Laufgrenze vor den Knöpfen, Touch/Tastatur/Bewegung reduzieren
- Haus-Bote und Kaffee robuster nach HA-Neustart; Feste: feste Deko-Plätze, Meteorströme, 11:11
- Grafischer Karten-Editor (getConfigForm)

## 0.19.0 (2026-11-09)

Päckchen für gute Pflege, am Ballon verschenkt

- Pflege-Serie: bleibt nichts länger als 60 Min Wachzeit unter 50 %, gibt es
- Wird aus dem gespeicherten Stand nachgerechnet, auch ohne Zuschauer
- Stand im Tagesplan (plan_entity, 6. Feld), Geräte bis 0.18 löschen ihn nicht
- Knopf über dem Löwenzahn, erscheint mit dem ersten Päckchen; Ring zeigt den
- Lang drücken: Album mit 8 Schätzen, Serie, nächstes Päckchen
- Ballon schwebt mit dem Wind herein, Pika schießt ihn vom Stein mit der
- Leckerli der Jahreszeit (Satt und Glück) oder Schätze: Wollknäuel, Windrad,
- gifts: false schaltet alles ab; Vorschau-Knopfzeile Päckchen

## 0.18.0 (2026-11-08)

Mimik, Streicheln nach Stelle, kleine Momente, Träume

- Kopf schief legen (mit ?), rote Bäckchen, ω-Mund, Zungenspitze, Nasenwackeln,
- Zonen: Kopf (reinlehnen), Nase (boop, schielen, niesen), Ohr (flappt), Bauch (kichern, auf den Rücken)
- Combo in 6 s: Pirouette bei 5, schmelzen ab 8, beleidigt bei 11
- Lang drücken = kraulen mit Klopfbein, waagerecht wischen = Fell plustern
- Ab 10× am Tag anhänglich: hoppelt hin, wenn man auf die Wiese tippt
- Gähnen, Niesen (Frühling mit Pollen), Ohr putzen, Kratzen, Schluckauf nach hastigem Fressen,
- Trippeln/große Hopser, Nachwippen beim Landen, seltenes Stolpern, Atmen nach Stimmung
- Großes Wiedersehen nach über 3 Stunden
- Traumblase im Schlaf mit dem, was er erlebt hat (Pino, Kaffee, Flieger, Vogel, Musik ...),
- Streichel-Zähler und Erlebnisse stehen im Tagesplan (plan_entity, fünftes Feld, Tag wechselt um 4 Uhr)

## 0.17.1 (2026-10-23)

Kaffee gemütlicher trinken (2–4 Min), damit man es noch sieht

## 0.17.0 (2026-10-22)

Audit-Fixes und Sparmodus

- Regentag: nach dem ersten Fernsehen wieder große Beschäftigungen (Sperre fällt, wenn nichts übrig bleibt)
- Kaffee: zweiter Bezug wird eingereiht statt gelöscht, verfallene Bezüge gemerkt (kein Phantom-Kaffee),
- Speichern wartet auf die Bestätigung von HA, sendet bei Fehler neu und führt gleichzeitige Änderungen
- Haus-Bote: Abbruch gleich nach dem Start zeigt kein "ausgeräumt", AutoOpen-Spüler wird nach Tür zu
- Flieger: Uhrversatz verfällt (NTP-Sprung), kaputte Einträge werden übersprungen
- Pino wird begrüßt und verabschiedet, auch wenn eine Beschäftigung ansteht
- stretch bleibt nach Abbruch nicht hängen, doppeltes @keyframes sway, Maus mit Verspätung,
- setConfig prüft Helfer, Fehler einer Erweiterung reißen set hass nicht mehr mit
- Sparmodus: außerhalb des Bildes (IntersectionObserver) wie versteckter Tab, Animationen pausiert,
- Mond/Sonne ohne ständig neu startenden 90-s-Übergang
- Schirm, Kerzen und Lichterkette in Stufen, Lichterkette in drei Gruppen, Blumen nachts ohne Wind still,

## 0.16.2 (2026-10-22)

Selbst Gefressenes macht etwas satt (Blume +3, Heu +2, bis 50 %)

## 0.16.1 (2026-10-22)

Regen erst ab Mindestmenge (precip_entity, rain_min)

## 0.16.0 (2026-10-22)

Tagesplan – Beschäftigungen auf allen Geräten gleich, Einstieg nach Neuladen

- Große und kleine Beschäftigungen kommen aus festen Zeitfenstern (seedRnd), mit festem Platz,
- Neuer Helfer plan_entity: Vorrat (Sammeln zählt nur einmal), Frühsport, Verlauf der Beschäftigungen
- Kaffee folgt einer festen Zeitleiste ab Bezugsende, kein Speicher im Browser mehr
- Begrüßung startet keine Beschäftigung mehr; Bildschirm aus = Beschäftigungen auslassen
- Vorschau: Plan-Uhr vorstellen, rechte Karte neu laden

## 0.15.0 (2026-10-18)

Musik, Malen, Seifenblasen, Frühsport, Seilspringen, Gewichtheben; Begrüßung, Tagesform

- Große Beschäftigungen alle 10–15 Min (Bildschirm aus: 30–40), kleine alle 3–5 Min
- Die letzten drei großen kommen nicht gleich wieder; Tagesform aus dem Datum (2 Lieblinge, 1 Unlust)
- Wird die Karte sichtbar (oder geht screen_entity an), winkt er und führt zur Hälfte gleich etwas vor
- Pino kommt alle ~30 Min für 3–6 Min, die Maus bleibt länger und läuft öfter über die Wiese

## 0.14.1 (2026-10-17)

Sterne, Regen, Schnee und Flieger sparsamer

- Sterne funkeln in drei Ebenen zu je acht statt einzeln (3 statt 24 Animationen)
- Regen und Schnee fallen in drei Ebenen mit eigenem Tempo, die ihr Muster
- Flieger alle 5 s statt jede Sekunde nachgeführt: Zielpunkt 5 s voraus mit

## 0.14.0 (2026-10-17)

Pika trinkt mit, wenn ein Kaffee bezogen wird

## 0.13.2 (2026-10-17)

weniger Rechenlast durch Animationen

- Unsichtbare Animationen laufen nicht mehr: ausgeblendete Wolken und Nebel
- Atmen auf einer HTML-Hülle (.br) statt auf <g class="all">: läuft auf dem
- .scene mit contain: strict

## 0.13.1 (2026-10-17)

Flugzeuge weichen sich senkrecht aus statt deckungsgleich zu stehen

## 0.13.0 (2026-10-17)

Haus-Bote als Reihe vorn links am unteren Rand

## 0.12.1 (2026-10-17)

Waschmaschine und Trockner auch auf schmalen Karten am Stein

## 0.12.0 (2026-10-17)

Haus-Bote mit festen Plätzen

## 0.11.0 (2026-10-17)

Erdhügel mit Vorratsnische statt Heuhaufen

## 0.10.3 (2026-10-17)

Flugzeuge ruhiger – feste Plätze, wiederholte Positionen, sanfte Randblende

## 0.10.2 (2026-10-17)

Haus-Bote-Requisiten stehen immer in der ersten Reihe, auch auf schmalen Karten

## 0.10.1 (2026-10-17)

Fortschrittsbalken liegt unter dem Requisit statt auf dessen Fuß

## 0.10.0 (2026-10-17)

Audit-Fixes für Schlaf, Sync, Häufchen, Haus-Bote, Feste, Pino, Layout und Performance

## 0.9.0 (2026-10-17)

Haus-Bote, Festtage, Freund-Pika Pino, Sternschnuppen und Glühwürmchen, gerätesynchrone Besuche

## 0.8.1 (2026-10-17)

Flugzeug-Fähnchen liegt offen vor Statusleiste und Futterknopf
