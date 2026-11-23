// Album 2: der Schlitten (Schatz t2 = 2) – Daten, Wahl der Aktionen (nur bei Schnee), Rodeln, Bauchrutscher, Gold,
// Tipp, Auspacken mit und ohne Schnee, Abbruch an jeder Stelle, reduzierte Bewegung, schmale Karte. Ohne echte Szene:
// Elemente sind Attrappen, Laufen und Hüpfen stellen nur die Stelle. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const plain = (v) => JSON.parse(JSON.stringify(v));

// Ein Element, soweit Schlitten, Wehe, Seil und Teilchen es anfassen
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
    this.hidden = false;
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
    return { left: 100, top: 150, right: 180, bottom: 190, width: 80, height: 40 };
  }
}

// Das gebaute Bündel in einer eigenen Welt: „Bewegung reduzieren“ schaltet ruhe.matches, Zeitgeber laufen nie von
// selbst (lauf() lässt die gestellten laufen)
const ruhe = { matches: false };
let wecker = [];
let takt = null;
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
  // Bild-für-Bild-Takt nur, wenn ein Test ihn einschaltet (takt = []): er sammelt die Rückrufe, bild() lässt einen laufen
  requestAnimationFrame: (f) => (takt ? takt.push(f) : 0), cancelAnimationFrame: (i) => takt && (takt[i - 1] = null),
  __pikaTest: (x) => (T = x),
}, { filename: 'pika-pet-card.js' });
const lauf = () => {
  const w = wecker;
  wecker = [];
  for (const x of w) if (!x.aus) x.fn();
};

// Karte mit Geometrie wie _layout (600 × 248 bzw. schmal 380 × 184), Album 2 mit dem Schlitten auf Stufe lv. ruf: was
// sie tut. wx: Wetter (Schnee liegt: { snowcover: true })
const GEO = {
  breit: { W: 600, H: 248, gy: 223.2, pW: 119.04, pH: 99.2, hayR: 222.68, hole: { l: 70.2, r: 121, cx: 95.6 }, rock: { l: 441.2, w: 148.8, cx: 515.6, lift: 49.1, ku: 1.488, top0: 154.75 }, xR: 546.4 },
  schmal: { W: 380, H: 184, gy: 165.6, pW: 88.32, pH: 73.6, hayR: 165.21, hole: { l: 52.1, r: 89.8, cx: 70.9 }, rock: { l: 259.6, w: 110.4, cx: 314.8, lift: 36.4, ku: 1.104, top0: 114.8 }, xR: 340.3 },
};
const karte = (lv = 1, { wx = { snowcover: true }, geo = 'breit', ...extra } = {}) => {
  const G = GEO[geo];
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const w = (lv >= 1 ? 4 : 0) | (lv >= 2 ? 0x400 : 0) | (lv >= 3 ? 0x40000 : 0);
  const leer = () => {};
  Object.assign(c, {
    _cfg: { gifts: true }, _W: G.W, _H: G.H, _x: 300, _dir: 1, _lift: 0, _lane: 0, _wx: wx, _wind: 0,
    _g: { gy: G.gy, pW: G.pW, pH: G.pH, hayR: G.hayR, hole: G.hole, rock: G.rock, xR: G.xR, home: G.hole.cx },
    _el: { pika: new El(), psay: new El(), fx: new El(), gifts: new El(), acts: new El(), birds: new El(), scene: new El() },
    _plan: { gift: { u: 255, v: 255, w, z: 4, o: 4, i: 34 } },
    _say: (t) => ruf.push(['sagt', t]), _wait: async () => {}, _face: (d) => (c._dir = d),
    _walkTo: async (x) => {
      c._face(x >= c._x ? 1 : -1);
      c._x = x;
      c._lift = 0;
      ruf.push(['geht', Math.round(x)]);
    },
    _hopTo: async (x, lift) => {
      c._x = x;
      c._lift = lift;
      ruf.push(['hüpft', Math.round(x), Math.round(lift)]);
    },
    _setX: (x) => (c._x = x),
    _nosePos: () => ({ x: c._x + c._dir * G.pW * 0.258, y: G.gy - c._lift - G.pH * 0.43 }),
    _mouth: (col, svg) => ruf.push(['maul', !!col]),
    _sparkle: leer, _mimik: leer, _happy: () => ruf.push(['freut']), _jump: leer, _peep: (x, y, t) => ruf.push(['piep', t]),
    _found: (k) => ruf.push(['entdeckt', k]), _away: () => false, _urlaubFern: () => false, _err: (w, e) => ruf.push(['fehler', w, String(e)]), _poops: () => ({ piles: [] }),
    ...extra,
  });
  c._giftScene = () => c._a2Scene();
  wecker = [];
  return { c, ruf, G };
};
// Abschnitte Bild für Bild durchspielen (sonst stellt der Test ohne requestAnimationFrame nur Anfang und Ende): für
// Schnee und Funken, die unterwegs entstehen
const bilder = (c) => {
  const drive = c._a2SledDrive;
  c._a2SledDrive = async function (ms, step) {
    for (let f = 0; f < 1; f += 0.04) step(f);
    return drive.call(this, ms, step);
  };
};
// Teilchen im Effekt-Layer nach Klasse
const fx = (c, k) => c._el.fx.kinder.filter((e) => e.cls.has(k));
// Aufgeräumt? Kein Zustand, kein Seil, keine eigenen Klassen am Pika, die Wehe blendet aus, der Schlitten ist weg
// oder blendet aus
const sauber = (c, msg = '') => {
  assert.ok(!c._a2SledS, `kein Schlitten-Zustand ${msg}`);
  assert.ok(c._el.gifts.kinder.filter((e) => e.cls.has('a2slrope')).every((e) => e.weg), `Seil weg ${msg}`);
  for (const k of ['a2sl-sit', 'a2sl-belly', 'carry']) assert.ok(!c._el.pika.cls.has(k), `${k} ${msg}`);
  assert.equal(c._el.pika.props['--a2sly'], undefined, msg);
  assert.equal(c._el.pika.props['--a2sla'], undefined, msg);
  assert.ok(c._el.acts.kinder.filter((e) => e.cls.has('a2sl-drift')).every((e) => e.cls.has('off')), `Wehe blendet aus ${msg}`);
  const el = c._a2Els?.get('sled');
  assert.ok(!el || el.cls.has('a2out'), `Schlitten weg ${msg}`);
  assert.ok(fx(c, 'a2sls').every((e) => e.weg) || !fx(c, 'a2sls').length, msg);
};

test('Schlitten: Daten wie die Schätze aus Album 1 (24 × 24, ohne id und class), gebaut, Monate, Aktionen gibt es', () => {
  const { c } = karte();
  const it = c._a2Item(2);
  assert.equal(it.key, 'sled');
  assert.equal(it.built, true);
  assert.deepEqual(plain(it.mo), [10, 11, 0, 1, 2]);
  assert.match(it.icon, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(it.icon, /\sid=|\sclass=|NaN|undefined/);
  for (const k of ['name', 'say', 'trick', 'gilt', 'use', 'gold']) assert.ok(it[k] && typeof it[k] === 'string', k);
  assert.equal(it.trick, 'Bauchrutscher');
  assert.ok(it.find?.t && it.find?.h);
  assert.ok(it.dbg.length >= 3);
  for (const [label, act, lv] of it.dbg) {
    assert.equal(typeof c[`_${act}`], 'function', label);
    assert.ok(lv >= 1 && lv <= 3);
  }
  // die Entdeckung kennt das Tagebuch
  assert.deepEqual([...T.findsParse('sled,feeder,unbekannt')].sort(), ['feeder', 'sled']);
  assert.equal(T.findsSer(new Set(['sled', 'feeder'])), 'feeder,sled');
});

test('Schlitten: Er mag ihn nur, wenn Schnee liegt; nicht bei Sturm, nachts, starkem Wind; Trick erst ab Stufe 2', () => {
  const { c } = karte(1);
  const acts = (wx = {}, cls = [], lv = 1) => {
    c._el.scene.cls = new Set(cls);
    return plain(c._a2SledActs({ wx }, lv));
  };
  assert.deepEqual(acts({}), []);
  assert.deepEqual(acts({ wet: true }), []);
  assert.deepEqual(acts({ snowcover: true }), [[0.5, 'a2SledPlay'], [0, 'a2SledBelly']]);
  assert.deepEqual(acts({ snowcover: true, storm: true }), []);
  // Regen auf dem Schnee: kein Rodelwetter (wie bei Schneeengel und Schneeball)
  assert.deepEqual(acts({ snowcover: true, wet: true }), []);
  assert.deepEqual(acts({ snowcover: true }, ['night']), []);
  assert.ok(acts({ snowcover: true }, ['dusk'])[0][0] < 0.5);
  c._wind = 45;
  assert.deepEqual(acts({ snowcover: true }), []);
  c._wind = 0;
  assert.ok(acts({ snowcover: true }, [], 2)[1][0] > 0);
  // über die Schnittstelle: mit Schnee dabei, ohne nicht
  c._el.scene.cls = new Set();
  assert.deepEqual(plain(c._a2Acts({ wx: { snowcover: true } })).map((a) => a[1]), ['a2SledPlay']);
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
});

test('Schlitten, Stufe 1: holen am Bau, zur Wehe ziehen, hinauf, oben drauf, rodeln bis vor den Vorrat, zurück zum Bau', async () => {
  const { c, ruf, G } = karte(1);
  let oben = null;
  let fahrt = null;
  const make = c._a2SledMake;
  c._a2SledMake = function (...a) {
    const S = make.apply(this, a);
    ruf.push(['schlitten', Math.round(a[0]), a[1]]);
    return S;
  };
  const drive = c._a2SledDrive;
  c._a2SledDrive = async function (ms, step) {
    await drive.call(this, ms, step);
    if (this._lift >= G.rock.lift - 0.01 && !oben) oben = { x: this._x, sled: this._a2SledS.x };
    if (this._a2SledS?.ride && ms > 800) fahrt = { x: this._x, lift: this._lift, ms };
  };
  await c._a2SledPlay();
  // geholt vor dem Eingang, Spitze zu ihm
  assert.deepEqual(ruf.find((r) => r[0] === 'schlitten'), ['schlitten', Math.round(G.hole.cx + G.pW * 0.05), 1]);
  // oben auf dem Stein angekommen, der Schlitten am Seil hinter ihm auf der Wehe
  assert.ok(oben && oben.x > G.rock.l + G.rock.ku * 30, 'oben');
  assert.ok(oben.sled < oben.x);
  // gerodelt: unten, vor dem Fuß der Wehe, rechts vom Vorrat
  assert.ok(fahrt, 'gefahren');
  assert.equal(fahrt.lift, 0);
  assert.ok(fahrt.x >= G.hayR + G.pW * 0.25 - 0.01 && fahrt.x < G.rock.l, `Halt bei ${fahrt.x}`);
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /juhuu|wiii|hui/.test(r[1])));
  // danach zurück zum Bau gezogen
  const geht = ruf.filter((r) => r[0] === 'geht');
  assert.equal(geht.at(-1)[1], Math.round(G.hole.cx + G.pW * 0.9));
  assert.equal(c._lift, 0);
  assert.equal(c._a2SledBusy, false);
  sauber(c);
  // nach dem Ausblenden ist das Element weg
  lauf();
  assert.equal(c._a2Els.has('sled'), false);
  assert.deepEqual(ruf.filter((r) => r[0] === 'fehler'), []);
});

test('Schlitten: ohne Schnee nur aus der Vorschau (_forced); Bauchrutscher erst ab Stufe 2', async () => {
  const { c, ruf } = karte(2, { wx: {} });
  await c._a2SledPlay();
  assert.deepEqual(ruf, []);
  c._forced = true;
  await c._a2SledPlay();
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /juhuu|wiii|hui/.test(r[1])));
  sauber(c);
  const { c: c1, ruf: r1 } = karte(1);
  await c1._a2SledBelly();
  assert.deepEqual(r1, []);
});

test('Schlitten, Stufe 2: Bauchrutscher – bäuchlings, weiter, am Ende plumpst er vom Schlitten in den Schnee', async () => {
  const { c, ruf, G } = karte(2);
  bilder(c);
  const seen = new Set();
  const drive = c._a2SledDrive;
  c._a2SledDrive = async function (ms, step) {
    await drive.call(this, ms, step);
    for (const k of this._el.pika.cls) seen.add(k);
  };
  await c._a2SledBelly();
  assert.ok(seen.has('a2sl-belly'), 'bäuchlings');
  assert.ok(!seen.has('a2sl-sit'));
  assert.ok(seen.has('lying'), 'rutscht vom Schlitten');
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /plumps|pfff|Gesicht/.test(r[1])));
  assert.ok(fx(c, 'a2slsp').length > 0, 'Schnee stiebt');
  assert.ok(c._x >= G.pW * 0.45);
  sauber(c);
});

test('Schlitten, Stufe 3: eine Spur aus Schneefunken hinter dem Schlitten; ohne Gold keine', async () => {
  const { c } = karte(3);
  bilder(c);
  await c._a2SledPlay();
  assert.ok(fx(c, 'a2sls').length >= 3, 'Funken');
  assert.ok(fx(c, 'a2slsp').length > 0, 'Schnee stiebt');
  const { c: c2 } = karte(2);
  bilder(c2);
  await c2._a2SledPlay();
  assert.equal(fx(c2, 'a2sls').length, 0);
  // verreist oder unsichtbar: auch golden keine
  const { c: c3 } = karte(3, { _away: () => true });
  bilder(c3);
  await c3._a2SledPlay();
  assert.equal(fx(c3, 'a2sls').length, 0);
});

test('Schlitten: Abbruch an jeder Stelle räumt auf; er steht danach am Boden oder noch oben (dann hüpft _step herunter)', async () => {
  for (const geo of ['breit', 'schmal']) {
    for (const lv of [1, 2, 3]) {
      for (let n = 1; n < 40; n++) {
        let k = 0;
        const { c } = karte(lv, { geo });
        c._wait = async () => {
          if (++k >= n) {
            c._ac = { signal: { aborted: true } };
            throw new Error('Cancel');
          }
        };
        const fertig = await (lv === 2 ? c._a2SledBelly() : c._a2SledPlay()).then(() => true, () => false);
        const msg = `(${geo}, Stufe ${lv}, Abbruch beim ${n}. Warten${fertig ? ', schon fertig' : ''})`;
        // _cleanup ruft den Hook danach auf, auch zweimal
        c._a2Cleanup();
        c._a2Cleanup();
        sauber(c, msg);
        assert.equal(c._a2SledBusy, false, msg);
        assert.ok(c._lift === 0 || c._lift > 1, msg);
        assert.ok(Number.isFinite(c._x) && c._x > 0 && c._x < GEO[geo].W, msg);
        if (fertig) break;
      }
    }
  }
});

test('Schlitten: Szene und Aufräumen mitten in der Aktion lassen ihn stehen; ohne Aktion ist er weg; Abhängen', async () => {
  const { c } = karte(1);
  let mitten = null;
  c._wait = async () => {
    if (!mitten && c._a2SledS?.tow) {
      c._a2Scene();
      c._a2Cleanup();
      mitten = !!c._a2SledS && c._a2Els.has('sled');
    }
  };
  await c._a2SledPlay();
  assert.equal(mitten, true);
  sauber(c);
  // Karte aus dem DOM mitten drin: alles sofort weg
  const { c: d } = karte(3);
  d._wait = async () => {
    if (d._a2SledS?.ride) {
      d._a2Detach();
      throw new Error('Cancel');
    }
  };
  await d._a2SledPlay().catch(() => {});
  assert.equal(d._a2SledS, null);
  assert.equal(d._a2Els.has('sled'), false);
  // ohne Schatz (Stufe 0) nichts
  const { c: n } = karte(0);
  await n._a2SledPlay();
  n._a2Scene();
  assert.equal(n._a2Els?.has('sled') ?? false, false);
});

test('Schlitten: Tipp darauf, solange er draußen ist – wackelt, Schnee stiebt, Entdeckung zählt; sonst keine Zone', async () => {
  const { c, ruf } = karte(1);
  let Z = null;
  c._wait = async () => {
    if (!Z && c._a2SledS?.tow) {
      Z = [];
      c._a2Zones(Z, { left: 0, top: 0 });
      ruf.push(['tipp', c._a2Tap(Z[0])]);
    }
  };
  await c._a2SledPlay();
  assert.deepEqual(Z.map((z) => [z.k, z.a2]), [['sled', true]]);
  assert.ok(ruf.some((r) => r[0] === 'tipp' && r[1] === true));
  assert.ok(ruf.some((r) => r[0] === 'piep' && /rutsch|klonk|schlitt/.test(r[1])));
  // nach der Aktion: keine Zone mehr (nach dem Ausblenden ist das Element weg), Tipp ohne Schlitten antwortet nicht
  lauf();
  const Z2 = [];
  c._a2Zones(Z2, { left: 0, top: 0 });
  assert.deepEqual(Z2, []);
  assert.equal(c._a2SledTap({ k: 'sled' }), false);
});

test('Schlitten auspacken: ohne Schnee zeigen und vertrösten, mit Schnee gleich eine kurze Fahrt (ohne Zurückziehen)', async () => {
  for (const lv of [1, 2, 3]) {
    const { c, ruf } = karte(lv, { wx: {} });
    await c._a2SledStow(lv);
    assert.ok(ruf.some((r) => r[0] === 'sagt' && /schneit|bald|im Schnee/.test(r[1])), `Stufe ${lv}`);
    assert.ok(!ruf.some((r) => r[0] === 'sagt' && /juhuu|wiii|hui/.test(r[1])));
    if (lv === 3) assert.ok(wecker.length > 0);
    sauber(c, `ohne Schnee, Stufe ${lv}`);
    const { c: s, ruf: rs, G } = karte(lv);
    bilder(s);
    await s._a2SledStow(lv);
    assert.ok(rs.some((r) => r[0] === 'sagt' && /juhuu|wiii|wuiii|hui|schneller/.test(r[1])), `mit Schnee, Stufe ${lv}`);
    assert.ok(!rs.some((r) => r[0] === 'geht' && r[1] === Math.round(G.hole.cx + G.pW * 0.9)), 'zieht ihn nicht zurück');
    if (lv === 3) assert.ok(fx(s, 'a2sls').length > 0);
    sauber(s, `mit Schnee, Stufe ${lv}`);
  }
});

test('Schlitten auspacken: Landet das Päckchen rechts vom Fuß der Wehe, geht er erst links davor; bei Regen nur zeigen', async () => {
  const { c, ruf, G } = karte(1);
  c._x = G.rock.cx;
  let erst = null;
  const make = c._a2SledMake;
  c._a2SledMake = function (x, fdir, pop) {
    erst ??= { x, fdir, pika: this._x };
    return make.call(this, x, fdir, pop);
  };
  await c._a2SledStow(1);
  const fuss = G.rock.l + c._a2SledU0() * G.rock.ku;
  assert.ok(erst.pika <= fuss - G.pW * 0.5 + 0.01, 'links vor der Wehe');
  assert.ok(erst.x < erst.pika && erst.fdir === 1, 'Schlitten links von ihm, Spitze zu ihm');
  assert.ok(ruf.some((r) => r[0] === 'sagt' && /juhuu|wiii|hui/.test(r[1])));
  sauber(c);
  const { c: n, ruf: rn } = karte(1, { wx: { snowcover: true, wet: true } });
  await n._a2SledStow(1);
  assert.ok(rn.some((r) => r[0] === 'sagt' && /schneit|bald|im Schnee/.test(r[1])));
  assert.equal(n._el.acts.kinder.length, 0, 'keine Wehe');
  sauber(n);
});

test('Schlitten, reduzierte Bewegung: keine Wehe, kein Hang, kein Stieben; er setzt sich an Ort und Stelle hinein', async () => {
  ruhe.matches = true;
  try {
    const { c, ruf } = karte(3);
    let sitzt = false;
    c._wait = async () => {
      if (c._a2SledS?.ride && c._el.pika.cls.has('a2sl-sit')) sitzt = Math.abs(c._a2SledAt().x - c._x) < 0.01;
    };
    await c._a2SledPlay();
    assert.equal(sitzt, true);
    assert.equal(c._el.acts.kinder.length, 0, 'keine Wehe');
    assert.ok(!ruf.some((r) => r[0] === 'hüpft'));
    assert.equal(fx(c, 'a2slsp').length, 0);
    assert.ok(fx(c, 'a2sls').every((e) => e.cls.has('still')));
    assert.ok(c._lift === 0);
    sauber(c);
    // (ohne Ausblenden: gleich weg)
    assert.equal(c._a2Els.has('sled'), false);
  } finally {
    ruhe.matches = false;
  }
});

test('Schlitten, schmale Karte: Die Wehe beginnt rechts vom Vorrat, die Fahrt endet vor ihrem Fuß, nie über den Rand', async () => {
  for (const geo of ['breit', 'schmal']) {
    const { c, G } = karte(2, { geo });
    let fuss = null;
    const drift = c._a2SledDrift;
    c._a2SledDrift = function () {
      drift.call(this);
      fuss = this._a2SledFoot();
      // die Wehe steigt zum Stein hin an, oben so hoch wie der Stein
      assert.equal(this._a2SledH(fuss - 5), 0);
      assert.ok(this._a2SledH(fuss + 20) > 0);
      assert.ok(Math.abs(this._a2SledH(G.rock.cx) - G.rock.lift) < 0.05);
      assert.ok(this._a2SledAng(fuss + 30) < 0, 'nach links geneigt');
    };
    await c._a2SledBelly();
    assert.ok(fuss >= G.hayR + G.pW * 0.6 - 0.01, `${geo}: Fuß ${fuss}`);
    assert.ok(c._x >= G.pW * 0.45 && c._x < fuss, `${geo}: Ende ${c._x}`);
  }
});

test('Schlitten auspacken nachts, wenn Schnee liegt: nur zeigen, aber er wartet nicht auf Schnee', async () => {
  for (const lv of [1, 3]) {
    const { c, ruf } = karte(lv);
    c._el.scene.classList.add('night');
    await c._a2SledStow(lv);
    const sagt = ruf.filter((r) => r[0] === 'sagt').map((r) => r[1]);
    assert.ok(!sagt.some((t) => /kein Schnee|wo bleibt|schneit/.test(t)), sagt.join(' / '));
    assert.ok(!sagt.some((t) => /juhuu|wiii|hui/.test(t)), 'keine Fahrt');
    sauber(c, `nachts, Stufe ${lv}`);
  }
});

// 0.48.1: Der Freund steht nicht auf der Wehe (_a2FrAside vor dem Rodeln): Sein nächster Weg führt ihn hinaus, auch der
// Weg, den er selbst wählt (_friendWalkTo mit _frKeepX).
test('Schlitten: Der Freund geht von der Wehe, bevor er rodelt; seine Wege enden nicht darauf', async () => {
  const { c, G } = karte(1);
  const foot = c._a2SledFoot();
  const fr = { kind: 'kirby', x: foot + 10, lane: 0, lift: 0, arrived: true, greeted: true, leaving: false, busy: false, el: { classList: { add() {}, remove() {} } } };
  c._fr = fr;
  c._cfg = { ...(c._cfg || {}), depth: true };
  c._frRange = () => [G.pW, G.W - G.pW * 0.4];
  let weg = 0;
  c._frTake = () => weg++;
  c._frFace = () => {};
  c._frSetX = (f, x) => (f.x = x);
  // er hoppelt (wie _friendIdle es täte) in den Bereich: Er landet am Rand
  const K = [];
  c._wait = async () => {
    if (c._frKeep && !K.length) {
      K.push(...c._frKeep);
      await c._friendWalkTo(fr, foot + 5, 1, async () => {});
    }
  };
  await c._a2SledPlay({ short: true });
  assert.ok(weg >= 1, 'beiseite gebeten');
  assert.ok(K.length === 2 && K[0] < foot && K[1] > foot, JSON.stringify(K));
  // (auf 600 px reicht die Wiese links nicht ganz: so weit hinaus wie möglich, am Ende des Auslaufs)
  assert.ok(fr.x < foot - G.pW && fr.x <= K[0] + G.pW * 0.45, 'draußen: ' + fr.x + ' ' + JSON.stringify(K));
  assert.equal(c._frKeepX(fr.x, ...c._frRange()), fr.x);
  c._a2Cleanup(); // (wie _cleanup am Ende der Aktion)
  assert.equal(c._frKeep, null, 'nach dem Rodeln frei');
});

// 0.48.1: Der Schlitten, den er nach dem Auspacken (ohne Schnee) neben sich stellt, steht nicht vor der Tür des Baus und
// nicht vor der Laterne, die dort brennt.
test('Schlitten auspacken ohne Schnee: nicht vor Bautür und Laterne geparkt', async () => {
  const { c, G } = karte(1, { wx: {} });
  const lat = { parentElement: c._el.gifts, offsetLeft: G.hole.r + 6, offsetWidth: 22, style: {} };
  c._gtEls = new Map([[1, lat]]);
  c._x = G.hole.r + G.pW * 0.95;
  let S = null;
  c._wait = async () => {
    S ??= c._a2SledS && { x: c._a2SledS.x };
  };
  await c._a2SledStow(1);
  const { w } = c._a2SledDim();
  const pad = G.H * 0.015;
  const frei = (l, r) => S.x + w / 2 <= l - pad + 0.01 || S.x - w / 2 >= r + pad - 0.01;
  assert.ok(S && frei(G.hole.l, G.hole.r), 'nicht vor der Tür: ' + JSON.stringify(S));
  assert.ok(frei(lat.offsetLeft, lat.offsetLeft + lat.offsetWidth), 'nicht vor der Laterne');
});

// Takt einschalten: wartend() zählt die angeforderten Bilder, bild() lässt sie laufen
const taktAn = () => {
  takt = [];
  const wartend = () => takt.filter(Boolean).length;
  const bild = () => {
    const F = takt.map((f, i) => [f, i]).filter(([f]) => f);
    for (const [, i] of F) takt[i] = null;
    for (const [f] of F) f(performance.now());
  };
  return { wartend, bild };
};

// 0.48.1: Der Takt läuft nur, solange sich etwas bewegen kann (ein Abschnitt oder das Seil im Maul), und liest die Nase
// je Bild einmal
test('Schlitten: Bild-für-Bild-Takt nur, solange sich etwas bewegt; die Nase einmal je Bild', async () => {
  const { c } = karte(1);
  const { wartend, bild } = taktAn();
  try {
    let nase = 0;
    const np = c._nosePos;
    c._nosePos = () => (nase++, np());
    const S = c._a2SledMake(300, 1);
    assert.equal(wartend(), 1);
    bild();
    assert.equal(wartend(), 0, 'liegt still: kein Takt');
    c._a2SledHold(true);
    assert.equal(wartend(), 1, 'Seil im Maul: Takt');
    nase = 0;
    bild();
    assert.equal(nase, 1, 'Nase einmal je Bild (Ziehen und Stellen)');
    assert.equal(wartend(), 1);
    c._a2SledHold(false);
    bild();
    assert.equal(wartend(), 0);
    // ein Abschnitt startet ihn wieder, danach ruht er
    let n = 0;
    c._wait = async () => {
      bild();
      bild();
    };
    await c._a2SledDrive(500, () => n++);
    assert.ok(n >= 3, 'Bilder während des Abschnitts');
    bild();
    assert.equal(wartend(), 0);
    assert.equal(S.fm, null);
    c._a2SledEnd(true);
  } finally {
    takt = null;
  }
});
