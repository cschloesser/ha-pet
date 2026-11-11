# Änderungen

Jede Version der Pika Pet Card, die neueste zuerst.

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
