// Päckchen: Pflege-Serie (GIFT), Stufen der Schätze im Plan, Inhalt (Pech-Schutz), Meilensteine, Zustandsklassen

import { seedRnd } from './hilfen.js';

// Pflege: Liegt keiner der drei Werte länger als grace (Wachzeit) unter min, läuft die Serie weiter. Je every Wachzeit
// ohne Unterbrechung gibt es ein Päckchen (höchstens max im Vorrat). Jeder goldDays-te gute Tag (Freundschaftstag, siehe
// giftGoodDay) bringt ein goldenes, höchstens goldMax liegen auf Vorrat. Die guten Tage müssen nicht am Stück sein und
// zählen nur hoch. Verschenkt schwebt es arrive ms lang an einem Ballon herein, der Pika schießt ihn vom Aussichtsstein
// mit der Zwille herunter und packt aus. Leckerli bringen treat Satt, jedes Päckchen joy Glück.
const GIFT = { min: 50, grace: 60 * 6e4, every: 6 * 36e5, max: 3, goldDays: 7, goldMax: 2, arrive: 12000, treat: 15, joy: 15 };
const GIFT_TRE = 8; // GIFT_ITEMS 0–7 sind Schätze (Album, ein Bit je Schatz), danach Leckerli (8–15, mehr fasst gift.i nicht)
// Stufe des Schatzes t im Plan: 0 fehlt, 1 Schatz, 2 mit Trick, 3 golden (u: Bit t, v: Bit t und Bit 8 + t)
const giftLv = (G, t) => (!G || !(G.u & (1 << t)) ? 0 : !(G.v & (1 << t)) ? 1 : G.v & (1 << (8 + t)) ? 3 : 2);
// Stufen aller Schätze, wie sie schon ausgepackt sind: Die Stufe kommt beim Verschenken, fliegt der Ballon noch,
// zählt sie nicht (hide: diesen Schatz ebenfalls eine Stufe tiefer, solange er ausgepackt wird)
const giftLvs = (G, hide = null) => [...Array(GIFT_TRE).keys()].map((t) => {
  const lv = giftLv(G, t);
  return Math.max(0, lv - ((G && G.z > G.o && (G.i & 15) === t) || hide === t ? 1 : 0));
});
// Schätze, die schon ausgepackt sind, als Bits
const giftOwned = (G) => giftLvs(G).reduce((m, lv, t) => (lv ? m | (1 << t) : m), 0);
// Ist Päckchen Nummer z ein Schatz (sofern noch einer fehlt)? Das erste immer, sonst eins aus jedem Block von drei
// (Stelle fest gewürfelt), und nie mehr als zwei Leckerli in Folge (Pech-Schutz): Waren die beiden davor Leckerli, ist
// es ein Schatz. Hängt nur an z, ist also auf allen Geräten gleich. Goldene sind immer Schätze, das prüft _giftPick.
const giftTreM = [false];
const giftTre = (z) => {
  if (!(z >= 1)) return false;
  for (let n = giftTreM.length; n <= z; n++) {
    const base = n === 1 || (n - 1) % 3 === Math.floor(seedRnd('gblk', Math.floor((n - 1) / 3)) * 3);
    giftTreM[n] = base || (n >= 3 && !giftTreM[n - 1] && !giftTreM[n - 2]);
  }
  return giftTreM[z];
};
// Leckerli für Päckchen Nummer z im Monat mo (0 = Januar): eins von denen, die es dann gibt (items: GIFT_ITEMS, dort
// steht je Leckerli mo, ohne mo gibt es das Leckerli immer). Hängt nur an z und am Monat. Die Nummer steht danach im
// Tagesplan (gift.i), die anderen Geräte würfeln nicht selbst.
const giftTreat = (items, z, mo) => {
  const ok = items.map((it, n) => n).filter((n) => n >= GIFT_TRE && (!items[n].mo || items[n].mo.includes(mo)));
  return ok[Math.floor(seedRnd('gtreat', z) * ok.length)];
};
// Meilensteine: das 10., 25., 50. und 100. ausgepackte Päckchen, danach jedes 100.
const giftMile = (o) => o === 10 || o === 25 || o === 50 || (o >= 100 && o % 100 === 0);
// Alle acht Schätze golden (Stufe 3)
const giftAllGold = (G) => !!G && (G.u & 255) === 255 && ((G.v || 0) & 0xffff) === 0xffff;
// Gold mit Wirkung (seit 0.44): Jeder goldene Schatz (Stufe 3) hat eine kleine Zugabe. Sie ist Zierde je Gerät, nichts
// davon steht im Plan oder im Zustand. cd: frühestens so viele ms nach dem letzten Mal (Uhr des Geräts, gemerkt bis
// zum Neuladen), p: Wahrscheinlichkeit je Gelegenheit (ohne p: immer). Was kein cd hat, hängt an einer Aktion, die
// selbst selten genug ist (Anstupsen, Brille lupfen, Gießen, Nickerchen).
const GOLD = {
  yarnBack: { cd: 4 * 6e4, p: 0.35 }, // Wollknäuel: kullert von selbst zu ihm zurück
  wheel: { cd: 6000 }, // Windrad: Lichtfunken, wenn es angepustet oder angetippt wird
  wheelWind: { cd: 90000, p: 0.35, min: 30 }, // … und im echten Wind ab min km/h (je Takt; ab da gilt die Szene als windig)
  heart: { cd: 2500, p: 0.7 }, // Plüsch-Pino: Herzchen beim Kuscheln am Tag (zwei Gelegenheiten je Kuscheln)
  heartNight: { cd: 4 * 6e4, p: 0.2 }, // … und nachts im Bau (je Takt)
  sheen: { cd: 2 * 6e4, p: 0.3 }, // Sonnenbrille: Lichtreflex bei Sonne (je Takt)
  spot: { p: 0.45 }, // Fernrohr: Der erste Blick findet immer etwas, jeder weitere mit p
  bell: { cd: 45000 }, // Glöckchen: Ein Vogel antwortet (das Glockenspiel bimmelt mehrmals: eine Antwort)
};
// Ist eine Zugabe mit Abstand und Wahrscheinlichkeit R (Eintrag aus GOLD) jetzt dran? last: wann zuletzt (ms, sonst
// nie), u: Zufallszahl 0–1. Eine zurückgestellte Geräteuhr sperrt nicht länger als cd.
const goldDue = (R, last, now, u = 0) => (last == null || Math.abs(now - last) >= (R?.cd || 0)) && u < (R?.p ?? 1);
// Gelb der Wiesenpalette (Frühling/Sommer und Herbst, auch im Areal alpin): die Farbe der goldenen Blume der Gießkanne.
// Im Winter gibt es kein Gelb (verblasste Samenstände), dann wächst keine.
const GOLD_BLOOM = ['#f6c945', '#e3b23c'];
// Wer zum Nickerchen in der goldenen Hängematte kommt: Schmetterling (April bis September bei Tag, trocken, nicht kalt,
// kaum Wind), Glühwürmchen (Sommerabend, Option fireflies), sonst läuft ein Schimmer übers Netz.
// L: { mo (Monat 0–11, Südhalbkugel schon versetzt), dark (Dämmerung oder Nacht), summer, wet, cold, wind, flies }
const goldHamGuest = (L) => (!L.dark && L.mo >= 3 && L.mo <= 8 && !L.wet && !L.cold && (L.wind || 0) < 30 ? 'bfly'
  : L.dark && L.summer && !L.wet && L.flies !== false ? 'ff' : 'shim');
// (gsheen, gglow: Lichtreflex auf der goldenen Sonnenbrille, bewegt bzw. ruhig)
const GIFT_CLS = ['sling', 'aim', 'snap', 'spy', 'wcan', 'pour', 'shup', 'wink', 'hswing', 'puffy', 'gsheen', 'gglow'];

export {
  GIFT, GIFT_TRE, giftLv, giftLvs, giftOwned, giftTre, giftTreat, giftMile, giftAllGold, GIFT_CLS, GOLD, goldDue, GOLD_BLOOM,
  goldHamGuest,
};
