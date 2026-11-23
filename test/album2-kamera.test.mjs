// Album 2: die Kamera (Schatz t2 = 3) – Daten, Wahl der Aktionen (bei Tag, kein Starkregen), Motive (Vogel, Blume, Himmel),
// Foto, Selfie allein und mit dem Freund, Gold, Blitz (höchstens alle 1,2 s, ruhig ohne Lichtpuls), Tipp, Auspacken,
// Abbruch an jeder Stelle, reduzierte Bewegung, schmale Karte. Ohne echte Szene: Elemente sind Attrappen, Laufen
// stellt nur die Stelle. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const plain = (v) => JSON.parse(JSON.stringify(v));

// Ein Element, soweit Kamera, Sofortbild und Blitz es anfassen
class El {
  constructor(tag = 'div') {
    this.tag = tag;
    this.cls = new Set();
    this.classList = {
      add: (...k) => k.forEach((x) => this.cls.add(x)), remove: (...k) => k.forEach((x) => this.cls.delete(x)),
      contains: (k) => this.cls.has(k), toggle: (k, on) => ((on ?? !this.cls.has(k)) ? this.cls.add(k) : this.cls.delete(k)),
    };
    const props = (this.props = {});
    this.style = { setProperty: (k, v) => (props[k] = v), removeProperty: (k) => delete props[k] };
    this.kinder = [];
    this.weg = false;
    this.isConnected = true;
    this.innerHTML = '';
    this.attrs = {};
    this.offsetWidth = 10;
    this.unter = null;
    this.anim = [];
  }

  set className(v) {
    this.cls = new Set(String(v).split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this.cls].join(' ');
  }

  querySelector() {
    this.unter ??= new El();
    return this.unter;
  }

  getAttribute(k) {
    return this.attrs[k] ?? null;
  }

  appendChild(k) {
    this.kinder.push(k);
    return k;
  }

  remove() {
    this.weg = true;
    this.isConnected = false;
  }

  animate(kf) {
    this.anim.push(kf);
    return { cancel() {}, finish() {} };
  }

  getBoundingClientRect() {
    return { left: 300, top: 150, right: 360, bottom: 220, width: 60, height: 70 };
  }
}

// Das gebaute Bündel in einer eigenen Welt: „Bewegung reduzieren“ schaltet ruhe.matches, Zeitgeber laufen nie von
// selbst (lauf() lässt die gestellten laufen)
const ruhe = { matches: false };
let wecker = [];
let T = null;
vm.runInNewContext(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'), {
  window: { matchMedia: () => ruhe, customCards: [] },
  document: { addEventListener() {}, removeEventListener() {}, createElement: (t) => new El(t) },
  HTMLElement: class {}, customElements: { get: () => null, define() {} }, console: { info() {}, log() {}, warn() {}, debug() {} },
  setTimeout: (fn) => {
    const w = { fn, aus: false };
    wecker.push(w);
    return w;
  },
  clearTimeout: (w) => {
    if (w && typeof w === 'object') w.aus = true;
  },
  setInterval: () => 0, clearInterval() {}, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController, performance,
  __pikaTest: (x) => (T = x),
}, { filename: 'pika-pet-card.js' });
const lauf = () => {
  const w = wecker;
  wecker = [];
  for (const x of w) if (!x.aus) x.fn();
};

// Geometrie wie _layout in der Vorschau (600 × 248 bzw. schmal 380 × 184)
const GEO = {
  breit: { W: 600, H: 248, gy: 223.2, pW: 119.04, pH: 99.2, hayR: 222.68, hay: 202.34, home: 95.58, xR: 546.43, hole: { l: 70.16, r: 121, cx: 95.58 } },
  schmal: { W: 380, H: 184, gy: 165.6, pW: 88.32, pH: 73.6, hayR: 165.21, hay: 150.13, home: 70.91, xR: 340.26, hole: { l: 52.05, r: 89.77, cx: 70.91 } },
};
// Karte mit Album 2, die Kamera auf Stufe lv. ruf: was sie tut
const karte = (lv = 1, { geo = 'breit', wx = {}, cls = [], ...extra } = {}) => {
  const G = GEO[geo];
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const w = (lv >= 1 ? 8 : 0) | (lv >= 2 ? 0x800 : 0) | (lv >= 3 ? 0x80000 : 0);
  const leer = () => {};
  const scene = new El();
  for (const k of cls) scene.cls.add(k);
  Object.assign(c, {
    _cfg: { gifts: true, depth: true, friend: true }, _W: G.W, _H: G.H, _Hs: G.H, _x: 300, _dir: 1, _lift: 0, _lane: 0, _wx: wx, _wind: 0,
    _g: { gy: G.gy, pW: G.pW, pH: G.pH, hayR: G.hayR, hay: G.hay, home: G.home, stash: true, hole: G.hole, xR: G.xR, fMin: 0.43, fMax: 0.72 },
    _el: { pika: new El(), psay: new El(), fx: new El(), gifts: new El(), acts: new El(), birds: new El(), scene, mfood: new El() },
    _plan: { gift: { u: 255, v: 255, w, z: 4, o: 4, i: 35 } }, _flowers: [],
    _say: (t) => ruf.push(['sagt', t]), _wait: async () => {}, _face: (d) => (c._dir = d),
    _walkTo: async (x, speed) => {
      x = Math.min(Math.max(x, G.pW * 0.45), G.xR);
      if (Math.abs(x - c._x) >= 4) c._face(x >= c._x ? 1 : -1);
      c._x = x;
      ruf.push(['geht', Math.round(x), speed]);
    },
    _mouth: (col) => ruf.push(['maul', !!col]), _cls: (k) => ruf.push(['cls', k]), _interrupt: () => ruf.push(['abbruch']),
    _sparkle: leer, _mimik: leer, _emote: (k) => ruf.push(['emote', k]), _happy: () => ruf.push(['freut']), _hearts: () => ruf.push(['herzen']),
    _peep: (x, y, t) => ruf.push(['piep', t, Math.round(x), Math.round(y)]),
    _found: (k) => ruf.push(['entdeckt', k]), _away: () => false, _urlaubFern: () => false, _err: (wo, e) => ruf.push(['fehler', wo, String(e)]), _poops: () => ({ piles: [] }),
    ...extra,
  });
  c._giftScene = () => c._a2Scene();
  wecker = [];
  return { c, ruf, G };
};
// Der Freund, der gerade da ist (Attrappe, mit den Bausteinen, die das Selfie braucht)
const freund = (c, ruf, kind = 'katzumi', x = 480, extra = {}) => {
  c._fr = { kind, x, arrived: true, greeted: true, leaving: false, busy: false, until: Date.now() + 9e5, el: new El(), ...extra };
  Object.assign(c, {
    _withFriend: async (fn) => {
      ruf.push(['zusammen']);
      await fn(c._fr, (ms) => c._wait(ms));
    },
    _friendWalkTo: async (fr, x) => {
      fr.x = x;
      ruf.push(['freund geht', Math.round(x)]);
    },
    _frFace: (fr, d) => (fr.dir = d), _frCall: () => {}, _frHappy: () => ruf.push(['freund freut']), _frLook: () => {},
    _frSay: (fr, t) => ruf.push(['freund sagt', t]), _frHearts: () => ruf.push(['freund herzen']),
  });
  return c._fr;
};
// Der Vogel vom Besuch, sitzend (name: wie aria-label)
const vogel = (x, y, name = 'Blaumeise') => {
  const el = new El();
  el.querySelector().attrs['aria-label'] = name;
  return { el, x, y, sitting: true, scared: false };
};
const fotos = (c) => c._el.gifts.kinder.filter((e) => e.cls.has('a2cmph'));
const blitze = (c) => c._el.fx.kinder.filter((e) => e.cls.has('a2cmbu') || e.cls.has('a2cmov'));
const gesagt = (ruf, re) => ruf.some((r) => r[0] === 'sagt' && re.test(r[1]));
// Aufgeräumt? Kein Zustand, keine eigenen Klassen am Pika, kein Riemen im Maul, Kamera und Bild blenden aus (oder sind
// weg), kein Lichtpuls bleibt
const sauber = (c, msg = '') => {
  assert.ok(!c._a2CameraS, `kein Kamera-Zustand ${msg}`);
  assert.ok(!c._a2CameraCarrying, `kein Riemen im Maul ${msg}`);
  for (const k of ['a2cm-hold', 'a2cm-carry', 'carry']) assert.ok(!c._el.pika.cls.has(k), `${k} ${msg}`);
  const el = c._a2Els?.get('camera');
  assert.ok(!el || el.cls.has('a2out'), `Kamera weg ${msg}`);
  if (el) assert.ok(!el.cls.has('timer'), `Lämpchen aus ${msg}`);
  assert.ok(fotos(c).every((e) => e.weg || e.cls.has('away')), `Bild weg ${msg}`);
  assert.ok(blitze(c).every((e) => e.weg), `kein Blitz ${msg}`);
};
// Liegt alles auf der Wiese? Kamera rechts vom Heu und im Bild, er bis xR
const aufDerWiese = (c, G, msg = '') => {
  const S = c._a2CameraS;
  const { w } = c._a2CameraDim();
  assert.ok(S.x - w / 2 >= G.hayR - 0.01 && S.x + w / 2 <= G.W + 0.01, `Kamera bei ${S.x} ${msg}`);
  assert.ok(c._x >= G.pW * 0.45 - 0.01 && c._x <= G.xR + 0.01, `Pika bei ${c._x} ${msg}`);
};

test('Kamera: Daten wie die Schätze aus Album 1 (24 × 24, ohne id und class), gebaut, ganzjährig, Aktionen gibt es', () => {
  const { c } = karte();
  const it = c._a2Item(3);
  assert.equal(it.key, 'camera');
  assert.equal(it.built, true);
  assert.equal(it.mo, null);
  assert.match(it.icon, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(it.icon, /\sid=|\sclass=|NaN|undefined/);
  for (const k of ['name', 'say', 'trick', 'gilt', 'use', 'gold']) assert.ok(it[k] && typeof it[k] === 'string', k);
  assert.equal(it.trick, 'Selfie');
  assert.ok(it.find?.t && it.find?.h);
  assert.ok(it.dbg.length >= 3);
  for (const [label, act, lv] of it.dbg) {
    assert.equal(typeof c[`_${act}`], 'function', label);
    assert.ok(lv >= 1 && lv <= 3);
  }
  // die Entdeckung kennt das Tagebuch
  assert.deepEqual([...T.findsParse('camera,feeder,unbekannt')].sort(), ['camera', 'feeder']);
  // jedes Sofortbild ohne id, NaN, undefined (golden auch)
  const S = { cover: 40, bow: true, rain: true, snow: true, fog: true, snowcover: true };
  for (const M of [{ k: 'flower', S, color: '#f28fb1' }, { k: 'bird', S, bird: null }, { k: 'sky', S: { night: true } },
    ...['pino', 'kirby', 'rufus', 'katzumi'].map((k) => ({ k: 'self', S, who: [{ k, s: 0.7 }] }))]) {
    for (const gold of [false, true]) {
      const ph = c._a2CameraPhoto(M, gold);
      assert.doesNotMatch(ph.innerHTML, /\sid=|NaN|undefined|<svg[^>]*<svg/, `${M.k} ${gold}`);
      assert.equal(ph.innerHTML.match(/<svg/g).length, 1, 'kein inneres <svg> (der Stil gäbe ihm die volle Breite)');
    }
  }
});

test('Kamera: bei Tag, ohne Starkregen und Gewitter, wenig Wind; in der Dämmerung seltener; das Selfie oft, wenn der Freund da ist', () => {
  const { c, ruf } = karte(1);
  const acts = (wx = {}, cls = [], lv = 1) => {
    c._el.scene.cls = new Set(cls);
    return plain(c._a2CameraActs({ wx }, lv));
  };
  assert.deepEqual(acts(), [[0.3, 'a2CameraPlay'], [0, 'a2CameraSelfie']]);
  // normaler Regen (rainy) und Schneeregen gehen (das Blatt als Schirm), Starkregen, Hagel, Gewitter nicht
  assert.equal(acts({ wet: true, rain: 40, cover: 85 })[0][0], 0.3);
  assert.equal(acts({ wet: true, rain: 25, snow: 25 })[0][0], 0.3);
  assert.deepEqual(acts({ wet: true, rain: 95, storm: true, shelter: true }), []);
  assert.deepEqual(acts({ wet: true, rain: 60 }), []);
  assert.deepEqual(acts({ wet: true, rain: 60, hail: true }), []);
  assert.deepEqual(acts({ wet: true, flash: true }), []);
  assert.deepEqual(acts({ storm: true }), []);
  assert.deepEqual(acts({}, ['night']), []);
  assert.ok(acts({}, ['dusk'])[0][0] < 0.3);
  // Schneefall und Nebel: ja (die Flocken kommen mit aufs Bild)
  assert.equal(acts({ snow: 55, snowcover: true })[0][0], 0.3);
  c._wind = 45;
  assert.deepEqual(acts(), []);
  c._wind = 0;
  // Stufe 2: allein selten, mit dem Freund oft; der Freund nur, wenn er begrüßt ist und nicht gleich geht
  assert.equal(acts({}, [], 2)[1][0], 0.15);
  const fr = freund(c, ruf);
  assert.equal(acts({}, [], 2)[1][0], 1.5);
  fr.greeted = false;
  assert.equal(acts({}, [], 2)[1][0], 0.15);
  fr.greeted = true;
  fr.until = Date.now() + 10000;
  assert.equal(c._a2CameraFriend(), null);
  // über die Schnittstelle
  c._fr = null;
  c._el.scene.cls = new Set();
  assert.deepEqual(plain(c._a2Acts({ wx: {} })).map((a) => a[1]), ['a2CameraPlay']);
  assert.deepEqual(plain(c._a2Acts({ wx: { wet: true, rain: 95, storm: true } })), []);
});

test('Kamera, Stufe 1: holen am Bau, am Riemen tragen, aufstellen, zielen, klick, Bild aus dem Schlitz in die Pfoten', async () => {
  const { c, ruf, G } = karte(1);
  let steht = null;
  let gehalten = null;
  c._wait = async () => {
    const S = c._a2CameraS;
    if (S && !steht) {
      steht = { x: S.x, d: S.d, pika: c._x, tragen: c._a2CameraCarrying };
      aufDerWiese(c, G);
    }
    if (S?.ph?.cls.has('a2cmheld') && !gehalten) gehalten = { hold: c._el.pika.cls.has('a2cm-hold'), dir: c._dir, d: S.d, tilt: S.tilt, z: Number(S.ph.style.zIndex) };
  };
  await c._a2CameraPlay({ motif: 'sky' });
  // zuerst zum Bau, dort ins Maul
  const geht = ruf.filter((r) => r[0] === 'geht');
  assert.equal(geht[0][1], Math.round(G.hole.cx + G.pW * 0.75));
  const iMaul = ruf.findIndex((r) => r[0] === 'maul' && r[1]);
  assert.ok(iMaul > ruf.indexOf(geht[0]), 'Riemen ins Maul am Bau');
  // aufgestellt: er hinter der Kamera, die Linse von ihm weg; der Riemen ist dann aus dem Maul
  assert.ok(steht, 'Kamera steht');
  assert.equal(steht.tragen, false);
  assert.equal(Math.sign(steht.x - steht.pika), steht.d);
  // Himmel: Linse schräg nach oben, klick, surr, Bild in den Pfoten (vor ihm), er hat sich umgedreht
  assert.ok(ruf.some((r) => r[0] === 'piep' && r[1] === 'klick!'));
  assert.ok(ruf.some((r) => r[0] === 'piep' && /surr/.test(r[1])));
  assert.ok(ruf.some((r) => r[0] === 'cls' && r[1] === 'blink'), 'er blinzelt beim Blitz');
  assert.ok(gehalten?.hold, 'hält das Bild');
  assert.equal(gehalten.dir, -gehalten.d, 'umgedreht, weg von der Kamera');
  assert.equal(gehalten.tilt, -30);
  assert.ok(gehalten.z > Number(c._a2Els.get('camera').style.zIndex), 'Bild vor ihm, vor der Kamera');
  const ph = fotos(c)[0];
  assert.ok(ph.cls.has('dev'), 'entwickelt');
  assert.match(ph.innerHTML, /#a8daf5/, 'blauer Himmel');
  assert.equal(blitze(c).length, 2, 'ein Lichtpuls und ein schwacher über der Szene');
  assert.equal(c._a2CameraBusy, false);
  sauber(c);
  // nach dem Ausblenden ist alles weg
  lauf();
  assert.equal(c._a2Els.has('camera'), false);
  assert.ok(ph.weg);
  assert.ok(blitze(c).every((e) => e.weg));
  assert.deepEqual(ruf.filter((r) => r[0] === 'fehler'), []);
});

test('Kamera: Motive – der Vogel vom Besuch (fliegt er vorher weg, ist er nicht drauf), eine Blume, der Himmel', async () => {
  // Vogel (Blaumeise auf dem Bau), Linse hinauf
  const { c, ruf, G } = karte(1);
  c._bird = vogel(160, 150);
  const L = c._a2CameraPick('bird');
  assert.equal(L.M.k, 'bird');
  assert.equal(L.d, -1, 'Kamera rechts vom Vogel, Linse nach links');
  assert.ok(L.tilt < 0, 'Linse hinauf');
  await c._a2CameraPlay({ motif: 'bird' });
  assert.match(fotos(c)[0].innerHTML, /#5b97d8/, 'Blaumeise auf dem Bild');
  assert.ok(gesagt(ruf, /^eine Blaumeise!$/));
  sauber(c);
  // er fliegt weg, bevor es klickt: nur der Ast
  const { c: c2, ruf: r2 } = karte(1);
  c2._bird = vogel(160, 150, 'Spatz');
  let n = 0;
  c2._wait = async () => {
    if (++n === 6) c2._bird.sitting = false;
  };
  await c2._a2CameraPlay({ motif: 'bird' });
  assert.doesNotMatch(fotos(c2)[0].innerHTML, /#b38d66/);
  assert.ok(gesagt(r2, /weggeflogen|zu spät/));
  // Blume: Linse kurz vor der Blüte, ein wenig hinab; ihre Farbe auf dem Bild
  const { c: c3, ruf: r3 } = karte(1);
  c3._flowers = [{ xf: 0.62, color: '#9b7fe0', el: new El() }];
  const F = c3._a2CameraPick('flower');
  assert.equal(F.M.k, 'flower');
  const tip = F.cx + F.d * c3._a2CameraOff().tip;
  assert.ok(F.d * (0.62 * G.W - tip) > 0 && Math.abs(0.62 * G.W - tip) < G.pW * 0.6, 'Blume vor der Linse');
  assert.ok(F.tilt > 0);
  await c3._a2CameraPlay({ motif: 'flower' });
  assert.match(fotos(c3)[0].innerHTML, /#9b7fe0/);
  assert.ok(gesagt(r3, /Blume|hübsch/));
  // gepflückte Blumen und Schnee: keine Blume; der Himmel geht immer
  c3._flowers[0].el.cls.add('picked');
  assert.equal(c3._a2CameraAimFlower(), null);
  assert.equal(c3._a2CameraPick('flower').M.k, 'sky');
  // Würfel: mit Vogel und Blume wählt er nach Gewicht (Vogel 3, Blume 2, Himmel 1)
  const { c: c4 } = karte(1);
  c4._bird = vogel(160, 150);
  c4._flowers = [{ xf: 0.62, color: '#9b7fe0', el: new El() }];
  const zufall = Math.random;
  try {
    Math.random = () => 0.1;
    assert.equal(c4._a2CameraPick().M.k, 'bird');
    Math.random = () => 0.6;
    assert.equal(c4._a2CameraPick().M.k, 'flower');
    Math.random = () => 0.95;
    assert.equal(c4._a2CameraPick().M.k, 'sky');
  } finally {
    Math.random = zufall;
  }
  // Himmel mit Regenbogen, nachts der Mond, Schneefall
  const { c: c5, ruf: r5 } = karte(1, { cls: ['night'], wx: { cover: 10 } });
  await c5._a2CameraPlay({ motif: 'sky', short: true });
  assert.match(fotos(c5)[0].innerHTML, /#2d3866/, 'Nachthimmel');
  assert.ok(gesagt(r5, /Mond/));
  const { c: c6, ruf: r6 } = karte(1, { wx: { cover: 40 } });
  c6._bowKey = '0.5|20|true|600x248';
  await c6._a2CameraPlay({ motif: 'sky' });
  assert.match(fotos(c6)[0].innerHTML, /#ef6b5b/, 'Regenbogen');
  assert.ok(gesagt(r6, /Regenbogen/));
});

test('Kamera, Stufe 2: Selfie allein – Selbstauslöser, vor die Linse, Blitz, Bild holen; nur er auf dem Bild', async () => {
  for (const geo of ['breit', 'schmal']) {
    const { c, ruf, G } = karte(2, { geo });
    let timer = false;
    let pose = null;
    c._wait = async () => {
      const S = c._a2CameraS;
      if (S?.el.cls.has('timer')) {
        timer = true;
        if (c._el.pika.cls.has('happy') && !pose) {
          pose = { x: c._x, dir: c._dir, d: S.d, cx: S.x };
          aufDerWiese(c, G, geo);
        }
      }
    };
    await c._a2CameraSelfie();
    assert.ok(timer, `Lämpchen blinkt (${geo})`);
    assert.ok(pose, 'posiert');
    assert.equal(Math.sign(pose.x - pose.cx), pose.d, 'vor der Linse');
    assert.equal(pose.dir, -pose.d, 'schaut in die Kamera');
    assert.ok(ruf.filter((r) => r[0] === 'piep' && r[1] === 'piep').length === 0, 'piep … piep kommt aus Zeitgebern');
    lauf();
    const html = fotos(c)[0].innerHTML;
    assert.match(html, /#c09a76/, 'er auf dem Bild');
    assert.doesNotMatch(html, /#f6c08a|#e2b673|#fffaf0|#e09a5a/, 'kein Freund');
    assert.ok(gesagt(ruf, /das bin ich|hübsch|ich!/));
    assert.ok(!ruf.some((r) => r[0] === 'zusammen'));
    sauber(c, geo);
  }
  // auf Stufe 1 gibt es den Trick nicht
  const { c: c1, ruf: r1 } = karte(1);
  await c1._a2CameraSelfie();
  assert.deepEqual(r1, []);
});

test('Kamera, Selfie mit dem Freund: er kommt mit vor die Linse, ist mit auf dem Bild, danach schauen beide es an', async () => {
  for (const [geo, kind] of [['breit', 'katzumi'], ['schmal', 'kirby'], ['schmal', 'rufus'], ['breit', 'pino']]) {
    const { c, ruf, G } = karte(2, { geo });
    const fr = freund(c, ruf, kind, geo === 'breit' ? 470 : 300);
    let pose = null;
    c._wait = async () => {
      if (c._a2CameraS?.el.cls.has('timer') && c._el.pika.cls.has('happy') && !pose) {
        const [fl, fh] = c._frRange();
        pose = { x: c._x, fr: fr.x, frDir: fr.dir, d: c._a2CameraS.d, cx: c._a2CameraS.x, ok: fr.x >= fl - 0.01 && fr.x <= fh + 0.01 };
        aufDerWiese(c, G, `${geo} ${kind}`);
      }
    };
    await c._a2CameraSelfie();
    const msg = `(${geo}, ${kind})`;
    assert.ok(ruf.some((r) => r[0] === 'zusammen'), msg);
    assert.ok(pose, `posiert ${msg}`);
    assert.ok(pose.ok, `Freund in seinem Bereich ${msg}`);
    assert.equal(Math.sign(pose.fr - pose.x), pose.d, `Freund neben ihm, weiter weg von der Linse ${msg}`);
    assert.equal(pose.frDir, -pose.d, `Freund schaut in die Kamera ${msg}`);
    const html = fotos(c)[0].innerHTML;
    assert.match(html, /#c09a76/);
    assert.match(html, { katzumi: /#f6c08a/, kirby: /#e2b673/, rufus: /#fffaf0/, pino: /#e09a5a/ }[kind], msg);
    assert.ok(gesagt(ruf, /wir zwei|das sind wir/), msg);
    assert.ok(ruf.some((r) => r[0] === 'freund herzen'), msg);
    // Pino heißt wie in friend_name
    if (kind === 'pino') assert.ok(gesagt(ruf, /^Pino, ein Foto!$/));
    else assert.ok(gesagt(ruf, new RegExp(`^${kind[0].toUpperCase()}${kind.slice(1)}, ein Foto!$`)), msg);
    sauber(c, msg);
  }
  // o.solo: ohne ihn; geht er gleich, auch ohne ihn
  const { c, ruf } = karte(2);
  freund(c, ruf, 'kirby', 470, { leaving: true });
  await c._a2CameraSelfie();
  assert.ok(!ruf.some((r) => r[0] === 'zusammen'));
});

test('Kamera, Stufe 3: goldener Rahmen und Glitzer (mit Abstand und Würfel, sicher nach dem Auspacken); ohne Gold keiner', async () => {
  const { c, ruf } = karte(3);
  await c._a2CameraPlay({ motif: 'sky', gold: true });
  const ph = fotos(c)[0];
  assert.ok(ph.cls.has('gold'));
  assert.match(ph.innerHTML, /#f2c94c/);
  assert.match(ph.innerHTML, /a2cmgl/);
  assert.ok(gesagt(ruf, /glitzert|goldig|Goldrahmen/));
  // ohne o.gold: über _a2GoldOk (höchstens alle 2 Minuten)
  const { c: g } = karte(3);
  assert.equal(g._a2GoldOk('camera', { cd: 2 * 6e4, p: 1 }), true);
  assert.equal(g._a2GoldOk('camera', { cd: 2 * 6e4, p: 1 }), false);
  // Stufe 2: nie golden; verreist: auch golden keiner
  const { c: n } = karte(2);
  await n._a2CameraPlay({ motif: 'sky' });
  assert.ok(!fotos(n)[0].cls.has('gold'));
  assert.doesNotMatch(fotos(n)[0].innerHTML, /a2cmgl/);
  const { c: v } = karte(3, { _away: () => true });
  v._dbgGold = true;
  await v._a2CameraSelfie();
  assert.ok(!fotos(v)[0].cls.has('gold'));
  // Vorschau (_dbgGold): sofort
  const { c: d } = karte(3);
  d._dbgGold = true;
  await d._a2CameraSelfie();
  assert.ok(fotos(d)[0].cls.has('gold'));
});

test('Kamera: Blitz höchstens alle 1,2 s (auch beim schnellen Antippen kein Flackern), ruhig ohne Lichtpuls', async () => {
  const { c, ruf } = karte(1);
  let S = null;
  c._wait = async () => {
    if (!S && c._a2CameraS) {
      S = c._a2CameraS;
      // Tipp auf die Kamera: Zone, Blitz, Entdeckung zählt (true)
      const Z = [];
      c._a2Zones(Z, { left: 0, top: 0 });
      assert.deepEqual(Z.map((z) => [z.k, z.a2]), [['camera', true]]);
      ruf.push(['tipp', c._a2Tap(Z[0])]);
      ruf.push(['tipp', c._a2Tap(Z[0])]);
    }
  };
  await c._a2CameraPlay({ motif: 'sky' });
  assert.deepEqual(ruf.filter((r) => r[0] === 'tipp'), [['tipp', true], ['tipp', true]]);
  // erster Tipp blitzt, der zweite gleich danach klickt nur; der Klick der Aktion (im selben Augenblick) auch nur
  assert.deepEqual(ruf.filter((r) => r[0] === 'piep' && /blitz|klick/.test(r[1])).map((r) => r[1]), ['blitz!', 'klick!', 'klick!']);
  assert.equal(blitze(c).length, 2, 'ein einziger Lichtpuls');
  // nach der Aktion: keine Zone mehr, Tipp antwortet nicht
  lauf();
  const Z2 = [];
  c._a2Zones(Z2, { left: 0, top: 0 });
  assert.deepEqual(Z2, []);
  assert.equal(c._a2CameraTap(), false);
  // ruhig: kein Lichtpuls, das Blitzfenster leuchtet langsam (glow, länger)
  ruhe.matches = true;
  try {
    const { c: r } = karte(1);
    let glow = false;
    r._wait = async () => {
      if (r._a2CameraS?.el.cls.has('glow')) glow = true;
    };
    await r._a2CameraPlay({ motif: 'sky' });
    assert.ok(glow);
    assert.equal(blitze(r).length, 0);
  } finally {
    ruhe.matches = false;
  }
});

test('Kamera: Abbruch an jeder Stelle räumt auf (Foto, Selfie allein und mit Freund, breit und schmal)', async () => {
  for (const geo of ['breit', 'schmal']) {
    for (const [lv, was] of [[1, 'foto'], [3, 'foto'], [2, 'selfie'], [2, 'freund'], [3, 'freund']]) {
      for (let n = 1; n < 60; n++) {
        let k = 0;
        const { c, ruf } = karte(lv, { geo });
        if (was === 'freund') freund(c, ruf, 'kirby', geo === 'breit' ? 470 : 300);
        else c._bird = vogel(160, 150);
        c._wait = async () => {
          if (++k >= n) {
            c._ac = { signal: { aborted: true } };
            throw new Error('Cancel');
          }
        };
        const fertig = await (was === 'foto' ? c._a2CameraPlay() : c._a2CameraSelfie()).then(() => true, () => false);
        const msg = `(${geo}, Stufe ${lv}, ${was}, Abbruch beim ${n}. Warten${fertig ? ', schon fertig' : ''})`;
        // _cleanup ruft den Hook danach auf, auch zweimal
        c._a2Cleanup();
        c._a2Cleanup();
        sauber(c, msg);
        assert.equal(c._a2CameraBusy, false, msg);
        assert.ok(Number.isFinite(c._x) && c._x > 0 && c._x < GEO[geo].W, msg);
        assert.deepEqual(ruf.filter((r) => r[0] === 'fehler'), [], msg);
        if (fertig) break;
      }
    }
  }
});

test('Kamera: Szene und Aufräumen mitten in der Aktion lassen sie stehen; neue Größe bricht ab; Abhängen räumt sofort', async () => {
  const { c, ruf } = karte(1);
  let mitten = null;
  c._wait = async () => {
    if (!mitten && c._a2CameraS) {
      c._a2Scene();
      c._a2Cleanup();
      mitten = !!c._a2CameraS && c._a2Els.has('camera');
    }
  };
  await c._a2CameraPlay({ motif: 'sky' });
  assert.equal(mitten, true);
  sauber(c);
  // Größe der Karte geändert: abbrechen (die Pixel stimmen nicht mehr)
  const { c: g, ruf: rg } = karte(1);
  let einmal = false;
  g._wait = async () => {
    if (g._a2CameraS && !einmal) {
      einmal = true;
      g._W = 500;
      g._a2Scene();
    }
  };
  await g._a2CameraPlay({ motif: 'sky' });
  assert.ok(rg.some((r) => r[0] === 'abbruch'));
  // Karte aus dem DOM mitten drin: alles sofort weg (auch das Bild, ohne Ausblenden)
  const { c: d } = karte(3);
  d._wait = async () => {
    if (d._a2CameraS?.ph?.cls.has('a2cmheld')) {
      d._a2Detach();
      throw new Error('Cancel');
    }
  };
  await d._a2CameraPlay({ motif: 'sky' }).catch(() => {});
  assert.equal(d._a2CameraS, null);
  assert.equal(d._a2Els.has('camera'), false);
  assert.ok(fotos(d).every((e) => e.weg));
  // ohne Schatz (Stufe 0) nichts; ohne Fotowetter nur aus der Vorschau (_forced)
  const { c: n, ruf: rn } = karte(0);
  await n._a2CameraPlay();
  n._a2Scene();
  assert.deepEqual(rn, []);
  const { c: w, ruf: rw } = karte(1, { wx: { wet: true, rain: 95, storm: true } });
  await w._a2CameraPlay();
  assert.deepEqual(rw, []);
  w._forced = true;
  await w._a2CameraPlay();
  assert.ok(rw.some((r) => r[0] === 'piep' && r[1] === 'klick!'));
  assert.ok(ruf.length > 0);
});

test('Kamera auspacken: Stufe 1 gleich ein Foto (ohne Holen), 2 das Selfie, 3 im goldenen Rahmen; auch nachts und bei Regen', async () => {
  for (const lv of [1, 2, 3]) {
    const { c, ruf, G } = karte(lv, { wx: { wet: true }, cls: ['night'] });
    await c._a2CameraStow(lv);
    const msg = `Stufe ${lv}`;
    assert.ok(!ruf.some((r) => r[0] === 'geht' && r[1] === Math.round(G.hole.cx + G.pW * 0.75)), `holt sie nicht erst ${msg}`);
    assert.ok(!ruf.some((r) => r[0] === 'maul' && r[1]), msg);
    assert.ok(ruf.some((r) => r[0] === 'piep' && r[1] === 'klick!'), msg);
    const ph = fotos(c)[0];
    if (lv === 2) assert.match(ph.innerHTML, /#c09a76/, msg);
    assert.equal(ph.cls.has('gold'), lv === 3, msg);
    sauber(c, msg);
  }
});

test('Kamera, reduzierte Bewegung: kein Holen, kein Aufploppen, kein Schwenk, das Bild blendet in den Pfoten ein', async () => {
  ruhe.matches = true;
  try {
    for (const [lv, act] of [[1, '_a2CameraPlay'], [2, '_a2CameraSelfie']]) {
      const { c, ruf, G } = karte(lv);
      let still = false;
      let pop = false;
      c._wait = async () => {
        const el = c._a2CameraS?.el;
        if (el) {
          still ||= el.cls.has('still');
          pop ||= el.cls.has('a2pop');
        }
      };
      await c[act]({ motif: 'sky' });
      assert.ok(!ruf.some((r) => r[0] === 'geht' && r[1] === Math.round(G.hole.cx + G.pW * 0.75)), 'holt sie nicht');
      assert.ok(still && !pop);
      assert.ok(!ruf.some((r) => r[0] === 'piep' && /surr/.test(r[1])), 'schiebt sich nicht heraus');
      const ph = fotos(c)[0];
      assert.ok(ph.cls.has('still'));
      assert.ok(ph.anim.some((k) => k[0]?.opacity === 0), 'blendet ein');
      assert.ok(!ph.anim.some((k) => /translateY/.test(k[0]?.transform || '')));
      assert.equal(blitze(c).length, 0);
      sauber(c);
    }
  } finally {
    ruhe.matches = false;
  }
});

test('Kamera: Das Bild in den Pfoten trägt nicht die Klasse held (Ebene des Plüsch-Pinos, inset: 0)', async () => {
  // Die allgemeine Regel gibt es (STYLE_GIFT): Ein .held in .gifts reichte bis zum Boden der Szene, und das Bild drehte
  // sich (transform-origin 50 % 100 %) um deren Unterkante statt um seine eigene
  const bundle = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
  assert.match(bundle, /\.held \{ position: absolute; inset: 0;/);
  for (const act of ['_a2CameraPlay', '_a2CameraSelfie']) {
    const { c } = karte(2);
    let gehalten = false;
    const je = new Set();
    c._wait = async () => {
      const ph = c._a2CameraS?.ph;
      if (!ph) return;
      for (const k of ph.cls) je.add(k);
      gehalten ||= c._el.pika.cls.has('a2cm-hold');
    };
    await c[act]({ motif: 'sky' });
    assert.ok(gehalten, `${act}: er hält es`);
    assert.ok(!je.has('held'), `${act}: nie .held`);
    assert.ok(je.has('a2cmheld'), `${act}: eigene Klasse`);
  }
});

test('Kamera, Selfie mit dem Freund: Abbruch gleich nach dem Blitz – der Freund öffnet die Augen trotzdem wieder', async () => {
  const { c, ruf } = karte(2);
  const fr = freund(c, ruf, 'rufus', 470);
  let zu = false;
  c._wait = async () => {
    if (fr.el.cls.has('blink')) {
      zu = true;
      c._ac = { signal: { aborted: true } };
      throw new Error('Cancel');
    }
  };
  await c._a2CameraSelfie().catch(() => {});
  assert.ok(zu, 'er hat geblinzelt');
  c._a2Cleanup();
  sauber(c);
  lauf();
  assert.ok(!fr.el.cls.has('blink'), 'Augen wieder auf');
});

test('Kamera: Nur die Höhe der Karte ändert sich (H, pW, gy mit ihr) mitten im Foto: abbrechen wie bei neuer Breite', async () => {
  const { c, ruf } = karte(1, { geo: 'schmal' });
  let einmal = false;
  c._wait = async () => {
    if (c._a2CameraS && !einmal) {
      einmal = true;
      c._H = 300;
      c._Hs = 300;
      c._a2Scene();
    }
  };
  await c._a2CameraPlay({ motif: 'sky' });
  assert.ok(einmal);
  assert.ok(ruf.some((r) => r[0] === 'abbruch'), 'neue Höhe: abbrechen');
});

// Ein Ding am Boden (wie das Windrad aus Album 1: _gtEls, in .gifts, ohne top) von l bis r
const amBoden = (c, l, r, t = 1) => {
  const el = { parentElement: c._el.gifts, offsetLeft: l, offsetWidth: r - l, style: {} };
  c._gtEls = new Map([...(c._gtEls || []), [t, el]]);
  return el;
};
const frei = (x, w, l, r, pad) => x + w / 2 <= l - pad + 0.01 || x - w / 2 >= r + pad - 0.01;

test('Kamera: steht nicht vor dem, was schon am Boden steht (Himmel, Selfie, Blume; seit 0.48.1)', () => {
  const { c } = karte(1);
  const O = c._a2CameraOff();
  const L0 = c._a2CameraAimSky();
  amBoden(c, L0.cx - 15, L0.cx + 15);
  const pad = c._H * 0.015;
  const L = c._a2CameraAimSky();
  assert.ok(frei(L.cx, O.w, L0.cx - 15, L0.cx + 15, pad), JSON.stringify([L0.cx, L.cx]));
  const S = c._a2CameraSelfPlan(null);
  assert.ok(S && frei(S.cx, O.w, L0.cx - 15, L0.cx + 15, pad), JSON.stringify(S));
  // Blume: eine, vor der die Kamera auf dem Windrad stünde, nimmt er nicht
  const { c: b } = karte(1);
  b._flowers = [{ xf: 0.62, color: '#e33', el: new El() }];
  const F = b._a2CameraAimFlower();
  assert.ok(F, 'ohne Sperre geht die Blume');
  amBoden(b, F.cx - 10, F.cx + 10);
  const F2 = b._a2CameraAimFlower();
  assert.ok(!F2 || frei(F2.cx, O.w, F.cx - 10, F.cx + 10, pad), JSON.stringify(F2));
});
