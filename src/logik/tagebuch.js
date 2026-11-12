// Tagebuch: Grenzen, Entdeckungen, Texte, Ereignisse aus dem Verlauf ableiten

import { seedRnd } from './hilfen.js';
import { RATE } from './zustand.js';
import { MEM_BITS } from './tagesplan.js';
import { ACT_WIN } from './beschaeftigungen.js';
import { GIFT, GIFT_TRE, giftMile, giftAllGold } from './paeckchen.js';
import { URLAUB } from './urlaub.js';

// Tippt man auf die Statusleiste, geht „Pikas Tagebuch“ auf: was er heute und gestern erlebt hat (aus seiner Sicht),
// dazu seine Schätze. Gespeichert wird dafür nichts Neues: Die Einträge entstehen beim Öffnen aus dem Verlauf der
// beiden Helfer in HA (history/history_during_period), also aus den Änderungen von Zustand und Tagesplan samt
// Uhrzeit. Ohne Helfer schreibt das Gerät dieselbe Liste selbst im Browser mit (DIARY.keep). Was kein Gerät gezeigt
// hat, steht nicht im Verlauf: Dafür erfindet das Tagebuch nichts, eine lange Lücke bleibt „mein Geheimnis“.
// keep/max: Mitschrift im Browser, close: schließt sich nach so langer Ruhe selbst (Wand-Tablet), gap: ab so langer
// Lücke in der Wachzeit ein Geheimnis, acts: so viele Beschäftigungen je Tageszeit ausführlich (der Rest in einer Zeile)
const DIARY = { keep: 3 * 864e5, max: 400, close: 60000, gap: 100 * 6e4, acts: 2 };
// Seite „Entdeckungen“: was man mit ihm und seiner Welt tun kann (statt einer Einführung), aus seiner Sicht. k: Kennung
// (bleibt fest, sie steht im Browser-Speicher), g: Abschnitt, t: Titel, h: wie es geht, need: nur zeigen, wenn es das
// hier gibt (gift: Päckchen an, friend: Freund an, flight und bote: eingerichtet, wheel und yarn: Schatz ausgepackt).
// {n} = Name des Freunds. Nichts davon läuft ab oder wird belohnt: Es ist ein Nachschlagen, keine Aufgabenliste.
const FIND_GROUPS = ['Streicheln', 'Kümmern', 'Meine Welt'];
const FINDS = [
  { k: 'head', g: 0, t: 'Kopf', h: 'Tipp mir auf den Kopf. Ich lehne mich in deine Hand.' },
  { k: 'nose', g: 0, t: 'Nase', h: 'Tipp mir auf die Nase. Boop!' },
  { k: 'ear', g: 0, t: 'Ohr', h: 'Tipp ein Ohr an. Es flappt nach.' },
  { k: 'belly', g: 0, t: 'Bauch', h: 'Tipp mir auf den Bauch. Das kitzelt!' },
  { k: 'back', g: 0, t: 'Rücken', h: 'Tipp mir auf den Rücken oder den Po. Ich mache einen Freudensprung.' },
  { k: 'kraul', g: 0, t: 'Kraulen', h: 'Leg den Finger auf mich und lass ihn liegen. Das mag ich lieber als schnelles Tippen.' },
  { k: 'stroke', g: 0, t: 'Übers Fell streichen', h: 'Wisch waagerecht über mich. Mein Fell plustert sich auf.' },
  { k: 'combo', g: 0, t: 'Fünfmal hintereinander', h: 'Tipp mich fünfmal schnell an. Dann gibt es einen Luftsprung.' },
  { k: 'melt', g: 0, t: 'Achtmal hintereinander', h: 'Noch öfter, und ich schmelze dahin.' },
  { k: 'pout', g: 0, t: 'Elfmal hintereinander', h: 'Irgendwann reicht es mir. Hmpf! Lange böse bin ich aber nie.' },
  { k: 'sleep', g: 0, t: 'Im Schlaf', h: 'Streichle mich, wenn ich schlafe. Ich wache nicht auf, aber ich merke es.' },
  { k: 'meadow', g: 0, t: 'Auf die Wiese tippen', h: 'Ich schaue hin. Hast du mich heute schon oft gestreichelt, komme ich angehoppelt.' },
  { k: 'feed', g: 1, t: 'Füttern', h: 'Der Löwenzahn-Knopf oben rechts lässt Futter fallen.' },
  { k: 'clean', g: 1, t: 'Saubermachen', h: 'Tipp ein Häufchen an, dann kommt die Schaufel.' },
  { k: 'bloom', g: 1, t: 'Mein Geschenk annehmen', h: 'Manchmal lege ich dir eine Blume mit Schleife ins Gras. Tipp sie an.' },
  { k: 'parcel', g: 1, t: 'Päckchen schenken', h: 'Der Päckchen-Knopf oben rechts schickt mir eins am Ballon.', need: 'gift' },
  { k: 'album', g: 1, t: 'Schätze aufschlagen', h: 'Drück lange auf den Päckchen-Knopf.', need: 'gift' },
  { k: 'flower', g: 2, t: 'Blume', h: 'Tipp eine Blume an. Sie staubt, und stehe ich daneben, muss ich niesen.' },
  { k: 'cloud', g: 2, t: 'Wolke', h: 'Tipp eine Wolke an. Sie tröpfelt.' },
  { k: 'star', g: 2, t: 'Stern', h: 'Tipp abends oder nachts einen Stern an. Er fällt vom Himmel.' },
  { k: 'door', g: 2, t: 'Tür', h: 'Klopf an meine Tür. Bin ich im Bau, linse ich heraus.' },
  { k: 'wheel', g: 2, t: 'Windrad', h: 'Stups mein Windrad an. Es dreht sich ganz schnell.', need: 'wheel' },
  { k: 'yarn', g: 2, t: 'Wollknäuel', h: 'Stups mein Wollknäuel an. Es kullert davon.', need: 'yarn' },
  { k: 'visitor', g: 2, t: 'Besuch', h: 'Tipp Vögelchen, Maus, Frosch oder Schnecke an.' },
  { k: 'pino', g: 2, t: '{n}', h: 'Ist {n} zu Besuch: auch antippen. Das gibt Herzchen.', need: 'friend' },
  { k: 'bubble', g: 2, t: 'Seifenblase', h: 'Puste ich Seifenblasen, kannst du sie platzen lassen. Plopp!' },
  { k: 'plane', g: 2, t: 'Flugzeug', h: 'Tipp ein Flugzeug an. Ein Fähnchen zeigt, wohin es fliegt.', need: 'flight' },
  { k: 'device', g: 2, t: 'Haushaltsgerät', h: 'Tipp ein Gerät am Bau an. Ein Fähnchen zeigt, wie weit es ist.', need: 'bote' },
];
const FIND_IDS = new Set(FINDS.map((f) => f.k));
// Im Browser gemerkt als „head,nose,…“. Unbekanntes (ältere oder neuere Karte) wird überlesen.
const findsParse = (s) => new Set(String(s || '').split(',').filter((k) => FIND_IDS.has(k)));
const findsSer = (set) => FINDS.filter((f) => set.has(f.k)).map((f) => f.k).join(',');
// Texte aus seiner Sicht. Mehrere Fassungen je Ereignis: Welche erscheint, hängt an Ereignis und Minute (diaryPick),
// so steht auf Tablet und Handy derselbe Satz, auch beim zweiten Öffnen. {n} = Name des Freunds.
const DIARY_TXT = {
  wake: ['Aufgewacht! Erst mal strecken und gähnen.', 'Guten Morgen! Die Nase zuerst aus dem Bau gesteckt.', 'Zipfelmütze ab, der Tag kann losgehen.'],
  sleep: ['Zipfelmütze auf und ab in den Bau. Gute Nacht!', 'Müde. Ich hab mich im Bau eingekuschelt.', 'Augen zu. Schlaf gut, liebes Tagebuch.'],
  act: {
    read: ['Ein Buch gelesen. An der lustigen Stelle musste ich kichern.', 'Gelesen, bis mir fast die Augen zugefallen sind.',
      'Mein Buch war so spannend, dass ich das Umblättern vergessen hab.'],
    game: ['Gameboy gespielt. Eine Runde gewonnen, juhu!', 'Am Gameboy war der Wurm drin. Mööp.', 'Gameboy gespielt, bis die Daumen müde waren.'],
    tablet: ['Auf dem Bauch gelegen und am Tablet gewischt.', 'Am Tablet geschaut, wohin die Flugzeuge fliegen.'],
    kite: ['Drachen steigen lassen! Der Wind hat ganz schön gezerrt.', 'Mein Drache stand hoch am Himmel. Ich hab die Schnur gut festgehalten.'],
    tv: ['Im Bau ferngesehen. Draußen war es mir zu ungemütlich.', 'Fernsehen im Bau. Gemütlich!'],
    music: ['Ukulele gespielt und mitgesungen. La-la-la!', 'Musik gemacht. Ein Ton ging daneben, plonk. Egal.',
      'Ein kleines Konzert gegeben. Zum Schluss hab ich mich verbeugt.'],
    paint: ['Ich hab {m} gemalt. Ich finde, es ist richtig gut geworden.', 'An der Staffelei gestanden und {m} gemalt.',
      'Ich hab {m} gemalt. Dabei hatte ich einen Farbklecks auf der Nase.'],
    bubbles: ['Seifenblasen gepustet und hinterhergesprungen. Plopp!', 'Seifenblasen! Eine ist direkt vor meiner Nase geplatzt.'],
    sport: ['Frühsport! Hampelmann, Kniebeugen, Strecken. Danach war ich platt.', 'Stirnband auf und los: Frühsport. Ich hab sogar mitgezählt.'],
  },
  // dasselbe kurz, für die Zeile „Außerdem: …“, und als Hauptwort für die Tagesform
  actShort: { read: 'gelesen', game: 'Gameboy gespielt', tablet: 'am Tablet gewischt', kite: 'Drachen steigen lassen', tv: 'ferngesehen',
    music: 'Musik gemacht', paint: 'gemalt', bubbles: 'Seifenblasen gepustet', sport: 'geturnt' },
  actNoun: { read: 'Lesen', game: 'Gameboy', tablet: 'Tablet', music: 'Musik', paint: 'Malen', bubbles: 'Seifenblasen' },
  motif: { blume: 'eine Blume', pika: 'mich selbst', pino: '{n}', bau: 'meinen Bau', flieger: 'ein Flugzeug', regenbogen: 'einen Regenbogen' },
  pino: ['{n} war zu Besuch! Wir haben uns mit den Nasen angestupst.', '{n} kam vorbei. Zusammen ist alles schöner.',
    'Mit {n} gespielt. Beim Abschied hingen meine Ohren kurz.'],
  coffee: ['Es roch nach Kaffee. Ich hab mir auch einen geholt.', 'Kaffeeduft! Ich hab mitgetrunken, Schluck für Schluck.'],
  coffeeMore: ['Noch ein Kaffee! Ich hab wieder mitgetrunken.', 'Schon wieder Kaffeeduft. Da konnte ich nicht nein sagen.',
    'Kaffee Nummer {z}. Jetzt bin ich hellwach!'],
  bird: ['Ein Vögelchen saß da. Ich hab gepiepst, es hat zurückgezwitschert.', 'Besuch von einem Vögelchen. Wir haben uns nett unterhalten.'],
  plane: ['Ein Flugzeug! Ich hab ihm lange nachgeschaut. Brumm.', 'Hoch oben flog ein Flugzeug. Wo es wohl hinwollte?'],
  bfly: ['Ein Schmetterling ist auf meiner Nase gelandet. Ich hab ganz still gehalten.', 'Schmetterling auf der Nase! Ich musste schielen.'],
  heart: ['So viel gestreichelt worden. Mein Fell steht noch ganz flauschig ab.', 'Ganz viele Streicheleinheiten bekommen. Ich bin fast geschmolzen.'],
  parcel: ['Ein Päckchen am Ballon! Ich hab es mit der Zwille heruntergeholt.', 'Ein Päckchen! Schleife auf, Deckel ab.'],
  earn: ['Du kümmerst dich so gut um mich, dass ein Päckchen für mich bereitliegt.', 'Ein neues Päckchen wartet auf mich. Danke fürs Kümmern!'],
  earnGold: ['Sieben gute Tage zusammen! Dafür gibt es ein goldenes Päckchen.', 'Wieder sieben gute Tage. Ein goldenes Päckchen liegt für mich bereit!'],
  gut: ['Heute war ein guter Tag: gefüttert, gestreichelt und rundum zufrieden.', 'Gefüttert, gestreichelt, alles bestens. Das war ein guter Tag.'],
  urlaub: ['Ich bin zu {n} gefahren. Mein Bau wartet so lange auf mich.', 'Rucksack auf und los: Ich besuche {n}!'],
  urlaubTag: ['Ich bin bei {n}.', 'Heute bin ich noch bei {n}.'],
  heim: ['Wieder zu Hause! {d} war ich bei {n}. Hier ist meine Postkarte.', 'Da bin ich wieder! {d} bei {n}, es war schön. Die Postkarte ist für euch.'],
  mile: ['Das war mein {z}. Päckchen! Ich hab ein bisschen gefeiert.'],
  tonne: ['Die Tonne steht an der Straße. Danke fürs Rausstellen!', 'Morgen kommt die Müllabfuhr. Die Tonne steht schon draußen.'],
  sauger: ['Der Saugroboter war unterwegs. Ich bin hinterhergehoppelt.', 'Der Saugroboter hat geputzt. Vielleicht bin ich ein Stück mitgefahren!'],
  allGold: ['Jetzt sind alle meine Schätze golden. Was für ein Fest!'],
  flowerTaken: ['Ich hab dir eine Blume gepflückt und ins Gras gelegt. Du hast sie genommen!', 'Für dich: eine Blume mit Schleife. Du hast sie angenommen, da hab ich mich gefreut.'],
  flowerWait: ['Ich hab dir eine Blume ins Gras gelegt. Sie wartet auf dich.'],
  flowerWilt: ['Ich hab dir eine Blume hingelegt. Sie ist leider verwelkt. Ich pflück dir bald eine neue.'],
  gather1: ['Eine Blüte für meinen Vorrat gesammelt.'],
  gatherN: ['{c} Blüten für meinen Vorrat gesammelt. Der Winter kann kommen.', '{c} Blüten gepflückt und in den Vorrat gelegt.'],
  hungry: ['Mein Bauch hat geknurrt. Zum Glück gab es bald etwas zu knabbern.'],
  hungryNow: ['Mein Bauch hat geknurrt. Ich hab ganz fest an Löwenzahn gedacht.'],
  clean: ['Alles blitzblank! Danke fürs Saubermachen, da hab ich einen Freudensprung gemacht.', 'Meine Wiese ist wieder sauber. Sie funkelt richtig!'],
  streak: ['Meine Päckchen-Serie fängt neu an. Das macht nichts, meine guten Tage behalte ich.'],
  secret: ['Da steht nichts in meinem Tagebuch. Was ich gemacht habe, bleibt mein Geheimnis.',
    'Da steht nichts. Vielleicht hab ich Purzelbäume geübt. Vielleicht auch nicht.'],
  bote: { washer: ['Die Wäsche war fertig. Ich hab ganz laut Bescheid gesagt!'], dryer: ['Der Trockner war fertig. Die Handtücher waren schön flauschig.'],
    dishwasher: ['Das Geschirr war fertig und hat geglänzt.'] },
  fest: { witch: 'Halloween! Ich hab einen Hexenhut auf.', martin: 'St. Martin! Laterne, Laterne …', boot: 'Nikolaus! Mein Stiefel ist voll.',
    xmas: 'Weihnachten! Bei mir steht ein Tannenbaum.', sticks: 'Frohes Neues! Ich hab das Feuerwerk gesehen.', karneval: 'Helau! Es regnet Konfetti.',
    ostern: 'Ostern! Im Gras liegen bunte Eier.', maibaum: 'Hinter meinem Bau steht ein Maibaum.', sommer: 'Sommerfest! Die Wimpel flattern.' },
  treasure: ['Stups ich an und flitze hinterher.', 'Dreht sich im echten Wind.', 'Mit dem kuschle ich nachts.', 'Für sonnige Tage ab 24 Grad.',
    'Damit schau ich Flugzeugen nach.', 'Für mein Nickerchen.', 'Damit gieße ich die Blumen.', 'Bimmelt, wenn ich rauskomme.'],
  wx: { sunny: 'sonnig', clear: 'klar', 'clear-night': 'klar', partlycloudy: 'heiter', cloudy: 'bewölkt', rainy: 'Regen', pouring: 'Starkregen',
    snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', fog: 'Nebel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', hail: 'Hagel',
    windy: 'windig', 'windy-variant': 'windig' },
};
const diaryPick = (list, ...key) => list[Math.floor(seedRnd('tb', ...key) * list.length)];
const diaryTime = (t) => {
  const d = new Date(t);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const bitCount = (n) => {
  let c = 0;
  for (let v = n >>> 0; v; v &= v - 1) c++;
  return c;
};
// Verlauf → Roh-Ereignisse { t, k, … }. S und P: [{ t, v }] mit geparstem Zustand bzw. Tagesplan, aufsteigend; der
// jeweils erste Stand ist nur die Ausgangslage. from: Ereignisse davor zählen nicht. decayAt(t, h): wann ab t h
// Abbau-Stunden um sind (für „Bauch hat geknurrt“), until: jetzt.
// Schreiben zwei Geräte fast gleichzeitig, stehen drei Stände im Verlauf: der des einen, der des anderen (ohne das
// Neue des ersten) und der zusammengeführte. Etwas verschwindet dann kurz und kommt wieder. Darum zählt jedes
// Ereignis erst, wenn ein Höchststand steigt (Erlebnisse je Tag, ausgepackte Päckchen, Verdientes, Großputz …), nicht
// schon, wenn es im Vergleich mit dem Stand direkt davor neu ist (so bis 0.34: Pino, Blüten und Päckchen zweimal).
// → { ev, stamps (wann sich überhaupt etwas änderte), pets (Pika-Tag → wie oft gestreichelt), urlaub ([Beginn, Ende]
//   je Urlaub, Ende Infinity solange er läuft) }
const diaryDerive = (S, P, from, { decayAt, until }) => {
  const ev = [];
  const stamps = [];
  const pets = {};
  const add = (t, k, x) => t >= from && ev.push({ t, k, ...x });
  const acts = new Map(); // Fenster → Ereignis (das Motiv beim Malen kommt erst am Ende dazu)
  const fed = new Set((P[0]?.v.fd || []).map((f) => f.t));
  let pend = null; // verschenktes, noch nicht ausgepacktes Päckchen
  const petMax = (c) => c && (pets[c.d] = Math.max(pets[c.d] || 0, c.n));
  petMax(P[0]?.v.cute);
  // Höchststände (siehe oben), aus der Ausgangslage
  const p0 = P[0]?.v;
  const mem = {}; // Pika-Tag → schon gesehene Erlebnis-Bits
  if (p0?.cute) mem[p0.cute.d] = p0.cute.m;
  const hays = new Set(p0 ? [`${p0.hay.m}.${p0.hay.c}`] : []);
  let hayM = p0 ? p0.hay.m : -Infinity;
  const fls = new Set(p0?.fl ? [p0.fl.t] : []);
  const g00 = p0?.gift;
  let maxO = g00 ? g00.o : -Infinity;
  let maxZ = g00 ? g00.z : -Infinity;
  let maxK = g00 ? g00.k : -Infinity;
  let maxF = g00?.f ?? null;
  const maxA = g00 ? { [g00.k]: g00.a } : {};
  const urs = new Map(); // Beginn → Dauer (null: läuft)
  const urSee = (ur) => ur && (!urs.has(ur.t) || urs.get(ur.t) == null) && urs.set(ur.t, ur.d);
  urSee(p0?.ur);
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1].v;
    const b = P[i].v;
    const t = P[i].t;
    stamps.push(t);
    for (const [k, name, v] of b.rec) {
      if (acts.has(k)) {
        if (v) acts.get(k).v = v;
      } else if (!a.rec.some((e) => e[0] === k) && k * ACT_WIN.big > t - 3 * 36e5) {
        // (ein Fenster von vor Stunden ist kein neues: Es fiel nur aus dem Verlauf und kam zurück)
        const e = { t, k: 'act', a: name, v: v || '' };
        acts.set(k, e);
        if (t >= from) ev.push(e);
      }
    }
    const hk = `${b.hay.m}.${b.hay.c}`;
    if (!hays.has(hk) && (b.hay.m > hayM || b.hay.c !== a.hay.c)) add(t, 'gather');
    hays.add(hk);
    hayM = Math.max(hayM, b.hay.m);
    if (b.fl && !fls.has(b.fl.t)) {
      fls.add(b.fl.t);
      add(b.fl.t, 'flower', { id: b.fl.t, taken: !!b.fl.k });
    } else if (b.fl?.k && !a.fl?.k) {
      const e = ev.find((x) => x.k === 'flower' && x.id === b.fl.t);
      if (e) e.taken = true;
      else add(t, 'flower', { id: b.fl.t, taken: true });
    }
    for (const f of b.fd) {
      if (fed.has(f.t)) continue;
      fed.add(f.t);
      add(f.t, 'feed');
    }
    const c = b.cute;
    if (c) {
      petMax(c);
      const neu = c.m & ~(mem[c.d] || 0);
      mem[c.d] = (mem[c.d] || 0) | c.m;
      MEM_BITS.forEach((name, bit) => neu & (1 << bit) && add(t, 'mem', { b: name }));
    }
    urSee(b.ur);
    const g0 = a.gift;
    const g1 = b.gift;
    if (g0 && g1) {
      // Verdient: nur, wenn auch eins in den Vorrat kam (bei vollem Vorrat wächst a weiter, es kommt aber keins dazu)
      if (g1.k === g0.k && g1.a > (maxA[g1.k] ?? g0.a) && g0.n < GIFT.max) add(t, 'earn');
      if (g1.k === g0.k) maxA[g1.k] = Math.max(maxA[g1.k] ?? g1.a, g1.a);
      // Goldenes: jeder siebte Freundschaftstag (bis 0.34: jede Woche am Stück, das steht nicht mehr im Plan)
      if (g1.f != null) {
        if (maxF != null && Math.floor(g1.f / GIFT.goldDays) > Math.floor(maxF / GIFT.goldDays)) add(t, 'earnGold');
        maxF = Math.max(maxF ?? g1.f, g1.f);
      }
      if (g1.k !== g0.k && g1.k > maxK && g0.b != null && g1.a === 0) add(t, 'streak');
      maxK = Math.max(maxK, g1.k);
      if (g1.z > maxZ) {
        maxZ = g1.z;
        const it = g1.i & 15;
        const bit = 1 << it;
        const v0 = g0.v || 0;
        const v1 = g1.v || 0;
        pend = { z: g1.z, it, gold: !!(g1.i & 16), what: it >= GIFT_TRE ? 'treat' : !(g0.u & bit) ? 'new'
          : v1 & (bit << 8) && !(v0 & (bit << 8)) ? 'gilt' : v1 & bit && !(v0 & bit) ? 'trick' : 'new' };
      }
      if (g1.o > maxO) {
        maxO = g1.o;
        const it = g1.i & 15;
        const e = pend && pend.z <= g1.o ? pend : { it, gold: !!(g1.i & 16), what: it >= GIFT_TRE ? 'treat' : 'new' };
        add(t, 'parcel', { ...e, o: g1.o, mile: giftMile(g1.o), all: e.what === 'gilt' && giftAllGold(g1) });
        pend = null;
      }
    }
  }
  // Urlaub: Abreise und Rückkehr je einmal (ein ganz kurzer, eben aus Versehen eingeschaltet, steht nicht da)
  const urlaub = [];
  for (const [t0, d] of urs) {
    urlaub.push([t0, d == null ? Infinity : t0 + d]);
    if (d != null && d < URLAUB.min) continue;
    add(t0, 'urlaub', { id: t0, d });
    if (d != null) add(t0 + d, 'heim', { id: t0, d });
  }
  // Nach der Rückkehr setzt ein Gerät den Zustand neu an (alle Zeiten gleich, alles sauber): Das ist kein Putzen
  const rebase = (v) => v.st === v.c && v.gt === v.c && urlaub.some(([, e]) => v.c >= e - 6e4 && v.c - e < URLAUB.keep);
  // Zustand: Großputz, einzeln weggemachte Häufchen, und wann der Bauch knurrte (satt unter 30 %, bevor es wieder stieg)
  let food = S[0]?.v;
  let maxC = S[0]?.v.c ?? -Infinity;
  const masks = new Map(S[0] ? [[S[0].v.c, S[0].v.m]] : []); // Großputz → schon gesehene Einzelputze
  const growl = (v, end, eaten) => {
    if (!v || !(v.s > 30)) return;
    const x = decayAt(v.st, (v.s - 30) / RATE.s);
    if (x < end) add(x, 'hungry', { eaten });
  };
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1].v;
    const b = S[i].v;
    const t = S[i].t;
    stamps.push(t);
    const seen = masks.get(b.c) || 0;
    if (b.c > maxC && !rebase(b)) add(t, 'clean', { n: 1, all: true });
    else if (b.c === a.c && b.m & ~seen) add(t, 'clean', { n: bitCount(b.m & ~seen) });
    masks.set(b.c, seen | b.m);
    maxC = Math.max(maxC, b.c);
    if (b.st !== food.st) {
      growl(food, b.st, true);
      food = b;
    }
  }
  growl(food, until, false);
  // Was in einen Urlaub fällt (der Bauch knurrte dort nicht), außer Abreise und Rückkehr
  const inU = (x) => urlaub.some(([a, b]) => x.t > a && x.t < b);
  return { ev: ev.filter((x) => x.k === 'urlaub' || x.k === 'heim' || !inU(x)), stamps: stamps.sort((x, y) => x - y), pets, urlaub };
};

export { DIARY, FIND_GROUPS, FINDS, FIND_IDS, findsParse, findsSer, DIARY_TXT, diaryPick, diaryTime, diaryDerive };
