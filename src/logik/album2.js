// Album 2 (seit 0.46): acht weitere Schätze. Stufen im Plan (gift.w), wann Album 2 beginnt, was ein Päckchen bringt.
// Bilder, Namen, Monate, Texte und ob ein Schatz schon gebaut ist, stehen je Schatz in src/grafik/album2/<key>.js; wie
// ein Schatz in der Szene spielt, in src/karte/album2-<key>.js (Schnittstelle: Kopf von src/karte/album2.js).

import { seedRnd } from './hilfen.js';
import { GIFT_TRE, giftLv, giftTre, giftFlying } from './paeckchen.js';

// Reihenfolge (t2 = 0–7) ist fest: Sie steht so im Plan (Bits von w, gift.i = 32 + t2). Nur anhängen geht nicht, w hat
// genau acht Plätze je Stufe.
const A2_KEYS = ['feeder', 'lantern', 'sled', 'camera', 'radio', 'tramp', 'picnic', 'pool'];
const A2_N = A2_KEYS.length;
// Alle Bits von w: acht Schätze, acht Tricks, acht goldene
const A2_FULL = 0xffffff;
// Stufe des Schatzes t (0–7) aus Album 2 im Plan, wie giftLv: 0 fehlt, 1 Schatz (Bit t), 2 mit Trick (Bit 8 + t),
// 3 golden (Bit 16 + t; zählt nur mit Trick)
const giftLv2 = (G, t) => {
  const w = G?.w || 0;
  return !(w & (1 << t)) ? 0 : !(w & (1 << (8 + t))) ? 1 : w & (1 << (16 + t)) ? 3 : 2;
};
// Stufen aller acht, wie sie schon ausgepackt sind (wie giftLvs: Fliegt der Ballon noch, zählt die neue Stufe nicht;
// hide: diesen ebenfalls eine tiefer, solange er ausgepackt wird)
const giftLvs2 = (G, hide = null) => A2_KEYS.map((k, t) => Math.max(0, giftLv2(G, t) - (giftFlying(G, 2, t) || hide === t ? 1 : 0)));
// Hat Album 2 begonnen? Sobald kein Schatz aus Album 1 mehr auf Stufe 0 oder 1 steht (normale Päckchen bringen dort
// nichts mehr), oder schon etwas aus Album 2 da ist
const a2Begun = (G) => !!G && ((G.w || 0) > 0 || [...Array(GIFT_TRE).keys()].every((t) => giftLv(G, t) >= 2));
// Alle acht aus Album 2 golden
const a2AllGold = (G) => !!G && ((G.w || 0) & A2_FULL) === A2_FULL;

// Welcher Schatz steckt in Päckchen z (G: Päckchen-Stand im Plan, gold: goldenes Päckchen)? → Wert für gift.i ohne das
// „golden“ (0–7 Album 1, 32 + t2 Album 2), oder null: ein Leckerli. Auf allen Geräten gleich (Würfel nur seedRnd mit z).
// - normal, und nur, wenn z ein Schatz-Platz ist (giftTre): Album 1 Stufe 0, dann Stufe 1 (Trick), dann Album 2
//   Stufe 0, dann Stufe 1
// - golden (immer ein Schatz): Album 1 wie bis 0.45 (Stufe 0, sonst Stufe 2 vergolden, sonst Stufe 1); erst wenn Album 1
//   ganz golden ist, Album 2 Stufe 0, dann Stufe 2 vergolden, dann Stufe 1
// Für Album 2 zählen nur gebaute Schätze (info[t2].built), und innerhalb einer Stufe zuerst die der Jahreszeit
// (info[t2].mo: Monate 0–11, ohne = immer; mo: Monat des schenkenden Geräts, Südhalbkugel schon versetzt), sonst alle.
const giftPickTre = (G, z, gold, info, mo) => {
  if (!gold && !giftTre(z)) return null;
  const T = [...Array(GIFT_TRE).keys()];
  const at = (lv) => T.filter((t) => giftLv(G, t) === lv);
  const one = (list) => list[Math.floor(seedRnd('gtre', z) * list.length)];
  const a1 = at(0).length ? at(0) : gold && at(2).length ? at(2) : at(1);
  if (a1.length) return one(a1);
  const at2 = (lv) => {
    const all = A2_KEYS.map((k, t) => t).filter((t) => info[t]?.built && giftLv2(G, t) === lv);
    const sea = all.filter((t) => !info[t].mo || info[t].mo.includes(mo));
    return sea.length ? sea : all;
  };
  for (const lv of gold ? [0, 2, 1] : [0, 1]) {
    const L = at2(lv);
    if (L.length) return 32 + one(L);
  }
  return null;
};

export { A2_KEYS, A2_N, A2_FULL, giftLv2, giftLvs2, a2Begun, a2AllGold, giftPickTre };
