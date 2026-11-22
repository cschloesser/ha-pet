// Tests für die kleinen Beschäftigungen bei Regen (0.44): Tropfen fangen und Blattschirm kreiseln. node --test
// Wie schnee.test.mjs lädt die Datei das gebaute Bündel mit ein paar Attrappen in node, mit eigener Uhr (jetzt),
// Zeitgebern, die erst auf Zuruf laufen (klingeln), und einem Schalter für „Bewegung reduzieren“ (ruhe): Die echten
// Methoden _drops und _twirl laufen an einer Karte mit Attrappen-Elementen von Anfang bis Ende durch, oder sie
// werden an jeder Wartestelle abgebrochen. Für den Vergleich der Auswahl kommt das Bündel von 0.43.0 aus git dazu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execSync } from 'node:child_process';

const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
const quell = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// ---------- die Welt der Karte ----------
let T = null;
let jetzt = new Date(2026, 10, 5, 11).getTime();
const ruhe = { matches: false }; // prefers-reduced-motion: Die Karte liest es einmal beim Laden und behält das Objekt
const wecker = []; // { fn, aus }: Zeitgeber der Karte, laufen erst mit klingeln()
const zufall = { wert: 0.5, n: 0 }; // Math.random der Karte: fester Wert, Aufrufe gezählt
const gebaut = []; // alle Elemente, die die Karte mit document.createElement anlegt (t: wann)
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
      this.log?.push(`+${x}`);
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
// Ein Element, soweit die Beschäftigungen es anfassen: Klassen, Stil, Kinder
class Att {
  constructor() {
    this.classList = new Kl();
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.children = [];
    this.parentElement = null;
    this.offsetLeft = 0;
    this.offsetWidth = 0;
    this.teile = {};
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

  querySelector(sel) {
    return (this.teile[sel] ??= new Att());
  }

  querySelectorAll() {
    return [];
  }

  setAttribute() {}

  animate() {
    return { cancel() {} };
  }
}
const DOK = {
  hidden: false, addEventListener() {}, removeEventListener() {},
  createElement: () => {
    const el = new Att();
    el.t = jetzt;
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
  setTimeout: (fn) => {
    const w = { fn, aus: false };
    wecker.push(w);
    return w;
  },
  clearTimeout: (w) => {
    if (w && typeof w === 'object') w.aus = true;
  },
  setInterval: () => 0, clearInterval() {}, queueMicrotask, Date: Uhr, Math: Mathe, JSON, Promise, Intl, AbortController, performance,
  __pikaTest: (x) => (T = x),
}, { filename: 'pika-pet-card.js' });
// Alle gestellten Zeitgeber laufen lassen (Tropfen und Spritzer wegräumen, zeitgesteuerte Klassen nehmen)
const klingeln = () => {
  while (wecker.length) {
    const w = wecker.shift();
    if (!w.aus) w.fn();
  }
};
const plain = (v) => JSON.parse(JSON.stringify(v));

// Die Karte von 0.43.0 (aus git): Dort gab es bei Regen nur Pfütze und Schiffchen. Ohne git (z. B. ein ausgepacktes
// Archiv) werden die Vergleiche mit ihr übersprungen.
let TA = null;
try {
  const alt = execSync('git show 73c7868:pika-pet-card.js', { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
  vm.runInNewContext(alt, {
    window: { matchMedia: () => ({ matches: false }), customCards: [] },
    document: { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => new Att() },
    HTMLElement: class {}, customElements: { get: () => null, define() {} }, console: { info() {}, log() {}, warn() {}, debug() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController, performance,
    __pikaTest: (x) => (TA = x),
  }, { filename: 'pika-pet-card-0.43.0.js' });
} catch (e) { TA = null; }

// ---------- Karte mit der Geometrie von _layout, ohne Schleife ----------
// Die beiden neuen Beschäftigungen für Regen, aus den Tabellen gelesen
const NEU = T.MINI_PROG.rain.filter((a) => !['puddle', 'boat'].includes(a));
const GROESSEN = [[600, 248], [380, 184], [250, 184], [320, 400], [340, 248], [1000, 200]];
const REGEN = { wet: true, rain: 40 };
const buehne = (W = 600, Hs = 248, mehr = {}) => {
  const c = Object.create(T.PikaPetCard.prototype);
  const scene = new Att();
  Object.assign(scene, { clientWidth: W, clientHeight: Hs });
  const leer = () => {};
  Object.assign(c, {
    _el: new Proxy({ scene }, { get: (t, k) => (t[k] ??= new Att()) }), _g: { pW: 1 }, _W: 0, _Hs: 0, _inside: true, _cfg: {}, _arealKey: 'huegel',
    _planes: new Map(), _lift: 0, _poseName: 'out', _dir: 1, abbr: 0, eingefroren: 0, log: [], hopser: 0, spruenge: [],
    _btnFit: leer, _pose: leer, _layoutSky: leer, _layoutFest: leer, _layoutFriend: leer, _layoutBote: leer, _layoutGift: leer, _layoutSig: leer,
    _planeSnap: leer, _placePiles: leer, _restartCritters: leer, _flowerGiftPlace: leer,
    _interrupt() { this.abbr++; },
    _poops: () => ({ piles: [] }), _bote: null, _festPos: {}, _gtEls: null,
    _setX(x) {
      this._x = x;
      this.log.push(`x${x.toFixed(1)}`);
    },
    _freeze() { this.eingefroren++; },
    _liveX() { return this._x; },
    _planNow: () => jetzt,
    _say(t) { this.log.push(`„${t}“`); },
    _jump(k) {
      this.log.push(`Sprung ${k}`);
      this.spruenge.push(jetzt);
    },
    _hearts: leer, _mimik(m) { if (m) this.log.push(`Mimik ${m}`); }, _tvOn: leer, _kiteAway: leer, _easelAway: leer, _mouth: leer, _bubble: leer,
    _bubbleRefit: leer,
    _wx: { ...REGEN }, _hay: 0, _wind: 5, _seasonK: 'autumn', _fest: {}, ...mehr,
  });
  c._layout();
  c._inside = false;
  c._x = c._g.home + c._g.pW;
  c.log.length = 0;
  c._el.pika.classList.log = c.log;
  const hop = c._hopTo;
  c._hopTo = function (...a) {
    this.hopser++;
    return hop.apply(this, a);
  };
  return c;
};
// Fenster aus dem Tagesplan (wie _miniAt): feste Zahlen r aus der Nummer m, Beginn start
const zahlen = (m) => (n) => T.seedRnd('mini', m, 10 + n);
const fenster = (act, m, start = jetzt) => {
  const r = zahlen(m);
  return { id: `m${m}`, kind: 'mini', k: m, act, start, end: start + T.ACT_WALK + T.ACT_LEN[act](r), r };
};
// Nummer eines Fensters, dessen feste Zahlen ok(r) erfüllen
const suche = (ok, ab = 1) => {
  for (let m = ab; m < ab + 20000; m++) if (ok(zahlen(m))) return m;
  throw new Error('kein passendes Fenster');
};
class Abbruch extends Error {}
// Die Beschäftigung des Fensters S an der Karte c laufen lassen. Jedes Warten stellt nur die Uhr vor; stopp: bei
// diesem Warten (0, 1, 2 …) wird abgebrochen, wie es _interrupt mitten im Warten täte. bei(n, c): vor jedem Warten.
// Danach räumt das echte _cleanup auf, wie in der Schleife. → { fertig, n: Zahl der Wartestellen }
const lauf = async (c, S, { stopp = Infinity, bei = null, aufraeumen = true } = {}) => {
  let n = 0;
  c._slot = S;
  c._action = S.act;
  c._wait = (ms) => {
    bei?.(n, c);
    if (n++ === stopp) return Promise.reject(new Abbruch());
    jetzt += Math.max(0, ms);
    return Promise.resolve();
  };
  let fertig = true;
  try {
    await c[`_${S.act}`]();
  } catch (e) {
    if (!(e instanceof Abbruch)) throw e;
    fertig = false;
  }
  if (aufraeumen) c._cleanup();
  return { fertig, n };
};
// Was _cleanup am Pika stehen lassen darf: Blickrichtung, Spur, das Wetter (Blatt) und Klassen mit eigenem Zeitgeber
const BLEIBT = new Set(['left', 'lane1', 'lnd', 'happy', 'wet']);
const mit = (kl) => gebaut.filter((el) => el.classList.je.has(kl));
const anzahl = (log, was) => log.filter((e) => e === was).length;
const LAGE = { wet: false, rain: 0, storm: false, shelter: false, snowcover: false, cold: false, wind: 10, hayFull: false, winter: false };
// Was die Tabellen für ein Fenster festlegen (so steht es in logik/beschaeftigungen-klein.js): die Versuche beim
// Tropfenfangen und die Tropfenringe beim Kreiseln
const versuche = (r) => {
  const P = Array.from({ length: 3 + Math.floor(r(1) * 3) }, (_, i) => ({ hit: r(10 + i) < 0.62, hop: r(20 + i) < 0.6 }));
  if (!P.some((v) => v.hit)) P[P.length - 1].hit = true;
  return P;
};
const schnell = (r) => 1800 + r(1) * 1500;
const ringe = (r) => [1500, 1500, schnell(r)].map((len, st) => Math.ceil((len - 120) / [750, 500, 330][st]));
// Karte ohne Elemente, nur für die Auswahl (_miniAct, _miniAt, _actOk)
const wahl = (Tx, wx, mehr = {}) => {
  const c = Object.create(Tx.PikaPetCard.prototype);
  Object.assign(c, { _wx: wx, _hay: 0, _wind: 5, _seasonK: 'autumn', _fest: {}, _planNow: () => jetzt, ...mehr });
  return c;
};
// Die Wahl über tage Tage (360 Fenster je Tag) → { folge: je Fenster die Beschäftigung oder null, frei: die Fenster,
// in denen überhaupt eine kleine drankommen kann, n: wie oft was in den freien Fenstern }
const tage = (Tx, wx, mehr, n = 30) => {
  const c = wahl(Tx, wx, mehr);
  const m0 = Math.floor(jetzt / Tx.ACT_WIN.mini);
  const R = { folge: [], frei: 0, n: {} };
  for (let m = m0; m < m0 + n * 360; m++) {
    const a = c._miniAct(m);
    R.folge.push(a);
    if (!Tx.miniHas(m) || c._nearBig(Tx.miniStart(m))) continue;
    R.frei++;
    R.n[a] = (R.n[a] || 0) + 1;
  }
  return R;
};

// ---------- Auswahl ----------

test('Regen: Tropfen fangen und Blattschirm kreiseln stehen hinten in der Tabelle und nur im Regenprogramm', () => {
  // Die Reihenfolge von MINI_W ist Teil der Wahl: Neues kommt ans Ende, davor ändert sich nichts
  assert.deepEqual(plain(NEU), ['drops', 'twirl']);
  assert.deepEqual(plain(T.MINI_ACTS), ['rope', 'weights', 'gather', 'hula', 'yoyo', 'puste', 'purzel', 'stones', 'juggle', 'crown', 'glider', 'puddle',
    'boat', 'snowpika', 'angel', 'snowball', 'drops', 'twirl']);
  // trocken und bei Schnee bleibt das Programm, wie es war
  assert.deepEqual(plain(T.MINI_PROG.dry), ['rope', 'weights', 'gather', 'hula', 'yoyo', 'puste', 'purzel', 'stones', 'juggle', 'crown', 'glider']);
  assert.deepEqual(plain(T.MINI_PROG.snow), ['weights', 'hula', 'yoyo', 'purzel', 'juggle', 'glider', 'snowpika', 'angel', 'snowball']);
  assert.deepEqual(plain(T.MINI_PROG.rain), ['puddle', 'boat', 'drops', 'twirl']);
  for (const a of NEU) {
    assert.ok(T.MINI_W[a] > 0 && T.MINI_W[a] < T.MINI_W.boat, `${a}: Gewicht unter dem des Schiffchens`);
    assert.equal(T.MINI_PROG.dry.includes(a), false, `${a} nicht im Trockenen`);
    assert.equal(T.MINI_PROG.snow.includes(a), false, `${a} nicht bei Schnee`);
  }
  // Die Summe der Gewichte für Regen ist die von 0.43 (Pfütze 1,5 + Schiffchen 1,2 + „nichts“ 3): Die neuen haben
  // ihr Gewicht vom „nichts“ genommen, Pfütze und Schiffchen behalten ihre Fenster
  assert.deepEqual([T.MINI_W.puddle, T.MINI_W.boat], [1.5, 1.2]);
  assert.ok(Math.abs(T.MINI_PROG.rain.reduce((s, a) => s + T.MINI_W[a], T.MINI_REST) - 5.7) < 1e-9);
  // Jede Lage aus Schneedecke, Regen, Gewitter und „im Bau bleiben“: nur bei Regen ohne Schnee, nicht im Bau
  for (let bits = 0; bits < 32; bits++) {
    const L = { ...LAGE, snowcover: !!(bits & 1), wet: !!(bits & 2), rain: bits & 2 ? 40 : 0, storm: !!(bits & 4), shelter: !!(bits & 8), cold: !!(bits & 16) };
    const soll = L.rain > 0 && !L.snowcover && !L.shelter;
    for (const a of NEU) assert.equal(T.miniOk(a, L), soll, `${a} bei ${JSON.stringify(L)}`);
    // was bei einer Lage geht, steht in ihrem Programm (sonst käme es nie dran oder bliebe nach dem Wetterwechsel stehen)
    const prog = T.miniProg(L);
    if (soll) assert.equal(prog, 'rain');
    else for (const a of NEU) assert.ok(!prog || !T.MINI_PROG[prog].includes(a) || !T.miniOk(a, L), `${a}: ${prog}`);
  }
  // Wind, Kälte, Winter und voller Vorrat stören sie nicht (anders als Papierflieger, Blumenkranz und Blüte)
  for (const a of NEU) assert.equal(T.miniOk(a, { ...LAGE, ...REGEN, wind: 60, hayFull: true, winter: true, cold: true }), true, a);
  // An der Karte (_actOk) mit den Lagen aus der Wettertabelle: Regen ja; hört er auf, ist Schluss (WX_STOP bricht
  // dann ab); Starkregen, Hagel und Gewitter nein (er bleibt im Bau, wie bei Pfütze und Schiffchen), Schnee nein
  const c = wahl(T, {});
  const lage = (cond, schnee = false) => {
    const W = T.WEATHER[cond];
    return { rain: W.rain || 0, wet: (W.rain || 0) > 0 || !!W.flash, storm: !!W.storm, shelter: !!W.storm, snowcover: schnee };
  };
  for (const a of NEU) {
    assert.ok(T.WX_STOP.includes(a), `WX_STOP: ${a}`);
    c._wx = lage('rainy');
    assert.equal(c._actOk(a), true, a);
    for (const cond of ['cloudy', 'sunny', 'pouring', 'hail', 'lightning', 'lightning-rainy', 'snowy']) {
      c._wx = lage(cond, cond === 'snowy');
      assert.equal(c._actOk(a), false, `${a} bei ${cond}`);
    }
    c._wx = lage('rainy', true);
    assert.equal(c._actOk(a), false, `${a} bei Regen auf Schnee`);
    c._wx = lage('snowy-rainy', true);
    assert.equal(c._actOk(a), false, `${a} bei Schneeregen`);
  }
});

test('Regen: über viele Regentage kommt jede dran, nie dieselbe zweimal hintereinander, auf zwei Karten dieselbe; ein gutes Drittel der Fenster bleibt leer', () => {
  const a = wahl(T, { ...REGEN });
  const b = wahl(T, { ...REGEN });
  const m0 = Math.floor(jetzt / T.ACT_WIN.mini);
  const n = {};
  let prev = null;
  let folgen = 0;
  let frei = 0;
  for (let m = m0; m < m0 + 60 * 360; m++) {
    const act = a._miniAct(m);
    assert.equal(b._miniAct(m), act, `Fenster ${m}: beide Karten wählen dasselbe`);
    if (T.miniHas(m) && !a._nearBig(T.miniStart(m))) {
      frei++;
      n[act] = (n[act] || 0) + 1;
    }
    if (act === null) {
      prev = null;
      continue;
    }
    assert.ok(T.MINI_PROG.rain.includes(act), `${act} gehört nicht ins Regenprogramm`);
    if (prev !== null) {
      folgen++;
      assert.notEqual(act, prev, `Fenster ${m}: zweimal ${act}`);
    }
    prev = act;
  }
  assert.ok(folgen > 2000, `${folgen} Fenster mit Vorgänger`);
  assert.deepEqual(Object.keys(n).sort(), [...T.MINI_PROG.rain, 'null'].sort(), 'jede aus dem Regenprogramm kommt vor');
  const teil = (k) => n[k] / frei;
  // leer bleibt rund ein Drittel der Fenster, in denen eine kleine drankommen kann (bis 0.43: 57 %)
  assert.ok(teil('null') > 0.28 && teil('null') < 0.4, `leer: ${n.null} von ${frei}`);
  // die Pfütze bleibt die häufigste, keine beherrscht den Regentag, die neuen kommen je in gut jedem zehnten Fenster
  for (const act of T.MINI_PROG.rain) {
    assert.ok(act === 'puddle' || n[act] < n.puddle, JSON.stringify(n));
    assert.ok(teil(act) < 0.3, `${act}: ${n[act]} von ${frei}`);
  }
  for (const act of NEU) assert.ok(teil(act) > 0.08 && teil(act) < 0.16, `${act}: ${n[act]} von ${frei}`);
  // Gewitter, Starkregen, Regen auf Schnee: gar keine kleine (er bleibt im Bau bzw. es gibt kein Programm)
  const sturm = wahl(T, { wet: true, rain: 70, storm: true, shelter: true });
  const guss = wahl(T, { wet: true, rain: 95, storm: true, shelter: true });
  const matsch = wahl(T, { snowcover: true, wet: true, rain: 30 });
  for (let m = m0; m < m0 + 720; m++) {
    assert.equal(sturm._miniAct(m), null, `Gewitter, Fenster ${m}`);
    assert.equal(guss._miniAct(m), null, `Starkregen, Fenster ${m}`);
    assert.equal(matsch._miniAct(m), null, `Regen auf Schnee, Fenster ${m}`);
  }
  // trocken und bei Schnee kommen sie nie dran
  const trocken = wahl(T, {});
  const schnee = wahl(T, { snowcover: true, cold: true }, { _seasonK: 'winter' });
  for (let m = m0; m < m0 + 3000; m++) {
    assert.equal(NEU.includes(trocken._miniAct(m)), false, `trocken, Fenster ${m}`);
    assert.equal(NEU.includes(schnee._miniAct(m)), false, `Schnee, Fenster ${m}`);
  }
  // dasselbe Fenster auf zwei Karten: dieselbe Beschäftigung, derselbe Beginn, dieselbe Länge, dieselben festen Zahlen
  let gesehen = 0;
  for (let m = m0; m < m0 + 6000 && gesehen < 40; m++) {
    if (!NEU.includes(a._miniAct(m)) || a._nearBig(T.miniStart(m))) continue;
    const t = T.miniStart(m) + 1000;
    const [A, B] = [a._miniAt(t), b._miniAt(t)];
    assert.ok(A && B, `Fenster ${m}`);
    assert.deepEqual([A.id, A.act, A.start, A.end], [B.id, B.act, B.start, B.end]);
    assert.deepEqual([1, 2, 3, 6, 10, 11, 20, 40, 100].map(A.r), [1, 2, 3, 6, 10, 11, 20, 40, 100].map(B.r));
    gesehen++;
  }
  assert.equal(gesehen, 40);
});

test('Regen gegen 0.43.0: trocken und bei Schnee ändert sich keine Wahl; bei Regen bleiben Pfütze und Schiffchen in ihren Fenstern, leer statt 57 % nur noch ein Drittel', { skip: !TA && 'ohne git keine alte Karte' }, () => {
  // trocken und Schnee, auch mit den Schaltern (Wind, Kälte, Winter, voller Vorrat): über 30 Tage Fenster für Fenster dasselbe
  const lagen = [
    ['trocken', {}, { _seasonK: 'summer' }],
    ['trocken, Herbst, etwas Wind', {}, { _wind: 25 }],
    ['trocken mit Schaltern', { cold: true }, { _seasonK: 'winter', _wind: 50, _hay: T.HAY_MAX }],
    ['Schnee', { snowcover: true, cold: true }, { _seasonK: 'winter' }],
    ['Schnee bei Wind', { snowcover: true, cold: true }, { _seasonK: 'winter', _wind: 45 }],
    ['Gewitter', { wet: true, rain: 70, storm: true, shelter: true }, {}],
    ['Regen auf Schnee', { snowcover: true, wet: true, rain: 30 }, {}],
  ];
  for (const [name, wx, mehr] of lagen) {
    const [alt, neu] = [tage(TA, wx, mehr), tage(T, wx, mehr)];
    assert.equal(alt.folge.length, 10800);
    assert.deepEqual(neu.folge, alt.folge, name);
    for (const a of NEU) assert.equal(neu.folge.includes(a), false, `${name}: ${a}`);
  }
  assert.ok(tage(T, {}, { _seasonK: 'summer' }).folge.filter(Boolean).length > 5000, 'trocken ist fast jedes freie Fenster besetzt');
  // Regen, 60 Tage
  const [alt, neu] = [tage(TA, { ...REGEN }, {}, 60), tage(T, { ...REGEN }, {}, 60)];
  assert.equal(alt.frei, neu.frei);
  assert.deepEqual(Object.keys(alt.n).sort(), ['boat', 'null', 'puddle']);
  const leer = [alt.n.null / alt.frei, neu.n.null / neu.frei];
  assert.ok(leer[0] > 0.52 && leer[0] < 0.62, `0.43.0: ${leer[0]}`);
  assert.ok(leer[1] > 0.28 && leer[1] < 0.4, `jetzt: ${leer[1]}`);
  assert.ok(leer[0] - leer[1] > 0.18, `${leer}`);
  // Wo 0.43.0 Pfütze oder Schiffchen zeigt, zeigt die neue Karte dasselbe (bis auf seltene Ketten, siehe MINI_REST):
  // Ein Gerät, das noch nicht neu geladen ist, zeigt in den Fenstern der neuen Beschäftigungen nichts, sonst dasselbe
  let zeigte = 0;
  let anders = 0;
  let gefuellt = 0;
  for (const [i, a] of alt.folge.entries()) {
    const b = neu.folge[i];
    if (a !== null) {
      zeigte++;
      if (a !== b) anders++;
    } else if (b !== null) gefuellt++;
  }
  assert.ok(zeigte > 4000 && anders / zeigte < 0.005, `${anders} von ${zeigte} anders`);
  assert.ok(gefuellt > 2000, `${gefuellt} bisher leere Fenster gefüllt`);
  // Pfütze und Schiffchen kommen so oft wie bisher (ein paar mehr durch die Ketten)
  for (const a of ['puddle', 'boat']) assert.ok(Math.abs(neu.n[a] - alt.n[a]) / alt.n[a] < 0.03, `${a}: ${alt.n[a]} → ${neu.n[a]}`);
});

// ---------- Tabellen ----------

test('Regen: die Tabellen sind für die beiden neuen vollständig (Länge, Klassen, Größenänderung, Einstieg, Freunde, kein Tagebuch)', async () => {
  const raeumt = new Set(['walking', ...[/const all = \[([\s\S]*?)\];/, /const ACT_CLS = \[([\s\S]*?)\];/, /const CUTE_CLS = \[([\s\S]*?)\];/]
    .flatMap((re, i) => [...quell(['karte/lebensschleife.js', 'logik/beschaeftigungen.js', 'logik/interaktion.js'][i]).match(re)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))]);
  assert.ok(raeumt.size > 90, `nur ${raeumt.size} Klassen gefunden`);
  for (const a of NEU) {
    assert.equal(typeof T.PikaPetCard.prototype[`_${a}`], 'function', `Methode _${a}`);
    assert.ok(T.hasKey(T.ACT_LEN, a), `ACT_LEN.${a}`);
    for (const v of [0, 0.24, 0.26, 0.5, 0.61, 0.63, 0.999]) {
      const len = T.ACT_LEN[a](() => v);
      assert.ok(len >= 5000 && len <= 30000, `${a}: Hauptteil ${len} ms`);
    }
    assert.ok(T.WX_STOP.includes(a), `WX_STOP: ${a}`);
    // Beide rechnen mit Pixeln (Tropfen aufs Maul, Tropfenringe, der Hüpfer hinter dem Blatt her) und haben nicht
    // die ganze Zeit ein Requisit am Boden: Eine Größenänderung bricht sie über ACT_PX ab
    assert.equal(T.ACT_PX.has(a), true, `ACT_PX: ${a}`);
  }
  // Länge: Tropfen fangen 1,5 s und 2,4 s je Versuch (drei bis fünf), Kreiseln 8,3 bis 9,8 s, ob das Blatt abhebt oder nicht
  assert.deepEqual([0, 0.34, 0.67, 0.999].map((v) => T.ACT_LEN.drops(() => v)), [8700, 11100, 13500, 13500]);
  assert.deepEqual([0, 0.5].map((v) => T.ACT_LEN.twirl(() => v)), [8300, 9050]);
  // Die neuen laufen hier wirklich, in jeder Spielart: Jede Klasse, die sie dem Pika je geben, räumt _cleanup ab
  const gesetzt = new Set();
  for (const a of NEU) {
    for (const [still, m, wind] of [[false, 77, 5], [false, suche((r) => r(6) < 0.25), 5], [false, suche((r) => r(6) >= 0.6 && r(11) >= 0.62 && r(20) >= 0.6 && r(10) < 0.62), 30], [true, 77, 30]]) {
      ruhe.matches = still;
      gebaut.length = 0;
      const c = buehne(600, 248, { _wind: wind });
      const R = await lauf(c, fenster(a, m));
      ruhe.matches = false;
      klingeln();
      assert.equal(R.fertig, true);
      const je = [...c._el.pika.classList.je];
      assert.ok(je.length >= 4, `${a}: nur ${je} gesetzt`);
      for (const k of je) {
        assert.ok(raeumt.has(k) || BLEIBT.has(k), `${a}: Klasse ${k} räumt _cleanup nicht ab`);
        gesetzt.add(k);
      }
    }
  }
  // Jede ihrer eigenen Klassen (drops…, tw…) steht in ACT_CLS, hat eine Regel im Stil und wird von einer der beiden
  // Methoden auch gesetzt; umgekehrt steht jede solche Klasse aus dem Stil in ACT_CLS (sonst bliebe nach einem
  // Abbruch die Haltung stehen)
  const actCls = [...quell('logik/beschaeftigungen.js').match(/const ACT_CLS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const stil = quell('stil/beschaeftigungen.js');
  const eigene = actCls.filter((k) => /^(drops|twirl|tw-)/.test(k));
  assert.deepEqual(eigene, ['drops', 'drops-up', 'drops-st', 'drops-yum', 'drops-no', 'twirl', 'tw-go', 'tw-2', 'tw-3', 'tw-end', 'tw-off', 'tw-back']);
  for (const k of eigene) {
    assert.ok(new RegExp(`\\.${k}[ .:]`).test(stil), `Stil für .${k}`);
    assert.ok(gesetzt.has(k), `.${k} setzt keine der Methoden`);
  }
  for (const k of new Set([...stil.matchAll(/\.((?:drops|tw)-[a-z0-9]+)[ .:]/g)].map((m) => m[1]))) assert.ok(actCls.includes(k), `ACT_CLS: ${k} (aus dem Stil)`);
  // Einstieg: In das Tropfenfangen steigt ein später geladenes Gerät ein (es läuft im Takt der Planzeit), in das
  // Kreiseln nicht (gemeinsamer Beginn, wie beim Reifen)
  assert.equal(T.ACT_NOJOIN.has('drops'), false);
  assert.equal(T.ACT_NOJOIN.has('twirl'), true);
  for (const a of ['puddle', 'boat']) assert.equal(T.ACT_NOJOIN.has(a), false, a);
  // Kein neues Requisit in der Pika-Grafik: Sie nutzen nur, was dort schon ist (Blattschirm, Zunge, offenes Maul,
  // die Pfote vom Drachen), und das wird den Freunden schon abgenommen bzw. gehört zum Gesicht. In PROP_SEL kommt
  // dafür nichts dazu.
  const freunde = quell('karte/pino.js').match(/el\.querySelectorAll\('([^']+)'\)\.forEach\(\(n\) => n\.remove\(\)\)/)[1].split(', ');
  for (const s of ['.brolly', '.kpaw']) assert.ok(freunde.includes(s), `${s} fehlt in der Liste, die den Freunden die Requisiten abnimmt (pino.js)`);
  const grafik = quell('grafik/pika.js');
  for (const k of ['brolly', 'kpaw', 'tongue', 'omouth', 'mth', 'wmouth', 'hd', 'face']) assert.ok(new RegExp(`class="${k}[" ]`).test(grafik), `Pika-Grafik: .${k}`);
  // der Blattschirm ist so gebaut, wie der Stil ihn anfasst: Stiel, Blatt, Ader (drei Pfade), dann die Pfote
  assert.match(grafik, /<g class="brolly">\s*<path [^>]*\/>\s*<path [^>]*\/>\s*<path [^>]*\/>\s*<ellipse [^>]*\/>\s*<\/g>/);
  for (const s of T.PROP_SEL) assert.equal(/brolly|kpaw|tongue|mouth|leaf|drop/.test(s), false, `PROP_SEL: ${s}`);
  // nichts davon im Tagebuch und nichts in den Listen der Kleinigkeiten (wie die anderen kleinen)
  for (const a of NEU) {
    assert.equal(T.ACT_SMALL.includes(a), false, a);
    assert.equal(new RegExp(`\\b${a}\\b`).test(quell('logik/tagebuch.js')), false, `${a} steht nicht im Tagebuch`);
    assert.equal(new RegExp(`['"]${a}['"]`).test(quell('karte/tagebuch.js')), false, `${a} steht nicht im Tagebuch (Karte)`);
  }
});

test('Regen: Späteinstieg nach Plan – Tropfen fangen ja (solange es schon regnete), Blattschirm kreiseln nur gleich zu Beginn', () => {
  const NOW = jetzt;
  const c = Object.create(T.PikaPetCard.prototype);
  const S = { id: 'm5', kind: 'mini', k: 5, act: 'drops', start: NOW - 9000, end: NOW + 7000, r: () => 0.5 };
  Object.assign(c, {
    _g: {}, _asleep: false, _watched: () => true, _plan: {}, _planOk: true, _planStale: false, _planNow: () => NOW, _bigAt: () => null,
    _miniAt: () => S, _wx: { ...REGEN }, _hay: 0, _fest: {}, _seasonK: 'autumn', _wind: 5,
    _wxLog: [{ t: NOW - 2 * 36e5, c: 'rainy', T: 9 }],
  });
  assert.equal(c._slotNow(), S, 'Tropfen fangen läuft seit 9 s: einsteigen');
  S.end = NOW + 3000;
  assert.equal(c._slotNow(), null, 'kurz vor Schluss nicht mehr');
  S.end = NOW + 7000;
  // der Regen kam erst im Fenster: Die anderen haben dort schon etwas anderes gezeigt
  c._wxLog = [{ t: NOW - 36e5, c: 'cloudy', T: 9 }, { t: NOW - 3000, c: 'rainy', T: 9 }];
  assert.equal(c._slotNow(), null);
  c._wxLog = [{ t: NOW - 2 * 36e5, c: 'rainy', T: 9 }];
  // der Regen ist vorbei, oder es gießt: nichts
  c._wx = {};
  assert.equal(c._slotNow(), null);
  c._wx = { wet: true, rain: 95, storm: true, shelter: true };
  assert.equal(c._slotNow(), null);
  c._wx = { ...REGEN };
  S.act = 'twirl';
  assert.equal(c._slotNow(), null, 'Blattschirm kreiselt seit 9 s: nicht mehr einsteigen');
  S.start = NOW - 3000;
  assert.equal(c._slotNow(), S, 'Blattschirm hat eben begonnen: mitmachen');
});

// ---------- Ablauf ----------

test('Tropfen fangen: Ablauf – Blatt weglegen, drei bis fünf Versuche im Takt, gefangen oder auf die Nase, stolz zählen', async () => {
  const faelle = [
    ['drei Versuche', (r) => versuche(r).length === 3],
    ['vier Versuche, einer daneben', (r) => versuche(r).length === 4 && versuche(r).filter((v) => !v.hit).length === 1],
    ['fünf Versuche, alle gefangen', (r) => versuche(r).length === 5 && versuche(r).every((v) => v.hit)],
    ['gestreckt statt gehüpft', (r) => versuche(r).some((v) => v.hit && !v.hop) && versuche(r).some((v) => v.hit && v.hop)],
    ['erst der letzte sitzt', (r) => [0, 1, 2].every((i) => r(10 + i) >= 0.62) && versuche(r).length === 3],
  ];
  for (const [name, ok] of faelle) {
    const m = suche(ok);
    const P = versuche(zahlen(m));
    const treffer = P.filter((v) => v.hit).length;
    gebaut.length = 0;
    const c = buehne();
    const { pW, pH } = c._g;
    const S = fenster('drops', m);
    const t0 = jetzt;
    const T1 = S.start + T.ACT_WALK + 1500; // der erste Versuch
    assert.equal(S.end - S.start - T.ACT_WALK, 1500 + P.length * 2400, `${name}: Länge des Hauptteils`);
    const R = await lauf(c, S);
    assert.equal(R.fertig, true, name);
    // nach dem Hauptteil: zählen (1,8 s), Blatt aufheben (0,45 s), kurz stehen (0,4 s)
    assert.equal(jetzt - t0, S.end - t0 + 1800 + 450 + 400, `${name}: Dauer`);
    const log = c.log;
    const text = log.join(' ');
    // Blatt weglegen: bücken, es liegt hinter ihm im Gras, die Pfote ist frei (.drops blendet den Schirm aus)
    assert.ok(text.indexOf('+sniff') >= 0 && text.indexOf('+sniff') < text.indexOf('+drops'), name);
    const [blatt, ...mehr] = mit('aprop');
    assert.equal(mehr.length, 0, name);
    for (const k of ['leafp', 'on', 'off']) assert.ok(blatt.classList.je.has(k), `Blatt: ${k}`);
    assert.match(blatt.html, /<svg viewBox="0 0 64 22"/);
    const mitte = parseFloat(blatt.style.left) + parseFloat(blatt.style.width) / 2;
    const links = c._el.pika.classList.contains('left');
    // (Platz für beide aus _besideSpot: seine Mitte 0,45 Pika-Breiten vom Rand, das Blatt eine halbe Pika-Breite breit)
    assert.ok(Math.abs(Math.abs(mitte - c._x) - pW * 0.7) < 0.2, `${name}: Blatt bei ${mitte}, Pika bei ${c._x}`);
    assert.ok(mitte - pW * 0.25 >= c._g.hayR && mitte + pW * 0.25 <= c._g.rock.l, `${name}: Blatt zwischen Vorrat und Stein`);
    assert.equal(mitte > c._x, links, `${name}: das Blatt liegt hinter ihm`);
    assert.equal(blatt.classList.je.has('mir'), links, `${name}: gespiegelt, wenn er nach links schaut`);
    assert.equal(blatt.t, S.start + T.ACT_WALK + 450, `${name}: er legt es zur Planzeit ab`);
    // je Versuch: Kopf zurück und Zunge heraus, ein dicker Tropfen, Hüpfer oder Strecken
    assert.equal(anzahl(log, '+drops-up'), P.length, name);
    const tropfen = mit('bigdrop');
    assert.equal(tropfen.length, P.length, name);
    assert.deepEqual(tropfen.map((e) => e.classList.je.has('hit')), P.map((v) => v.hit), `${name}: gefangen oder daneben`);
    assert.deepEqual(tropfen.map((e) => e.t - T1), P.map((_, i) => i * 2400 + 300), `${name}: Tropfen im Takt der Planzeit`);
    for (const e of tropfen) {
      assert.equal(e.style['--fd'], '1100ms');
      assert.match(e.html, /^<svg viewBox="0 0 10 14"/);
      assert.ok(parseFloat(e.style['--fy']) < -pH * 0.5, 'er fällt von oben');
    }
    // Absprung: für einen gefangenen 270 ms vor dem Tropfen (dann ist er oben), daneben zu früh (640 ms nach
    // Beginn des Versuchs); am Ende ein Hüpfer vor Stolz
    const soll = P.flatMap((v, i) => (!v.hit ? [i * 2400 + 640] : v.hop ? [i * 2400 + 1400 - 270] : []));
    assert.deepEqual(c.spruenge.map((t) => t - T1), [...soll, P.length * 2400], `${name}: Absprünge`);
    assert.equal(anzahl(log, '+crouch'), soll.length, name);
    assert.equal(anzahl(log, '+drops-st'), P.filter((v) => v.hit && !v.hop).length, `${name}: gestreckt`);
    // der gefangene Tropfen zielt auf das Maul: im Hüpfer 0,27 Pika-Höhen höher als am Boden, gestreckt ein wenig
    const hoch = P.map((v, i) => parseFloat(tropfen[i].style.top));
    const boden = hoch.find((y, i) => !P[i].hit);
    for (const [i, v] of P.entries()) {
      if (!v.hit) assert.equal(hoch[i], boden, 'daneben: auf die Nase, am Boden');
      else if (boden != null) assert.ok(Math.abs(boden + pH * 0.062 - hoch[i] - pH * (v.hop ? 0.27 : 0.035)) < 0.2, `${name}: Versuch ${i} bei ${hoch[i]}, Nase ${boden}`);
      assert.ok(Math.abs(parseFloat(tropfen[i].style.left) - (c._x + (links ? -1 : 1) * pW * 0.27)) < pW * 0.03, 'über dem Maul');
    }
    // gefangen: „mmh!“, vergnügtes Wackeln; daneben: „plitsch!“, Spritzer von der Nase, Kopfschütteln
    assert.equal(anzahl(log, '+drops-yum'), treffer, name);
    assert.equal(anzahl(log, '+drops-no'), P.length - treffer, name);
    assert.equal(anzahl(log, '+crosseye'), P.length - treffer, name);
    assert.equal(log.filter((e) => /^„(mmh!|nass!|lecker!)“$/.test(e)).length, treffer, name);
    assert.equal(log.filter((e) => /^„(plitsch!|daneben!)“$/.test(e)).length, P.length - treffer, name);
    assert.equal(mit('sn').length, 4 * (P.length - treffer), `${name}: Spritzer`);
    // am Ende zählt er, was er erwischt hat
    const zahlwort = ['', 'Einen erwischt!', 'Zwei Stück!', 'Drei Stück!', 'Vier Stück!', 'Fünf Stück!'][treffer];
    assert.equal(log.filter((e) => /Stück|erwischt/.test(e)).join(), `„${zahlwort}“`, name);
    assert.ok(text.includes('Mimik proud'), name);
    assert.ok(text.lastIndexOf('+sniff') > text.indexOf(zahlwort), `${name}: danach hebt er das Blatt wieder auf`);
    // er bleibt an seinem Platz
    assert.equal(new Set(log.filter((e) => e[0] === 'x')).size, 1, name);
    assert.equal(c.hopser, 0);
    klingeln();
    assert.equal(c._el.acts.children.length + c._el.actsf.children.length + c._el.fx.children.length, 0, 'nichts bleibt liegen');
    assert.deepEqual([...c._el.pika.classList.s].filter((k) => k !== 'left'), []);
  }
  // „erst der letzte sitzt“: Die festen Zahlen sagten dreimal daneben, den letzten fängt er doch
  const m = suche(faelle[4][1]);
  assert.deepEqual(versuche(zahlen(m)).map((v) => v.hit), [false, false, true]);
  // ohne Regen (aus der Vorschau gestartet) hat er kein Blatt: Dann liegt auch keins im Gras
  gebaut.length = 0;
  const c = buehne(600, 248, { _wx: {} });
  await lauf(c, fenster('drops', 77));
  assert.equal(mit('aprop').length, 0);
  assert.equal(mit('bigdrop').length, versuche(zahlen(77)).length);
  klingeln();
});

test('Blattschirm kreiseln: Ablauf – drei Stufen, Tropfenringe, anhalten; manchmal hebt das Blatt ab, bei Wind öfter', async () => {
  // Fenster, in denen das Blatt nie (r(6) ≥ 0,6), nur bei Wind (0,25 … 0,6) oder immer (< 0,25) abhebt
  const nie = suche((r) => r(6) >= 0.6);
  const beiWind = suche((r) => r(6) >= 0.25 && r(6) < 0.6);
  const immer = suche((r) => r(6) < 0.25);
  const faelle = [[nie, 5, false], [nie, 45, false], [beiWind, 19, false], [beiWind, 20, true], [beiWind, 45, true], [immer, 0, true], [immer, 30, true]];
  const dauer = {};
  for (const [m, wind, hebt] of faelle) {
    for (const wd of [undefined, -1, 1]) {
      const name = `Fenster ${m}, Wind ${wind} km/h${wd ? ` nach ${wd < 0 ? 'links' : 'rechts'}` : ''}`;
      const r = zahlen(m);
      gebaut.length = 0;
      const c = buehne(600, 248, { _wind: wind, _windDir: wd });
      const { pW } = c._g;
      const S = fenster('twirl', m);
      const T0 = S.start + T.ACT_WALK;
      const t0 = jetzt;
      assert.ok(Math.abs(S.end - T0 - (700 + 3000 + schnell(r) + 2800)) < 0.01, `${name}: Länge des Hauptteils`);
      const R = await lauf(c, S);
      assert.equal(R.fertig, true, name);
      // beide Schlüsse dauern gleich lang: Danach noch 1,3 s
      assert.ok(Math.abs(jetzt - t0 - (S.end - t0 + 1300)) < 0.01, `${name}: Dauer ${jetzt - t0}`);
      dauer[m] ??= jetzt - t0;
      assert.ok(Math.abs(dauer[m] - (jetzt - t0)) < 0.01, `${name}: so lang wie bei jedem anderen Wind`);
      const log = c.log;
      const text = log.join(' ');
      // beide Pfoten an den Stiel, dann drei Stufen
      for (const k of ['+twirl', '+tw-go', '+tw-2', '+tw-3']) assert.equal(anzahl(log, k), 1, `${name}: ${k}`);
      assert.ok(text.indexOf('+twirl') < text.indexOf('+tw-go') && text.indexOf('+tw-go') < text.indexOf('+tw-2') && text.indexOf('+tw-2') < text.indexOf('+tw-3'));
      assert.match(text, /„(Kreisel!|dreh dich!|und rum!)“/);
      // er schaut mit dem Wind; ohne Windrichtung steht die Seite mit dem Fenster fest
      const dir = wd || (r(3) < 0.5 ? -1 : 1);
      // Tropfenringe zu festen Planzeiten: je Stufe dichter und mit mehr Tropfen (4, 5, 6)
      const [a, b, d] = ringe(r);
      const tr = mit('twdrop');
      const zeiten = [...new Set(tr.map((e) => e.t - T0))];
      const soll = [...Array.from({ length: a }, (_, i) => 700 + i * 750), ...Array.from({ length: b }, (_, i) => 2200 + i * 500),
        ...Array.from({ length: d }, (_, i) => 3700 + i * 330)];
      assert.deepEqual(zeiten.slice(0, soll.length), soll, `${name}: Ringe`);
      assert.equal(tr.length, a * 4 + b * 5 + d * 6 + (hebt ? 0 : 8), `${name}: Tropfen`);
      // die Tropfen sitzen links und rechts am Blattrand und fliegen nach außen, schnelle Ringe weiter
      const cx = c.log.find((e) => e[0] === 'x').slice(1) - 0 + dir * pW * (89.5 / 120 - 0.5);
      for (const e of tr) {
        const dx = parseFloat(e.style.left) - cx;
        assert.ok(Math.abs(dx) > pW * 0.19 && Math.abs(dx) <= pW * 0.3 + 0.1, `${name}: Tropfen ${dx} px neben der Blattmitte`);
        assert.equal(Math.sign(parseFloat(e.style['--dx'])), Math.sign(dx), 'nach außen');
        assert.ok(parseFloat(e.style['--dy']) > 0, 'und hinunter');
      }
      // abwechselnd rechts und links (ein Ring mit fünf Tropfen hat rechts einen mehr)
      const li = tr.filter((e) => parseFloat(e.style.left) < cx).length;
      assert.ok(li >= tr.length * 0.4 && li <= tr.length / 2, `${name}: ${li} von ${tr.length} Tropfen links`);
      const xs = [...new Set(log.filter((e) => e[0] === 'x').map((e) => Number(e.slice(1))))];
      if (hebt) {
        // der Wind hebt es aus den Pfoten: staunen, hinterherhüpfen (0,7 Pika-Breiten in Windrichtung), fangen
        for (const k of ['+tw-off', '+look-up', 'Mimik awe', '+crouch', '+tw-back']) assert.ok(text.includes(k), `${name}: ${k} fehlt`);
        assert.ok(text.indexOf('+tw-3') < text.indexOf('+tw-off') && text.indexOf('+tw-off') < text.indexOf('+tw-back'));
        assert.match(text, /„(hui!|oh!|mein Blatt!)“.*„(hab dich!|gefangen!|hiergeblieben!)“/);
        assert.equal(c.hopser, 1, name);
        assert.equal(xs.length, 2, `${name}: ${xs}`);
        assert.ok(Math.abs((xs[1] - xs[0]) * dir - pW * 0.7) < 0.2, `${name}: Hüpfer ${xs}`);
        assert.equal(c._el.pika.style['--twx'], '84.0px', 'so weit treibt das Blatt (in Einheiten der Pika-Grafik)');
        assert.equal(c._el.pika.classList.contains('left'), dir < 0, 'er schaut weiter mit dem Wind');
        // er springt 850 ms nach dem Abheben ab (nach dem Ducken) und hat es 620 ms später
        assert.equal(c.spruenge.length, 1);
        assert.ok(Math.abs(c.spruenge[0] - (S.end - 2800 + 850 + 180)) < 0.01, `${name}: Absprung`);
        assert.equal(/Ta-da|Kreisel! ♥|trocken/.test(text), false);
        assert.equal(log.includes('+crosseye') || log.includes('+tw-end'), false);
      } else {
        // anhalten: ein letzter Schwung Tropfen, kurz schwindlig, stolz
        for (const k of ['+tw-end', '+crosseye', '+tilt', 'Mimik proud']) assert.ok(text.includes(k), `${name}: ${k} fehlt`);
        assert.match(text, /„(Ta-da!|Kreisel! ♥|trocken!)“/);
        assert.equal(c.hopser, 0, name);
        assert.equal(c.spruenge.length, 0);
        assert.equal(xs.length, 1, `${name}: er bleibt stehen`);
        assert.equal(log.includes('+tw-off'), false);
        assert.equal(/hab dich|gefangen|hiergeblieben/.test(text), false);
        assert.equal(c._el.pika.classList.contains('left'), dir < 0);
      }
      klingeln();
      assert.equal(c._el.acts.children.length + c._el.actsf.children.length + c._el.fx.children.length, 0, 'nichts bleibt liegen');
      assert.deepEqual([...c._el.pika.classList.s].filter((k) => k !== 'left'), []);
    }
  }
  // die Schwelle: ab 20 km/h hebt es in 60 % der Fenster ab, darunter in einem Viertel
  let [still, windig] = [0, 0];
  for (let m = 1; m <= 400; m++) {
    for (const wind of [12, 28]) {
      const c = buehne(600, 248, { _wind: wind });
      await lauf(c, fenster('twirl', m));
      klingeln();
      if (c.hopser) wind < 20 ? still++ : windig++;
    }
  }
  assert.ok(still > 70 && still < 130, `bei wenig Wind in ${still} von 400 Fenstern`);
  assert.ok(windig > 200 && windig < 280, `bei Wind in ${windig} von 400 Fenstern`);
});

test('Regen: nichts ist gewürfelt – zwei Karten zeigen im selben Fenster dasselbe, egal was Math.random liefert', async () => {
  // im Quelltext der beiden Methoden und ihrer Helfer kommt kein freier Zufall vor
  const klein = quell('karte/beschaeftigungen-klein.js');
  for (const n of ['_bigDrop(vx, vy, up, hit, ms)', '_noseSplash(vx, vy, n, u)', '_twRing(n, far, u)', 'async _drops()', 'async _twirl()']) {
    const body = klein.slice(klein.indexOf(`\n  ${n} {`)).match(/\{([\s\S]*?)\n  \}\n/)[1];
    assert.ok(body.length > 200, n);
    assert.equal(/Math\.random|\brnd\(|\bpick\(|this\._splash\(|this\._puff\(/.test(body), false, `${n} würfelt`);
  }
  const logik = quell('logik/beschaeftigungen-klein.js');
  assert.equal(/Math\.random/.test(logik), false);
  for (const a of NEU) {
    for (const [m, wind] of [[300, 5], [301, 5], [302, 30], [303, 30], [suche((r) => r(6) < 0.25 && r(11) >= 0.62), 5], [suche((r) => r(6) >= 0.6 && r(10) >= 0.62), 30]]) {
      const logs = [];
      for (const wert of [0.03, 0.97]) {
        zufall.wert = wert;
        zufall.n = 0;
        gebaut.length = 0;
        const start = jetzt;
        const c = buehne(600, 248, { _wind: wind });
        await lauf(c, fenster(a, m, start));
        // (Herzchen sind hier still: Sie streuen auf jedem Gerät anders, wie überall)
        assert.equal(zufall.n, 0, `${a}: Math.random ${zufall.n}-mal gefragt`);
        const teile = gebaut.filter((e) => /bigdrop|twdrop|splash|leafp/.test([...e.classList.je].join(' ')))
          .map((e) => [[...e.classList.je].join(' '), e.t - start, e.style.left, e.style.top, e.style['--dx'], e.style['--dy'], e.style['--fy']]);
        assert.ok(teile.length >= 3, `${a}: ${teile.length} Teile`);
        logs.push(JSON.stringify([c.log, teile, jetzt - start, c._el.pika.style['--twx']]));
        klingeln();
      }
      assert.equal(logs[0], logs[1], `${a}, Fenster ${m}`);
    }
  }
  zufall.wert = 0.5;
  // auf einer anderen Kartengröße derselbe Ablauf (Sprüche, Haltungen, Reihenfolge), nur die Wege sind andere
  for (const a of NEU) {
    const m = suche((r) => r(6) < 0.25 && r(11) >= 0.62);
    const ablauf = [];
    for (const [W, Hs] of [[600, 248], [1000, 200], [380, 184]]) {
      const c = buehne(W, Hs);
      await lauf(c, fenster(a, m));
      // (ohne Wege, Blickrichtung und Gangart: Kurze Wege trippelt er, weite hoppelt er)
      ablauf.push(c.log.filter((e) => e[0] !== 'x' && !['+left', '+lnd', '+walking', '+trip', '+bighop'].includes(e)).join(' '));
      klingeln();
    }
    assert.equal(ablauf[1], ablauf[0], `${a}: 1000 × 200`);
    assert.equal(ablauf[2], ablauf[0], `${a}: 380 × 184`);
  }
});

// ---------- Abbruch, Größe, Einstieg, Bewegung reduzieren ----------

// Die Spielarten, in denen jede der beiden abgebrochen und in der Größe geändert wird: [Bewegung reduzieren, Fenster, Wind]
const spielarten = (a) => (a === 'drops'
  ? [[false, suche((r) => versuche(r).some((v) => !v.hit) && versuche(r).some((v) => v.hit && !v.hop) && versuche(r).some((v) => v.hit && v.hop)), 5], [true, 77, 5]]
  : [[false, suche((r) => r(6) >= 0.6), 5], [false, suche((r) => r(6) < 0.25), 30], [true, suche((r) => r(6) < 0.25), 30]]);

test('Regen: Abbruch an jeder Wartestelle lässt kein Blatt, keinen Tropfen, keine Haltung und keine Höhe zurück', async () => {
  for (const a of NEU) {
    for (const [still, m, wind] of spielarten(a)) {
      ruhe.matches = still;
      const voll = await lauf(buehne(600, 248, { _wind: wind }), fenster(a, m));
      klingeln();
      assert.equal(voll.fertig, true);
      assert.ok(voll.n >= 14, `${a}: nur ${voll.n} Wartestellen`);
      for (let stopp = 0; stopp < voll.n; stopp++) {
        gebaut.length = 0;
        const c = buehne(600, 248, { _wind: wind });
        const R = await lauf(c, fenster(a, m), { stopp });
        const wo = `${a}${still ? ' (Bewegung reduzieren)' : ''}, Fenster ${m}, Abbruch an Wartestelle ${stopp}`;
        assert.equal(R.fertig, false, wo);
        assert.equal(c._action, null, wo);
        assert.equal(c._lift, 0, wo);
        assert.equal(c._aprops?.size || 0, 0, wo);
        for (const el of mit('aprop')) assert.deepEqual([el.classList.contains('on'), el.classList.contains('off')], [false, true], wo);
        const stehen = [...c._el.pika.classList.s].filter((k) => !BLEIBT.has(k));
        assert.deepEqual(stehen, [], wo);
        assert.ok(c.eingefroren <= 1, wo);
        assert.ok(c._x >= c._g.pW * 0.45 - 0.01 && c._x <= c._g.xR + 0.01, `${wo}: steht bei ${c._x}`);
        // nach einer Sekunde ist auch im Baum nichts mehr davon da (Tropfen und Spritzer räumen sich selbst weg)
        klingeln();
        assert.equal(c._el.acts.children.length + c._el.actsf.children.length + c._el.fx.children.length, 0, wo);
        assert.deepEqual([...c._el.pika.classList.s].filter((k) => k !== 'left'), [], wo);
      }
    }
  }
  ruhe.matches = false;
});

test('Regen: ändert sich die Größe der Karte, bricht er ab; das Tropfenfangen nimmt er nach Plan wieder auf', async () => {
  for (const a of NEU) {
    const [, m, wind] = spielarten(a)[a === 'drops' ? 0 : 1];
    const voll = await lauf(buehne(600, 248, { _wind: wind }), fenster(a, m));
    klingeln();
    // an jeder Wartestelle: Größe ändern → _layout bricht ab (ACT_PX, und solange das Blatt im Gras liegt, auch deshalb)
    for (let stopp = 0; stopp < voll.n; stopp++) {
      const c = buehne(600, 248, { _wind: wind });
      await lauf(c, fenster(a, m), { stopp, aufraeumen: false });
      c.abbr = 0;
      Object.assign(c._el.scene, { clientWidth: 500, clientHeight: 248 });
      c._layout();
      assert.equal(c.abbr >= 1, true, `${a}, Wartestelle ${stopp}: nicht abgebrochen`);
      // derselbe Aufruf ohne Größenänderung: nichts
      c.abbr = 0;
      c._layout();
      assert.equal(c.abbr, 0);
      c._cleanup();
      klingeln();
    }
  }
  // danach: Das Tropfenfangen läuft im Takt der Planzeit weiter (wie die Pfütze), das Kreiseln ist für dieses Fenster vorbei
  assert.equal(T.ACT_NOJOIN.has('drops'), false);
  assert.equal(T.ACT_NOJOIN.has('twirl'), true);
});

test('Regen: auf schmalen Karten bleibt alles im Bild – das Blatt liegt in der Karte, der Hüpfer hinter dem Blatt her wird kürzer oder geht auf der Stelle', async () => {
  const huepft = {};
  const liegt = {};
  for (const [W, Hs] of GROESSEN) {
    for (const m of [77, 78, 79, 80, suche((r) => r(3) < 0.5 && r(2) < 0.2), suche((r) => r(3) >= 0.5 && r(2) > 0.8)]) {
      const wo = `${W} × ${Hs}, Fenster ${m}`;
      // Tropfen fangen
      gebaut.length = 0;
      let c = buehne(W, Hs);
      const { pW, xR } = c._g;
      await lauf(c, fenster('drops', m));
      const [blatt] = mit('aprop');
      const [l, w] = [parseFloat(blatt.style.left), parseFloat(blatt.style.width)];
      assert.ok(Math.abs(w - pW * 0.5) < 0.1, `${wo}: Blatt ${w} px breit`);
      assert.ok(l >= 0 && l + w <= W, `${wo}: Blatt ${l} … ${l + w}`);
      // es liegt wie Schnee-Pika und Steintürmchen zwischen Vorrat und Stein; nur auf den schmalsten Karten ragt es
      // (wie sie) ein Stück vor den Stein
      const { hayR, rock } = c._g;
      (liegt[`${W}×${Hs}`] ??= new Set()).add(l >= hayR - 0.1 && l + w <= rock.l + 0.1 ? 'frei' : l >= hayR - 0.1 ? 'vor dem Stein' : 'vor dem Vorrat');
      // 0,7 Pika-Breiten neben ihm (auf 4 px: Für weniger macht er keinen Schritt, _walkTo)
      assert.ok(Math.abs(Math.abs(l + w / 2 - c._x) - pW * 0.7) < 4.1, `${wo}: Blatt ${l + w / 2}, Pika ${c._x}`);
      for (const e of mit('bigdrop')) assert.ok(parseFloat(e.style.left) > 0 && parseFloat(e.style.left) < W, `${wo}: Tropfen bei ${e.style.left}`);
      for (const x of c.log.filter((e) => e[0] === 'x').map((e) => Number(e.slice(1)))) assert.ok(x >= pW * 0.45 - 0.1 && x <= xR + 0.1, `${wo}: Pika bei ${x}`);
      klingeln();
      // Blattschirm kreiseln, das Blatt hebt ab, mit dem Wind nach links und nach rechts
      for (const wd of [-1, 1]) {
        gebaut.length = 0;
        c = buehne(W, Hs, { _wind: 45, _windDir: wd });
        const S = fenster('twirl', m);
        const lang = S.end - S.start;
        const t0 = jetzt;
        await lauf(c, S);
        assert.ok(Math.abs(jetzt - t0 - lang - 1300) < 0.01, `${wo}: gleich lang wie überall`);
        const xs = [...new Set(c.log.filter((e) => e[0] === 'x').map((e) => Number(e.slice(1))))];
        for (const x of xs) assert.ok(x >= pW * 0.45 - 0.1 && x <= xR + 0.1, `${wo}: Pika bei ${x}`);
        const text = c.log.join(' ');
        const hebt = text.includes('+tw-off');
        if (hebt) {
          const weit = Number(c._el.pika.style['--twx'].replace('px', '')) / 120 * pW;
          (huepft[`${W}×${Hs}`] ??= new Set()).add(c.hopser ? 'hüpft' : 'auf der Stelle');
          if (c.hopser) {
            // er hüpft mit dem Wind, mindestens 0,3 und höchstens 0,7 Pika-Breiten, und das Blatt treibt genau so weit
            assert.equal(xs.length, 2, `${wo}: ${xs}`);
            assert.ok((xs[1] - xs[0]) * wd >= pW * 0.3 - 0.1 && (xs[1] - xs[0]) * wd <= pW * 0.7 + 0.1, `${wo}: Hüpfer ${xs}`);
            assert.ok(Math.abs(weit - Math.abs(xs[1] - xs[0])) < 0.1, `${wo}: Blatt ${weit} px, Hüpfer ${xs}`);
          } else {
            // kein Platz: Das Blatt steigt gerade hoch, er springt ihm auf der Stelle nach
            assert.equal(weit, 0, wo);
            assert.equal(xs.length, 1, wo);
            assert.ok(c.log.includes('Sprung hop1'), wo);
          }
          assert.match(text, /„(hab dich!|gefangen!|hiergeblieben!)“/);
        }
        klingeln();
      }
    }
  }
  // Platz für den Hüpfer (mindestens 0,3 Pika-Breiten) ist auf allen sechs Größen: Er tritt vorher so weit zurück wie nötig
  for (const [W, Hs] of GROESSEN) assert.deepEqual([...huepft[`${W}×${Hs}`]], ['hüpft'], `${W} × ${Hs}`);
  // das Blatt: bei 600 × 248, 380 × 184 und 1000 × 200 frei zwischen Vorrat und Stein, auf den schmaleren ragt es vor den Stein
  assert.deepEqual(Object.fromEntries(Object.entries(liegt).map(([k, v]) => [k, [...v].join()])),
    { '600×248': 'frei', '380×184': 'frei', '250×184': 'vor dem Stein', '320×400': 'vor dem Stein', '340×248': 'vor dem Stein', '1000×200': 'frei' });
  // Bleibt gar kein Weg (hier: die Wiese künstlich auf eine halbe Pika-Breite gekürzt), steigt das Blatt gerade hoch,
  // und er springt ihm auf der Stelle nach: gleich lang, dieselben Rufe
  for (const wd of [-1, 1]) {
    const c = buehne(250, 184, { _wind: 45, _windDir: wd });
    c._g.xR = c._g.pW * 0.6;
    const S = fenster('twirl', suche((r) => r(6) < 0.25));
    const t0 = jetzt;
    await lauf(c, S);
    const text = c.log.join(' ');
    assert.ok(text.includes('+tw-off') && text.includes('+tw-back') && text.includes('Sprung hop1'), text);
    assert.equal(c.hopser, 0);
    assert.equal(c._el.pika.style['--twx'], '0.0px');
    assert.match(text, /„(hab dich!|gefangen!|hiergeblieben!)“/);
    assert.ok(Math.abs(jetzt - t0 - (S.end - S.start) - 1300) < 0.01);
    for (const x of c.log.filter((e) => e[0] === 'x').map((e) => Number(e.slice(1)))) assert.ok(x >= c._g.pW * 0.45 - 0.1 && x <= c._g.xR + 0.1, `Pika bei ${x}`);
    klingeln();
  }
});

test('Tropfen fangen: ein Gerät, das später dazukommt, fängt im selben Takt mit und nennt am Ende dieselbe Zahl', async () => {
  const m = suche((r) => versuche(r).length === 5 && versuche(r).filter((v) => v.hit).length === 3);
  const P = versuche(zahlen(m));
  const start = jetzt;
  // Karte A von Anfang an
  gebaut.length = 0;
  const A = buehne();
  await lauf(A, fenster('drops', m, start));
  const blattA = mit('aprop')[0];
  const endeA = jetzt;
  const zahlA = A.log.find((e) => /Stück|erwischt/.test(e));
  assert.equal(zahlA, '„Drei Stück!“');
  klingeln();
  const T1 = start + T.ACT_WALK + 1500;
  // Karte B wird mitten im zweiten Versuch frisch geladen (noch von niemandem gesehen): Sie steht gleich am Platz,
  // das Blatt liegt schon da, und sie macht ab dem dritten Versuch mit
  for (const spaet of [2400 + 500, 2 * 2400 - 1, 2 * 2400 + 100, 3 * 2400 + 1300]) {
    jetzt = T1 + spaet;
    gebaut.length = 0;
    const B = buehne();
    Object.assign(B, { _blindAt: jetzt - 200, _blindFirst: true });
    const R = await lauf(B, fenster('drops', m, start));
    assert.equal(R.fertig, true);
    const ab = Math.ceil((spaet + 60) / 2400); // 60 ms steht er schon da, bevor es weitergeht (_goSpot)
    const wo = `${spaet} ms nach dem ersten Versuch`;
    assert.equal(B.log.includes('+sniff') && B.log.indexOf('+sniff') < B.log.indexOf('+drops'), false, `${wo}: kein Bücken zum Ablegen`);
    const blatt = mit('aprop')[0];
    assert.deepEqual([blatt.style.left, blatt.style.width], [blattA.style.left, blattA.style.width], `${wo}: das Blatt liegt an derselben Stelle`);
    assert.equal(B._x, A._x, wo);
    assert.equal(B.log.filter((e) => e[0] === 'x').length, 1, `${wo}: er steht gleich dort`);
    const tropfen = mit('bigdrop');
    assert.deepEqual(tropfen.map((e) => e.t - T1), P.slice(ab).map((_, i) => (ab + i) * 2400 + 300), `${wo}: im selben Takt`);
    assert.deepEqual(tropfen.map((e) => e.classList.je.has('hit')), P.slice(ab).map((v) => v.hit), wo);
    assert.equal(B.log.find((e) => /Stück|erwischt/.test(e)), zahlA, `${wo}: dieselbe Zahl, auch wenn er nicht alle sah`);
    assert.equal(jetzt, endeA, `${wo}: gleichzeitig fertig`);
    assert.equal(B.log.some((e) => /Regentropfen|Tropfen fangen|aaah/.test(e)), false, wo);
    klingeln();
  }
  jetzt = endeA + 60000;
});

test('Regen: mit „Bewegung reduzieren“ hüpft und kreiselt nichts – die Tropfen blenden am Maul ein, das Blatt steht schräg und hebt nie ab', async () => {
  ruhe.matches = true;
  try {
    for (const m of [77, suche((r) => versuche(r).some((v) => !v.hit) && versuche(r).some((v) => v.hit && !v.hop)), suche((r) => r(6) < 0.25)]) {
      // Tropfen fangen
      const P = versuche(zahlen(m));
      gebaut.length = 0;
      let c = buehne();
      let S = fenster('drops', m);
      let t0 = jetzt;
      let R = await lauf(c, S);
      assert.equal(R.fertig, true);
      let je = c._el.pika.classList.je;
      for (const k of ['drops-st', 'crouch']) assert.equal(je.has(k), false, `Tropfen fangen: ${k}`);
      assert.equal(c.log.some((e) => e.startsWith('Sprung')), false, 'kein Hüpfer');
      assert.equal(c.hopser, 0);
      assert.equal(mit('sn').length, 0, 'keine Spritzer');
      // die Tropfen kommen trotzdem (sie blenden ein, Stil), alle auf Höhe des Mauls bzw. der Nase am Boden
      const tropfen = mit('bigdrop');
      assert.equal(tropfen.length, P.length);
      assert.ok(new Set(tropfen.filter((e) => e.classList.je.has('hit')).map((e) => e.style.top)).size <= 1);
      assert.equal(anzahl(c.log, '+drops-up'), P.length);
      assert.equal(anzahl(c.log, '+drops-yum'), P.filter((v) => v.hit).length);
      assert.match(c.log.join(' '), /„(Einen erwischt!|\S+ Stück!)“/);
      assert.equal(jetzt - t0, S.end - t0 + 1800 + 450 + 400, 'so lang wie mit Bewegung');
      klingeln();
      // Blattschirm kreiseln, bei Sturm: Es hebt trotzdem nicht ab
      gebaut.length = 0;
      c = buehne(600, 248, { _wind: 60 });
      S = fenster('twirl', m);
      t0 = jetzt;
      R = await lauf(c, S);
      assert.equal(R.fertig, true);
      je = c._el.pika.classList.je;
      for (const k of ['tw-off', 'tw-back', 'crouch']) assert.equal(je.has(k), false, `Kreiseln: ${k}`);
      assert.equal(c.hopser, 0);
      assert.equal(c.log.some((e) => e.startsWith('Sprung')), false);
      assert.ok([...new Set(c.log.filter((e) => e[0] === 'x'))].length <= 1, 'er läuft nur hin und bleibt an seinem Platz');
      // je Stufe ein Ring (4, 5, 6 Tropfen), kein letzter Schwung
      assert.deepEqual([...new Set(mit('twdrop').map((e) => e.t - S.start - T.ACT_WALK))], [700, 2200, 3700]);
      assert.equal(mit('twdrop').length, 15);
      for (const k of ['twirl', 'tw-go', 'tw-2', 'tw-3', 'tilt']) assert.equal(je.has(k), true, `Kreiseln: ${k}`);
      assert.match(c.log.join(' '), /„(Ta-da!|Kreisel! ♥|trocken!)“/);
      assert.ok(Math.abs(jetzt - t0 - (S.end - t0 + 1300)) < 0.01, 'so lang wie mit Bewegung');
      klingeln();
    }
  } finally {
    ruhe.matches = false;
  }
  // der Stil nimmt unter „Bewegung reduzieren“ den Fall der Tropfen, das Wackeln und das Kreiseln heraus
  const stil = quell('stil/beschaeftigungen.js');
  const red = stil.slice(stil.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  for (const k of ['.bigdrop, .bigdrop.hit { animation: bdfade', '.drops-yum .hop, .drops-no .hd, .drops-yum .tongue { animation: none; }',
    '.tw-go .brolly > path + path { animation: none; transform: scaleX(.62); }', '.twdrop { animation: twfade']) assert.ok(red.includes(k), k);
});

test('Regen: Stil – der Blattschirm pendelt beim Kreiseln nicht, liegt beim Tropfenfangen im Gras, und die Dauern passen zu den Tabellen', () => {
  const stil = T.STYLES;
  // die Regel, die das Blatt bei Regen pendeln lässt (vier Klassen): Die fürs Kreiseln schlägt sie (fünf)
  assert.ok(stil.includes('.wet:not(.inside):not(.sleeping) .brolly { animation: brolly'));
  assert.ok(stil.includes('.pika.wet.twirl:not(.inside) .brolly { animation: none;'));
  assert.ok(stil.indexOf('.pika.wet.twirl:not(.inside) .brolly') > stil.indexOf('.wet:not(.inside):not(.sleeping) .brolly'));
  // Tropfen fangen: Schirm aus der Pfote; ohne Regen holt er ihn fürs Kreiseln hervor
  assert.ok(stil.includes('.pika.drops .brolly { display: none; }'));
  assert.ok(stil.includes('.pika.twirl .brolly { display: inline; }'));
  // Zunge und offenes Maul beim Tropfenfangen
  assert.match(stil, /\.drops-up \.tongue \{ display: inline; transform: [^}]*scale\(/);
  assert.match(stil, /\.drops-up \.omouth \{ display: inline;/);
  // drei Stufen: Dauer einer Umdrehung 900, 560, 320 ms
  assert.match(stil, /\.tw-go \{ --tw: 900ms; \}\s*\.tw-go\.tw-2 \{ --tw: 560ms; \}\s*\.tw-go\.tw-3 \{ --tw: 320ms; \}/);
  // Abheben in 850 ms; zurück in die Pfote mit Dauer und Kurve des Hüpfers (_hopTo)
  assert.match(stil, /\.tw-off \.brolly > path \{[^}]*transition: transform 850ms/);
  assert.ok(stil.includes('.tw-off.tw-back .brolly > path { transform: none; transition: transform .55s cubic-bezier(.3, .6, .4, 1); }'));
  assert.ok(quell('karte/alltag.js').includes("p.style.transition = 'transform .55s cubic-bezier(.3, .6, .4, 1)';"), 'Kurve von _hopTo');
});

test('Regen: die Vorschau hat Knöpfe für Tropfen fangen und Blattschirm kreiseln', () => {
  const html = fs.readFileSync(new URL('../preview.html', import.meta.url), 'utf8');
  const bar = html.slice(html.indexOf('id="bar-act"'), html.indexOf('Ende Aktivitäten'));
  for (const a of ['puddle', 'boat', ...NEU]) assert.match(bar, new RegExp(`<button data-act="${a}">[^<]+\\(Regen\\)</button>`), a);
  assert.ok(bar.includes('<button data-act="drops">Tropfen fangen (Regen)</button>'));
  assert.ok(bar.includes('<button data-act="twirl">Blattschirm kreiseln (Regen)</button>'));
});
