// Album 2: das Planschbecken (Schatz t2 = 7) – Daten, Wetter (ab 25 °C, Tag, Sommerhalbjahr), Spiel mit und ohne
// Gießkanne, Arschbombe, Gummiente, Tipp, Auspacken (zeigen und vertrösten oder gleich planschen), Abbruch an jeder
// Stelle (auch auf dem Rand und im Sprung), reduzierte Bewegung, schmale Karte. Ohne echte Szene: Elemente sind
// Attrappen, Laufen stellt nur die Stelle. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const plain = (v) => JSON.parse(JSON.stringify(v));

// Ein Element, soweit Becken, Ente, Tropfen und Gießkanne es anfassen
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
    this.offsetWidth = 10;
    this.unter = null;
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

  appendChild(k) {
    this.kinder.push(k);
    return k;
  }

  remove() {
    this.weg = true;
    this.isConnected = false;
  }

  animate() {
    return { cancel() {}, finish() {} };
  }

  getBoundingClientRect() {
    return { left: 300, top: 160, right: 330, bottom: 180, width: 30, height: 20 };
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
  for (let n = 0; n < 5 && wecker.length; n++) {
    const w = wecker;
    wecker = [];
    for (const x of w) if (!x.aus) x.fn();
  }
};

// Geometrie wie _layout (600 × 248 bzw. schmal 380 × 184)
const GEO = {
  breit: { W: 600, H: 248, gy: 223.2, pW: 119.04, pH: 99.2, hayR: 222.68, hole: { l: 70.2, r: 121, cx: 95.6 }, rock: { l: 441.2, w: 148.8, cx: 515.6, lift: 49.1, ku: 1.488 }, xR: 546.4 },
  schmal: { W: 380, H: 184, gy: 165.6, pW: 88.32, pH: 73.6, hayR: 165.21, hole: { l: 52.1, r: 89.8, cx: 70.9 }, rock: { l: 259.6, w: 110.4, cx: 314.8, lift: 36.4, ku: 1.104 }, xR: 340.3 },
};
const JULI = new Date(2026, 6, 15, 13).getTime();
// Karte mit Album 2, Planschbecken auf Stufe lv. ruf: was sie tut. temp: Temperatur der Wetter-Entität, wx: Wetter,
// can: die Gießkanne aus Album 1 steht in der Szene
const karte = (lv = 1, { geo = 'breit', temp = 28, wx = {}, can = true, date = JULI, ...extra } = {}) => {
  const G = GEO[geo];
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const w = (lv >= 1 ? 0x80 : 0) | (lv >= 2 ? 0x8000 : 0) | (lv >= 3 ? 0x800000 : 0);
  const leer = () => {};
  const kanne = new El();
  Object.assign(c, {
    _cfg: { gifts: true }, _W: G.W, _H: G.H, _x: 300, _dir: 1, _lift: 0, _lane: 0, _wx: wx, _wind: 0, _wxRaw: { temp }, _dbgDate: date,
    _g: { gy: G.gy, pW: G.pW, pH: G.pH, hayR: G.hayR, hole: G.hole, rock: G.rock, xR: G.xR },
    _el: { pika: new El(), psay: new El(), fx: new El(), gifts: new El(), acts: new El(), birds: new El(), scene: new El() },
    _plan: { gift: { u: 255, v: 255, w, z: 4, o: 4, i: 39 } },
    _gtEls: can ? new Map([[6, kanne]]) : new Map(),
    _say: (t) => ruf.push(['sagt', t]), _wait: async () => {}, _face: (d) => (c._dir = d),
    _walkTo: async (x) => {
      x = Math.min(Math.max(x, G.pW * 0.45), G.xR);
      c._face(x >= c._x ? 1 : -1);
      c._x = x;
      c._lift = 0;
      ruf.push(['geht', Math.round(x)]);
    },
    _setX: (x) => {
      c._x = x;
      c._el.pika.style.transform = `translate(${(x - G.pW / 2).toFixed(1)}px, ${(-c._lift).toFixed(1)}px)`;
      ruf.push(['steht', Math.round(x)]);
    },
    _pikaZ: leer,
    _groundSpot: (u, w2) => ({ x: (G.hayR + G.rock.l) / 2, w: w2 }), _poops: () => ({ piles: [] }),
    _nosePos: () => ({ x: c._x + c._dir * G.pW * 0.258, y: G.gy - G.pH * 0.43 }),
    _mouth: (col) => ruf.push(['maul', !!col]),
    _jump: (k) => ruf.push(['springt', k]), _puff: () => ruf.push(['staub']),
    _sparkle: leer, _mimik: leer, _happy: () => ruf.push(['freut']), _peep: (x, y, t) => ruf.push(['piep', t]),
    _found: (k) => ruf.push(['entdeckt', k]), _away: () => false, _urlaubFern: () => false, _err: (k, e) => ruf.push(['fehler', k, String(e)]),
    ...extra,
  });
  c._giftScene = () => c._a2Scene();
  wecker = [];
  return { c, ruf, G, kanne };
};
// Jeder Aufruf von _a2PoolPika (x, dy) mitschreiben
const stellen = (c) => {
  const L = [];
  const f = c._a2PoolPika;
  c._a2PoolPika = function (x, dy, ms, ease) {
    L.push([x, dy, this._el.pika.cls.has('a2pl-ball')]);
    return f.call(this, x, dy, ms, ease);
  };
  return L;
};
const fx = (c, k) => c._el.fx.kinder.filter((e) => e.cls.has(k));
const vorn = (c) => c._el.gifts.kinder.filter((e) => e.cls.has('a2plf'));
const POOL_CLS = ['a2pl-in', 'a2pl-ball', 'a2pl-wob', 'a2pl-drip', 'a2pl-shake', 'carry', 'wcan', 'pour'];
// Aufgeräumt? Kein Zustand, keine eigenen Klassen am Pika, nichts im Maul, die Gießkanne steht wieder, beide Stücke
// blenden aus oder sind weg, er steht am Boden
const sauber = (c, kanne, msg = '') => {
  assert.ok(!c._a2PoolS, `kein Becken-Zustand ${msg}`);
  assert.ok(!c._a2PoolBusy, `nicht beschäftigt ${msg}`);
  for (const k of POOL_CLS) assert.ok(!c._el.pika.cls.has(k), `${k} ${msg}`);
  assert.ok(!c._a2PoolCarrying, `nichts im Maul ${msg}`);
  if (kanne) assert.ok(!kanne.cls.has('away'), `Gießkanne steht ${msg}`);
  assert.ok(vorn(c).every((e) => e.weg || e.cls.has('a2out')), `vorderes Stück weg ${msg}`);
  const el = c._a2Els?.get('pool');
  assert.ok(!el || el.cls.has('a2out'), `hinteres Stück weg ${msg}`);
  assert.equal(c._lift, 0, `am Boden ${msg}`);
  assert.doesNotMatch(String(c._el.pika.style.transform ?? ''), /,\s*-?[1-9][\d.]*px\)/, `nicht höher oder tiefer ${msg}`);
};

test('Planschbecken: Daten wie die Schätze aus Album 1 (24 × 24, ohne id und class), gebaut, Juni bis August, Aktionen gibt es', () => {
  const { c } = karte();
  const it = c._a2Item(7);
  assert.equal(it.key, 'pool');
  assert.equal(it.built, true);
  assert.deepEqual(plain(it.mo), [5, 6, 7]);
  assert.match(it.icon, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(it.icon, /\sid=|\sclass=|NaN|undefined/);
  for (const k of ['name', 'say', 'trick', 'gilt', 'use', 'gold']) assert.ok(it[k] && typeof it[k] === 'string', k);
  assert.equal(it.trick, 'Arschbombe');
  assert.ok(it.find?.t && it.find?.h);
  assert.ok(it.dbg.length >= 3);
  for (const [label, act, lv] of it.dbg) {
    assert.equal(typeof c[`_${act}`], 'function', label);
    assert.ok(lv >= 1 && lv <= 3);
  }
  // die Entdeckung kennt das Tagebuch
  assert.deepEqual([...T.findsParse('pool,unbekannt')], ['pool']);
});

test('Planschbecken: nur ab 25 °C bei Tag im Sommerhalbjahr, ab 30 °C öfter, bei leichtem Regen seltener; nie bei Gewitter, Starkregen, Schnee, Sturm', () => {
  const acts = (o = {}, cls = []) => {
    const { c } = karte(o.lv ?? 1, o);
    c._el.scene.cls = new Set(cls);
    return plain(c._a2PoolActs({ wx: o.wx || {} }, o.lv ?? 1));
  };
  assert.deepEqual(acts(), [[0.45, 'a2PoolPlay'], [0, 'a2PoolBomb']]);
  assert.deepEqual(acts({ temp: 25 })[0], [0.45, 'a2PoolPlay']);
  // liegt ein Häufchen, nicht (das Becken stünde darüber)
  {
    const { c } = karte(1, {});
    c._el.scene.cls = new Set();
    assert.deepEqual(plain(c._a2PoolActs({ wx: {}, piles: [{ k: 1, slot: 0 }] }, 1)), []);
    assert.equal(plain(c._a2PoolActs({ wx: {}, piles: [] }, 1)).length, 2);
  }
  assert.deepEqual(acts({ temp: 24.9 }), []);
  assert.deepEqual(acts({ temp: null }), []);
  assert.equal(acts({ temp: 31 })[0][0], 0.8);
  assert.ok(acts({ lv: 2 })[1][0] > 0, 'Trick ab Stufe 2');
  // leichter Regen geht, seltener; Starkregen, Hagel, Gewitter, Schnee nicht
  assert.ok(Math.abs(acts({ wx: { wet: true, rain: 40 } })[0][0] - 0.18) < 1e-9);
  for (const wx of [{ wet: true, rain: 95, storm: true, shelter: true }, { wet: true, rain: 60, hail: true, storm: true }, { flash: true, storm: true, wet: true },
    { snow: 25, rain: 25, wet: true }, { snowcover: true }]) assert.deepEqual(acts({ wx }), [], JSON.stringify(wx));
  // nachts und in der Dämmerung nicht, nicht bei starkem Wind
  assert.deepEqual(acts({}, ['night']), []);
  assert.deepEqual(acts({}, ['dusk']), []);
  assert.deepEqual(acts({ _wind: 45 }), []);
  // Der Monat zählt nicht, nur die Wärme (ein heißer Tag im Mai; sogar im November)
  assert.ok(acts({ date: new Date(2026, 4, 20, 13).getTime() }).length > 0);
  assert.ok(acts({ date: new Date(2026, 10, 22, 13).getTime() }).length > 0);
  // seine Jahreszeit (fürs Vertrösten): Juni bis August, auf der Südhalbkugel versetzt
  const jz = (date, lat = 50) => karte(1, { date, _hass: { config: { latitude: lat } } }).c._a2PoolSummer();
  assert.deepEqual([jz(new Date(2026, 4, 31, 12).getTime()), jz(JULI), jz(new Date(2026, 8, 1, 12).getTime())], [false, true, false]);
  assert.equal(jz(new Date(2026, 11, 24, 12).getTime(), -34), true);
  // die Vorschau setzt die Temperatur über _dbgWeather
  const { c } = karte(1, { temp: 12 });
  c._dbgWeather = { temp: 28 };
  assert.equal(c._a2PoolTemp(), 28);
  // Wahl über die Schnittstelle: nur mit dem Schatz, nicht verreist
  const { c: k } = karte(1);
  assert.deepEqual(plain(k._a2Acts({ wx: {} })).map((a) => a[1]), ['a2PoolPlay']);
  k._urlaubFern = () => true;
  assert.deepEqual(plain(k._a2Acts({ wx: {} })), []);
  const { c: k0 } = karte(0);
  assert.deepEqual(plain(k0._a2Acts({ wx: {} })), []);
});

test('Planschbecken, Stufe 1: holen, aufblasen, mit der Gießkanne füllen, hineinhüpfen, planschen, tropfen, schütteln, wegräumen', async () => {
  for (const geo of ['breit', 'schmal']) {
    const { c, ruf, G, kanne } = karte(1, { geo });
    const L = stellen(c);
    let mitten = null;
    let voll = null;
    let flach = null;
    c._wait = async () => {
      const S = c._a2PoolS;
      if (S && flach == null) flach = S.flat && S.el.props['--a2plf'] === '0';
      if (S && kanne.cls.has('away')) voll ??= { kanne: c._el.pika.cls.has('wcan') };
      if (S && c._el.pika.cls.has('a2pl-in') && !mitten) mitten = { z: [Number(S.el.style.zIndex), Number(S.fr.style.zIndex), 0], leer: S.el.cls.has('leer'), x: c._x, S: { ...S } };
    };
    await c._a2PoolPlay();
    const msg = `(${geo})`;
    // holt es aus dem Bau, trägt es im Maul
    assert.equal(ruf.find((r) => r[0] === 'geht')[1], Math.round(G.hole.cx + G.pW * 0.75), msg);
    assert.ok(ruf.some((r) => r[0] === 'maul' && r[1]), msg);
    assert.equal(flach, true, `zusammengelegt hingelegt ${msg}`);
    assert.ok(ruf.filter((r) => r[0] === 'piep' && /^(pff…|pffft!)$/.test(r[1])).length === 3, `drei Puster ${msg}`);
    // Gießkanne: geholt und wieder hingestellt, das Wasser ist vor dem Hineinhüpfen drin
    assert.deepEqual(voll, { kanne: true }, msg);
    assert.equal(mitten.leer, false, msg);
    // im Becken: in der Mitte, das vordere Stück vor ihm (höhere Ebene als der Pika: Rang arm)
    assert.ok(Math.abs(mitten.x - mitten.S.cx) < 0.01, msg);
    assert.ok(mitten.z[1] > mitten.z[0], msg);
    // Das Becken liegt rechts vom Heu und im Bild, er steht daneben in seinem Bereich
    const S = mitten.S;
    assert.ok(S.cx - S.w / 2 >= G.hayR, `rechts vom Heu ${msg}`);
    assert.ok(S.cx + S.w / 2 <= G.W, `im Bild ${msg}`);
    assert.ok(S.sx >= G.pW * 0.45 && S.sx <= G.xR, msg);
    assert.ok(Math.abs(S.sx - S.cx) >= S.w / 2, `steht neben dem Becken ${msg}`);
    // er springt hinein (nie mit _lift), es spritzt, er tropft und schüttelt sich
    assert.ok(L.length >= 2 && L.every(([x]) => x > 0 && x < G.W), msg);
    assert.ok(L.some(([, dy]) => dy > 0), `sitzt etwas tiefer ${msg}`);
    assert.ok(ruf.some((r) => r[0] === 'springt' && r[1] === 'hop1'), msg);
    assert.ok(fx(c, 'splash').length >= 6, `Tropfen ${msg}`);
    assert.ok(ruf.some((r) => r[0] === 'sagt' && /schüttel|wusch/.test(r[1])), msg);
    // trägt es zurück in den Bau
    assert.equal(ruf.filter((r) => r[0] === 'geht').at(-1)[1], Math.round(G.hole.cx + G.pW * 0.75), msg);
    lauf();
    sauber(c, kanne, msg);
    assert.ok(fx(c, 'a2pldrip').length > 0, `tropft ${msg}`);
    assert.deepEqual(ruf.filter((r) => r[0] === 'fehler'), []);
  }
  // ohne Gießkanne: gleich voll, keine Kanne
  const { c, ruf, kanne } = karte(1, { can: false });
  let leer = null;
  c._wait = async () => {
    if (c._a2PoolS && leer == null && !c._a2PoolS.flat) leer = c._a2PoolS.el.cls.has('leer');
  };
  await c._a2PoolPlay();
  assert.equal(leer, false);
  assert.ok(!ruf.some((r) => r[0] === 'sagt' && /Wasser holen|Gießkanne|noch leer/.test(r[1])));
  sauber(c, kanne);
  // ohne Planschwetter nichts (außer aus der Vorschau, _forced)
  const { c: k, ruf: rk } = karte(1, { temp: 20 });
  await k._a2PoolPlay();
  assert.deepEqual(rk, []);
  k._forced = true;
  await k._a2PoolPlay();
  assert.ok(rk.some((r) => r[0] === 'sagt' && /schön kühl|herrlich|ahh/.test(r[1])));
});

test('Planschbecken, Stufe 2: Arschbombe vom Rand – auf den Rand (höher, ohne _lift), zusammengerollt hinein, großer Spritzer', async () => {
  const { c: c1, ruf: r1 } = karte(1);
  await c1._a2PoolBomb();
  assert.deepEqual(r1, [], 'auf Stufe 1 gibt es den Trick nicht');
  for (const geo of ['breit', 'schmal']) {
    const { c, ruf, G, kanne } = karte(2, { geo });
    const L = stellen(c);
    let wackelt = false;
    let liftMax = 0;
    c._wait = async () => {
      wackelt ||= c._el.pika.cls.has('a2pl-wob');
      liftMax = Math.max(liftMax, c._lift);
    };
    await c._a2PoolBomb();
    const msg = `(${geo})`;
    const S0 = { w: G.pW * 1.5 };
    // auf dem Rand: höher als der Boden, nicht höher als ein Fünftel der Bühne; seitlich am Rand des Beckens
    const rand = L.find(([, dy]) => dy < 0);
    assert.ok(rand, `auf dem Rand ${msg}`);
    assert.ok(-rand[1] < G.H * 0.2, msg);
    assert.equal(liftMax, 0, `_lift bleibt 0 ${msg}`);
    assert.ok(wackelt, msg);
    // zusammengerollt hinein, in die Mitte
    const sprung = L.find(([, , ball]) => ball);
    assert.ok(sprung && sprung[1] > 0, msg);
    assert.ok(Math.abs(rand[0] - sprung[0]) > S0.w * 0.4, `vom Rand bis zur Mitte ${msg}`);
    assert.ok(ruf.some((r) => r[0] === 'springt' && r[1] === 'binky'), msg);
    assert.ok(ruf.some((r) => r[0] === 'sagt' && r[1] === 'PLATSCH!'), msg);
    assert.ok(fx(c, 'splash').length >= 14, msg);
    lauf();
    sauber(c, kanne, msg);
  }
});

test('Planschbecken, Stufe 3: Die goldene Gummiente schwimmt mit (mit Abstand und Würfel), er bestaunt sie; der Rand ist golden; verreist keine', async () => {
  const { c, ruf, kanne } = karte(3);
  c._dbgGold = true;
  let ente = null;
  let gilt = null;
  c._wait = async () => {
    const S = c._a2PoolS;
    if (S?.duck && c._el.pika.cls.has('a2pl-in')) ente ??= S.duck.className;
    if (S) gilt ??= [S.el.cls.has('gilt'), S.fr.cls.has('gilt')];
  };
  await c._a2PoolPlay();
  assert.match(ente, /a2pld/);
  assert.match(ente, /\bon\b/);
  assert.deepEqual(gilt, [true, true]);
  assert.ok(ruf.some((r) => r[0] === 'piep' && r[1] === 'quietsch!'));
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /Gummiente|goldene Ente|Entchen/.test(r[1])));
  sauber(c, kanne);
  // Stufe 2: keine Ente; golden, aber verreist (oder unsichtbar): auch keine
  for (const [lv, extra] of [[2, {}], [3, { _away: () => true }]]) {
    const { c: k, ruf: rk } = karte(lv, extra);
    let d = false;
    k._wait = async () => {
      d ||= !!k._a2PoolS?.duck;
    };
    k._dbgGold = true;
    await k._a2PoolPlay();
    assert.equal(d, false, `Stufe ${lv}`);
    assert.ok(!rk.some((r) => r[1] === 'quietsch!'));
  }
  // ohne Vorschau: höchstens alle paar Minuten
  const { c: h } = karte(3);
  const R = { cd: 5 * 6e4, p: 1 };
  assert.equal(h._a2GoldOk('pool', R), true);
  assert.equal(h._a2GoldOk('pool', R), false);
});

test('Planschbecken: Abbruch an jeder Stelle (auch auf dem Rand und im Sprung) räumt auf; er steht am Boden, die Gießkanne wieder an ihrem Platz', async () => {
  const runs = [['play', (c) => c._a2PoolPlay()], ['bomb', (c) => c._a2PoolBomb()], ['stow', (c, lv) => c._a2PoolStow(lv)], ['zeigen', (c, lv) => c._a2PoolStow(lv)]];
  for (const still of [false, true]) {
    ruhe.matches = still;
    try {
      for (const geo of ['breit', 'schmal']) {
        for (const lv of [1, 2, 3]) {
          for (const [art, go] of runs) {
            for (let n = 1; n < 80; n++) {
              let k = 0;
              const { c, kanne } = karte(lv, { geo, ...(art === 'zeigen' ? { temp: 15 } : {}) });
              let wo = '';
              c._wait = async () => {
                if (++k >= n) {
                  wo = [...c._el.pika.cls].filter((x) => /a2pl|carry|wcan|pour|puffy/.test(x)).join(' ');
                  c._ac = { signal: { aborted: true } };
                  throw new Error('Cancel');
                }
              };
              const fertig = await go(c, lv).then(() => true, () => false);
              const msg = `(${still ? 'ruhig, ' : ''}${geo}, Stufe ${lv}, ${art}, Abbruch beim ${n}. Warten${wo ? ` [${wo}]` : ''}${fertig ? ', schon fertig' : ''})`;
              // _cleanup ruft den Hook danach auf, auch zweimal
              c._a2Cleanup();
              c._a2Cleanup();
              lauf();
              sauber(c, kanne, msg);
              assert.ok(vorn(c).every((e) => e.weg), `vorderes Stück entfernt ${msg}`);
              assert.equal(c._a2Els?.has('pool') ?? false, false, `hinteres Stück entfernt ${msg}`);
              assert.ok(Number.isFinite(c._x) && c._x > 0 && c._x < GEO[geo].W, msg);
              if (fertig) break;
            }
          }
        }
      }
    } finally {
      ruhe.matches = false;
    }
  }
});

test('Planschbecken: Szene und Aufräumen mitten in der Aktion lassen es stehen; danach ist es weg; Größenänderung bricht ab; Abhängen', async () => {
  const { c, kanne } = karte(1);
  let mitten = null;
  c._wait = async () => {
    if (!mitten && c._el.pika.cls.has('a2pl-in')) {
      c._a2Scene();
      c._a2Cleanup();
      mitten = !!c._a2PoolS && c._a2Els.has('pool');
    }
  };
  await c._a2PoolPlay();
  assert.equal(mitten, true);
  sauber(c, kanne);
  // Die Karte ändert ihre Größe: abbrechen (die Stücke stehen an alten Pixeln)
  const { c: g } = karte(1);
  let ab = 0;
  g._interrupt = () => ab++;
  g._wait = async () => {
    if (g._a2PoolS && !ab) {
      g._W = 500;
      g._a2Scene();
    }
  };
  await g._a2PoolPlay();
  assert.equal(ab, 1);
  // Karte aus dem DOM mitten drin: alles sofort weg
  const { c: d } = karte(3);
  d._wait = async () => {
    if (d._el.pika.cls.has('a2pl-in')) {
      d._a2Detach();
      throw new Error('Cancel');
    }
  };
  await d._a2PoolPlay().catch(() => {});
  assert.equal(d._a2PoolS, null);
  assert.equal(d._a2Els.has('pool'), false);
  assert.ok(vorn(d).every((e) => e.weg));
  // ohne Schatz (Stufe 0) nichts
  const { c: n } = karte(0);
  await n._a2PoolPlay();
  n._a2Scene();
  assert.equal(n._a2Els?.has('pool') ?? false, false);
});

test('Planschbecken: Tipp ins Becken, solange es steht – Ring auf dem Wasser, plitsch, Entdeckung zählt; flach oder weg keine Antwort', async () => {
  const { c, ruf } = karte(1);
  let Z = null;
  let flach = null;
  let leer = null;
  c._wait = async () => {
    const S = c._a2PoolS;
    if (S?.flat && flach == null) flach = c._a2PoolTap({ k: 'pool' });
    if (S && !S.flat && S.el.cls.has('leer') && leer == null) leer = c._a2PoolTap({ k: 'pool' });
    if (!Z && c._el.pika.cls.has('a2pl-in')) {
      Z = [];
      c._a2Zones(Z, { left: 0, top: 0 });
      ruf.push(['tipp', c._a2Tap(Z[0]), S.el.cls.has('rip'), S.fr.cls.has('rip')]);
    }
  };
  await c._a2PoolPlay();
  assert.equal(flach, false, 'zusammengelegt antwortet es nicht');
  assert.equal(leer, false, 'ohne Wasser auch nicht');
  assert.deepEqual(Z.map((z) => [z.k, z.a2]), [['pool', true]]);
  assert.ok(ruf.some((r) => r[0] === 'tipp' && r[1] === true && r[2] && r[3]));
  assert.ok(ruf.some((r) => r[0] === 'piep' && /plitsch|platsch|blubb/.test(r[1])));
  // nach der Aktion: keine Zone mehr, Tipp ohne Becken antwortet nicht
  lauf();
  const Z2 = [];
  c._a2Zones(Z2, { left: 0, top: 0 });
  assert.deepEqual(Z2, []);
  assert.equal(c._a2PoolTap({ k: 'pool' }), false);
});

test('Planschbecken auspacken: außerhalb des Sommers oder zu kalt zeigen und vertrösten, bei Planschwetter gleich kurz planschen', async () => {
  const NOV = new Date(2026, 10, 22, 13).getTime();
  for (const lv of [1, 2, 3]) {
    // November (und kalt): „im Sommer!“
    const { c, ruf, kanne } = karte(lv, { date: NOV, temp: 6 });
    let S0 = null;
    c._wait = async () => {
      S0 ??= c._a2PoolS && { leer: c._a2PoolS.el.cls.has('leer'), duck: c._a2PoolS.duck?.className ?? null };
    };
    await c._a2PoolStow(lv);
    assert.ok(ruf.some((r) => r[0] === 'sagt' && /im Sommer|bis zum Sommer/.test(r[1])), `Stufe ${lv}`);
    assert.ok(!ruf.some((r) => r[0] === 'springt'), 'kein Sprung');
    assert.ok(!c._el.pika.cls.has('a2pl-in'));
    assert.equal(S0.leer, false, 'voll, zum Hineintippen');
    if (lv === 3) {
      assert.match(S0.duck, /\bon\b/);
      assert.ok(ruf.some((r) => r[1] === 'die Ente darf!'));
    } else assert.equal(S0.duck, null);
    sauber(c, kanne, `November, Stufe ${lv}`);
    // Juli, aber kalt: „brrr“ und „wenn's heiß ist“
    const { c: k, ruf: rk } = karte(lv, { temp: 19 });
    await k._a2PoolStow(lv);
    assert.ok(rk.some((r) => r[0] === 'sagt' && /kalt/.test(r[1])));
    assert.ok(rk.some((r) => r[0] === 'sagt' && /heiß|25 Grad/.test(r[1])));
    // warm, aber Gewitter: „heute nicht“
    const { c: g, ruf: rg } = karte(lv, { wx: { storm: true, flash: true, shelter: true } });
    await g._a2PoolStow(lv);
    assert.ok(rg.some((r) => r[0] === 'sagt' && /heute nicht|ein andermal/.test(r[1])));
    assert.ok(!rg.some((r) => r[0] === 'springt'));
    // Planschwetter: gleich hinein, ohne Holen aus dem Bau und ohne Wegräumen
    const { c: s, ruf: rs, G } = karte(lv);
    let drin = false;
    s._wait = async () => {
      drin ||= s._el.pika.cls.has('a2pl-in');
    };
    await s._a2PoolStow(lv);
    assert.equal(drin, true, `planscht, Stufe ${lv}`);
    assert.ok(!rs.some((r) => r[0] === 'geht' && r[1] === Math.round(G.hole.cx + G.pW * 0.75)), 'kein Holen, kein Wegräumen');
    if (lv === 2) assert.ok(rs.some((r) => r[1] === 'PLATSCH!'));
    if (lv === 3) assert.ok(rs.some((r) => r[1] === 'quietsch!'));
    lauf();
    sauber(s, null, `Planschwetter, Stufe ${lv}`);
  }
});

test('Planschbecken, reduzierte Bewegung: kein Holen, kein Aufblasen, keine Sprünge, keine Spritzer – hineingehen, ein Ring auf dem Wasser', async () => {
  ruhe.matches = true;
  try {
    for (const [lv, go] of [[1, (c) => c._a2PoolPlay()], [2, (c) => c._a2PoolBomb()], [3, (c) => c._a2PoolPlay()]]) {
      const { c, ruf, G, kanne } = karte(lv, { _dbgGold: true });
      let flach = false;
      let ring = false;
      let mehr = false;
      let ente = null;
      c._wait = async () => {
        const S = c._a2PoolS;
        flach ||= !!S?.flat;
        ring ||= !!S?.el.cls.has('rip');
        mehr ||= !!S && (S.el.cls.has('rip2') || S.el.cls.has('wave'));
        if (S?.duck) ente ??= S.duck.className;
      };
      await go(c);
      const msg = `Stufe ${lv}`;
      assert.equal(flach, false, msg);
      assert.equal(ring, true, msg);
      assert.equal(mehr, false, `nur ein Ring ${msg}`);
      assert.ok(!ruf.some((r) => r[0] === 'springt'), msg);
      assert.ok(!ruf.some((r) => r[0] === 'maul' && r[1]), `trägt nichts ${msg}`);
      assert.ok(!ruf.some((r) => r[0] === 'geht' && r[1] === Math.round(G.hole.cx + G.pW * 0.75)), msg);
      assert.equal(fx(c, 'splash').length, 0, msg);
      assert.equal(fx(c, 'a2pldrip').length, 0, msg);
      if (lv === 3) assert.match(ente, /\bstill\b/);
      lauf();
      sauber(c, kanne, msg);
    }
  } finally {
    ruhe.matches = false;
  }
});

test('Planschbecken: Stil mit Safari-Rand, ruhiger Fassung und eigenen Klassen; Bilder ohne Fehler', () => {
  const stil = fs.readFileSync(new URL('../src/stil/album2-pool.js', import.meta.url), 'utf8');
  assert.match(stil, /\.a2-pool svg, \.a2plf svg \{ padding: [^;]+; margin: -/);
  assert.match(stil, /@media \(prefers-reduced-motion: reduce\)/);
  for (const k of ['a2pl-in', 'a2pl-ball', 'a2pl-wob', 'a2pl-shake', 'a2pldrip', 'rip', 'rip2', 'leer', 'gilt']) assert.ok(stil.includes(`.${k}`), k);
  const quell = fs.readFileSync(new URL('../src/grafik/album2/pool.js', import.meta.url), 'utf8');
  assert.doesNotMatch(quell, /NaN|undefined/);
  const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
  assert.ok(src.includes('.a2pld.on'), 'Stil steckt im Bündel');
});

test('Planschbecken: Nur die Höhe der Karte ändert sich (pW, gy neu, das Becken an alten Pixeln) – auch das bricht ab', async () => {
  const { c: g } = karte(1);
  let ab = 0;
  g._interrupt = () => ab++;
  g._wait = async () => {
    if (g._a2PoolS && !ab) {
      g._H = 300;
      g._a2Scene();
    }
  };
  await g._a2PoolPlay();
  assert.equal(ab, 1);
});

// 0.48.1: Das Becken nimmt Rücksicht auf das, was schon am Boden steht (_a2Free über _groundBlocks): Auf der schmalen
// Karte steht das Windrad dicht rechts vom Heu, das Becken liegt dann rechts davon, und er steht trotzdem daneben.
test('Planschbecken: liegt nicht über dem Windrad (schmal: rechts davon), er steht daneben', () => {
  for (const geo of ['schmal', 'breit']) {
    const { c, G } = karte(1, { geo });
    const wh = new El();
    wh.offsetLeft = G.hayR - G.H * 0.07;
    wh.offsetWidth = G.H * 0.14;
    wh.parentElement = c._el.gifts;
    c._gtEls = new Map([[1, wh]]);
    for (let k = 0; k < 10; k++) {
      const P = c._a2PoolSpot();
      const msg = `(${geo}) ${JSON.stringify(P)}`;
      assert.ok(P.cx - P.w / 2 >= wh.offsetLeft + wh.offsetWidth - 0.01, `rechts vom Windrad ${msg}`);
      assert.ok(P.cx + P.w / 2 <= G.W, `im Bild ${msg}`);
      assert.ok(P.sx >= G.pW * 0.45 - 0.01 && P.sx <= G.xR + 0.01, msg);
      assert.ok(Math.abs(P.sx - P.cx) >= P.w / 2 + G.pW * 0.3 - 0.01, `er steht daneben ${msg}`);
    }
  }
});

// 0.48.1: Tippvorrang am Boden nach der Ebene (worldFront in src/logik/interaktion.js, aus _worldZones): Auf 380 px liegt
// der linke Beckenrand über dem Windrad, der Tipp gehört dem Becken; das Vogelhäuschen auf der hinteren Spur schlägt
// Knäuel und Windrad nicht.
test('Planschbecken: Ein Tipp auf den Rand über dem Windrad gehört dem Becken (vorn gewinnt, nicht pauschal Album 2)', () => {
  const wheel = { k: 'wheel', l: 140, t: 100, r: 170, b: 170, z: 12012 };
  const yarn = { k: 'yarn', l: 300, t: 150, r: 330, b: 172, z: 12012 };
  const pool = { k: 'pool', a2: true, l: 160, t: 130, r: 300, b: 172, z: 12016 };
  const feeder = { k: 'feeder', a2: true, l: 290, t: 60, r: 320, b: 160, z: 7000 };
  const alt = [wheel, yarn, pool, feeder];
  assert.equal(T.worldPick(165, 150, alt).k, 'wheel', 'bis 0.48.0: das Windrad');
  const Z = T.worldFront(alt);
  assert.equal(T.worldPick(165, 150, Z).k, 'pool');
  assert.equal(T.worldPick(310, 155, Z).k, 'yarn', 'das Häuschen hinten schlägt das Knäuel nicht');
  assert.equal(T.worldPick(150, 110, Z).k, 'wheel', 'wo nur das Windrad ist, bleibt es beim Windrad');
  // gleiche Ebene: Reihenfolge wie gegeben
  assert.deepEqual(plain(T.worldFront([{ k: 'a', z: 1 }, { k: 'b', z: 1 }, { k: 'c' }]).map((z) => z.k)), ['a', 'b', 'c']);
});

// 0.48.1 (Nachtrag E): Im Regen planscht er weiter (das darf er), fängt es aber an zu schneien, endet das Planschen
test('Planschbecken: Regen setzt ein – er planscht weiter; Schnee – die Aktion endet', () => {
  const { c } = karte(1);
  let ab = 0;
  c._interrupt = () => ab++;
  c._wx = {};
  c._a2PoolBusy = true;
  c._a2PoolMake(c._a2PoolSpot());
  c._wx = { wet: true, rain: 20 };
  c._a2Scene();
  assert.equal(ab, 0);
  c._wx = { snow: 1 };
  c._a2Scene();
  assert.equal(ab, 1);
  c._a2PoolBusy = false;
  c._a2PoolEnd(true);
});
