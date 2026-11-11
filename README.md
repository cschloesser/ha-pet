# Pika Pet Card

Ein kleiner Pika (Pfeifhase) wohnt in deinem Home-Assistant-Dashboard.

- **Antippen** → streicheln: Herzchen, rote Bäckchen, Glück steigt. Je nach Stelle reagiert er anders (siehe [Streicheln](#streicheln))
- **Löwenzahn-Knopf** (oben rechts) → füttern: Futter fällt herunter, er bekommt Sternchenaugen, hoppelt hin, frisst und leckt sich das Mäulchen
- **Tagsüber** schaut er sich um, hoppelt herum, knabbert Blumen, trägt Blüten zu seinem Vorrat (beim Erdhügel in eine Nische im Hügel, sonst auf den Heuhaufen), putzt sich und piepst ab und zu
- **Bau**: Ab und zu verschwindet er in seinem Bau und schaut ein paarmal heraus, bevor er wieder rauskommt
- **Aussichtsstein**: Wie echte Pikas springt er auf den Stein mit Geröll, richtet sich auf und pfeift
- **Nachts** (Standard: Sonnenuntergang bis Sonnenaufgang) schläft er mit Zipfelmütze im Eingang seines Baus
- **Hunger und Glück** sinken langsam, im Schlaf nur halb so schnell. Hat er Hunger (Satt unter 30 %), denkt er an Löwenzahn; unter 15 % lässt er die Ohren hängen
- **Päckchen**: Wer sich gut kümmert, verdient Päckchen. Sie schweben an einem Ballon herein, er schießt sie mit der Zwille vom Himmel (siehe [Päckchen](#päckchen))
- **Tagebuch**: Ein Tipp auf die Leiste oben links schlägt sein Tagebuch auf: was er heute und gestern erlebt hat, und seine Schätze (siehe [Tagebuch](#tagebuch))

## Streicheln

Tippt man ihn an, während er nur herumsitzt, hoppelt oder sich umschaut, reagiert er auf die Stelle. Ist er gerade beschäftigt (Buch, Musik, Futter …), gibt es Herzchen und einen Hüpfer, ohne dass er aufhört; Lang drücken zählt dann wie Antippen (nach gut einer halben Sekunde, noch während der Finger liegt). Mit der Tastatur streichelt Enter oder die Leertaste (der Pika lässt sich mit Tab anwählen); eine gehaltene Taste zählt einmal.

- **Sofort beim Aufsetzen** des Fingers, noch vor dem Loslassen: Er gibt ein wenig nach, die Bäckchen werden rot, die Augen wandern zum Finger. Was er gerade tut, läuft dabei weiter. Mit „Bewegung reduzieren“ bleiben Bäckchen und Blick, das Nachgeben entfällt.
- **Glück**: Ein Tipp gibt 8 Punkte, wenn seit der letzten Berührung mindestens anderthalb Sekunden vergangen sind, schneller hintereinander entsprechend weniger. Dauerfeuer bringt so nicht mehr als ruhiges Tippen, abgezogen wird nie etwas. Am meisten lohnt das Kraulen (siehe unten).

- **Kopf**: Er lehnt sich in die Hand, Augen zu, Ohren angelegt, zufriedenes ω-Mäulchen.
- **Nase**: *boop!* Er schielt auf seine Nase, manchmal muss er niesen.
- **Ohr**: Das Ohr flappt nach, er kichert.
- **Bauch**: Er kichert und kippt manchmal kurz auf den Rücken.
- **Rücken und Po**: Freudensprung wie gehabt.
- **Mehrmals hintereinander** (innerhalb von 6 Sekunden): beim 5. Mal ein Luftsprung mit Funkeln, ab dem 8. Mal schmilzt er zum runden Fellknäuel. Beim 11. Mal ist es ihm zu viel: „hmpf!“, er dreht sich mit Grummelwolke weg, linst dann doch zurück („…na gut“). Solange er schmollt, lässt er sich von weiterem Tippen nicht stören (fürs Glück zählt es trotzdem).
- **Lang drücken** = kraulen: Augen zu, Ohren angelegt, „prrr…“, ein Hinterbein klopft. Solange der Finger liegt (höchstens 20 s), gibt es Herzchen und Glück: 6 Punkte je knapper Sekunde, mehr als jedes Tippen in derselben Zeit. Der Finger darf dabei ruhig etwas rutschen, und die Seite rollt währenddessen nicht mit (vor dem Einsetzen des Kraulens lässt sie sich über dem Pika wie gewohnt schieben). Nach dem Loslassen lässt er sich sofort wieder kraulen. Ein langes Kraulen zählt fürs Tagebuch und fürs Anhänglichsein mehrfach (etwa alle 4,5 s einmal).
- **Waagerecht über ihn wischen** = übers Fell streichen: Es plustert sich auf und legt sich wieder.
- **Im Schlaf**: Antippen, Kraulen und Wischen wecken ihn nicht. Er öffnet kurz ein Auge, es gibt ein Herzchen und manchmal ein verschlafenes „mmh…“. Viermal in 6 Sekunden: „noch fünf Minuten…“, und er dreht sich auf die andere Seite.
- **Anhänglich**: Wurde er heute schon zehnmal gestreichelt (mit `plan_entity` auf allen Geräten zusammengezählt, sonst je Gerät; der Tag wechselt um 4 Uhr nachts), hoppelt er oft hin, wenn man auf die Wiese tippt, und legt den Kopf schief. Fürs Tagebuch zählt er weiter bis 99.
- **Geschenk**: Ab und zu (höchstens alle 90 Minuten, wenn er glücklich ist) pflückt er eine Blume und legt sie mit großer Schleife ganz vorn ins Gras: „für dich!“. Ein warmer Lichthof, Funken und ab und zu ein Wackeln heben sie von den Wiesenblumen ab. Antippen nimmt sie an (Herzchen, Glück steigt). Nimmt sie keiner, welkt sie nach 12 Minuten. Mit `plan_entity` liegt sie auf allen Geräten an derselben Stelle (auch nach dem Neuladen), angenommen ist sie überall, sobald sie auf einem angetippt wurde, und die 90 Minuten gelten für alle Geräte zusammen; ohne Helfer je Gerät. Streicheln unterwegs bringt ihn nicht davon ab; muss er doch etwas anderes tun (Futter, Schlafenszeit), legt er die Blume gleich dort ab.

## Mimik und kleine Momente

Zwischen den Beschäftigungen hat er kleine Eigenheiten. Jedes Gerät würfelt sie selbst, wie das Umschauen und Herumhoppeln.

- **Mimik**: Die Nase wackelt ab und zu, die Schnurrhaare zittern mit. Beim Streicheln werden die Bäckchen rot, ist er glücklich, sitzt er manchmal mit ω-Mäulchen da. Satt, glücklich und sauber atmet er ruhiger, nach dem Herumflitzen schneller.
- **Brauen und Mund** zeigen vier Stimmungen: **Trauer** (Hunger, es geht ihm nicht gut, Spiel verloren, Bild missraten, Hantel zu schwer), **Trotz** (das „hmpf!“ nach zu viel Streicheln, „iih!“ am Häufchen), **Stolz** (fertiges Bild, gestemmte Hantel) und **Staunen** (Flugzeug, Sternschnuppe, fallender Stern, der Inhalt eines Päckchens). Streicheln wischt Trauer und Trotz weg.
- **Kopf schief** mit Fragezeichen, manchmal erst links, dann rechts. Auch wenn ein Vögelchen zurückzwitschert, die Maus schnuppert, ein Flugzeug brummt oder man auf die Wiese tippt.
- **Gähnen** mit großem Mäulchen, danach Schmatzen. Mittags und abends öfter.
- **Niesen**: „ha… haa… hatschi!“, danach schüttelt er die Ohren. Im Frühling öfter (Blütenstaub tanzt vor der Nase), bei Kälte auch.
- **Ohr putzen**: Er zieht das vordere Ohr mit beiden Pfoten übers Gesicht und putzt es.
- **Kratzen** mit der Hinterpfote hinterm Ohr.
- **Schluckauf** nach hastigem Fressen: „hicks!“ mit Hüpfer, bis er „…weg!“ ist.
- **Einnicken** am Nachmittag: Der Kopf sinkt, er schreckt hoch, schaut sich ertappt um („hab nicht geschlafen!“). Streicheln weckt ihn.
- **Schmetterling** (April bis September, trocken, hell, wenig Wind): Er flattert heran und landet auf der Nase. Der Pika schielt und hält still, dann niest er ihn weg oder hopst ihm hinterher.
- **Zoomies**: Ist er sehr glücklich, flitzt er ein paarmal mit großen Hopsern quer über die Wiese und hechelt danach.
- **Gangart**: Kurze Wege trippelt er, eilig macht er große Hopser. Beim Landen wippt er nach, die Ohren schwingen nach. Selten stolpert er beim Herumhoppeln („hoppla!“).
- **Wiedersehen**: War die Karte über 3 Stunden nicht zu sehen (Tab im Hintergrund, Bildschirm aus), hoppelt er nach vorn, winkt mit Sternchenaugen („Du warst lange weg!“) und macht Freudensprünge. Schlief er, als der Bildschirm ausging, und ist inzwischen Morgen, wacht er erst auf und begrüßt dich dann.
- **Träume**: Im Schlaf erscheint ab und zu eine bläuliche Traumblase. Was er am Tag erlebt hat, träumt er öfter: Pino, Kaffee, ein Flugzeug, ein Vögelchen, Musik, der Schmetterling, Löwenzahn oder Klee vom Füttern, ein Herz, wenn er viel gestreichelt wurde. Dazu zuckt er im Schlaf, schmatzt oder murmelt („mip…“, „Pino…“). Was er erlebt hat, steht mit `plan_entity` im Helfer: Kam Pino, während der Bildschirm aus war, träumt das Tablet trotzdem von ihm, sobald ein anderes Gerät den Besuch gezeigt hat. Ohne Helfer merkt sich jedes Gerät nur, was es selbst gezeigt hat. Wann und was er träumt, würfelt jedes Gerät selbst.

## Die Welt antwortet

Auch die Szene lässt sich antippen. Die Antworten sind klein und bleiben auf dem Gerät, auf dem getippt wurde: Sie ändern weder seine Werte noch den Tagesplan, und was er gerade vorhat, läuft weiter. Schläft er, antworten nur die Dinge, er bleibt liegen.

- **Blume**: Sie wackelt und staubt. Steht er in der Nähe und hat nichts vor, kribbelt es ihm in der Nase: „ha… haa… hatschi!“
- **Wolke**: Sie zuckt zusammen und tröpfelt. Er schaut hoch.
- **Stern** (abends und nachts, solange Sterne zu sehen sind): Er fällt als kleine Sternschnuppe vom Himmel und ist nach ein paar Sekunden wieder da. Ist der Pika wach und hat nichts vor, staunt er.
- **Tür**: „klopf, klopf“. Ist er im Bau verschwunden, linst er heraus (das zählt wie Streicheln); ist er draußen, legt er den Kopf schief.
- **Windrad** (Schatz): dreht sich ein paar Sekunden ganz schnell, auch nachts und bei Flaute.
- **Wollknäuel** (Schatz): kullert ein Stück vom Finger weg und bleibt dort liegen.

Was schon ein eigenes Tippziel ist, behält den Vorrang: Pika, Häufchen, Blumengeschenk, Pino, Besucher, Flugzeuge, Geräte, Statusleiste und Knöpfe. Liegt eine Blume unter der Tippfläche eines Flugzeugs, geht das Fähnchen auf.

Alles, was sich antippen lässt (Häufchen, Blumengeschenk, Pino, Besucher, Geräte, Flugzeuge, Ostereier), lässt sich auch mit Tab anwählen und mit Enter oder Leertaste auslösen.

## Päckchen

Wer sich gut um ihn kümmert, verdient Päckchen, die man ihm schenken kann. Darin sind Leckerli oder Schätze für sein Album.

**Verdienen**

- Bleiben Satt, Glück und Sauber auf mindestens 50 %, läuft eine **Pflege-Serie**. Alle **6 Stunden Wachzeit** ohne Unterbrechung gibt es ein Päckchen, mit `sunset`/`sunrise` in Deutschland also gut 1 am Tag im Winter und fast 3 im Hochsommer (rund 2 im Frühjahr und Herbst). Höchstens **3** liegen auf Vorrat. Ändert man die Schlafenszeit, zählt das nur für die Zeit danach.
- **Toleranz**: Rutscht ein Wert unter 50 %, hat man **60 Minuten Wachzeit**, um ihn wieder hochzubringen (füttern, streicheln, putzen). Erst danach reißt die Serie. Was er selbst knabbert und was in einem Päckchen steckt, zählt dafür nicht: Danach muss noch einmal gefüttert, gestreichelt oder geputzt werden.
- **Nacht**: Schlaf zählt weder für den Fortschritt noch gegen die Serie. Satt und Glück sinken im Schlaf nur halb so schnell, wer abends füttert und streichelt, findet ihn morgens meist noch über 50 %. Rutscht doch etwas darunter, laufen die 60 Minuten ab dem Aufwachen.
- **Reißt die Serie**, ist nur der Fortschritt zum nächsten Päckchen weg, Vorrat und Album bleiben. Die neue Serie beginnt, sobald alles wieder über 50 % ist.
- **Goldenes Päckchen**: Nach 7 Tagen am Stück (und nach jeder weiteren Woche) kommt eins dazu, höchstens zwei liegen auf Vorrat. Darin ist immer ein Schatz bzw. eine neue Stufe (siehe [Stufen](#stufen)), solange es noch eine gibt.
- Niemand muss dafür zuschauen: Zwischen zwei Aktionen sinken die Werte nur. Wann einer unter 50 % fiel, rechnet die Karte beim nächsten Füttern, Streicheln oder Putzen aus dem gespeicherten Stand nach, auch wenn der Bildschirm die ganze Nacht aus war.

**Knopf**

- Der Päckchen-Knopf sitzt oben rechts links neben dem Löwenzahn (auf sehr schmalen Karten, wenn der Platz neben der Statusleiste nicht reicht, darunter). Bis zum ersten Päckchen gibt es ihn nicht; dann ploppt er mit Funkeln herein.
- Ein **Ring** zeigt den Fortschritt zum nächsten Päckchen, eine Zahl den Vorrat. Ist nichts da, ist er blass, bei vollem Vorrat wackelt er ab und zu.
- Liegt ein Wert unter 50 % und die 60 Minuten laufen, **pulsiert der Ring orange**, ein kleines Zeichen am Knopf zeigt, was fehlt (Blatt = Hunger, Herz = Streicheln, Funkeln = Putzen). Ist schon wieder alles über 50 % (nur selbst geknabbert), leuchtet er ruhig orange, bis du einmal fütterst, streichelst oder putzt. Ist die Serie gerissen, ist er grau.
- **Lang drücken** schlägt im [Tagebuch](#tagebuch) die Schätze auf (das Album): alle 8 Schätze mit Namen (fehlende als Schatten), die Serie in Tagen, wie viele Päckchen da sind, wann das nächste kommt und was gerade fehlt („Hunger!“, „Streicheln!“, „Putzen!“). Ein Schatz erscheint dort erst, wenn er ausgepackt ist. Bei jedem steht, was er damit macht, mit Stufe 2 der Trick (blauer Punkt), mit Stufe 3 „golden“ (in Gold).

**Schenken**

- Antippen: Ein Ballon mit dem Päckchen schwebt von der Seite herein, aus der der Wind kommt, und bleibt zwischen Heu und Stein in der Luft, wo er im Wind schaukelt.
- Der Pika entdeckt ihn („oh!“), springt auf den Aussichtsstein, zielt mit der Zwille (ein Auge zu) und schießt. Manchmal geht der erste Schuss knapp daneben. Der Ballon platzt mit Konfetti, das Päckchen fällt auf die Wiese und hüpft einmal auf.
- Er hoppelt hin, schnuppert, zupft die Schleife auf, der Deckel springt ab, und er hält den Inhalt hoch.
- **Schläft er**, schwebt der Ballon, bis er aufwacht. Bei einer großen Beschäftigung holt er ihn danach, bei Gewitter, wenn er wieder herauskommt.
- Es ist immer nur ein Ballon in der Luft. Tippt man noch einmal, schüttelt der Knopf „nein“.
- Alle Geräte zeigen denselben Ballon mit demselben Inhalt. Ausgepackt ist er, sobald ein Gerät es gezeigt hat; auf den anderen verschwindet er dann.

**Inhalt**

- **Leckerli** (meistens): Erdbeere (Mai bis Juli), Himbeeren (Juli bis September), Apfelschnitz (September bis November) oder ein Blumensträußchen. Satt +15 und Glück +15, er frisst es gleich.
- **Schätze**: Das erste Päckchen und etwa jedes dritte enthält einen Schatz, der noch fehlt. Jedes Päckchen bringt Glück +15 (zählt nicht als Pflege für die Serie). Verschenken zwei Geräte gleichzeitig, gilt nur ein Päckchen, und nur einmal gibt es Leckerli und Glück.

| Schatz | Wo | Was er damit macht |
|---|---|---|
| Wollknäuel | auf der Wiese | stupst es an, es kullert, er hinterher |
| Windrad | neben Heu bzw. Nische | dreht sich mit dem echten Wind, bei Flaute ganz langsam |
| Plüsch-Pino | im Bau | liegt nachts vor ihm, er kuschelt im Schlaf damit |
| Sonnenbrille | trägt er | bei Sonne ab 24 °C |
| Fernrohr | trägt er | schaut damit vom Stein, am liebsten echten Flugzeugen nach |
| Hängematte | auf der Wiese | Nickerchen, vor allem nachmittags |
| Gießkanne | links am Bau | gießt die Blumen, danach wachsen zwei neue |
| Glöckchen | an der Tür | bimmelt, wenn er herauskommt und wenn Pino kommt |

- Von Wollknäuel, Hängematte und Gießkanne stehen höchstens zwei zugleich auf der Wiese. Welche, wechselt jeden Tag (auf allen Geräten gleich), der neueste (auch der zuletzt aufgewertete) ist immer dabei.

**Stufen**

Ist das Album voll, geht es weiter: Jeder Schatz lässt sich zweimal aufwerten, das sind 16 weitere Ziele.

- **Stufe 2, ein neuer Trick**: In den Päckchen, die sonst einen fehlenden Schatz brächten (das erste und etwa jedes dritte), steckt dann ein Trick für einen Schatz, der noch keinen hat. Er führt ihn gleich nach dem Auspacken vor („neuer Trick: Kopfball!“).
- **Stufe 3, golden**: Nur aus goldenen Päckchen, und nur für Schätze, die schon ihren Trick haben (gibt es keinen, bringt das goldene einen Trick). Der Schatz wird golden und funkelt ab und zu; Sonnenbrille, Fernrohr und Gießkanne trägt bzw. hält er dann golden.
- Haben alle Schätze alles, was sie aus solchen Päckchen bekommen können, gibt es nur noch Leckerli.

| Schatz | Trick (Stufe 2) |
|---|---|
| Wollknäuel | **Kopfball**: stupst es hoch, köpft es und es fliegt im Bogen weiter („Tor!“) |
| Windrad | **Anpusten**: bei wenig Wind pustet er es an, dann dreht es sich kurz ganz schnell |
| Plüsch-Pino | **Kuscheln**: holt ihn tagsüber aus dem Bau und kuschelt mit ihm auf der Wiese |
| Sonnenbrille | **Brille lupfen**: schiebt sie hoch und zwinkert („lässig!“) |
| Fernrohr | **Sterngucken**: in der Dämmerung bei klarem Himmel sucht er die ersten Sterne |
| Hängematte | **Schaukeln**: schaukelt mit Schwung, bevor er einnickt |
| Gießkanne | **Regenbogen**: bei Sonne steht ein Regenbogen im Wasserstrahl, es wachsen drei Blumen statt zwei |
| Glöckchen | **Glockenspiel**: bimmelt an der Tür eine kleine Melodie |
- Mit `plan_entity` stehen Serie, Vorrat und Album im Helfer und gelten auf allen Geräten, sonst je Gerät. Mit `gifts: false` gibt es keine Päckchen.

## Tagebuch

Tippt man oben links auf die Statusleiste (das kleine Buch vor dem Namen), geht „Pikas Tagebuch“ auf: ein Notizbuch über dem Dashboard mit vier Reitern.

- **Heute** und **Gestern**: Was er erlebt hat, aus seiner Sicht und mit Uhrzeit, gegliedert in Morgens, Mittags, Nachmittags, Abends und Nachts. Der Tag wechselt wie beim Streicheln um 4 Uhr nachts.
  - Oben steht ein Satz, wie es ihm geht, darunter Zähler: wie oft er gefüttert, gestreichelt und geputzt wurde.
  - Einträge gibt es für Aufwachen (mit den beiden Lieblingsbeschäftigungen des Tages) und Schlafengehen, Festtage, Beschäftigungen (das gemalte Bild klebt als Bildchen dabei), Pino, Vögelchen, Flugzeug, Schmetterling, Kaffee, ausgepackte Päckchen mit Inhalt (Schatz, Trick, golden, Leckerli), verdiente Päckchen, das Blumengeschenk (angenommen, wartet noch, verwelkt), gesammelte Blüten, den Großputz, einen knurrenden Bauch (Satt unter 30 %), eine gerissene Serie und fertige Haushaltsgeräte.
  - Je Tageszeit stehen höchstens zwei Beschäftigungen ausführlich da (Malen, Frühsport und die Lieblinge des Tages zuerst; „3ד, wenn er es öfter tat), der Rest in einer Zeile „Außerdem: …“. Ein Tablet, das den ganzen Tag an ist, füllte sonst Seiten.
  - Pino, Vögelchen, Flugzeug, Schmetterling und Kaffee stehen einmal am Tag da (beim ersten Mal), so wie er sie sich für die Träume merkt.
  - **Geheimnis**: Steht in seiner Wachzeit länger als 100 Minuten nichts im Verlauf (kein Gerät hat ihn gezeigt), erfindet das Tagebuch nichts: „Was ich gemacht habe, bleibt mein Geheimnis.“ Nur die längste Lücke des Tages.
  - Je Ereignis gibt es mehrere Sätze. Welcher erscheint, hängt an Ereignis und Minute: Alle Geräte zeigen denselben, auch beim zweiten Öffnen.
- **Schätze**: alle acht Schätze mit Stufe, Päckchen im Vorrat und wann das nächste kommt (bzw. was fehlt), Pflege-Serie in Tagen, Blüten im Vorrat. Lang drücken auf den Päckchen-Knopf schlägt diesen Reiter direkt auf.
- **Entdeckungen**: was man mit ihm und seiner Welt alles tun kann, aus seiner Sicht, in drei Abschnitten (Streicheln, Kümmern, Meine Welt). Die Seite ersetzt eine Einführung: Jede Zeile sagt, wie es geht. Vor dem, was auf diesem Gerät schon ausprobiert wurde, steht ein Pfotenabdruck. Gezeigt wird nur, was es bei dieser Karte gibt (Pino, Päckchen, Flugzeuge, Geräte nur, wenn eingerichtet; Windrad und Wollknäuel erst, wenn ausgepackt). Die Pfoten merkt sich nur der Browser des Geräts (nichts davon steht in den Helfern), es gibt dafür weder Fristen noch Belohnungen.
- **Woher es kommt**: Gespeichert wird dafür nichts Neues. Die Karte liest beim Öffnen den Verlauf der beiden Helfer aus Home Assistant (die letzten zwei Tage) und leitet die Einträge aus den Änderungen von Zustand und Tagesplan ab, die Uhrzeit ist der Zeitstempel der Änderung. Darum zeigen alle Geräte dasselbe Tagebuch, und „Gestern“ ist gleich nach dem Update gefüllt. Der Recorder muss die Helfer dafür aufzeichnen (das ist der Standard); sonst steht unten ein Hinweis. Ohne Helfer schreibt das Gerät die Stände im Browser mit (3 Tage) und kennt nur, was es selbst gezeigt hat. Mit `appliances` liest die Karte auch den Verlauf der Geräte (`state`).
- **Was nicht drinsteht**: Kleinigkeiten, die jedes Gerät selbst würfelt (Niesen, Zoomies, Seilspringen, Gewichtheben, was er mit Pino spielt), Maus, Frosch und Schnecke, und alles, was kein Gerät gezeigt hat.
- **Bedienung**: Schließen mit ✕, einem Tipp neben das Buch oder Esc. Nach 60 Sekunden ohne Berührung schließt es sich selbst (Wand-Tablet). Ein roter Punkt am Buch zeigt Neues: ein neuer Tag oder ein ausgepacktes Päckchen seit dem letzten Aufschlagen (je Gerät gemerkt). Nachts ist das Papier dunkel, auf schmalen Bildschirmen kommt das Buch als Blatt von unten.
- **Fuß**: Ganz unten steht die Version der Karte auf diesem Gerät (so sieht man, ob ein Gerät noch eine alte geladen hat). Gab es seit dem Laden Fehler, lassen sich die letzten zehn dort aufklappen; auf einem Wand-Tablet ist das der einzige Ort, an dem man sie sieht.
- Mit `show_stats: false` gibt es statt der Leiste einen kleinen Buch-Knopf oben links. `diary: false` schaltet den Einstieg ab (die Schätze bleiben über langes Drücken auf den Päckchen-Knopf erreichbar, ohne die Reiter Heute, Gestern und Entdeckungen; gemerkt wird dann auch nichts), `diary_house: false` lässt Kaffee und Haushaltsgeräte weg.

## Häufchen und Sauberkeit

- Über den Tag macht er kleine Häufchen: etwa alle 80–140 Minuten, solange er wach ist (etwa 5–10 am Tag, je nach Tageslänge). Das erste kommt 10–30 Minuten nach dem Aufwachen, nachts keins.
- Wie echte Pikas geht er dafür in seine **Klo-Ecke** am Aussichtsstein. Liegen dort schon drei, sucht er sich einen Platz auf der Wiese. Seit dem letzten Großputz kommen höchstens 8 (einzeln weggemachte zählen mit), ihre Plätze werden erst wieder frei, wenn alles sauber ist. Ist alles weggemacht, gilt das als Großputz.
- Schaut man gerade zu, sieht man es live: hinhoppeln, umschauen, Hocke, Po-Wackeln, *plopp*.
- **Häufchen antippen** → Schaufel, weg, Funkeln. Ist alles sauber, funkelt die Wiese, er macht einen Freudensprung und Glück steigt um 10.
- Der **Sauber-Balken** (hellblau) verliert 10 % pro Häufchen und 2 % pro Stunde, die es liegt. Nach 4 Stunden kreist tagsüber eine kleine Fliege darüber.
- Schmutz **deckelt das Glück**: Höchstens 60 % + 0,4 × Sauberkeit sind zu sehen. Streicheln zählt trotzdem; nach dem Putzen zeigt der Balken wieder den vollen Wert. Unter 60 % schnuppert er an Häufchen und wendet sich mit „iih!“ ab, unter 30 % lässt er die Ohren hängen.
- Wann und wo Häufchen liegen, wird aus dem gespeicherten Zustand berechnet. Darum sehen alle Geräte dieselben Häufchen an denselben Stellen. Füttern, Streicheln und Putzen auf zwei Geräten gleichzeitig werden zusammengeführt.

## Besuch

- **Vögelchen**: Alle paar Minuten fliegt ein kleines, rundes Rotkehlchen, eine Blaumeise oder ein Spatz im Bogen heran. Es landet auf Laterne, Schornstein, Schild, Blumenkasten, Hügelkuppe oder dem Aussichtsstein (je nach Areal andere Plätze), legt den Kopf schief, pickt, hüpft, plustert sich auf und zwitschert. Nach 15–45 Sekunden fliegt es weiter. Es kommt nur bei Tag und nicht bei Regen.
- **Maus**: Hinter dem Aussichtsstein schaut eine kleine Maus seitlich oder über die Kuppe hervor, schnuppert und wackelt mit den Ohren. Meistens flitzt sie auf die Wiese, macht Männchen, schnuppert sich ein, zwei Stückchen weiter und läuft zurück (15–25 Sekunden). Sie kommt auch nachts, aber nicht bei Regen.
- **Frosch** (nur bei Regen): Etwa alle 6 Minuten hüpft ein kleiner Frosch hinter dem Aussichtsstein hervor auf die Wiese. Er sitzt 12–26 Sekunden da, quakt mit dicker Schallblase („quak!“), blinzelt, schnappt mit der Zunge nach Tropfen, hüpft ein Stück weiter und dann zurück hinter den Stein.
- **Schnecke** (nur bei Regen): Etwa alle 10 Minuten kriecht eine Schnecke mit braunem, gelbem oder rosa Haus hinter dem Stein hervor, ein Stück über die Wiese, reckt die Fühler, schaut sich um und kriecht zurück (40–70 Sekunden).
- Frosch und Schnecke kommen bei Regen und Starkregen, auch nachts. Bei Gewitter, Schneeregen und unter 3 °C bleiben sie weg. So ist bei Starkregen draußen etwas los, während der Pika im Bau sitzt.
- An Festtagen setzen sich Frosch, Schnecke und Maus neben Kürbis, Stiefel, Kranz, Kuchen oder Geschenk statt dahinter (die Deko steht eine Ebene vor ihnen).
- Der Pika schaut hin, piepst das Vögelchen an (es zwitschert zurück) und geht neugierig ein Stück auf die Maus zu. Kommt er zu nah, flitzt sie mit „piep!“ zurück. Springt er auf den Stein, fliegt ein Vögelchen dort vorher weg. Den Frosch piepst er an; quakt der zurück, zuckt er zusammen. Kommt er ihm zu nah, hüpft der Frosch mit großen Sätzen davon. An der Schnecke schnuppert er: Sie zieht sich ins Haus zurück, er wartet mit schiefem Kopf, bis sie wieder herausschaut.
- **Antippen** verscheucht Vögelchen, Maus und Frosch. Die Schnecke kann nicht weglaufen: Sie zieht sich für ein paar Sekunden ins Haus zurück (noch einmal antippen: das Haus wackelt, sie bleibt länger drin).
- Besuche werden aus der Uhrzeit berechnet, deshalb kommen Vögelchen, Maus, Frosch, Schnecke und Pino auf allen Geräten gleichzeitig.

## Freund-Pika

Ein paarmal am Tag kommt **Pino** zu Besuch, ein Freund-Pika: etwas kleiner, ingwerfarben, mit türkisem Halstuch und hellem Fleck auf der Stirn.

- **Wann**: Etwa alle 30 Minuten kommt Pino und bleibt 3–6 Minuten. Er kommt nur, wenn der Pika wach ist, es Tag ist und es nicht regnet oder gewittert. Passt es zu Beginn nicht (z. B. kurzer Niesel), kommt er später im selben Zeitfenster. In den letzten 10 Sekunden des Besuchs fangen die beiden kein neues Spiel mehr an, damit Pino auf allen Geräten gleichzeitig geht.
- **Ankunft**: Pino hoppelt vom linken oder rechten Rand herein und piepst. Der Pika bemerkt ihn, ruft „Pino!“, hoppelt zu ihm, und die beiden stupsen sich mit den Nasen an (Herzchen).
- **Zusammen spielen**: Meistens spielen sie miteinander, ab und zu macht der Pika auch etwas allein.
  - **Fangen**: Abwechselnd hoppelt einer davon und der andere hinterher, mit kleinen Staubwölkchen.
  - **Zusammen sitzen**: Die beiden sitzen nebeneinander, schauen in dieselbe Richtung und wackeln mit den Ohren. Einer putzt den anderen.
  - **Aussichtsstein**: Der Pika springt auf den Stein und pfeift, Pino schaut von unten hoch und piepst zurück. Manchmal hüpft Pino hinterher und setzt sich hinter ihn.
  - **Knabbern**: Der Pika pflückt eine Blume, Pino knabbert an einer anderen oder von der anderen Seite an derselben.
  - **Piep-Duett**: Die beiden piepsen abwechselnd, immer schneller, zum Schluss zusammen.
- **Pinos Eigenleben**: Ist der Pika mit etwas anderem beschäftigt, hoppelt Pino herum, putzt sich, schaut sich um, piepst, blinzelt und zuckt mit den Ohren. Er bleibt auf der Wiese und geht nicht in den Bau.
- **Antippen** streichelt Pino: Herzchen, ein kleiner Freudensprung und ein Piep. Die Balken des Pikas ändern sich dadurch nicht. Wird der Pika gestreichelt, kommt Pino neugierig näher und schaut zu.
- **Abschied**: Pino sagt „tschüss!“ und hoppelt zum Rand hinaus. Der Pika schaut ihm nach und lässt kurz die Ohren hängen. Geht der Pika schlafen, schlägt das Wetter um oder dämmert es (Sonne höchstens 3° über dem Horizont), geht Pino sofort.
- Besuche werden aus der Uhrzeit berechnet, deshalb kommen Vögelchen, Maus und Pino auf allen Geräten gleichzeitig. Mit `friend: false` kommt Pino nicht, mit `friend_name` bekommt er einen anderen Namen.

## Beschäftigungen

Große Beschäftigungen (1–2,5 Minuten) gibt es alle 9–19 Minuten. Dazwischen kommen alle paar Minuten kleine (10–30 Sekunden): Seilspringen, Gewichtheben und eine Blüte für den Vorrat holen.

- **Tagesplan**: Wann was drankommt, wird aus der Uhrzeit berechnet. Darum zeigen alle Geräte zur selben Zeit dieselbe Beschäftigung, mit demselben Platz, demselben Bild an der Staffelei, denselben Gameboy-Runden und Übungen. Wird die Seite neu geladen (oder geht der Bildschirm an), steht der Pika gleich mitten in der laufenden Beschäftigung, so weit wie auf den anderen Geräten. Nur Kleinigkeiten dazwischen (umschauen, herumhoppeln, putzen) und das Spielen mit Pino würfelt jedes Gerät selbst. Die kleinen Beschäftigungen beginnen nur, wer zu Beginn dabei ist.
- **Abwechslung**: Die letzten drei großen Beschäftigungen kommen nicht gleich wieder dran. Der Verlauf steht im Helfer `plan_entity` (siehe Installation): Wer eine Beschäftigung zuerst beginnt, trägt sie dort ein, die anderen Geräte übernehmen sie, auch wenn sich das Wetter inzwischen änderte. Ohne Helfer merkt sich jedes Gerät den Verlauf selbst.
- **Tagesform**: Jeden Tag hat er zwei Lieblingsbeschäftigungen (doppelt so oft) und eine, auf die er keine Lust hat (selten). Sie werden aus dem Datum gewürfelt und sind auf allen Geräten gleich.
- **Tageszeit**: Nachmittags liest er lieber, abends macht er lieber Musik, mittags malt er lieber.
- **Begrüßung**: Wird die Karte sichtbar (Bildschirm geht an, App oder Dashboard wird geöffnet), winkt er „Hallo!“. Ist er gerade beschäftigt, ruft er nur „Huhu!“; schläft er, blinzelt er mit einem Auge. Höchstens alle 5 Minuten. Mit `screen_entity` (z. B. dem Bildschirm-Schalter von Fully Kiosk) zählt auch das Einschalten des Bildschirms. Bei ausgeschaltetem Bildschirm ruht auf dem Gerät alles wie bei einem Tab im Hintergrund (Beschäftigungen, Besuche, Animationen); sobald er angeht, steigt der Pika mitten in der laufenden Beschäftigung ein. Das gilt nur auf dem Gerät mit diesem Bildschirm: Auf einem Rechner mit Maus läuft die Karte weiter, auf einem anderen Touch-Gerät mit demselben Dashboard nach dem ersten Antippen bzw. Scrollen.

Die großen:

- **Buch lesen** am Vorrat oder vor der Tür: Der Kopf wandert die Zeilen entlang, er blättert um und kichert. Nachmittags nickt er manchmal mit dem Buch ein. Streicheln weckt ihn.
- **Gameboy**: Die Daumen tippen, kleine Piepser steigen auf. Nach jeder Runde macht er einen Freudensprung („Juhu!“) oder lässt die Ohren hängen („mööp“).
- **Tablet**: Er liegt auf dem Bauch in der Wiese, das Display scheint ihm ins Gesicht, er wischt. Fliegt gerade ein echtes Flugzeug vorbei, zeigt das Tablet die Flugkarte, und er schaut zum Himmel.
- **Drachen** bei Wind ab 20 km/h, trocken und hell: Der Drache steigt in Windrichtung auf, schwankt mit Schwänzchen und zerrt an der Schnur.
- **Fernsehen** im Bau, bei Regen und Gewitter oder in der Dämmerung: Er sitzt mit dem Rücken zu uns im dunklen Eingang. Der Bildschirm leuchtet über seinem Kopf, sein Fell hat einen bunten Lichtsaum, beim Erdhügel flackert auch das Fenster. Ab und zu dreht er sich um und schaut heraus. Streicheln holt ihn kurz an die Tür.
- **Musik**: Ukulele, er wiegt sich, Noten steigen auf. Manchmal singt er mit („la-la-la ♪“) oder verspielt sich („plonk!“). Sitzt ein Vögelchen da, zwitschert es mit. Zum Schluss Verbeugung.
- **Malen** an der Staffelei, trocken und hell: Das Bild entsteht Schicht für Schicht (Himmel in der Farbe der Tageszeit, Sonne, Hügel, Motiv, Kleinkram). Motive: Blume, Selbstbildnis, Bau, Regenbogen, Pino oder ein Flugzeug, wenn gerade eins fliegt. Zwischendurch betrachtet er es, am Ende ist er stolz (oder nicht ganz zufrieden). Manchmal landet dabei ein Farbklecks auf seiner Nase, den er sich zum Schluss wegputzt.
- **Seifenblasen**, trocken, hell, Wind unter 30 km/h: Die Blasen treiben mit dem Wind, schillern und platzen. Ab und zu springt er einer hinterher („plopp!“). Antippen bringt eine Blase zum Platzen; platzt sie direkt vor seiner Nase, niest er.
- **Frühsport** einmal am Morgen (10–180 Minuten nach dem Aufwachen, die erste trockene Gelegenheit): Stirnband, Hampelmann, Kniebeugen, Laufen auf der Stelle, Strecken; er zählt mit und schwitzt. Mit `plan_entity` turnt er auf allen Geräten nur einmal, auch nach dem Neuladen.

Die kleinen:

- **Seilspringen**: Er zählt mit, wird manchmal schneller oder springt doppelt durch. Verheddert er sich, ist Schluss („hoppla!“).
- **Gewichtheben** mit der Pusteblumen-Hantel: in die Hocke, „hnnngh!“, über den Kopf. Manchmal plumpst sie herunter, oben fliegen gern ein paar Schirmchen davon.
- **Blüte sammeln**: Er pflückt eine Blume von der Wiese und wirft sie auf den Heuhaufen bzw. in die Nische (höchstens 12, jeden Tag fallen 2 weg). Mit `plan_entity` ist der Vorrat auf allen Geräten derselbe, mit denselben Blütenfarben; zeigen mehrere Geräte dasselbe Sammeln, zählt es nur einmal.

## Haus-Bote

Der Pika zeigt, was Waschmaschine, Trockner und Spülmaschine gerade machen (Home Connect; die Zustandsnamen von Miele, LG ThinQ und SmartThings werden auch erkannt). Jedes Gerät bekommt ein kleines Requisit am Bau:

| Gerät | Läuft | Fertig, noch zu | Ausgeräumt |
|---|---|---|---|
| Waschmaschine | Holzzuber mit Seifenschaum, Blasen steigen auf | Korb mit nasser Wäsche daneben, es tropft | Wäscheleine mit vier bunten Stücken, die im Wind wehen |
| Trockner | Holztrommel auf einem Gestell dreht sich, im Bullauge purzeln Socken, warme Luft steigt auf | Stapel flauschiger Handtücher, der dampft | Trommel mit offener Luke |
| Spülmaschine | Tisch mit Spülschüssel, ein Teller taucht ein | Stapel glänzender Teller, der funkelt | leere Schüssel, Geschirrtuch über der Tischkante |

- **Läuft**: Unter dem Requisit zeigt ein schmaler Balken den Fortschritt (ohne Prozentwert läuft er hin und her). Ab und zu beschäftigt sich der Pika damit: Er rührt im Zuber und bekommt eine Seifenblase auf die Nase, legt sich vor die Trommel und schaut ihr zu (die Augen drehen mit), oder er tunkt einen Teller in die Schüssel. Bei Pause und Startvorwahl steht alles still, bei Störung oder „Hilfe nötig“ blinkt ein rotes Ausrufezeichen.
- **Fertig**: Das Requisit hüpft alle paar Sekunden kurz. Der Pika hoppelt alle 3–6 Minuten hin (ist es schon über eine Stunde fertig, nur noch alle 20–30 Minuten), tätschelt oder stupst es, dreht den Kopf zu dir und sagt Bescheid („Wäsche!“, „flauschig!“, „Geschirr!“, „fertig!“).
- **Ausgeräumt**: Nur nach einem echten Programmende: Das Gerät wechselt von „fertig“ auf „aus“, die Tür geht bei „fertig“ auf, oder es geht kurz vor Programmende direkt auf „aus“. Einschalten, Abbrechen oder eine gelöschte Startvorwahl zählen nicht. Siehst du gerade zu, räumt der Pika sichtbar mit auf (auch beim direkten Wechsel auf „aus“; ein Päckchen packt er vorher noch fertig aus): Er hängt die Wäsche Stück für Stück an die Leine, trägt ein Handtuch in seinen Bau oder poliert einen Teller und bringt ihn hinein. Danach freut er sich. Das Ausgeräumt-Requisit bleibt 20 Minuten stehen, danach verschwindet alles bis zum nächsten Lauf. Nach dem Neuladen der Seite erscheint „ausgeräumt“ nur, wenn der Fortschritt noch bei etwa 100 % steht und in der Stunde vor dem Ausschalten dorthin kam, und nicht kurz nach einem Neustart von Home Assistant.
- **Tür** (`door`): Die Spülmaschine gilt als ausgeräumt, sobald die Tür bei „fertig“ aufgeht. Den AutoOpen-Spalt in den ersten 2 Minuten nach Programmende ignoriert der Pika, und Tür wieder zu macht sie nicht wieder „fertig“.
- **Antippen** eines Requisits blendet ein Fähnchen ein (nach 9 s geht es wieder zu): Gerätename und Stand, z. B. „62 % · fertig um 14:35“, „fertig seit 35 Min“ oder „ausgeräumt“.
- **Platz**: Alle Requisiten stehen ganz vorn am unteren Bildrand, vor dem Pika, damit er sie nie verdeckt, von links in der Reihenfolge von `appliances`. Frei bleiben dabei der Eingang (dort schläft der Pika), die Bodendeko der Festtage und der Vorrat (Nische bzw. Heuhaufen): Das erste Gerät steht links neben der Tür, das zweite zwischen Tür und Vorrat, ein drittes rechts hinter dem Vorrat am Rand der Wiese (Häufchen liegen dann erst rechts davon). Reicht der Platz so nicht, werden alle gemeinsam gleich stark kleiner (bis ein Viertel); erst auf sehr schmalen Karten dürfen sie den Vorrat, dann die Deko verdecken, die Tür zuletzt. Die hohe Wäscheleine steht kleiner. Bodendeko der Festtage steht dafür an festen Plätzen: Kürbis und Stiefel auf der Wiese zwischen Heuhaufen bzw. Nische und Stein, Adventskranz und Kuchen rechts neben der Tür (der Kuchen im Advent links daneben); die Geräte weichen ihr aus.
- Zwei Geräte gleichen Typs ohne `name` heißen „Waschmaschine 1“ / „Waschmaschine 2“. Schläft der Pika (und nachts bei Geräten, die nicht laufen), halten die Requisiten still, das schont schwache Tablets.
- Ist ein Gerät kurz `unavailable` oder `unknown` (WLAN weg), bleibt alles, wie es war. Nach einem Neustart von Home Assistant setzt HA `last_changed` neu, „fertig seit …“ zählt dann ab dem Neustart.

```yaml
appliances:
  - type: washer                 # washer | dryer | dishwasher
    name: Waschmaschine          # optional, Standard je Typ: Waschmaschine / Trockner / Spülmaschine
    state: sensor.waschmaschine_betriebszustand
    progress: sensor.waschmaschine_programm_fortschritt   # optional, Fortschritt in % (oder Anteil 0–1)
    end: sensor.waschmaschine_programm_endzeit             # optional, Endzeit (Zeitstempel) oder Restzeit (Zahl mit Einheit s/min/h, Standard min, oder h:mm)
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

Betriebszustände: `run`, `pause`, `delayedstart`, `actionrequired`, `error`, `aborting` zählen als „läuft“, `finished` als „fertig“, `ready` und `inactive` als „aus“. Schaltet sich ein Gerät nach dem Ausräumen ab (`ready` → `inactive`), verlängert das die 20 Minuten nicht. Unbekannte Zustände und fehlende Entities meldet die Karte einmal in der Browser-Konsole. Ohne `appliances` passiert nichts.

## Kaffee

Machst du dir am Kaffeevollautomaten (Home Connect) ein Getränk, trinkt der Pika mit:

- **Während des Bezugs** hebt er die Nase, schnuppert und denkt an eine Tasse Kaffee (Denkblase). Dann setzt er sich erwartungsvoll neben den Bau. Schläft er, zuckt er nur kurz.
- **Ist der Bezug fertig**, holt er sich aus dem Bau dasselbe Getränk und trinkt es in aller Ruhe Schluck für Schluck (rund 2–4 Minuten, damit man es noch sieht, wenn man mit der Tasse zum Tablet kommt), oben auf dem Aussichtsstein oder neben dem Bau. Alle Geräte trinken im selben Takt; wird ein Bildschirm erst später sichtbar, steigt er mit dem passend leeren Gefäß ein. Beim Schluck macht er die Augen zu, der Füllstand sinkt, solange es heiß ist, dampft es. Gefäße: Latte Macchiato und Caffè Latte im hohen Glas mit Löffel, Cappuccino, Flat White & Co. in der Tasse mit Schaumherz, Espresso und Ristretto im Tässchen, Kaffee und Caffè Crema im gepunkteten Becher, Heißwasser als Tee mit Teebeutel, warme Milch und Milchschaum im Glas. Bei Milchgetränken bekommt er ein Milchschaum-Bärtchen und leckt es am Ende ab. Danach macht der Koffein ein paar Freudensprünge, dann bringt er das leere Gefäß zurück in den Bau.
- **Schläft er**, weckt ihn der Duft: Er trinkt verschlafen vor der Tür und schläft danach weiter. Bei Sturm bleibt er im Bau, der Kaffee verfällt.
- Spülen beim Ein- und Ausschalten und Reinigungsprogramme zählen nicht. Fertig ist ein Bezug, wenn das Programm mindestens 15 s nach dem Hochzählen des Tassenzählers endet (hat die Karte den Bezug nicht live gesehen, höchstens 3 Minuten danach). Ein Neustart von Home Assistant zählt nicht. Packt er gerade ein Päckchen aus oder räumt mit auf, macht er das zuerst fertig.
- Holen und Trinken folgen einer festen Zeitleiste ab dem Ende des Bezugs (je nach Getränk ein Schluck alle 25–45 Sekunden). Darum trinken alle Geräte im selben Takt. Lädt man die Seite neu, steht er gleich mit dem passend leeren Gefäß da; ist es auf den anderen Geräten schon ausgetrunken, kommt nichts mehr. Gemerkt werden muss dafür nichts. Wird er beim Trinken unterbrochen (Bildschirm aus, Gewitter), trinkt er danach weiter, solange nach der Zeitleiste noch etwas übrig ist; sonst verfällt der Rest.

```yaml
coffee:
  active: select.kaffeevollautomat_aktives_programm          # aktives Programm (Getränk läuft)
  counter: sensor.kaffeevollautomat_kaffee_und_milchtassen   # optional, Tassenzähler (für Neuladen, ohne nur live)
  selected: select.kaffeevollautomat_ausgewahltes_programm   # optional, Getränkeart, falls der Bezug nicht live gesehen wurde
```

## Flugzeuge

Echte Flüge aus der Umgebung ziehen über den Himmel. Die Daten kommen aus der [Flightradar24-Integration](https://github.com/AlexandrErohin/home-assistant-flightradar24) (HACS), Sensor `sensor.flightradar24_current_in_area`.

- **Position**: Osten links, Westen rechts (auf der Südhalbkugel umgekehrt, siehe unten). Der Bildrand liegt bei `flight_radius` (Standard 15 km, so groß wie der Radius der Integration). Flugzeuge außerhalb davon belegen keinen Platz; Flüge ganz ohne Kennung (ID, Rufzeichen, Flugnummer, Kennzeichen) werden ausgelassen.
- **Höhe und Größe**: Ein Anflug steht knapp über den Hügeln und ist groß, ein Flieger in Reiseflughöhe steht weit oben und ist klein, ab etwa 8000 m mit Kondensstreifen.
- **Bewegung**: Zwischen den Meldungen der Integration (alle 10–30 s) fliegen sie mit Kurs, Geschwindigkeit und Steig- oder Sinkrate weiter.
- **Antippen** blendet ein Fähnchen ein (nach 9 s geht es wieder zu): Flugnummer und Ziel, z. B. „EW 9542 → Palma de Mallorca“. Landet der Flug in der Nähe (unter 30 km), steht stattdessen die Herkunft da, z. B. „aus Katowice“. Darunter stehen Airline, Flugzeugtyp, Strecke, Höhe und Tempo. Ohne Antippen sieht man nur die Flugzeuge.
- **Aussehen**: Leitwerk in Airline-Farbe. Kleinflugzeuge und Hubschrauber haben eigene Grafiken. Nachts leuchten Kabinenfenster, Blitzer und Rundumleuchte. Bei bedecktem Himmel sind hohe Flieger nur blass zu sehen, bei Nebel alle.
- **Anzahl**: höchstens `max_flights` gleichzeitig (Standard 2), die nächsten zuerst. Ein Flugzeug, das schon zu sehen ist, behält seinen Platz, solange es gemeldet wird; ein deutlich näheres (z. B. ein tiefer Anflug) kommt als zusätzliches dazu. Flugzeuge am Boden zählen nicht.
- **Ruhig**: Zum Rand des Meldebereichs hin blenden Flugzeuge sanft ein und aus, statt mitten im Bild aufzutauchen. Meldet die Integration eine Position unverändert noch einmal, fliegen sie einfach weiter.
- **Pika**: Er schaut tief fliegenden Flugzeugen nach und sagt manchmal „brumm!“. Ist eins ganz nah, erschrickt er kurz.

## Himmel und Wetter

Der Blick geht nach Süden: Osten (Sonnenaufgang) ist links, Westen rechts. Auf der Südhalbkugel (`latitude` < 0 in Home Assistant) geht er nach Norden, dort steht die Sonne mittags: Osten ist rechts, Westen links, der zunehmende Mond ist links hell; Flugzeuge und Wind folgen derselben Blickrichtung.

- **Sonne** steht nach Azimut und Höhe aus `sun.sun` am Himmel und geht hinter dem Hügel unter. Der Himmel wechselt zwischen Tag, Dämmerung und Nacht.
- **Mond** mit echter Phase und echtem Stand, berechnet aus Datum und Standort (`hass.config`). Tagsüber ist er blass zu sehen, wenn er über dem Horizont steht.
- **Wetter** aus `weather_entity`:
  - Wolken nach Bedeckung, grauer Himmel bei bedecktem Wetter
  - Regen, Starkregen, Gewitter mit Blitzen, Schnee mit verschneiten Hügeln, Nebelschwaden. Sprech- und Denkblasen, „zzz“ und die Zeichen über dem Kopf (auch Pinos Blase) liegen über dem Wetter und bleiben lesbar.
  - Mit `precip_entity` (Niederschlag in mm/h) regnet es bei „rainy“ erst ab `rain_min` (Standard 0,3 mm/h). Vorhersagen wie DWD melden „rainy“ schon bei Niesel, der oft gar nicht ankommt.
  - Wolken ziehen und Blumen biegen sich mit Windstärke und Windrichtung (Windeinheit der Wetter-Entität: km/h, m/s, mph, kn, ft/s oder Beaufort)
  - Ist die Wetter-Entität kurz `unavailable` oder `unknown` (Aussetzer des Dienstes), gilt das letzte Wetter bis zu 30 Minuten weiter. So kommt er nicht mitten im Gewitter heraus.
- **Pika** reagiert darauf:
  - Bei Regen hält er sich ein Blatt als Schirm über den Kopf und bleibt in der Nähe seines Baus. Fängt es mitten in einer Beschäftigung an, die nur trocken geht (Lesen, Gameboy, Seilspringen …), hört er damit auf; Fernsehen geht weiter.
  - Bei Starkregen und Gewitter verkriecht er sich im Bau, schaut ab und zu heraus und erschrickt bei Blitzen.
  - Bei Regen kommen Frosch und Schnecke zu Besuch (siehe [Besuch](#besuch)).
  - Unter 3 °C trägt er einen Schal.
  - Bei Schnee knabbert er an seinem Heuvorrat.
- **Glühwürmchen** in Sommernächten (Mai bis September, auf der Südhalbkugel November bis März): 10 bis 14 Stück schwirren tief über der Wiese und um den Heuhaufen und blinken unregelmäßig gelbgrün, in der späten Dämmerung schon ein paar schwächer. Bei Regen und Gewitter verschwinden sie. Ist der Pika wach, setzt er sich hin, schaut ihnen nach und hüpft nach einem.
- **Sternschnuppen** nachts bei klarem Himmel (nicht bei dichter Bewölkung, Nebel, Regen oder Schnee): alle paar Minuten eine, ab und zu ein heller Bolide, der kurz aufleuchtet, selten zwei kurz nacheinander. Zu den Meteorströmen (Perseiden um den 12. 8., Geminiden um den 14. 12.) kommen sie dreimal so oft. Ein wacher Pika schaut manchmal hoch: „oh!“
- **Bewegung reduzieren** (Systemeinstellung): Feuerwerk nur als sanftes Aufleuchten mit wenigen Raketen, wenig Konfetti ohne Drehen, keine Fledermäuse, Wimpel und Maibaum-Bänder hängen still, Glühwürmchen glimmen am Platz, Sternschnuppen ohne Boliden.

## Areale

Mit `areal` wählst du den Bau:

- `huegel` (Standard): Grashügel mit runder Holztür, Namensschild, Rundfenster mit Blumenkasten, Vorratsnische rechts im Hügel (dort legt er die gesammelten Blüten ab, statt eines Heuhaufens) und Laterne. Nachts brennt Licht, bei unter 12 °C und abends raucht der Schornstein.
- `fels`: Steinhaufen mit Steinbogen als Eingang
- `stumpf`: Baumstumpf mit Höhle zwischen den Wurzeln, Fliegenpilze leuchten nachts
- `alpin`: Geröllhalde mit Bergen im Hintergrund, Enzian und Edelweiß

## Festtage

Über das Jahr schmückt der Pika seinen Bau. Alles richtet sich nach dem Datum in Ortszeit, ist reine Zierde (kostet keine Werte, wird nicht gesammelt) und passt sich Tag und Nacht an. Mit `festive: false` bleibt nur der Geburtstag.

| Wann | Deko | Pika |
| --- | --- | --- |
| **Halloween** 24.–31. 10. | geschnitzter Kürbis auf der Wiese vor dem Stein, nachts leuchtet das Gesicht flackernd | schnuppert am Kürbis (nur trocken), erschrickt („huch!“), kichert; am 31. 10. mit Hexenhut, nachts flattern Fledermäuse über den Himmel |
| **St. Martin** 11. 11. | bunte Papierlaterne hängt am Bau, leuchtet abends | ab 16 Uhr zieht er bei trockenem Wetter mit einer Laterne am Stab über die Wiese: „Laterne, Laterne…“ (geht er früher schlafen, etwa mit `sunset`, schon 90 Minuten vor der Schlafenszeit); um 11:11 Auftakt der Karnevalszeit: einmal Konfetti und „Helau!“ (wach, hell, trocken) |
| **Advent** 1. Advent bis 24. 12. | Adventskranz vor dem Bau rechts neben der Tür, so viele Kerzen brennen, wie Adventssonntage waren; Lichterkette an der Bau-Oberkante (bis 6. 1., leuchtet in Dämmerung und Nacht) | |
| **Nikolaus** 5. 12. ab 18 Uhr (bei früher Schlafenszeit schon 2 Stunden davor), 6. 12. | Stiefel auf der Wiese vor dem Stein, am 6. 12. gefüllt (Löwenzahn, Nüsse, Zuckerstange) | schaut hinein und freut sich („oh!“) |
| **Weihnachten** 24.–26. 12. | Tannenbaum mit Kugeln, Lichterkette und Stern zwischen Heu und Stein, Geschenk darunter | trägt eine Weihnachtsmütze (auch beim Schlafen statt der Zipfelmütze), staunt vor dem Baum |
| **Silvester** 31. 12. ab 23:55 bis 1:00 | Feuerwerk: Raketen, bunte Kugeln mit Funken, Lichtschein auf der Wiese, um Mitternacht ein Finale; am 1. 1. liegen zwei abgebrannte Raketenstäbe im Gras | wacht um Mitternacht auf, schaut aus dem Bau, zuckt bei jedem Knall: „Frohes Neues!“, dann schläft er weiter (bei Gewitter oder Starkregen schaut er auch wach nur aus dem Bau); ein Vögelchen fliegt beim Knall davon |
| **Karneval** Weiberfastnacht bis Aschermittwoch | Luftschlangen am Bau, alle paar Minuten regnet Konfetti (wenn er wach, es hell und trocken ist) | Partyhütchen, hüpft bei trockenem Wetter im Konfetti: „Helau!“ |
| **Ostern** Karfreitag bis Ostermontag | 4–6 bunt bemalte Eier im Gras (antippen = wackeln) | hoppelt hin, schnuppert, stupst ein Ei an |
| **Maibaum** 30. 4. ab 18 Uhr, 1. 5. | Maibaum mit Kranz hinter dem Bau, die Bänder wehen mit dem Wind | |
| **Sommerfest** 21. 6. | Wimpelkette zwischen Bau und Stein | macht öfter Freudensprünge |
| **Geburtstag** (`birthdays`) | Kuchen mit Kerze vor dem Bau rechts neben der Tür (im Advent links), Girlande „ALLES ♥ GUTE“ | Partyhütchen, pustet die Kerze aus (nach 20 s brennt sie wieder): „Alles Gute, Mia!“ |

Geburtstage stehen in der Konfiguration, mehrere am selben Tag werden zusammen gefeiert („Alles Gute, Mia und Tom!“). Das Datum geht als `MM-TT`, `JJJJ-MM-TT`, `TT.MM.` oder `TT.MM.JJJJ`, auch ohne Anführungszeichen (`14.10` ist der 14. Oktober, `12.06` der 12. Juni). Ohne Anführungszeichen den Monat immer zweistellig schreiben: YAML macht aus `5.1` und `5.10` dieselbe Zahl, beides gilt als 5. Oktober; der 5. Januar ist `05.01` (oder `"5.1."`). Ein nicht erkanntes Datum meldet die Karte einmal in der Browser-Konsole. Wer am 29. 2. Geburtstag hat, feiert sonst am 28. 2.

```yaml
birthdays:
  - name: Mia
    date: "03-14"
  - name: Tom
    date: "11-02"
```

In `preview.html` stellen die Festtage-Knöpfe die Uhr der Karte auf den jeweiligen Tag (Karneval und Ostern im aktuellen Jahr berechnet), „Mitternacht“ zeigt das Aufwachen zum Feuerwerk, „Aktion!“ startet die passende Fest-Aktion sofort, „Heute“ stellt die echte Zeit wieder her.

## Installation (HACS)

1. HACS → ⋮ → *Benutzerdefinierte Repositories* → `https://github.com/cschloesser/ha-pet`, Typ **Dashboard**
2. *Pika Pet Card* herunterladen; die Ressource wird automatisch eingetragen
3. Optional einen Text-Helfer anlegen, damit der Pika auf allen Geräten denselben Zustand hat:
   *Einstellungen → Geräte & Dienste → Helfer → Text*, z. B. `input_text.pika_status` (max. Länge 100). Ein neuer Helfer bekommt nach etwa 20 s Startwerte, ein leerer sofort; ist er `unavailable`, wird nichts überschrieben und nichts gesendet; bleibt er beim Laden länger als 60 s `unavailable`, spielt die Karte lokal weiter und legt das Gefütterte und Gestreichelte auf seinen Stand, sobald er wiederkommt. Fehlt die Entity, spielt die Karte lokal weiter (Hinweis in der Browser-Konsole).
4. Optional einen zweiten Text-Helfer für den Tagesplan (Vorrat, Frühsport, Verlauf der Beschäftigungen, wie oft er heute gestreichelt wurde, was er erlebt hat, Päckchen, Blumengeschenk), z. B. `input_text.pika_plan` mit **max. Länge 255**, als `plan_entity` eintragen (unter 165 wird nichts gesendet, Hinweis in der Konsole). Ohne ihn laufen die Beschäftigungen trotzdem auf allen Geräten gleichzeitig, nur Vorrat, Frühsport, Abwechslung, Anhänglichkeit, Träume, Päckchen und Blumengeschenk merkt sich jedes Gerät selbst. Der Vorrat, den ein Gerät bis 0.15 gesammelt hat, wird beim ersten Mal übernommen.

## Konfiguration

Die Karte hat einen grafischen Editor: Helfer, Wetter, Sonne und Bildschirm-Schalter wählt man dort aus der Liste, Schlafenszeiten tippt man ein. Geburtstage, Haushaltsgeräte und Kaffee stehen darin als YAML-Felder. HA-Versionen ohne Formular-Editor für eigene Karten zeigen nur den YAML-Editor.

```yaml
type: custom:pika-pet-card
name: Pika                       # Name in der Statusanzeige
entity: input_text.pika_status   # optional, sonst nur lokal im Browser gespeichert
plan_entity: input_text.pika_plan   # optional: Tagesplan für alle Geräte (max. Länge 255)
sleep_start: sunset              # Schlafenszeit (Standard: Sonnenuntergang)
sleep_end: sunrise               # Aufwachzeit (Standard: Sonnenaufgang)
sun_entity: sun.sun              # Sonnenstand
weather_entity: weather.forecast_home   # Wetter (Standard: met.no-Integration)
precip_entity: sensor.niederschlag      # optional: Niederschlag in mm/h
rain_min: 0.3                    # ab so viel mm/h regnet es bei "rainy" (nur mit precip_entity)
shooting_stars: true             # Sternschnuppen nachts bei klarem Himmel
fireflies: true                  # Glühwürmchen in Sommernächten
areal: huegel                    # Bau: huegel, fels, stumpf, alpin
flight_entity: sensor.flightradar24_current_in_area   # Flugzeuge (leer = keine)
flight_radius: 15                # Radius der Flightradar24-Integration in km
max_flights: 2                   # höchstens so viele Flugzeuge gleichzeitig
festive: true                    # Festtage-Deko im Jahreslauf (false = nur Geburtstage)
birthdays:                       # Geburtstage: Kuchen, Girlande, „Alles Gute, Mia!“ (Datum MM-TT)
  - { name: Mia, date: "03-14" }
show_stats: true                 # Satt-/Glück-/Sauber-Balken
diary: true                      # Tagebuch: Antippen der Leiste (false = aus)
diary_house: true                # Kaffee und Haushaltsgeräte im Tagebuch (false = weglassen)
gifts: true                      # Päckchen für gute Pflege (false = keine)
friend: true                     # Freund-Pika kommt zu Besuch (false = nie)
friend_name: Pino                # Name des Freund-Pikas
height: 180                      # Mindesthöhe in px (im Abschnitts-Layout zählt die Zeilenhöhe)
appliances:                      # Waschmaschine, Trockner, Spülmaschine, siehe Haus-Bote
coffee:                          # Kaffeevollautomat, siehe Kaffee
screen_entity: switch.tablet_bildschirm   # optional: Bildschirm-Schalter (Fully Kiosk), siehe Beschäftigungen
depth: false                     # Prototyp: Kulisse in Ebenen und hintere Spur, siehe unten
```

Für `sleep_start` und `sleep_end` gehen feste Uhrzeiten (`"21:00"`) oder `sunset`/`sunrise`, auch mit Versatz: `"sunset+01:00"` (eine Stunde nach Sonnenuntergang), `"sunrise-30"` (30 Minuten vor Sonnenaufgang). Sonnenauf- und -untergang rechnet die Karte für jeden Tag aus dem Standort von HA (auf allen Geräten gleich, auch am Abend vor der Zeitumstellung); nur ohne Standort kommen sie aus `sun.sun`. Ohne beides gilt 21:00 bis 07:00, der Himmel richtet sich dann nach der Schlafenszeit. Uhrzeiten am besten in Anführungszeichen; `21:00` ohne geht aber auch (YAML macht 1260 daraus, reine Zahlen gelten als Minuten nach Mitternacht). Unverständliche Angaben wie `sunset+1h` fallen auf 21:00/07:00 zurück, mit Hinweis in der Konsole.

`wind_bearing` des Wetters darf eine Gradzahl oder ein Kürzel sein („SW“, „NNO“). Geht die Uhr eines Geräts falsch, gleicht die Karte das aus (ab einer Viertelsekunde Abweichung, geschätzt aus den Zeitstempeln von HA): Beschäftigungen, Besuche, Schlafenszeit, Häufchen, Päckchen, Haus-Bote, Kaffee und Flugzeuge laufen nach der Uhr von HA, auf allen Geräten gleich. Auf schmalen Karten (z. B. Handy) werden Aussichtsstein und Heuhaufen automatisch kleiner (die Nische des Erdhügels gehört zum Bau und behält ihre Größe), damit alles ins Bild passt. Ist die Karte schmaler als 3:2 (Handy im Abschnitts-Layout, Hochformat), bemisst sich die ganze Szene an der Breite statt an der Höhe: Bau, Pika und Stein werden gemeinsam kleiner und stehen unten, darüber ist mehr Himmel. Die Statusleiste läuft nie unter den Futterknopf: Ein langer Name endet mit „…“, auf schmalen Karten werden erst die Balken kürzer, dann fällt der Name weg. Im Abschnitts-Layout braucht die Karte mindestens 9 von 12 Spalten. Leiste und Knöpfe lassen sich auf mindestens 44 px antippen (unsichtbarer Rand). Fliegt ein Flugzeug tief über Pika, Pino, Besucher, Häufchen oder Geräte, gilt der Tipp ihnen und nicht dem Flugzeug; die Knöpfe liegen immer über den Tippflächen der Flugzeuge. Der Vorrat (Heuhaufen bzw. Nische) steht mit `plan_entity` im Helfer, sonst im Browser des Geräts. Was im Browser liegt, ist unter dem Namen der Karte gespeichert: Benennst du ihn im grafischen Editor um, nimmt die Karte den Stand mit. Änderst du `name` direkt im YAML des Dashboards, fängt ein Gerät ohne Helfer von vorn an.

Im Text-Helfer steht der Zustand als `satt,zeit,glück,zeit,großputz,maske,teilputz` (Zeiten in Sekunden, nach der Uhr von HA). Hunger, Glück und Häufchen werden daraus beim Anzeigen berechnet, deshalb braucht es keine Automation. Ältere Werte mit vier Feldern werden weiter gelesen. Jedes Schreiben (auch das des Tagesplans) wartet auf die Bestätigung von HA: Geht es verloren (Verbindung weg, Fehler), sendet die Karte erneut, und schrieben zwei Geräte gleichzeitig, werden beide Änderungen zusammengeführt. `entity` und `plan_entity` müssen zwei verschiedene `input_text`-Helfer sein, sonst zeigt die Karte eine Fehlermeldung. Läuft auf einem Gerät noch eine Version bis 0.17, schreibt es den Tagesplan ohne Streichel-Zähler und Erlebnisse zurück; nach dem Neuladen aller Geräte ist das vorbei. Geräte bis 0.18 kennen die Päckchen nicht und schreiben den Plan ohne sie zurück, Geräte bis 0.22 die Stufen der Schätze nicht, Geräte bis 0.23 das Blumengeschenk nicht (es verschwindet dann auf den anderen), Geräte bis 0.26 zählen das Streicheln nur bis 10. Neuere Geräte merken sich den letzten Päckchen-Stand und tragen ihn wieder ein, solange sie offen sind; trotzdem am besten alle Geräte neu laden.

**Tiefe (Prototyp, `depth: true`, nur im YAML):** Die Hügel im Hintergrund stehen in Ebenen und wandern mit dem Pika ein wenig mit, je weiter weg, desto mehr (dazu eine dunstige Hügelkette ganz hinten; im Areal alpin bewegen sich die Berge am stärksten). Wiese, Bau, Stein und Heu bleiben stehen. Beim Herumhoppeln geht er manchmal auf eine hintere Spur zwischen Heuhaufen und Stein: dort steht er höher, ist kleiner und liegt hinter Blumen, Futter und Geschenken. Jede andere Beschäftigung holt ihn nach vorn. Die Spur ist je Gerät, nicht im Tagesplan.

Die Karte schont das Gerät: Ist sie nicht zu sehen (Tab im Hintergrund, Bildschirm aus, aus dem Bild gescrollt), ruhen Schleife, Besuche und alle Animationen. Nach längerer Pause wählt sie die nächste Beschäftigung erst mit frischem Stand aus HA. Nachts ohne Wind stehen die Blumen still, Kerzen, Lichterkette und Regenschirm bewegen sich in Stufen. Mit der Systemeinstellung „Bewegung reduzieren“ ruhen Wolken, Sterne, Blumen, Rauch, Niederschlag und Blinklichter, Blitze hellen die Karte nur sanft auf, statt Luftsprüngen macht er kleine Hüpfer, und herumflitzen (Zoomies) tut er nicht.

## Entwicklung

`node --test` (im Ordner des Repos, ab Node 20) prüft die reinen Funktionen der Karte: Tagesplan (lesen, schreiben, Länge, wiederholbare Änderungen), Zustand und Zusammenführen, Päckchen-Stufen, Feste, Sonnenzeiten, den Fehlerspeicher und den Wachhund der Lebensschleife, dazu das Glück fürs Streicheln (Dauerfeuer, Kraulen), die Trefferwahl der Welt-Tipps, die Mimik und die Entdeckungen. Die Tests laden `pika-pet-card.js` unverändert mit ein paar Attrappen für `window` und `document`. Die Schleife selbst hält Fehler aus: Wirft eine Beschäftigung oder das Aufräumen danach, merkt sich die Karte den Fehler (siehe Fuß des Tagebuchs) und macht weiter; bleibt sie trotzdem länger als gut anderthalb Minuten an etwas hängen, startet der Wachhund sie neu.

`preview.html` lädt die Karte mit einem simulierten `hass`-Objekt. Die Häufchen-Knöpfe stellen die Uhr der Häufchen vor (nächstes Häufchen, +4 Std., +1 Tag), die Besuch-Knöpfe holen Vögelchen, Maus, Frosch und Schnecke sofort (auch ohne Regen) oder stellen die Besuchsuhr kurz vor den nächsten berechneten Besuch, die Hobby-Knöpfe starten eine Beschäftigung sofort (auch ohne passendes Wetter), die Flieger-Knöpfe schicken Testflüge los (Anflug, Abflug, Reiseflug, Hubschrauber, Kleinflugzeug). Dafür den Ordner über einen lokalen Webserver öffnen, z. B. `node dev/serve.mjs . 8765` (lauscht nur auf localhost). `areale.html` zeigt alle vier Areale nebeneinander. Die Zeile Tiefe schaltet `depth` um, schickt ihn auf die hintere bzw. vordere Spur und wechselt das Areal. Die Knopfzeilen Himmel-Extras, Festtage, Freund-Pika, Haus-Bote, Kaffee und Aktivitäten lösen die jeweiligen Erweiterungen sofort aus (Festtage stellen dafür das Datum der Karte um, Haus-Bote und Kaffee setzen Mock-Zustände der Geräte; ein Kaffeebezug dauert dort 18 s). Beide Vorschau-Karten teilen sich die Helfer wie zwei Geräte: „Uhr vor“ stellt die Plan-Uhr kurz vor die nächste große oder kleine Beschäftigung, „rechte Karte neu laden“ zeigt den Einstieg mitten in einer laufenden. Die Zeile Süßes startet die kleinen Momente sofort (das Geschenk nur links, rechts erscheint es über den Helfer), spielt Streichel-Zonen und Combos ohne genaues Zielen ab, krault 4 s, wischt übers Fell, stellt „heute oft gestreichelt“ ein, holt das Wiedersehen nach 4 Stunden und zeigt nachts sofort einen Traum. Die Zeile Päckchen gibt links ein Päckchen bzw. ein goldenes dazu, verschenkt es, stellt den Beginn der Serie zurück (12 Stunden, 7 Tage), lässt Satt unter 50 % fallen oder tut so, als läge ein Wert schon seit 2 Stunden darunter (der Ring wird grau, Füttern startet eine neue Serie), füllt das Album, setzt alles zurück, zeigt das Album und startet die Schatz-Aktionen sofort. Die Zeile Stufen gibt allen Schätzen im Album ihren Trick bzw. macht sie golden (vorher „Album voll“ für alle acht), nimmt die Stufen wieder weg und startet die Tricks sofort (Sterngucken stellt die Dämmerung ein, Schaukeln holt die Hängematte auf die Wiese). Die Vorschau führt für beide Helfer einen Verlauf wie der Recorder von HA; die Zeile Tagebuch öffnet das Tagebuch der linken Karte bzw. die Schätze, zeigt zwei volle Beispieltage (fertige Ereignisse statt des Verlaufs), schiebt den bisherigen Verlauf um 3 Stunden oder einen Tag zurück (so wandert Erlebtes nach gestern), blendet die Leiste aus (dann erscheint der Buch-Knopf) und zeigt, wie viele Stände im Verlauf liegen.
