// Tests für 0.44: Gold mit Wirkung (jeder goldene Schatz hat eine kleine Zugabe) und die Tiefe als Standard. node --test
// Wie schnee.test.mjs lädt die Datei das gebaute Bündel mit ein paar Attrappen in node: eigene Uhr (jetzt), Zeitgeber,
// die mit der Uhr laufen (vor), ein Schalter für „Bewegung reduzieren“ (ruhe) und ein fester Zufall (zufall). Die
// echten Methoden der Schätze (_giftYarn, _giftWater, _giftScene …) laufen an einer Karte mit der Geometrie von
// _layout von Anfang bis Ende durch oder werden an jeder Wartestelle abgebrochen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { GOLD, goldDue, GOLD_BLOOM, goldHamGuest, GIFT_CLS, giftLvs } from '../src/logik/paeckchen.js';
import { DEFAULTS, EDITOR_LABEL, EDITOR_HELP, LANE_DY } from '../src/logik/einstellungen.js';
import { DIARY_TXT } from '../src/logik/tagebuch.js';
import { GIFT_ITEMS, GIFT_TRICK, GIFT_HAMMOCK, GOLD_FLOWER } from '../src/grafik/paeckchen.js';

const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
const quell = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// ---------- die Welt der Karte ----------
let T = null;
let jetzt = new Date(2026, 6, 14, 14).getTime(); // ein Julinachmittag
const ruhe = { matches: false }; // prefers-reduced-motion: Die Karte liest es einmal beim Laden und behält das Objekt
let wecker = []; // { fn, at, aus }: Zeitgeber der Karte, laufen mit vor()
const zufall = { wert: 0.5, n: 0 }; // Math.random der Karte: fester Wert, Aufrufe gezählt
const gebaut = []; // alle Elemente, die die Karte mit document.createElement anlegt
class Uhr extends Date {
  constructor(...a) {
    if (a.length) super(...a);
    else super(jetzt);
  }

  static now() {
    return jetzt;
  }
}
const Mathe = Object.create(Math);
Mathe.random = () => {
  zufall.n++;
  return zufall.wert;
};
// Klassenliste, die mitschreibt, was je gesetzt wurde (je)
class Kl {
  constructor(je = new Set()) {
    this.s = new Set();
    this.je = je;
  }

  add(...k) {
    for (const x of k) {
      this.s.add(x);
      this.je.add(x);
    }
  }

  remove(...k) {
    for (const x of k) this.s.delete(x);
  }

  toggle(k, an) {
    const v = an === undefined ? !this.s.has(k) : !!an;
    if (v) this.add(k);
    else this.s.delete(k);
    return v;
  }

  contains(k) {
    return this.s.has(k);
  }
}
// Ein Element, soweit die Schätze es anfassen: Klassen, Stil, Kinder, Inhalt. Messen lässt es sich nicht (Breite 0):
// Die Karte rechnet dann mit ihrer Geometrie (_goldBox → null).
class Att {
  constructor() {
    this.classList = new Kl();
    this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    this.children = [];
    this.parentElement = null;
    this.offsetLeft = 0;
    this.offsetWidth = 0;
    this.teile = {};
    this.flug = []; // Web Animations dieses Elements
  }

  set className(v) {
    this.classList = new Kl(this.classList.je);
    v.split(/\s+/).filter(Boolean).forEach((k) => this.classList.add(k));
  }

  get className() {
    return [...this.classList.s].join(' ');
  }

  set innerHTML(v) {
    this.html = v;
  }

  get innerHTML() {
    return this.html ?? '';
  }

  get isConnected() {
    return !!this.parentElement;
  }

  appendChild(k) {
    k.parentElement = this;
    this.children.push(k);
    return k;
  }

  remove() {
    const p = this.parentElement;
    if (p) p.children.splice(p.children.indexOf(this), 1);
    this.parentElement = null;
  }

  // Eine Klasse im gesetzten Inhalt (.gsun in der Blume) gibt es nur, wenn sie darin steht; alles andere wird angelegt
  querySelector(sel) {
    if (typeof this.html === 'string' && /^\.[\w-]+$/.test(sel) && !new RegExp(`class="[^"]*\\b${sel.slice(1)}\\b`).test(this.html)) return null;
    return (this.teile[sel] ??= new Att());
  }

  querySelectorAll() {
    return [];
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  setAttribute() {}

  animate(kf, opt) {
    const a = { kf, opt, aus: false, cancel() { this.aus = true; } };
    this.flug.push(a);
    return a;
  }
}
const DOK = {
  hidden: false, addEventListener() {}, removeEventListener() {},
  createElement: () => {
    const el = new Att();
    gebaut.push(el);
    return el;
  },
};
vm.runInNewContext(src, {
  window: { matchMedia: () => ruhe, customCards: [] },
  document: DOK,
  HTMLElement: class {},
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn() {}, debug() {} },
  setTimeout: (fn, ms) => {
    const w = { fn, at: jetzt + Math.max(0, Number(ms) || 0), aus: false };
    wecker.push(w);
    return w;
  },
  clearTimeout: (w) => {
    if (w && typeof w === 'object') w.aus = true;
  },
  setInterval: () => 0, clearInterval() {}, queueMicrotask, Date: Uhr, Math: Mathe, JSON, Promise, Intl, AbortController, performance,
  __pikaTest: (x) => (T = x),
}, { filename: 'pika-pet-card.js' });
// Uhr um ms vorstellen und alle Zeitgeber laufen lassen, die bis dahin fällig sind (der Reihe nach)
const vor = (ms) => {
  const ziel = jetzt + ms;
  for (;;) {
    wecker = wecker.filter((w) => !w.aus);
    const w = wecker.filter((x) => x.at <= ziel).sort((a, b) => a.at - b.at)[0];
    if (!w) break;
    w.aus = true;
    jetzt = Math.max(jetzt, w.at);
    w.fn();
  }
  jetzt = ziel;
};
const plain = (v) => JSON.parse(JSON.stringify(v));
const P = T.PikaPetCard.prototype;

// ---------- Karte mit der Geometrie von _layout, ohne Schleife ----------
// Päckchen-Stand im Plan für die Stufen lv (je Schatz 0 fehlt, 1 Schatz, 2 Trick, 3 golden)
const stand = (lv) => {
  let u = 0;
  let v = 0;
  lv.forEach((l, t) => {
    if (l >= 1) u |= 1 << t;
    if (l >= 2) v |= 1 << t;
    if (l >= 3) v |= 1 << (8 + t);
  });
  return { k: jetzt, a: 0, n: 0, y: 0, z: 0, o: 0, i: 0, u, v, f: 0 };
};
const ALLE = (l) => Array(8).fill(l);
// lv: Stufen der acht Schätze. Zähler in c.z: was in Plan und Zustand geschrieben würde, was er sagt, Zwitschern.
const karte = ({ lv = ALLE(3), W = 600, Hs = 248, areal = 'huegel', cfg = {} } = {}) => {
  const c = Object.create(P);
  const scene = new Att();
  Object.assign(scene, { clientWidth: W, clientHeight: Hs });
  const leer = () => {};
  const z = { planOp: [], ops: [], add: 0, memo: [], found: [], selfFed: 0, save: 0, say: [], tweet: 0, eat: [], peep: [], warten: 0 };
  Object.assign(c, {
    _el: new Proxy({ scene }, { get: (t, k) => (t[k] ??= new Att()) }), _g: { pW: 1 }, _W: 0, _Hs: 0, _inside: true,
    _cfg: { gifts: true, depth: true, fireflies: true, friend_name: 'Pino', ...cfg }, _arealKey: areal,
    _planes: new Map(), _lift: 0, _lane: 0, _poseName: 'out', _dir: 1, z,
    _btnFit: leer, _pose: leer, _layoutSky: leer, _layoutFest: leer, _layoutFriend: leer, _layoutBote: leer, _layoutGift: leer, _layoutSig: leer,
    _planeSnap: leer, _placePiles: leer, _restartCritters: leer, _flowerGiftPlace: leer, _interrupt: leer,
    _poops: () => ({ piles: [] }), _bote: null, _festPos: {}, _gtEls: null,
    _setX(x) { this._x = x; }, _freeze: leer, _liveX() { return this._x; },
    _tvOn: leer, _kiteAway: leer, _easelAway: leer, _apropsAway: leer, _mouth: leer, _bubble: leer, _bubbleRefit: leer, _mimik: leer,
    _hearts: leer, _jump: leer, _happy: leer, _blush: leer, _puff: leer, _sparkle: leer, _sigWearSync: leer, _twitch: leer,
    _say(t) { z.say.push(t); }, _peep(x, y, t) { z.peep.push(t); },
    // was nichts schreiben darf: zählt nur mit
    _planOp(op) {
      z.planOp.push(op.t);
      z.ops.push(op);
    }, _add() { z.add++; }, _memo(k) { z.memo.push(k); }, _found(k) { z.found.push(k); },
    _selfFed() { z.selfFed++; }, _save() { z.save++; }, _careEval: () => null,
    _tweet() { z.tweet++; },
    _haNow: () => jetzt, _now: () => jetzt, _urlaubFern: () => false, _urlaubOn: () => false, _away: () => false,
    _planeToWatch: () => null,
    _face(d) { this._dir = d; },
    async _walkTo(x) {
      await this._wait(500);
      this._x = x;
    },
    async _hopTo(x, lift) {
      await this._wait(620);
      this._x = x;
      this._lift = lift;
    },
    async _eat(color) {
      z.eat.push(color);
      await this._wait(1000);
    },
    _wx: { cover: 10 }, _wind: 5, _windDir: 1, _hay: 0, _seasonK: 'summer', _fest: {}, _lit: null, _flowers: [], _foods: [],
    _wait: () => Promise.resolve(),
  });
  c._layout();
  c._inside = false;
  c._x = c._g.home + c._g.pW;
  c._plan = { gift: stand(lv) };
  return c;
};
class Abbruch extends Error {}
// Die Aktion name an der Karte c laufen lassen. Jedes Warten stellt die Uhr vor (fällige Zeitgeber laufen mit);
// stopp: bei diesem Warten (0, 1, 2 …) wird abgebrochen, wie es _interrupt mitten im Warten täte. Danach räumt das
// echte _cleanup auf, wie in der Schleife. → { fertig, n: Wartestellen, lebend: goldene Teilchen im Bild je Wartestelle,
// rest: goldene Teilchen gleich nach dem Ende (vor _cleanup) }
const lauf = async (c, name, args = [], { stopp = Infinity } = {}) => {
  let n = 0;
  const lebend = [];
  c._action = name.slice(1);
  c._wait = (ms) => {
    lebend.push(teilchen(c).length);
    if (n++ === stopp) return Promise.reject(new Abbruch());
    vor(Math.max(0, ms));
    return Promise.resolve();
  };
  let fertig = true;
  try {
    await c[name](...args);
  } catch (e) {
    if (!(e instanceof Abbruch)) throw e;
    fertig = false;
  }
  const rest = teilchen(c).length;
  c._cleanup();
  c._wait = () => Promise.resolve();
  return { fertig, n, lebend, rest };
};
// Goldene Teilchen, die gerade in der Effekt-Ebene der Karte hängen
const teilchen = (c) => c._el.fx.children.filter((el) => el.classList.contains('gfx'));
// Arten der goldenen Teilchen, die seit Stelle ab angelegt wurden (auch längst wieder entfernte): ['trail', 'trail', …]
const arten = (ab = 0) => gebaut.slice(ab).filter((el) => el.classList.je.has('gfx'))
  .map((el) => [...el.classList.je].find((k) => k !== 'gfx' && k !== 'still' && k !== 'off'));
const still = (ab = 0) => gebaut.slice(ab).filter((el) => el.classList.je.has('gfx')).map((el) => el.classList.je.has('still'));
// Was _cleanup am Pika stehen lassen darf: Blickrichtung und Klassen, die nicht an der Aktion hängen
const BLEIBT = new Set(['left', 'lane1', 'lnd', 'cool', 'g-shd', 'g-scp', 'g-can']);
const JULI = new Date(2026, 6, 14, 14).getTime();
const NOVEMBER = new Date(2026, 10, 22, 14).getTime();

// Jeder Schatz mit dem, was seine Zugabe auslöst. → was dabei an Goldenem entstand (Zahl; 0 = nichts)
const AUSLOESER = [
  // 0 Wollknäuel: anstupsen (Zufall 0,9: ein Stups, kein Kopfball hinterher, kein Zurückrollen)
  async (c) => {
    zufall.wert = 0.9;
    c._giftScene();
    c._yarnXf = (c._g.fMin + c._g.fMax) / 2;
    c._giftScene();
    const ab = gebaut.length;
    await lauf(c, '_giftYarn');
    return arten(ab).length;
  },
  // 1 Windrad: angetippt (wie src/karte/interaktion.js: _blowUntil setzen, dann _giftScene)
  async (c) => {
    c._giftScene();
    const ab = gebaut.length;
    c._blowUntil = jetzt + 2600;
    c._giftScene();
    return arten(ab).length;
  },
  // 2 Plüsch-Pino: kuscheln
  async (c) => {
    zufall.wert = 0.5;
    const ab = gebaut.length;
    await lauf(c, '_giftPlush', [6000]);
    return arten(ab).filter((k) => k === 'heart').length;
  },
  // 3 Sonnenbrille: lupfen
  async (c) => {
    c._el.pika.classList.add('cool');
    const ab = gebaut.length;
    await lauf(c, '_giftShades');
    return arten(ab).length;
  },
  // 4 Fernrohr: auf dem Stein Ausschau halten
  async (c) => {
    zufall.wert = 0.9;
    const ab = gebaut.length;
    await lauf(c, '_giftScope');
    return arten(ab).length;
  },
  // 5 Hängematte: Nickerchen (Juli, Tag: ein Schmetterling)
  async (c) => {
    zufall.wert = 0.9;
    c._dbgDate = JULI;
    const ab = gebaut.length;
    await lauf(c, '_giftHammock');
    const ham = gebaut.slice(ab).find((el) => el.classList.je.has('gt-ham'));
    return arten(ab).length + (ham.classList.je.has('gshim') || ham.classList.je.has('gglow') ? 1 : 0);
  },
  // 6 Gießkanne: gießen
  async (c) => {
    zufall.wert = 0.5;
    c._giftScene();
    await lauf(c, '_giftWater');
    return c._flowers.filter((f) => f.gold).length;
  },
  // 7 Glöckchen: bimmeln, dann eine Sekunde warten
  async (c) => {
    c._giftScene();
    const ab = gebaut.length;
    c._giftBell();
    vor(1000);
    return arten(ab).length + c.z.tweet;
  },
];

// ---------- Stufen ----------

test('Gold: jede Zugabe gibt es nur auf Stufe 3 – ohne Schatz, als Schatz und mit Trick passiert nichts Goldenes', async () => {
  ruhe.matches = false;
  for (let t = 0; t < 8; t++) {
    for (const l of [1, 2, 3]) {
      // alle anderen golden, nur dieser nicht: Die Stufe zählt je Schatz
      const lv = ALLE(3);
      lv[t] = l;
      const c = karte({ lv });
      assert.deepEqual(plain(giftLvs(c._plan.gift)), lv);
      const n = await AUSLOESER[t](c);
      vor(120000);
      if (l < 3) assert.equal(n, 0, `${GIFT_ITEMS[t].name} auf Stufe ${l}: ${n} Goldenes`);
      else assert.ok(n > 0, `${GIFT_ITEMS[t].name} golden: nichts passiert`);
      assert.equal(teilchen(c).length, 0, `${GIFT_ITEMS[t].name}: Teilchen bleiben stehen`);
    }
  }
  // Ein goldenes Päckchen, das noch am Ballon hängt, zählt nicht (wie .gilt in der Szene): erst nach dem Auspacken
  for (let t = 0; t < 8; t++) {
    const c = karte();
    Object.assign(c._plan.gift, { z: 5, o: 4, i: 16 + t });
    assert.equal(giftLvs(c._plan.gift)[t], 2);
    assert.equal(c._goldOk(t), false, GIFT_ITEMS[t].name);
    c._plan.gift.o = 5;
    assert.equal(c._goldOk(t), true, GIFT_ITEMS[t].name);
    // … und während er es auspackt (_giftHide), zeigt die Szene noch die alte Stufe
    c._giftHide = t;
    assert.equal(c._goldOk(t), false, GIFT_ITEMS[t].name);
  }
  // Päckchen abgeschaltet: nichts
  const aus = karte({ cfg: { gifts: false } });
  for (let t = 0; t < 8; t++) assert.equal(aus._goldOk(t), false);
});

test('Gold: was die acht Zugaben zeigen (Funkenspur, Lichtfunken, Herzchen, bling, Entdeckung, Besuch, Sonnenblume, Vogel)', async () => {
  ruhe.matches = false;
  // Wollknäuel: fünf Funken zwischen Start und Ziel, in der Reihenfolge des Rollens verzögert
  let c = karte();
  let ab = gebaut.length;
  await AUSLOESER[0](c);
  let neu = gebaut.slice(ab).filter((el) => el.classList.je.has('gfx'));
  assert.deepEqual(arten(ab), Array(5).fill('trail'));
  const xs = neu.map((el) => parseFloat(el.style.left));
  const ds = neu.map((el) => parseFloat(el.style.animationDelay));
  assert.ok(xs.every((x, i) => !i || (x - xs[i - 1]) * (xs[1] - xs[0]) > 0), `Spur nicht der Reihe nach: ${xs}`);
  assert.ok(ds.every((d, i) => !i || d > ds[i - 1]), `Verzögerung: ${ds}`);
  // Kopfball: Funken entlang des Bogens, die mittleren höher als die äußeren, alle über dem Boden
  c = karte();
  c._giftScene();
  c._yarnXf = (c._g.fMin + c._g.fMax) / 2;
  ab = gebaut.length;
  await lauf(c, '_giftHeader');
  neu = gebaut.slice(ab).filter((el) => el.classList.je.has('gfx'));
  assert.equal(neu.length, 5);
  const ys = neu.map((el) => parseFloat(el.style.top));
  assert.ok(Math.min(...ys.slice(1, 4)) < Math.min(ys[0], ys[4]) + 1 && ys.every((y) => y < c._g.gy), `Bogen: ${ys}`);
  vor(5000);
  assert.equal(teilchen(c).length, 0);
  // Windrad: drei Funken ab der Nabe, die vom Bau weg über die Wiese treiben
  c = karte();
  ab = gebaut.length;
  await AUSLOESER[1](c);
  neu = gebaut.slice(ab).filter((el) => el.classList.je.has('gfx'));
  assert.deepEqual(arten(ab), ['glint', 'glint', 'glint']);
  for (const el of neu) {
    assert.ok(parseFloat(el.style['--dx']) > c._W * 0.1, `treibt nicht über die Wiese: ${el.style['--dx']}`);
    assert.ok(parseFloat(el.style.left) < c._W / 2);
  }
  // echter Wind ab GOLD.wheelWind.min, aus dem Takt (Zufall unter p), nicht im Schlaf
  c = karte();
  c._giftScene();
  zufall.wert = 0.1;
  ab = gebaut.length;
  c._wind = GOLD.wheelWind.min - 1;
  c._tickGift();
  assert.deepEqual(arten(ab), []);
  c._wind = GOLD.wheelWind.min + 5;
  c._asleep = true;
  c._tickGift();
  assert.deepEqual(arten(ab).filter((k) => k === 'glint'), [], 'im Schlaf steht das Windrad still');
  c._asleep = false;
  c._tickGift();
  assert.deepEqual(arten(ab).filter((k) => k === 'glint'), ['glint', 'glint', 'glint']);
  // Plüsch-Pino: Herzchen steigen über ihm auf, wo er auf der Wiese sitzt; nachts über dem Bett im Bau
  c = karte();
  ab = gebaut.length;
  let px = null;
  zufall.wert = 0.5;
  c._goldHeart = function (...a) {
    px = this._plushX;
    return P._goldHeart.apply(this, a);
  };
  await lauf(c, '_giftPlush', [6000]);
  neu = gebaut.slice(ab).filter((el) => el.classList.je.has('heart'));
  assert.equal(neu.length, 2, 'zwei Gelegenheiten, 3 s auseinander');
  assert.ok(px != null && neu.every((el) => Math.abs(parseFloat(el.style.left) - px) < 1 && parseFloat(el.style.top) < c._g.gy));
  c = karte();
  c._asleep = true;
  c._giftScene();
  assert.ok(c._gtEls.has(2), 'nachts liegt er im Bett');
  zufall.wert = 0.1;
  ab = gebaut.length;
  c._tickGift();
  neu = gebaut.slice(ab).filter((el) => el.classList.je.has('heart'));
  assert.equal(neu.length, 1);
  assert.ok(parseFloat(neu[0].style.left) > c._g.hole.l && parseFloat(neu[0].style.left) < c._g.hole.r, 'über dem Bett im Bau');
  // … wach und ohne Plüsch-Pino draußen: keins
  c = karte();
  c._giftScene();
  ab = gebaut.length;
  c._tickGift();
  assert.deepEqual(arten(ab).filter((k) => k === 'heart'), []);
  // Sonnenbrille: ein Stern am Rand, auf der Seite, in die er schaut; Lichtreflex aus dem Takt nur bei Sonne ab 24 °C
  c = karte();
  ab = gebaut.length;
  await AUSLOESER[3](c);
  assert.deepEqual(arten(ab), ['bling']);
  assert.ok(parseFloat(gebaut.slice(ab).find((el) => el.classList.je.has('bling')).style.left) > c._x, 'er schaut nach rechts');
  c = karte();
  c._giftScene();
  zufall.wert = 0.1;
  Object.assign(c, { _wxRaw: { cond: 'cloudy', temp: 28 }, _elev: 40 });
  c._tickGift();
  assert.equal(c._el.pika.classList.je.has('gsheen'), false, 'bedeckt: keine Brille, kein Reflex');
  Object.assign(c, { _wxRaw: { cond: 'sunny', temp: 28 }, _elev: 40 });
  c._tickGift();
  assert.equal(c._el.pika.classList.contains('cool'), true);
  assert.equal(c._el.pika.classList.contains('gsheen'), true);
  vor(1600);
  assert.equal(c._el.pika.classList.contains('gsheen'), false, 'nach anderthalb Sekunden vorbei');
  // nur eine Minute nach dem Auspacken trägt er sie auch ohne Sonne: dann spiegelt nichts
  c = karte();
  c._giftScene();
  c._coolUntil = jetzt + 60000;
  c._wxRaw = { cond: 'cloudy', temp: 10 };
  c._tickGift();
  assert.deepEqual([c._el.pika.classList.contains('cool'), c._el.pika.classList.je.has('gsheen')], [true, false]);
  // Fernrohr: Der erste Blick findet immer etwas (am Tag ein Flugzeug, in der Dämmerung ein Stern), „da!“
  c = karte();
  ab = gebaut.length;
  await AUSLOESER[4](c);
  assert.deepEqual(arten(ab), ['plane'], 'Zufall 0,9: nur der erste Blick');
  assert.ok(c.z.say.some((s) => /^da/.test(s)), c.z.say.join(' | '));
  assert.deepEqual(c.z.memo, [], 'ins Tagesgedächtnis kommt nur ein echtes Flugzeug');
  c = karte();
  c._el.scene.classList.add('dusk');
  zufall.wert = 0.2;
  ab = gebaut.length;
  await lauf(c, '_giftScope');
  assert.deepEqual(arten(ab), ['star', 'star', 'star'], 'Zufall 0,2: jeder Blick');
  for (const el of gebaut.slice(ab).filter((x) => x.classList.je.has('star'))) {
    assert.ok(parseFloat(el.style.top) < c._Hs * 0.3 && parseFloat(el.style.left) >= 14 && parseFloat(el.style.left) <= c._W - 14);
  }
  // fliegt ein echtes Flugzeug, schaut er dem nach (wie bisher), ohne Zugabe
  c = karte();
  c._planeToWatch = () => ({ x: 300 });
  ab = gebaut.length;
  await lauf(c, '_giftScope');
  assert.deepEqual(arten(ab), []);
  assert.deepEqual(c.z.memo, ['plane', 'plane', 'plane']);
  // Glöckchen: ohne Vogel zwei Noten vom Bildrand gegenüber dem Bau; sitzt einer da, zwitschert er selbst
  c = karte();
  ab = gebaut.length;
  assert.equal(await AUSLOESER[7](c), 2);
  assert.deepEqual(arten(ab), ['tweet', 'tweet']);
  assert.ok(gebaut.slice(ab).filter((el) => el.classList.je.has('tweet')).every((el) => parseFloat(el.style.left) > c._W * 0.8 && /[♪♫]/.test(el.html)));
  c = karte();
  c._bird = { sitting: true };
  ab = gebaut.length;
  assert.equal(await AUSLOESER[7](c), 1);
  assert.deepEqual([arten(ab), c.z.tweet], [[], 1]);
  // … und es legt keinen Besuch an und verschiebt keinen (die folgen der Uhr): Die Zugabe fasst nur _tweet an
  const bell = quell('karte/schaetze.js').match(/\n  _goldBell\(\) \{([\s\S]*?)\n  \}\n/)[1];
  assert.doesNotMatch(bell, /_birdVisit|_critter|_startCritters|_restartCritters|_critT|_dbgShiftMs/);
});

test('Gold: die Hängematte lockt Besuch – Schmetterling am Sommertag, Glühwürmchen am Sommerabend, sonst ein Schimmer übers Netz', async () => {
  ruhe.matches = false;
  const L = { mo: 6, dark: false, summer: true, wet: false, cold: false, wind: 5, flies: true };
  assert.equal(goldHamGuest(L), 'bfly');
  assert.deepEqual([3, 8].map((mo) => goldHamGuest({ ...L, mo })), ['bfly', 'bfly'], 'April bis September');
  assert.deepEqual([2, 9, 11].map((mo) => goldHamGuest({ ...L, mo, summer: false })), ['shim', 'shim', 'shim']);
  assert.equal(goldHamGuest({ ...L, wet: true }), 'shim');
  assert.equal(goldHamGuest({ ...L, cold: true }), 'shim');
  assert.equal(goldHamGuest({ ...L, wind: 40 }), 'shim');
  assert.equal(goldHamGuest({ ...L, dark: true }), 'ff');
  assert.equal(goldHamGuest({ ...L, dark: true, flies: false }), 'shim', 'Option fireflies aus');
  assert.equal(goldHamGuest({ ...L, dark: true, summer: false, mo: 3 }), 'shim', 'Glühwürmchen nur im Sommer');
  assert.equal(goldHamGuest({ ...L, dark: true, wet: true }), 'shim');
  // an der Karte: Juli am Tag
  const nick = async (einrichten = () => {}) => {
    zufall.wert = 0.9;
    const c = karte();
    c._dbgDate = JULI;
    einrichten(c);
    const ab = gebaut.length;
    let beim = null; // was während des Dösens da ist
    const w = P._goldHam;
    c._goldHam = function (el) {
      const bye = w.apply(this, arguments);
      beim = { arten: arten(ab), ham: [...el.classList.s], gast: teilchen(this)[0] || null, cx: this._giftX(5) };
      return bye;
    };
    const R = await lauf(c, '_giftHammock');
    const ham = gebaut.slice(ab).find((el) => el.classList.je.has('gt-ham'));
    return { c, R, beim, ham, ab };
  };
  let N = await nick();
  assert.deepEqual(N.beim.arten, ['hbfly']);
  assert.match(N.beim.gast.html, /class="bwl"/, 'der Schmetterling von der Nase (BFLY_SVG)');
  // er sitzt auf der Spitze eines Gestells: 25/60 der Breite neben der Mitte der Hängematte, über dem Boden
  const w = N.c._g.pW * 1.25;
  assert.ok(Math.abs(Math.abs(parseFloat(N.beim.gast.style.left) - N.beim.cx) - w * 25 / 60) < 0.2, `${N.beim.gast.style.left} neben ${N.beim.cx}`);
  assert.ok(parseFloat(N.beim.gast.style.top) < N.c._g.gy && parseFloat(N.beim.gast.style.top) > N.c._g.gy - w / 3);
  assert.equal(N.beim.gast.flug.length, 1, 'er flattert heran');
  assert.ok(N.beim.gast.flug[0].opt.delay >= 2000 && N.beim.gast.flug[0].opt.fill === 'backwards', 'erst nach ein paar Sekunden Dösen, bis dahin unsichtbar');
  assert.equal(N.beim.gast.classList.je.has('off'), true, 'ausgeschlafen: Er fliegt davon');
  assert.equal(N.R.fertig, true);
  vor(2000);
  assert.equal(teilchen(N.c).length, 0);
  assert.equal(N.beim.gast.isConnected, false);
  assert.equal(N.c._bfly, undefined, 'der Merker des Nasen-Schmetterlings (_bfly) bleibt unberührt');
  // Juli in der Dämmerung: Glühwürmchen
  N = await nick((c) => c._el.scene.classList.add('dusk'));
  assert.deepEqual(N.beim.arten, ['hff']);
  assert.equal(N.beim.gast.flug.length, 0, 'es glimmt per Stil herein, ohne Web Animation');
  // … nicht mit fireflies: false
  N = await nick((c) => {
    c._el.scene.classList.add('night');
    c._cfg.fireflies = false;
  });
  assert.deepEqual([N.beim.arten, N.beim.ham.includes('gshim')], [[], true]);
  // November: Schimmer, solange er döst, danach ist die Klasse wieder weg
  N = await nick((c) => { c._dbgDate = NOVEMBER; });
  assert.deepEqual([N.beim.arten, N.beim.ham.includes('gshim')], [[], true]);
  assert.equal(N.ham.classList.contains('gshim'), false);
  // Südhalbkugel: im Januar ist dort Sommer
  N = await nick((c) => {
    c._dbgDate = new Date(2027, 0, 14, 14).getTime();
    c._hass = { config: { latitude: -34 } };
  });
  assert.deepEqual(N.beim.arten, ['hbfly']);
  // die Vorschau sucht aus
  N = await nick((c) => { c._dbgHam = 'ff'; });
  assert.deepEqual(N.beim.arten, ['hff']);
  // der Schimmer ist ein eigener Pfad im Netz der Hängematte, unsichtbar, bis die Klasse ihn laufen lässt
  assert.match(GIFT_HAMMOCK, /<g class="gnet">[\s\S]*<path class="gshm" d="M5 3.4 L10 5 Q30 23 50 5 L55 3.4" pathLength="100"/);
  const stil = quell('stil/paeckchen.js');
  assert.match(stil, /\.gt-ham \.gshm \{ opacity: 0;/);
  assert.match(stil, /\.gt-ham\.gshim \.gshm \{ animation: gshm /);
  // … und beim Abbauen nimmt _giftScene beide Klassen mit
  assert.match(quell('karte/paeckchen.js'), /classList\.remove\('build', 'sway', 'swing', 'gshim', 'gglow'\)/);
});

// ---------- Plan und Zustand ----------

test('Gold: nichts davon steht im Plan oder im Zustand – kein _planOp, kein _add, kein Tagesgedächtnis, kein Fund', async () => {
  ruhe.matches = false;
  for (let t = 0; t < 8; t++) {
    const zaehl = [];
    for (const l of [2, 3]) {
      const c = karte({ lv: ALLE(l) });
      // die Zugaben der anderen im selben Takt mit auslösen
      Object.assign(c, { _wxRaw: { cond: 'sunny', temp: 28 }, _elev: 40, _wind: 40 });
      const n = await AUSLOESER[t](c);
      zufall.wert = 0.05;
      c._tickGift();
      c._asleep = true;
      c._giftScene();
      c._tickGift();
      vor(120000);
      assert.equal(n > 0, l === 3);
      zaehl.push(plain({ ...c.z, say: 0, peep: 0, tweet: 0 }));
      assert.deepEqual(c.z.planOp, [], `${GIFT_ITEMS[t].name} Stufe ${l}`);
      assert.deepEqual([c.z.add, c.z.memo, c.z.found, c.z.selfFed, c.z.save], [0, [], [], 0, 0], `${GIFT_ITEMS[t].name} Stufe ${l}`);
    }
    // golden schreibt genau so viel wie mit Trick: nichts
    assert.deepEqual(zaehl[1], zaehl[0]);
  }
  // Die Karte merkt sich nur je Gerät, wann eine Zugabe zuletzt kam, und im Stand der Päckchen ändert sich kein Feld
  const c = karte();
  const vorher = JSON.stringify(c._plan);
  for (let t = 0; t < 8; t++) await AUSLOESER[t](c);
  vor(120000);
  assert.equal(JSON.stringify(c._plan), vorher);
  assert.ok(Object.keys(c._goldAt).every((k) => k in GOLD), Object.keys(c._goldAt).join());
  // und im Quelltext der Zugaben kommt kein Schreiben vor
  const teil = quell('karte/schaetze.js').split('// ---------- Gold mit Wirkung')[1].split('  // Golden: ab und zu ein Funkeln')[0];
  assert.doesNotMatch(teil, /_planOp|_add\(|_memo\(|_found\(|_save\(|localStorage|_selfFed/);
});

// ---------- Abstand ----------

test('Gold: Abstand und Würfel je Gerät – goldDue, mehrfaches Antippen, Glockenspiel mit einer Antwort', async () => {
  ruhe.matches = false;
  // die reine Regel
  assert.equal(goldDue({ cd: 1000 }, undefined, 5000), true, 'noch nie');
  assert.equal(goldDue({ cd: 1000 }, 4500, 5000), false);
  assert.equal(goldDue({ cd: 1000 }, 4000, 5000), true);
  assert.equal(goldDue({ cd: 1000 }, 9e9, 5000), true, 'zurückgestellte Uhr sperrt nicht ewig');
  assert.equal(goldDue({ cd: 1000 }, 5400, 5000), false);
  assert.equal(goldDue({ p: 0.3 }, undefined, 0, 0.29), true);
  assert.equal(goldDue({ p: 0.3 }, undefined, 0, 0.3), false);
  assert.equal(goldDue({ cd: 1000, p: 0.3 }, 4500, 5000, 0), false);
  assert.equal(goldDue({}, 5000, 5000, 0.99), true, 'ohne Abstand und Würfel: immer');
  for (const [k, R] of Object.entries(GOLD)) {
    assert.ok(R.cd == null || (R.cd >= 2000 && R.cd <= 10 * 6e4), `${k}: Abstand ${R.cd}`);
    assert.ok(R.p == null || (R.p > 0 && R.p < 1), `${k}: p ${R.p}`);
    assert.ok(R.cd != null || R.p != null, `${k}: weder Abstand noch Würfel`);
  }
  // Windrad: dreimal schnell angetippt gibt einen Schwung Funken, nach dem Abstand wieder einen
  let c = karte();
  c._giftScene();
  let ab = gebaut.length;
  for (let i = 0; i < 3; i++) {
    c._blowUntil = Math.max(c._blowUntil || 0, jetzt + 2600);
    c._giftScene();
    vor(700);
  }
  assert.equal(arten(ab).length, 3);
  // derselbe Schwung (_giftScene läuft bei jedem Takt): nichts Neues, auch nach dem Abstand nicht
  vor(GOLD.wheel.cd);
  c._blowUntil = jetzt + 100;
  c._giftScene();
  assert.equal(arten(ab).length, 6);
  for (let i = 0; i < 5; i++) c._giftScene();
  assert.equal(arten(ab).length, 6);
  vor(GOLD.wheel.cd + 200);
  c._giftScene();
  assert.equal(arten(ab).length, 6, 'der Schwung ist vorbei (_blowUntil abgelaufen)');
  // echter Wind: höchstens alle anderthalb Minuten
  zufall.wert = 0.1;
  c._wind = 45;
  ab = gebaut.length;
  for (let i = 0; i < 4; i++) {
    c._tickGift();
    vor(20000);
  }
  assert.equal(arten(ab).filter((k) => k === 'glint').length, 3);
  vor(GOLD.wheelWind.cd);
  c._tickGift();
  assert.equal(arten(ab).filter((k) => k === 'glint').length, 6);
  // … und nur mit Würfelglück
  zufall.wert = GOLD.wheelWind.p;
  vor(GOLD.wheelWind.cd + 1);
  c._tickGift();
  assert.equal(arten(ab).filter((k) => k === 'glint').length, 6);
  // Glöckchen: Das Glockenspiel bimmelt drei- oder viermal, der Vogel antwortet einmal
  c = karte();
  c._giftScene();
  zufall.wert = 0.5;
  ab = gebaut.length;
  await lauf(c, '_giftTune');
  vor(3000);
  assert.ok(c.z.peep.filter((s) => /bimm|bamm|ding|dong/.test(s)).length >= 3, c.z.peep.join());
  assert.deepEqual(arten(ab).filter((k) => k === 'tweet'), ['tweet', 'tweet']);
  // gleich danach kommt er aus dem Bau (bimm!): keine zweite Antwort; nach dem Abstand wieder
  c._giftBell();
  vor(2000);
  assert.equal(arten(ab).filter((k) => k === 'tweet').length, 2);
  vor(GOLD.bell.cd);
  c._giftBell();
  vor(2000);
  assert.equal(arten(ab).filter((k) => k === 'tweet').length, 4);
  // Lichtreflex auf der Brille: bei Sonne nicht in jedem Takt
  c = karte();
  c._giftScene();
  Object.assign(c, { _wxRaw: { cond: 'sunny', temp: 28 }, _elev: 40 });
  zufall.wert = 0.1;
  let n = 0;
  for (let i = 0; i < 30; i++) {
    c._tickGift();
    if (c._el.pika.classList.contains('gsheen')) n++;
    vor(20000);
  }
  assert.ok(n >= 4 && n <= 5, `${n} Reflexe in zehn Minuten`);
  zufall.wert = 0.9;
  vor(GOLD.sheen.cd);
  c._tickGift();
  assert.equal(c._el.pika.classList.contains('gsheen'), false, 'Würfel');
  // Herzchen nachts: höchstens alle vier Minuten
  c = karte();
  c._asleep = true;
  c._giftScene();
  zufall.wert = 0.1;
  ab = gebaut.length;
  for (let i = 0; i < 12; i++) {
    c._tickGift();
    vor(20000);
  }
  assert.equal(arten(ab).filter((k) => k === 'heart').length, 1);
  // Wollknäuel: Zurückrollen nur mit Würfelglück und dann lange nicht wieder
  // (die Wiese ist schmal: vom linken Rand aus, er steht links davon, damit auch der zweite Stups noch rollt)
  const kullern = async (k) => {
    k._giftScene();
    k._yarnXf = k._g.fMin;
    k._x = k._g.fMin * k._W - k._g.pW;
    k._giftScene();
    k._giftHeader = async () => {}; // (sonst köpft er es gleich weiter)
    const i0 = k.z.say.length;
    await lauf(k, '_giftYarn');
    return k.z.say.slice(i0).some((s) => /zurück|allein|Zauberknäuel/.test(s));
  };
  c = karte({ lv: [3, 1, 1, 1, 1, 1, 1, 1] });
  zufall.wert = 0.3; // unter p: rollt zurück (ein oder zwei Stupser je nach Zufall: hier 2)
  assert.equal(await kullern(c), true);
  const el = c._gtEls.get(0);
  assert.ok(Math.abs(parseFloat(el.style.left) - (c._x + c._dir * c._g.pW * 0.5)) < 1, 'es bleibt vor seinen Pfoten liegen');
  assert.ok(Math.abs(c._yarnXf * c._W - parseFloat(el.style.left)) < 1, 'und liegt für die Szene dort');
  assert.equal(await kullern(c), false, 'gleich noch einmal: nein');
  vor(GOLD.yarnBack.cd);
  assert.equal(await kullern(c), true);
  zufall.wert = 0.4;
  vor(GOLD.yarnBack.cd);
  assert.equal(await kullern(c), false, 'Würfel');
  // die Vorschau überspringt Abstand und Würfel
  c._dbgGold = true;
  zufall.wert = 0.99;
  assert.equal(c._goldOk(0, 'yarnBack'), true);
  assert.equal(c._goldOk(0, 'yarnBack'), true);
  // … und _dbgYarnBack gilt für einen Lauf: nur ein Stups (sonst wären es bei diesem Zufall zwei), dann kommt es zurück
  c = karte();
  c._dbgGold = true;
  c._dbgYarnBack = true;
  zufall.wert = 0.3;
  assert.equal(await kullern(c), true);
  assert.equal(c.z.say.filter((s) => ['hihi!', 'kuller!', 'fang!', 'hopp!'].includes(s)).length, 1);
  assert.equal(c._dbgYarnBack, false);
});

// ---------- Abbruch ----------

test('Gold: Abbruch an jeder Wartestelle lässt kein Teilchen, keinen Besuch und keine Klasse zurück', async () => {
  const FAELLE = [
    ['_giftYarn', [], 0.3, (c) => { c._giftScene(); c._yarnXf = (c._g.fMin + c._g.fMax) / 2; c._giftScene(); }],
    ['_giftHeader', [], 0.5, (c) => { c._giftScene(); c._yarnXf = (c._g.fMin + c._g.fMax) / 2; c._giftScene(); }],
    ['_giftPlush', [6000], 0.5, () => {}],
    ['_giftShades', [], 0.5, (c) => c._el.pika.classList.add('cool')],
    ['_giftScope', [], 0.2, () => {}],
    ['_giftHammock', [], 0.9, (c) => { c._dbgDate = JULI; }],
    ['_giftHammock', [], 0.9, (c) => { c._dbgDate = JULI; c._el.scene.classList.add('dusk'); }],
    ['_giftHammock', [], 0.9, (c) => { c._dbgDate = NOVEMBER; }],
    ['_giftWater', [], 0.5, (c) => c._giftScene()],
    ['_giftWater', [], 0.5, (c) => { c._giftScene(); c._seasonK = 'winter'; }],
  ];
  for (const ruhig of [false, true]) {
    ruhe.matches = ruhig;
    for (const [name, args, zf, einrichten] of FAELLE) {
      const neu = () => {
        zufall.wert = zf;
        const c = karte();
        einrichten(c);
        return c;
      };
      const ab0 = gebaut.length;
      const voll = await lauf(neu(), name, args);
      const wer = `${name}${ruhig ? ' (Bewegung reduzieren)' : ''}`;
      assert.equal(voll.fertig, true, wer);
      assert.ok(voll.n >= 4, `${wer}: nur ${voll.n} Wartestellen`);
      const golden = arten(ab0).length + gebaut.slice(ab0).filter((el) => el.classList.je.has('gshim') || el.classList.je.has('gglow')).length
        + gebaut.slice(ab0).filter((el) => el.classList.je.has('gbloom')).length;
      assert.ok(golden > 0, `${wer}: im vollen Lauf nichts Goldenes`);
      vor(200000);
      let mittendrin = 0; // Abbrüche, bei denen gerade Teilchen im Bild waren
      for (let stopp = 0; stopp < voll.n; stopp++) {
        const c = neu();
        const ab = gebaut.length;
        const R = await lauf(c, name, args, { stopp });
        const wo = `${wer}, Abbruch an Wartestelle ${stopp}`;
        assert.equal(R.fertig, false, wo);
        if (R.lebend[stopp] > 0) mittendrin++;
        // gleich nach dem Abbruch (noch vor _cleanup) hängt kein Teilchen mehr im Bild
        assert.equal(R.rest, 0, wo);
        assert.equal(teilchen(c).length, 0, wo);
        const ham = gebaut.slice(ab).find((el) => el.classList.je.has('gt-ham'));
        if (ham) assert.deepEqual(['gshim', 'gglow'].filter((k) => ham.classList.contains(k)), [], wo);
        // In der Hängematte unterbrochen, holt ihn die Schleife erst heraus (giftHamDown)
        if (c._lift > 0 && c._onHam) await lauf(c, '_giftHamDown');
        const stehen = [...c._el.pika.classList.s].filter((k) => !BLEIBT.has(k));
        assert.deepEqual(stehen, [], wo);
        // danach entsteht nichts mehr: kein Zeitgeber legt nach dem Abbruch noch ein Teilchen an
        const n0 = arten(ab).length;
        vor(200000);
        assert.equal(arten(ab).length, n0, `${wo}: nach dem Abbruch kam noch ein Teilchen`);
        assert.equal(teilchen(c).length, 0, wo);
        assert.equal(c._el.fx.children.length, 0, wo);
        assert.deepEqual(c.z.planOp, [], wo);
        // die Wiese bleibt in Ordnung, auch wenn er mitten im Gießen aufhört
        for (const f of c._flowers) assert.ok(f.el.isConnected && typeof f.color === 'string' && f.xf >= c._g.fMin && f.xf <= c._g.fMax, wo);
        assert.ok(c._flowers.filter((f) => f.gold).length <= 1, wo);
      }
      if (!ruhig && !/Water|Hammock/.test(name)) assert.ok(mittendrin > 0, `${wer}: kein Abbruch traf laufende Teilchen`);
      if (/Hammock/.test(name)) {
        // der Besuch auf dem Gestell ist bei einem Abbruch im Dösen da (außer beim Schimmer) und sofort weg
        const hatGast = arten(ab0).some((k) => k === 'hbfly' || k === 'hff');
        assert.equal(mittendrin > 0, hatGast, wer);
      }
    }
  }
  ruhe.matches = false;
  // Karte aus dem DOM: alles Goldene weg, auch die Antwort des Vogels, die noch aussteht
  const c = karte();
  c._giftScene();
  const ab = gebaut.length;
  c._blowUntil = jetzt + 2600;
  c._giftScene();
  c._giftBell();
  c._el.pika.classList.add('gsheen');
  assert.equal(teilchen(c).length, 3);
  c._detachGift();
  assert.equal(teilchen(c).length, 0);
  assert.equal(c._el.pika.classList.contains('gsheen'), false);
  vor(5000);
  assert.deepEqual(arten(ab), ['glint', 'glint', 'glint'], 'keine Note mehr nach dem Abhängen');
  // Die Klassen des Lichtreflexes räumt _cleanup mit ab (GIFT_CLS)
  assert.ok(GIFT_CLS.includes('gsheen') && GIFT_CLS.includes('gglow'));
  assert.match(quell('karte/lebensschleife.js'), /\.\.\.GIFT_CLS\]/);
});

// ---------- Urlaub ----------

test('Gold: solange er verreist ist oder keiner hinsieht, gibt es keine Zugabe', async () => {
  ruhe.matches = false;
  for (const [was, weg] of [['verreist', { _urlaubFern: () => true }], ['keiner sieht hin', { _away: () => true }]]) {
    for (let t = 0; t < 8; t++) {
      const c = karte();
      Object.assign(c, weg);
      assert.equal(c._goldOk(t), false, `${GIFT_ITEMS[t].name}, ${was}`);
    }
    // was von selbst kommt oder ein Tipp auslöst: Windrad, Glöckchen, Lichtreflex, Herzchen nachts
    const c = karte();
    Object.assign(c, { _wxRaw: { cond: 'sunny', temp: 28 }, _elev: 40, _wind: 45 });
    c._giftScene();
    Object.assign(c, weg);
    zufall.wert = 0.01;
    const ab = gebaut.length;
    c._blowUntil = jetzt + 2600;
    c._giftScene();
    c._tickGift();
    c._gtEls.get(7).classList.remove('ring');
    P._goldBell.call(c);
    c._asleep = true;
    c._giftScene();
    c._tickGift();
    vor(5000);
    assert.deepEqual(arten(ab), [], was);
    assert.equal(c.z.tweet, 0, was);
    assert.deepEqual(['gsheen', 'gglow'].filter((k) => c._el.pika.classList.je.has(k)), [], was);
  }
  // Reist er ab, während die Antwort des Vogels noch aussteht, kommt sie nicht mehr
  const c = karte();
  c._giftScene();
  const ab = gebaut.length;
  c._giftBell();
  c._urlaubFern = () => true;
  vor(5000);
  assert.deepEqual([arten(ab), c.z.tweet], [[], 0]);
});

// ---------- Bewegung reduzieren ----------

test('Gold mit „Bewegung reduzieren“: ein stiller Funke statt treibender Teilchen, kein Zurückrollen, kein Anflug', async () => {
  ruhe.matches = true;
  // Wollknäuel: ein einzelner stiller Funke am Ziel, und es kullert nie von selbst zurück
  let c = karte();
  let ab = gebaut.length;
  zufall.wert = 0.3;
  c._giftScene();
  c._yarnXf = (c._g.fMin + c._g.fMax) / 2;
  c._giftScene();
  const stups = c.z.say.length;
  await lauf(c, '_giftYarn');
  assert.ok(arten(ab).length >= 1 && arten(ab).length <= 2, 'je Stups einer');
  assert.ok(still(ab).every(Boolean));
  assert.equal(c.z.say.slice(stups).some((s) => /zurück|allein|Zauberknäuel/.test(s)), false);
  // Windrad, Herzchen, bling, Entdeckung, Vogel: je ein Teilchen, alle still
  for (const [t, soll] of [[1, ['glint']], [2, ['heart', 'heart']], [3, ['bling']], [4, ['plane']], [7, ['tweet']]]) {
    c = karte();
    ab = gebaut.length;
    await AUSLOESER[t](c);
    assert.deepEqual(arten(ab), soll, GIFT_ITEMS[t].name);
    assert.ok(still(ab).every(Boolean), GIFT_ITEMS[t].name);
    for (const el of gebaut.slice(ab).filter((x) => x.classList.je.has('gfx'))) assert.equal(el.flug.length, 0);
  }
  // Lichtreflex: glimmt auf, statt zu wandern
  c = karte();
  c._giftScene();
  Object.assign(c, { _wxRaw: { cond: 'sunny', temp: 28 }, _elev: 40 });
  zufall.wert = 0.1;
  c._tickGift();
  assert.deepEqual(['gsheen', 'gglow'].map((k) => c._el.pika.classList.contains(k)), [false, true]);
  // Hängematte: Der Schmetterling blendet am Platz ein (kein Anflug), der Schimmer liegt still auf dem Netz
  for (const [datum, soll] of [[JULI, 'hbfly'], [NOVEMBER, null]]) {
    zufall.wert = 0.9;
    c = karte();
    c._dbgDate = datum;
    ab = gebaut.length;
    await lauf(c, '_giftHammock');
    const ham = gebaut.slice(ab).find((el) => el.classList.je.has('gt-ham'));
    if (soll) {
      const gast = gebaut.slice(ab).find((el) => el.classList.je.has(soll));
      assert.deepEqual([gast.classList.je.has('still'), gast.flug.length, gast.classList.je.has('off')], [true, 0, false]);
    } else assert.deepEqual(['gshim', 'gglow'].map((k) => ham.classList.je.has(k)), [false, true]);
  }
  // Gießkanne im Winter: ein stiller Funke statt des Funkenregens
  c = karte();
  c._seasonK = 'winter';
  c._giftScene();
  zufall.wert = 0.5;
  ab = gebaut.length;
  await lauf(c, '_giftWater');
  assert.deepEqual([arten(ab), still(ab)], [['trail'], [true]]);
  ruhe.matches = false;
  // Stil: Die ruhige Fassung steht nach den Arten (sie ersetzt deren Animation), und die Systemeinstellung greift
  // auch ohne Skript
  const stil = quell('stil/paeckchen.js');
  const lage = (re) => stil.search(re);
  for (const art of ['trail', 'glint', 'heart', 'bling', 'star', 'plane', 'tweet']) {
    assert.ok(lage(new RegExp(`\\.gfx\\.${art} \\{[^}]*animation: gfx-`)) > 0, `.gfx.${art} ohne Animation`);
    assert.ok(lage(new RegExp(`\\.gfx\\.${art} \\{`)) < lage(/\.gfx\.still \{ animation: gfx-still/), `.gfx.${art} steht nach .still`);
  }
  assert.match(stil, /@keyframes gfx-still \{ 0%, 100% \{ opacity: 0; \} 30%, 70% \{ opacity: 1; \} \}/, 'nur Deckkraft');
  assert.match(stil, /@media \(prefers-reduced-motion: reduce\) \{\s*\.gfx:not\(\.hbfly\):not\(\.hff\) \{ animation-name: gfx-still !important; \}/);
  assert.match(stil, /@media \(prefers-reduced-motion: reduce\) \{ \.gsheen \.shades path:nth-child\(3\) \{ animation-name: gglow !important; \} \}/);
  assert.match(stil, /\.gfx\.hbfly \.bwl, \.gfx\.hbfly \.bwr, \.gt-ham \.gshm \{ animation: none !important; \}/);
  // ohne filter (Safari schneidet dessen Überstand ab, siehe 0.40.1)
  const gold = stil.split('/* ---- Gold mit Wirkung')[1].split('@media (prefers-reduced-motion: reduce) {')[0];
  assert.doesNotMatch(gold.replace(/\/\*[\s\S]*?\*\//g, ''), /filter:/);
});

// ---------- Wiese ----------

test('Gold: die Sonnenblume der Gießkanne ist eine gewöhnliche Wiesenblume – zählen, knabbern, nachwachsen, sammeln', async () => {
  ruhe.matches = false;
  zufall.wert = 0.5;
  // Trick allein: drei Blumen, keine goldene. Golden: dieselben drei, die mittlere ist die Sonnenblume
  const giess = async (lv, mehr = () => {}) => {
    const c = karte({ lv: [3, 3, 3, 3, 3, 3, lv, 3] });
    c._lit = { lb: 0.8, ls: 0.9, pal: {} };
    c._giftScene();
    mehr(c);
    const ab = gebaut.length;
    const R = await lauf(c, '_giftWater');
    assert.equal(R.fertig, true);
    return { c, ab };
  };
  const { c: t } = await giess(2);
  assert.deepEqual([t._flowers.length, t._flowers.filter((f) => f.gold).length], [3, 0]);
  const { c, ab } = await giess(3);
  assert.equal(c._flowers.length, 3);
  const g = c._flowers.filter((f) => f.gold);
  assert.equal(g.length, 1);
  assert.equal(c._flowers.indexOf(g[0]), 1, 'die mittlere der drei');
  assert.ok(c.z.say.some((s) => /goldene|leuchtet|Sonnenblume/.test(s)), c.z.say.join(' | '));
  // dieselben Felder wie jede Blume, die Farbe ist das Gelb der Palette, das Bild eine Sonnenblume in denselben
  // Lichtvariablen (--fc, --fm, --fst, --flf), und _flowerTint hat sie beleuchtet
  const pal = plain(c._flowerPal());
  for (const f of c._flowers) {
    assert.deepEqual(Object.keys(f).filter((k) => k !== 'gold').sort(), ['color', 'el', 'xf']);
    assert.ok(pal.includes(f.color), `${f.color} nicht in der Palette`);
    assert.ok(f.xf >= c._g.fMin && f.xf <= c._g.fMax);
    assert.equal(f.el.parentElement, c._el.flowers);
    assert.match(f.el.style['--fc'], /^#[0-9a-f]{6}$/);
  }
  assert.ok(GOLD_BLOOM.includes(g[0].color));
  assert.match(g[0].el.html, /<svg class="gsun" viewBox="0 0 20 30"/);
  assert.equal((g[0].el.html.match(/<ellipse cx="10" cy="3.3"/g) || []).length, 12, 'Kranz aus zwölf Blütenblättern');
  for (const v of ['--fc', '--fm', '--fst', '--flf']) assert.ok(g[0].el.html.includes(`var(${v},`), v);
  assert.ok(g[0].el.classList.contains('flower') && g[0].el.classList.contains('grow') && g[0].el.classList.contains('gbloom'));
  assert.notEqual(g[0].el.style['--fc'], g[0].color, 'bei 80 % Licht gedimmt');
  assert.equal(c._goldIsBloom(g[0]), true);
  assert.equal(GOLD_FLOWER('#f6c945', '#c47f1a').includes('filter'), false);
  // Größer nur am Bild (.gsun), nicht an der Klasse: Nach einem Wechsel der Jahreszeit ist sie eine gewöhnliche
  assert.match(quell('stil/paeckchen.js'), /\.flower svg\.gsun \{ scale: 1\.22; transform-origin: 50% 100%; \}/);
  assert.doesNotMatch(quell('stil/paeckchen.js'), /\.gbloom/);
  // gegossen wird nur unter acht Blumen (wie bisher), und nie wächst eine zweite goldene dazu: dann regnet es Funken
  const ab2 = gebaut.length;
  await lauf(c, '_giftWater');
  assert.equal(c._flowers.length, 6);
  assert.equal(c._flowers.filter((f) => f.gold).length, 1);
  assert.deepEqual(arten(ab2), Array(5).fill('trail'), 'Funkenregen über den frisch Gegossenen');
  await lauf(c, '_giftWater');
  assert.equal(c._flowers.length, 8);
  await lauf(c, '_giftWater');
  assert.equal(c._flowers.length, 8, 'nie mehr als acht');
  assert.equal(c._flowers.filter((f) => f.gold).length, 1);
  // die Auswahl der Beschäftigungen zählt sie wie jede andere (_giftActs: gießen nur unter sieben)
  assert.equal(c._giftActs({ wx: {} }).find((a) => a[1] === 'giftWater')[0], 0);
  // knabbern: Er findet sie als nächste, pflückt sie, frisst ihre Farbe; danach ist sie aus dem Modell
  c._x = g[0].xf * c._W;
  assert.equal(c._nearestFlower(), g[0]);
  await lauf(c, '_nibble');
  assert.equal(c._flowers.includes(g[0]), false);
  assert.equal(c._flowers.length, 7);
  assert.deepEqual(c.z.eat, [g[0].color]);
  assert.equal(g[0].el.classList.contains('picked'), true);
  vor(500);
  assert.equal(g[0].el.isConnected, false);
  assert.equal(c._flowers.filter((f) => f.gold).length, 0);
  // nachwachsen: bis sechs, lauter gewöhnliche
  while (c._flowers.length > 3) c._pickFlower(c._flowers[0]);
  for (let i = 0; i < 5; i++) c._regrow();
  assert.equal(c._flowers.length, 6);
  assert.equal(c._flowers.filter((f) => f.gold).length, 0);
  // … und beim nächsten Gießen wächst wieder eine goldene
  await lauf(c, '_giftWater');
  assert.deepEqual([c._flowers.length, c._flowers.filter((f) => f.gold).length], [8, 1]);
  // sammeln (_gather sucht nach der Farbe des Fensters): Die goldene zählt als gelbe Blume
  const gelb = c._flowers.find((f) => f.gold);
  assert.ok(c._flowers.filter((o) => o.color === gelb.color).includes(gelb));
  // Blumengeschenk (src/karte/momente.js): Er pflückt die nächste Blume und legt ihre Farbe als Nummer der Palette in
  // den Plan (fdrop). Mit der goldenen ist das die Nummer des Gelbs; ihr Bild wandert nirgends mit.
  {
    const k = karte();
    k._giftScene();
    zufall.wert = 0.5;
    await lauf(k, '_giftWater');
    const sonne = k._flowers.find((f) => f.gold);
    k._x = sonne.xf * k._W;
    k.z.ops.length = 0;
    await lauf(k, '_gift');
    assert.equal(k._flowers.includes(sonne), false);
    assert.deepEqual(k.z.ops.map((o) => [o.t, o.f.c]), [['fdrop', plain(k._flowerPal()).indexOf(sonne.color)]]);
    assert.doesNotMatch(quell('karte/momente.js'), /f\.el\.innerHTML|cloneNode|gsun/);
  }
  // Wechsel der Jahreszeit (_light malt jede Blume mit FLOWER_SVG neu): Die Farbe steht in der alten Palette, sie
  // bekommt also die der neuen; danach ist sie eine gewöhnliche Blume, und die nächste goldene darf wachsen
  assert.ok(pal.indexOf(gelb.color) >= 0);
  assert.match(quell('karte/himmel.js'), /f\.color = to\[Math\.max\(0, from\.indexOf\(f\.color\)\)\];\s*f\.el\.innerHTML = FLOWER_SVG\(f\.color\);/);
  gelb.el.innerHTML = '<svg viewBox="0 0 20 30"></svg>';
  assert.equal(c._goldIsBloom(gelb), false);
  // Herbst: das Gelb des Herbstes. Winter (verblasste Samenstände, kein Gelb): keine goldene, Funken über den Neuen
  const { c: h } = await giess(3, (k) => { k._seasonK = 'autumn'; });
  assert.equal(h._flowers.find((f) => f.gold).color, '#e3b23c');
  const { c: wi, ab: abW } = await giess(3, (k) => { k._seasonK = 'winter'; });
  assert.deepEqual([wi._flowers.length, wi._flowers.filter((f) => f.gold).length], [3, 0]);
  assert.deepEqual(arten(abW), Array(5).fill('trail'));
  assert.ok(wi._flowers.every((f) => plain(wi._flowerPal()).includes(f.color)));
  // Areal alpin (Enzian und Edelweiß): Auch dort gibt es im Sommer und Herbst ein Gelb
  for (const [k, farbe] of [['summer', '#f6c945'], ['autumn', '#e3b23c']]) {
    const a = karte({ areal: 'alpin' });
    a._seasonK = k;
    a._giftScene();
    await lauf(a, '_giftWater');
    assert.equal(a._flowers.find((f) => f.gold)?.color, farbe, `alpin, ${k}`);
  }
  // Das Funkeln goldener Schätze nimmt die Sonnenblume mit (und nur sie, keine gewöhnliche Blume)
  assert.match(quell('karte/schaetze.js'), /for \(const f of this\._flowers \|\| \[\]\) if \(this\._goldIsBloom\(f\) && f\.el\.isConnected\) gl\.push\(f\.el\);/);
  assert.ok(ab >= 0);
});

// ---------- Album ----------

test('Gold im Album: Bei jedem goldenen Schatz steht, was er zusätzlich kann', () => {
  assert.equal(DIARY_TXT.gold.length, 8);
  assert.equal(new Set(DIARY_TXT.gold).size, 8);
  for (const s of DIARY_TXT.gold) assert.ok(s.length >= 10 && s.length <= 32 && !/[.!]$/.test(s), s);
  // die echte Seite: Stufe 1 der Satz zum Schatz, Stufe 2 der Trick, Stufe 3 „golden: …“ und der Trick
  const seite = (lv) => {
    const c = Object.create(P);
    Object.assign(c, {
      _cfg: { gifts: true, friend_name: 'Pino' }, _plan: { gift: { ...stand(lv), n: 1 } }, _blooms: [],
      _careEval: () => null, _care: {}, _giftLow: () => [], _urlaubOn: () => false, _careToday: () => ({ fed: true, pet: true, ok: true, good: false }),
    });
    return c._diaryTreasures();
  };
  const zeile = (h, name) => h.match(new RegExp(`<b>${name}</b><span>([^<]*)</span>`))?.[1];
  const h1 = seite(ALLE(1));
  const h2 = seite(ALLE(2));
  const h3 = seite(ALLE(3));
  GIFT_ITEMS.slice(0, 8).forEach((it, t) => {
    const name = it.key === 'plush' ? 'Plüsch-Pino' : it.name;
    assert.equal(zeile(h1, name), DIARY_TXT.treasure[t]);
    assert.equal(zeile(h2, name), `Trick: ${GIFT_TRICK[t]}`);
    assert.equal(zeile(h3, name), `golden: ${DIARY_TXT.gold[t]} · Trick: ${GIFT_TRICK[t]}`);
  });
  assert.equal((h3.match(/class="t lv2 gilt"/g) || []).length, 8);
  assert.doesNotMatch(h2, /golden:/);
});

// ---------- Tiefe ----------

test('Tiefe ist Standard: DEFAULTS.depth, Schalter im Editor mit Beschriftung, getStubConfig ohne Angabe', () => {
  assert.equal(DEFAULTS.depth, true);
  assert.deepEqual(plain(T.PikaPetCard.getStubConfig()), { name: 'Pika' }, 'die Startkonfiguration nennt depth nicht: Es gilt der Standard');
  const form = T.PikaPetCard.getConfigForm();
  // bei den anderen Schaltern (Balken, Päckchen, Besuch …), nicht in einer aufklappbaren Gruppe und nicht als YAML
  const schalter = form.schema.find((s) => s.type === 'grid' && s.schema.some((x) => x.name === 'gifts'));
  const feld = schalter.schema.find((s) => s.name === 'depth');
  assert.deepEqual(plain(feld), { name: 'depth', selector: { boolean: {} }, default: true });
  assert.deepEqual(plain(schalter.schema.map((s) => [s.name, s.default])),
    [['show_stats', true], ['gifts', true], ['friend', true], ['festive', true], ['diary', true], ['diary_house', true], ['vacation', true], ['depth', true]]);
  assert.equal(form.computeLabel(feld), 'Tiefe (Pika und Besuch laufen auch auf einer hinteren Spur)');
  assert.equal(EDITOR_LABEL.depth, form.computeLabel(feld));
  assert.ok(form.computeHelper(feld).length > 20 && form.computeHelper(feld) === EDITOR_HELP.depth);
  // genau ein Feld depth im ganzen Formular
  const alle = (S) => S.flatMap((s) => [s.name, ...(s.schema ? alle(s.schema) : [])]);
  assert.equal(alle(form.schema).filter((n) => n === 'depth').length, 1);
  // „Prototyp“ steht bei dieser Option nicht mehr (in den Dateien dieser Etappe)
  for (const f of ['logik/einstellungen.js', 'karte/editor.js', 'logik/buehne.js']) assert.doesNotMatch(quell(f), /Prototyp/, f);
});

// Eine Karte, soweit setConfig sie braucht, mit einer Szene, die Klassen und Stil mitschreibt
const cfgKarte = () => {
  const c = Object.create(P);
  const scene = new Att();
  const leer = () => {};
  Object.assign(c, {
    _el: { name: {}, stats: {}, scene, pika: new Att() },
    _applyAreal: leer, _diarySync: leer, _planReset: leer, _renderStats: leer, _loadLocal: leer, _lsRename: leer, _chronikReset: leer,
    setzt: [],
    _setX(x, sofort) { this.setzt.push([x, sofort]); },
  });
  return { c, scene };
};

test('Tiefe ist Standard: ohne Angabe läuft die Karte mit hinterer Spur, depth: false verhält sich genau wie bis 0.43', async () => {
  // ohne Angabe: Klasse tiefe an der Szene, die Kulisse folgt dem Pika
  let { c, scene } = cfgKarte();
  c.setConfig({ name: 'Pika' });
  assert.equal(c._cfg.depth, true);
  assert.equal(scene.classList.contains('tiefe'), true);
  // ausdrücklich an: dasselbe
  ({ c, scene } = cfgKarte());
  c.setConfig({ name: 'Pika', depth: true });
  assert.deepEqual([c._cfg.depth, scene.classList.contains('tiefe')], [true, true]);
  // depth: false: keine Klasse, --plx weg, und wer hinten stand, steht wieder vorn
  ({ c, scene } = cfgKarte());
  Object.assign(c, { _lane: 1, _x: 300, _g: {}, _W: 600 });
  scene.style['--plx'] = '0.250';
  c.setConfig({ name: 'Pika', depth: false });
  assert.equal(c._cfg.depth, false);
  assert.equal(scene.classList.contains('tiefe'), false);
  assert.equal(scene.classList.je.has('tiefe'), false, 'die Klasse war nie gesetzt');
  assert.equal('--plx' in scene.style, false);
  assert.equal(c._lane, 0);
  assert.deepEqual(c.setzt, [[300, true]]);
  // im Editor umgeschaltet (setConfig bei jeder Änderung): an → aus → an
  ({ c, scene } = cfgKarte());
  Object.assign(c, { _x: 450, _W: 600 });
  c.setConfig({ name: 'Pika' });
  assert.equal(scene.style['--plx'], '0.500');
  c.setConfig({ name: 'Pika', depth: false });
  assert.deepEqual([scene.classList.contains('tiefe'), '--plx' in scene.style], [false, false]);
  c.setConfig({ name: 'Pika', depth: true });
  assert.deepEqual([scene.classList.contains('tiefe'), scene.style['--plx']], [true, '0.500']);

  // Herumhoppeln: mit depth: false immer Spur 0, gleich was der Zufall sagt und was die Vorschau verlangt; mit dem
  // Standard geht er bei passendem Zufall nach hinten
  const hoppel = async (cfg, mehr = {}) => {
    const k = karte({ cfg: { depth: undefined, ...cfg } });
    if (!('depth' in cfg)) k._cfg = { ...DEFAULTS, ...k._cfg, depth: DEFAULTS.depth };
    const wege = [];
    Object.assign(k, { _walkTo: async (x, tempo, ruhig, spur) => { wege.push(spur); }, ...mehr });
    zufall.wert = 0.35; // unter 0,4: er möchte nach hinten
    await k._wander();
    return { k, spur: wege[0] };
  };
  assert.equal((await hoppel({ depth: false })).spur, 0);
  assert.equal((await hoppel({ depth: false }, { _laneNext: 1, _laneX: 400 })).spur, 0, 'auch der Vorschau-Haken holt ihn nicht nach hinten');
  assert.equal((await hoppel({ depth: true })).spur, 1);
  assert.equal((await hoppel({})).spur, 1, 'Standard');
  // Höhe, Ebene und Größe der hinteren Spur gibt es mit depth: false nicht, auch wenn _lane einmal 1 wäre
  const { k: aus } = await hoppel({ depth: false });
  aus._lane = 1;
  assert.equal(aus._laneDy(), 0);
  aus._pikaZ(1);
  assert.equal(aus._el.pika.style.zIndex, String(T.buehneZ(0, 'pika')));
  assert.equal(aus._critLane({ back: true }, 200, 400, 26), 0);
  const { k: an } = await hoppel({});
  an._lane = 1;
  assert.equal(an._laneDy(), an._H * LANE_DY);
  an._pikaZ(1);
  assert.equal(an._el.pika.style.zIndex, String(T.buehneZ(-LANE_DY, 'pika')));
  assert.ok(T.buehneZ(-LANE_DY, 'pika') < T.buehneZ(0, 'pika'), 'hinten liegt hinter vorn');
  // und setConfig liest depth erst nach dem Zusammenführen mit DEFAULTS (keine eigene Vorgabe in der Karte)
  const kern = quell('karte.js');
  assert.match(kern, /\.\.\.DEFAULTS, \.\.\.\(config \|\| \{\}\)/);
  assert.match(kern, /toggle\('tiefe', !!this\._cfg\.depth\)/);
});
