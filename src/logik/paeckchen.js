// Päckchen: Pflege-Serie (GIFT), Stufen der Schätze im Plan, Zustandsklassen

// Pflege: Liegt keiner der drei Werte länger als grace (Wachzeit) unter min, läuft die Serie weiter. Je every Wachzeit
// ohne Unterbrechung gibt es ein Päckchen (höchstens max im Vorrat), nach gold am Stück ein goldenes. Verschenkt schwebt
// es arrive ms lang an einem Ballon herein, der Pika schießt ihn vom Aussichtsstein mit der Zwille herunter und packt aus.
// Leckerli bringen treat Satt, jedes Päckchen joy Glück.
const GIFT = { min: 50, grace: 60 * 6e4, every: 6 * 36e5, max: 3, gold: 7 * 864e5, goldMax: 2, arrive: 12000, treat: 15, joy: 15 };
const GIFT_TRE = 8; // GIFT_ITEMS 0–7 sind Schätze (Album, ein Bit je Schatz), danach Leckerli
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
const GIFT_CLS = ['sling', 'aim', 'snap', 'spy', 'wcan', 'pour', 'shup', 'wink', 'hswing', 'puffy'];

export { GIFT, GIFT_TRE, giftLv, giftLvs, giftOwned, GIFT_CLS };
