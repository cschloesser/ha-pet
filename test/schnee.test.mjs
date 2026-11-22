// Tests für die kleinen Beschäftigungen bei liegendem Schnee (0.43): Schneeengel und Schneeball. node --test
// Wie pika.test.mjs lädt die Datei das gebaute Bündel mit ein paar Attrappen in node. Dazu kommen eine eigene Uhr
// (jetzt), Zeitgeber, die erst auf Zuruf laufen (klingeln), und ein Schalter für „Bewegung reduzieren“ (ruhe): Damit
// laufen die echten Methoden _angel und _snowball an einer Karte mit Attrappen-Elementen von Anfang bis Ende durch,
// oder sie werden an jeder Wartestelle abgebrochen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8');
const quell = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// ---------- die Welt der Karte ----------
let T = null;
let jetzt = new Date(2026, 11, 5, 11).getTime();
const ruhe = { matches: false }; // prefers-reduced-motion: Die Karte liest es einmal beim Laden und behält das Objekt
const wecker = []; // { fn, aus }: Zeitgeber der Karte, laufen erst mit klingeln()
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
// Alle gestellten Zeitgeber laufen lassen (Requisit entfernen, Flöckchen wegräumen, zeitgesteuerte Klassen nehmen)
const klingeln = () => {
  while (wecker.length) {
    const w = wecker.shift();
    if (!w.aus) w.fn();
  }
};
const plain = (v) => JSON.parse(JSON.stringify(v));

// ---------- Karte mit der Geometrie von _layout, ohne Schleife ----------
// Die kleinen Beschäftigungen nur für Schnee außer dem Schnee-Pika (der hat seine Tests in pika.test.mjs): heute
// Schneeengel und Schneeball. Aus den Tabellen gelesen: Eine weitere läuft durch dieselben Tests (Ablauf bis zum
// Ende, Abbruch an jeder Wartestelle, Größenänderung, fester Zufall, Tabellen).
const NEU = T.MINI_PROG.snow.filter((a) => !T.MINI_PROG.dry.includes(a) && a !== 'snowpika');
const GROESSEN = [[600, 248], [380, 184], [250, 184], [320, 400], [340, 248], [1000, 200]];
const buehne = (W = 600, Hs = 248) => {
  const c = Object.create(T.PikaPetCard.prototype);
  const scene = new Att();
  Object.assign(scene, { clientWidth: W, clientHeight: Hs });
  const leer = () => {};
  Object.assign(c, {
    _el: new Proxy({ scene }, { get: (t, k) => (t[k] ??= new Att()) }), _g: { pW: 1 }, _W: 0, _Hs: 0, _inside: true, _cfg: {}, _arealKey: 'huegel',
    _planes: new Map(), _lift: 0, _poseName: 'out', _dir: 1, abbr: 0, eingefroren: 0, log: [], hopser: 0,
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
    _jump(k) { this.log.push(`Sprung ${k}`); },
    _hearts: leer, _mimik(m) { if (m) this.log.push(`Mimik ${m}`); }, _tvOn: leer, _kiteAway: leer, _easelAway: leer, _mouth: leer, _bubble: leer,
    _bubbleRefit: leer,
    _wx: { snowcover: true, cold: true }, _hay: 0, _wind: 5, _seasonK: 'winter', _fest: {},
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
const fenster = (act, m, start = jetzt) => {
  const r = (n) => T.seedRnd('mini', m, 10 + n);
  return { id: `m${m}`, kind: 'mini', k: m, act, start, end: start + T.ACT_WALK + T.ACT_LEN[act](r), r };
};
// Nummer eines Fensters, dessen feste Zahlen ok(r) erfüllen
const suche = (ok, ab = 1) => {
  for (let m = ab; m < ab + 5000; m++) if (ok((n) => T.seedRnd('mini', m, 10 + n))) return m;
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
// Was _cleanup am Pika stehen lassen darf: Blickrichtung, Spur und Klassen mit eigenem Zeitgeber (_cls, _happy)
const BLEIBT = new Set(['left', 'lane1', 'lnd', 'happy']);
// Die Requisiten am Boden, die bei diesem Lauf angelegt wurden
const requisiten = () => gebaut.filter((el) => el.classList.je.has('aprop'));
const zahl = (s, re) => Number(String(s).match(re)?.[1]);
const LAGE = { wet: false, rain: 0, storm: false, shelter: false, snowcover: false, cold: false, wind: 10, hayFull: false, winter: false };

// ---------- Auswahl ----------

test('Schnee: Schneeengel und Schneeball stehen hinten in der Tabelle und nur im Schneeprogramm', () => {
  // Die Reihenfolge von MINI_W ist Teil der Wahl: Neues kommt ans Ende, davor ändert sich nichts
  assert.deepEqual(plain(NEU), ['angel', 'snowball']);
  assert.deepEqual(plain(T.MINI_ACTS), ['rope', 'weights', 'gather', 'hula', 'yoyo', 'puste', 'purzel', 'stones', 'juggle', 'crown', 'glider', 'puddle',
    'boat', 'snowpika', 'angel', 'snowball']);
  // trocken und bei Regen bleibt das Programm, wie es war
  assert.deepEqual(plain(T.MINI_PROG.dry), ['rope', 'weights', 'gather', 'hula', 'yoyo', 'puste', 'purzel', 'stones', 'juggle', 'crown', 'glider']);
  assert.deepEqual(plain(T.MINI_PROG.rain), ['puddle', 'boat']);
  for (const a of NEU) {
    assert.ok(T.MINI_W[a] > 0 && T.MINI_W[a] < T.MINI_W.snowpika, `${a}: Gewicht unter dem des Schnee-Pikas`);
    assert.equal(T.MINI_PROG.snow.includes(a), true, `${a} im Schneeprogramm`);
    assert.equal(T.MINI_PROG.dry.includes(a), false, `${a} nicht im Trockenen`);
    assert.equal(T.MINI_PROG.rain.includes(a), false, `${a} nicht bei Regen`);
  }
  // Jede Lage aus Schneedecke, Regen, Gewitter und „im Bau bleiben“: nur bei Schnee ohne Regen und Sturm
  for (let bits = 0; bits < 32; bits++) {
    const L = { ...LAGE, snowcover: !!(bits & 1), wet: !!(bits & 2), rain: bits & 2 ? 30 : 0, storm: !!(bits & 4), shelter: !!(bits & 8), cold: !!(bits & 16) };
    const soll = L.snowcover && !L.wet && !L.storm && !L.shelter;
    for (const a of NEU) assert.equal(T.miniOk(a, L), soll, `${a} bei ${JSON.stringify(L)}`);
    // was bei einer Lage geht, steht in ihrem Programm (sonst käme es nie dran oder bliebe nach dem Wetterwechsel stehen)
    const prog = T.miniProg(L);
    if (soll) assert.equal(prog, 'snow');
    else for (const a of NEU) assert.ok(!prog || !T.MINI_PROG[prog].includes(a) || !T.miniOk(a, L), `${a}: ${prog}`);
  }
  // Wind und voller Vorrat stören sie nicht (anders als Papierflieger und Blüte)
  for (const a of NEU) assert.equal(T.miniOk(a, { ...LAGE, snowcover: true, wind: 60, hayFull: true, winter: true }), true, a);
  // An der Karte (_actOk): Taut der Schnee oder regnet es darauf, ist Schluss (WX_STOP bricht dann ab)
  const c = Object.create(T.PikaPetCard.prototype);
  Object.assign(c, { _hay: 0, _fest: {}, _seasonK: 'winter', _wind: 8 });
  for (const a of NEU) {
    assert.ok(T.WX_STOP.includes(a), `WX_STOP: ${a}`);
    c._wx = { snowcover: true, cold: true };
    assert.equal(c._actOk(a), true, a);
    c._wx = {};
    assert.equal(c._actOk(a), false, `${a} nach dem Tauen`);
    c._wx = { snowcover: true, wet: true, rain: 30 };
    assert.equal(c._actOk(a), false, `${a} bei Regen auf Schnee`);
    c._wx = { snowcover: true, storm: true, shelter: true };
    assert.equal(c._actOk(a), false, `${a} bei Gewitter`);
  }
});

test('Schnee: über viele Schneetage kommt jede Schnee-Beschäftigung dran, nie dieselbe zweimal hintereinander, auf zwei Karten dieselbe', () => {
  const karte = (wx) => {
    const c = Object.create(T.PikaPetCard.prototype);
    Object.assign(c, { _wx: wx, _hay: 0, _wind: 5, _seasonK: 'winter', _fest: {}, _planNow: () => jetzt });
    return c;
  };
  const a = karte({ snowcover: true, cold: true });
  const b = karte({ snowcover: true, cold: true });
  const m0 = Math.floor(jetzt / T.ACT_WIN.mini);
  const tage = 30;
  const n = {};
  let prev = null;
  let folgen = 0;
  for (let m = m0; m < m0 + tage * 360; m++) {
    const act = a._miniAct(m);
    assert.equal(b._miniAct(m), act, `Fenster ${m}: beide Karten wählen dasselbe`);
    if (act === null) {
      prev = null;
      continue;
    }
    assert.ok(T.MINI_PROG.snow.includes(act), `${act} gehört nicht ins Schneeprogramm`);
    if (prev !== null) {
      folgen++;
      assert.notEqual(act, prev, `Fenster ${m}: zweimal ${act}`);
    }
    prev = act;
    n[act] = (n[act] || 0) + 1;
  }
  assert.ok(folgen > 3000, `${folgen} Fenster mit Vorgänger`);
  assert.deepEqual(Object.keys(n).sort(), [...T.MINI_PROG.snow].sort(), 'jede aus dem Schneeprogramm kommt vor');
  const alle = Object.values(n).reduce((s, v) => s + v, 0);
  // die neuen etwa so oft wie Hula-Hoop, der Schnee-Pika bleibt die häufigste
  for (const act of NEU) assert.ok(n[act] / alle > 0.07 && n[act] / alle < 0.16, `${act}: ${n[act]} von ${alle}`);
  assert.ok(Object.entries(n).every(([act, v]) => act === 'snowpika' || v < n.snowpika), JSON.stringify(n));
  // Regen auf Schnee, Gewitter: gar keine kleine
  const regen = karte({ snowcover: true, wet: true, rain: 30 });
  const sturm = karte({ snowcover: true, storm: true, shelter: true });
  for (let m = m0; m < m0 + 720; m++) {
    assert.equal(regen._miniAct(m), null, `Regen auf Schnee, Fenster ${m}`);
    assert.equal(sturm._miniAct(m), null, `Gewitter, Fenster ${m}`);
  }
  // ohne Schnee kommen sie nie dran, und das trockene Programm kennt sie nicht
  const trocken = karte({});
  for (let m = m0; m < m0 + 3000; m++) assert.equal(NEU.includes(trocken._miniAct(m)), false, `trocken, Fenster ${m}`);
  // dasselbe Fenster auf zwei Karten: dieselbe Beschäftigung, derselbe Beginn, dieselbe Länge, dieselben festen Zahlen
  let gesehen = 0;
  for (let m = m0; m < m0 + 3000 && gesehen < 40; m++) {
    if (!NEU.includes(a._miniAct(m)) || a._nearBig(T.miniStart(m))) continue;
    const t = T.miniStart(m) + 1000;
    const [A, B] = [a._miniAt(t), b._miniAt(t)];
    assert.ok(A && B, `Fenster ${m}`);
    assert.deepEqual([A.id, A.act, A.start, A.end], [B.id, B.act, B.start, B.end]);
    assert.deepEqual([1, 2, 3, 4, 6, 7, 20, 25].map(A.r), [1, 2, 3, 4, 6, 7, 20, 25].map(B.r));
    gesehen++;
  }
  assert.equal(gesehen, 40);
});

// ---------- Tabellen ----------

test('Schnee: die Tabellen sind für jede kleine Beschäftigung vollständig (Länge, Klassen, Requisiten, Freunde, Einstieg)', async () => {
  const raeumt = new Set(['walking', ...[/const all = \[([\s\S]*?)\];/, /const ACT_CLS = \[([\s\S]*?)\];/, /const CUTE_CLS = \[([\s\S]*?)\];/]
    .flatMap((re, i) => [...quell(['karte/lebensschleife.js', 'logik/beschaeftigungen.js', 'logik/interaktion.js'][i]).match(re)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))]);
  assert.ok(raeumt.size > 80, `nur ${raeumt.size} Klassen gefunden`);
  for (const a of T.MINI_ACTS) {
    assert.equal(typeof T.PikaPetCard.prototype[`_${a}`], 'function', `Methode _${a}`);
    assert.ok(T.hasKey(T.ACT_LEN, a), `ACT_LEN.${a}`);
    for (const v of [0, 0.29, 0.31, 0.5, 0.999]) {
      const len = T.ACT_LEN[a](() => v);
      assert.ok(len >= 5000 && len <= 30000, `${a}: Hauptteil ${len} ms`);
    }
    assert.ok(T.WX_STOP.includes(a), `WX_STOP: ${a}`);
  }
  // Die neuen laufen hier wirklich: Jede Klasse, die sie dem Pika je geben, räumt _cleanup ab; solange er nach
  // Pixeln steht oder läuft, steht ein Requisit am Boden (dann bricht eine Größenänderung ab) oder sie stehen in ACT_PX
  for (const a of NEU) {
    for (const still of [false, true]) {
      ruhe.matches = still;
      gebaut.length = 0;
      const c = buehne();
      const am = [];
      const R = await lauf(c, fenster(a, 77), { bei: (n, k) => am.push(k._aprops?.size || 0) });
      ruhe.matches = false;
      assert.equal(R.fertig, true);
      const je = [...c._el.pika.classList.je];
      assert.ok(je.length >= 4, `${a}: nur ${je} gesetzt`);
      for (const k of je) assert.ok(raeumt.has(k) || BLEIBT.has(k), `${a}: Klasse ${k} räumt _cleanup nicht ab`);
      const ohne = am.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      assert.ok(T.ACT_PX.has(a) || (ohne.length <= 1 && ohne.every((i) => i === am.length - 1)),
        `${a}: an Wartestelle ${ohne} von ${am.length} steht kein Requisit, und ${a} fehlt in ACT_PX`);
    }
  }
  // Was die Pika-Grafik an Requisiten enthält, kramt er hervor (PROP_SEL), und den Freunden wird es abgenommen:
  // Sie sind aus derselben Grafik gebaut und trügen es sonst mit sich herum
  const grafik = quell('grafik/pika.js');
  const gruppen = ['ACT_BACK', 'ACT_FRONT'].flatMap((n) => [...grafik.match(new RegExp(`const ${n} = \`([\\s\\S]*?)\`;`))[1]
    .matchAll(/^ {6}<g class="([\w-]+)(?: [\w-]+)*">(?:<g class="([\w-]+)")?/gm)].map((m) => (m[1] === 'hd' ? m[2] : m[1])));
  assert.ok(gruppen.length >= 17 && gruppen.includes('hoop') && gruppen.includes('dcrown') && gruppen.includes('sboat'), `${gruppen}`);
  const freunde = quell('karte/pino.js').match(/el\.querySelectorAll\('([^']+)'\)\.forEach\(\(n\) => n\.remove\(\)\)/)[1].split(', ');
  for (const g of new Set(gruppen)) {
    assert.ok(freunde.includes(`.${g}`), `.${g} fehlt in der Liste, die den Freunden die Requisiten abnimmt (pino.js)`);
    if (g !== 'arms') assert.ok(T.PROP_SEL.includes(`.${g}`), `.${g} fehlt in PROP_SEL`);
  }
  for (const s of T.PROP_SEL) assert.ok(freunde.includes(s), `${s} aus PROP_SEL fehlt in pino.js`);
  // Jede Klasse, die der Stil der Beschäftigungen am Pika kennt (.klasse .teil), und die eine der neuen Methoden
  // setzt, steht in ACT_CLS: sonst bliebe nach einem Abbruch die Haltung stehen
  const actCls = [...quell('logik/beschaeftigungen.js').match(/const ACT_CLS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const stil = quell('stil/beschaeftigungen.js');
  for (const k of ['angel-dn', 'angel-go', 'angel-up', 'sb-pat', 'sb-push', 'sb-lean']) {
    assert.ok(actCls.includes(k), `ACT_CLS: ${k}`);
    assert.ok(stil.includes(`.${k} .`), `Stil für .${k}`);
  }
  for (const k of new Set([...stil.matchAll(/\.((?:angel|sb)-[a-z]+) \./g)].map((m) => m[1]))) assert.ok(actCls.includes(k), `ACT_CLS: ${k} (aus dem Stil)`);
  // Einstieg: In den Schneeball steigt ein später geladenes Gerät ein (er läuft nach der Planzeit), in den Engel nicht
  assert.equal(T.ACT_NOJOIN.has('angel'), true);
  assert.equal(T.ACT_NOJOIN.has('snowball'), false);
  assert.equal(T.ACT_NOJOIN.has('snowpika'), false);
  // nichts davon im Tagebuch und nichts in den Listen der Kleinigkeiten (wie die anderen kleinen)
  for (const a of NEU) {
    assert.equal(T.ACT_SMALL.includes(a), false, a);
    assert.equal(new RegExp(`\\b${a}\\b`).test(quell('logik/tagebuch.js')), false, `${a} steht nicht im Tagebuch`);
  }
});

test('Schnee: Späteinstieg nach Plan – Schneeball ja (solange der Schnee schon lag), Schneeengel nur gleich zu Beginn', () => {
  const NOW = jetzt;
  const c = Object.create(T.PikaPetCard.prototype);
  const S = { id: 'm5', kind: 'mini', k: 5, act: 'snowball', start: NOW - 9000, end: NOW + 7000, r: () => 0.5 };
  Object.assign(c, {
    _g: {}, _asleep: false, _watched: () => true, _plan: {}, _planOk: true, _planStale: false, _planNow: () => NOW, _bigAt: () => null,
    _miniAt: () => S, _wx: { snowcover: true, cold: true }, _hay: 0, _fest: {}, _seasonK: 'winter', _wind: 5,
    _wxLog: [{ t: NOW - 2 * 36e5, c: 'snowy', T: -2 }],
  });
  assert.equal(c._slotNow(), S, 'Schneeball läuft seit 9 s: einsteigen');
  S.end = NOW + 3000;
  assert.equal(c._slotNow(), null, 'kurz vor Schluss nicht mehr');
  S.end = NOW + 7000;
  // der Schnee kam erst im Fenster: Die anderen haben dort schon etwas anderes gezeigt
  c._wxLog = [{ t: NOW - 36e5, c: 'cloudy', T: -2 }, { t: NOW - 3000, c: 'snowy', T: -2 }];
  assert.equal(c._slotNow(), null);
  c._wxLog = [{ t: NOW - 2 * 36e5, c: 'snowy', T: -2 }];
  // getaut: nichts
  c._wx = {};
  assert.equal(c._slotNow(), null);
  c._wx = { snowcover: true, cold: true };
  S.act = 'angel';
  assert.equal(c._slotNow(), null, 'Schneeengel läuft seit 9 s: nicht mehr einsteigen');
  S.start = NOW - 3000;
  assert.equal(c._slotNow(), S, 'Schneeengel hat eben begonnen: mitmachen');
});

// ---------- Ablauf ----------

test('Schneeengel: Ablauf, zwei oder drei Schwünge, der Abdruck wächst und verweht', async () => {
  for (const sweeps of [2, 3]) {
    const m = suche((r) => 2 + Math.floor(r(1) * 2) === sweeps);
    gebaut.length = 0;
    const c = buehne();
    const S = fenster('angel', m);
    const t0 = jetzt;
    const R = await lauf(c, S);
    assert.equal(R.fertig, true);
    assert.equal(S.end - S.start - T.ACT_WALK, 6100 + sweeps * 1500, 'Länge des Hauptteils');
    // er beginnt zur Planzeit und ist mit dem Hauptteil zum Ende des Fensters fertig; danach bleibt der Abdruck 3–5 s
    const dauer = jetzt - t0;
    assert.ok(dauer >= S.end - t0 + 3000 + 1600 && dauer <= S.end - t0 + 5000 + 1600 + 400, `${dauer} ms`);
    const log = c.log.join(' ');
    for (const k of ['+look-b', '+look-f', '+angel-dn', '+angel-go', '+angel-up', 'Mimik proud', 'Sprung hop1']) assert.ok(log.includes(k), `${k} fehlt: ${log}`);
    assert.match(log, /„(Ein|Mein) Schneeengel!/);
    assert.ok(log.indexOf('+angel-dn') < log.indexOf('+angel-go') && log.indexOf('+angel-go') < log.indexOf('+angel-up'));
    assert.equal(c.hopser, 1, 'ein Hüpfer zur Seite');
    // ein Abdruck, erst leer, dann Bauch und Kopf (b), dann Flügel (w), die mit jedem Schwung wachsen, am Ende verweht (drift)
    const [el, ...mehr] = requisiten();
    assert.equal(mehr.length, 0);
    for (const k of ['angelp', 'on', 'b', 'w', 'drift', 'off']) assert.ok(el.classList.je.has(k), `Abdruck: ${k}`);
    assert.equal(el.style['--aw'], '1.00', 'nach dem letzten Schwung sind die Flügel ganz da');
    assert.match(el.html, /class="ap-b"[\s\S]*<ellipse[\s\S]*<ellipse/);
    // Er liegt mitten auf dem Abdruck und schaut ihn danach von der Seite an
    const xs = c.log.filter((e) => e[0] === 'x').map((e) => Number(e.slice(1)));
    const mitte = parseFloat(el.style.left) + parseFloat(el.style.width) / 2;
    assert.ok(Math.abs(xs[0] - mitte) < 0.2, `liegt bei ${xs[0]}, Abdruck bei ${mitte}`);
    const seite = xs[xs.length - 1];
    assert.ok(Math.abs(seite - mitte) >= parseFloat(el.style.width) / 2 + c._g.pW * 0.4 - 0.2, 'steht neben dem Abdruck');
    assert.equal(c._el.pika.classList.contains('left'), seite > mitte, 'schaut zum Abdruck');
    // Schnee stiebt: beim Plumpsen und bei jedem halben Schwung
    assert.equal(gebaut.filter((e) => e.classList.je.has('snowy')).length, 4 + sweeps * 4);
    klingeln();
    assert.equal(c._el.acts.children.length + c._el.fx.children.length, 0, 'nichts bleibt liegen');
    assert.deepEqual([...c._el.pika.classList.s].filter((k) => k !== 'left'), []);
  }
});

test('Schneeball: Ablauf, drei Größen, Spur – und manchmal rollt er davon', async () => {
  for (const run of [false, true]) {
    const m = suche((r) => (r(6) < 0.3) === run && r(3) < 0.5);
    gebaut.length = 0;
    const c = buehne();
    const { pW, pH, hayR, rock } = c._g;
    const S = fenster('snowball', m);
    assert.equal(S.end - S.start - T.ACT_WALK, run ? 12640 : 11100, 'Länge des Hauptteils');
    const t0 = jetzt;
    // die Kugel an jeder Wartestelle: wohin sie unterwegs ist (Ziel der Überblendung) und wie groß sie wird
    const kugel = [];
    const R = await lauf(c, S, {
      bei: () => {
        const ball = gebaut.find((e) => e.classList.je.has('sb-ball'));
        const size = gebaut.find((e) => e.classList.je.has('sb-size'));
        if (ball?.style.transform) kugel.push([zahl(ball.style.transform, /translateX\((-?[\d.]+)px\)/), zahl(size.style.transform, /scale\(([\d.]+)\)/)]);
      },
    });
    assert.equal(R.fertig, true);
    const dauer = jetzt - t0;
    assert.ok(dauer >= S.end - t0 + 3000 + 700 && dauer <= S.end - t0 + 5000 + 700 + 100, `${dauer} ms`);
    const log = c.log.join(' ');
    for (const k of ['+sniff', '+sb-pat', '+sb-push', '+walking', '+trip', '+spat', '+sb-lean']) assert.ok(log.includes(k), `${k} fehlt: ${log}`);
    assert.match(log, /„[sS]o groß!/);
    assert.equal(/halt|Halt|bleib hier/.test(log), run, 'nur wenn sie davonrollt, ruft er ihr nach');
    assert.equal(c.hopser, run ? 2 : 0, 'er hüpft ihr hinterher');
    assert.equal(log.includes('Mimik awe'), run);
    // ein Requisit: Spur und Kugel darin, zwischen Vorrat und Stein
    const [el, ...mehr] = requisiten();
    assert.equal(mehr.length, 0);
    assert.ok(el.classList.je.has('sbp') && el.classList.je.has('off'));
    const [l, w] = [parseFloat(el.style.left), parseFloat(el.style.width)];
    const track = gebaut.find((e) => e.classList.je.has('sb-track'));
    const weg = parseFloat(track.style.width);
    assert.ok(weg > pW && weg <= pW * 1.5 + 0.1, `Weg ${weg} px bei Pika-Breite ${pW}`);
    assert.equal(track.style.transform, 'scaleX(1.000)', 'die Spur reicht am Ende bis zur Kugel');
    // die Kugel: wächst in drei Stufen (Radius 0,10 / 0,17 / 0,25 Pika-Höhen), rollt dabei nur vorwärts
    const rMax = parseFloat(el.style.height) / 2;
    assert.ok(Math.abs(w - weg - 2 * rMax) < 0.2, 'das Requisit überspannt Weg und Kugel');
    const stufen = [...new Set(kugel.map((k) => Math.round(((k[1] * rMax) / pH) * 1000) / 1000))];
    assert.deepEqual(stufen.slice(0, 4), [0, 0.1, 0.17, 0.25]);
    assert.deepEqual(stufen.slice(4), run ? [0.274] : [], 'zu groß geworden');
    for (let i = 1; i < kugel.length; i++) assert.ok(kugel[i][0] >= kugel[i - 1][0] - 1e-9 && kugel[i][1] >= kugel[i - 1][1] - 1e-9, `Schritt ${i}: ${kugel[i]}`);
    assert.ok(Math.abs(kugel[kugel.length - 1][0] - weg) < 0.11, 'sie kommt am Ende des Wegs an');
    // er bleibt hinter der Kugel: Seine Mitte ist am Ende 0,4 Pika-Breiten und fast einen Radius von ihrer entfernt
    const mitteKugel = l + rMax + weg;
    const r3 = kugel[kugel.length - 1][1] * rMax;
    assert.ok(Math.abs(mitteKugel - c._x - (pW * 0.4 + r3 * 0.9)) < 0.3, `Pika ${c._x}, Kugel ${mitteKugel}`);
    // die Kugel bleibt mit ihrem Rand zwischen Vorrat und Stein: klein am Anfang (hier links), groß am Ende
    assert.ok(l + rMax - pH * 0.1 >= hayR && mitteKugel + r3 <= rock.l, `Kugel ${l + rMax - pH * 0.1} … ${mitteKugel + r3}, Wiese ${hayR} … ${rock.l}`);
    klingeln();
    assert.equal(c._el.acts.children.length + c._el.fx.children.length, 0, 'nichts bleibt stehen');
    assert.deepEqual([...c._el.pika.classList.s].filter((k) => k !== 'left'), []);
  }
});

test('Schnee: nichts ist gewürfelt – zwei Karten zeigen im selben Fenster dasselbe, egal was Math.random liefert', async () => {
  // im Quelltext der beiden Methoden und ihrer Helfer kommt kein freier Zufall vor
  const klein = quell('karte/beschaeftigungen-klein.js');
  for (const n of ['_angelSpot(S)', '_snowPuff(x, n, u)', 'async _angel()', 'async _snowball()']) {
    const body = klein.slice(klein.indexOf(`\n  ${n} {`)).match(/\{([\s\S]*?)\n  \}\n/)[1];
    assert.ok(body.length > 200, n);
    assert.equal(/Math\.random|\brnd\(|\bpick\(/.test(body), false, `${n} würfelt`);
  }
  for (const a of NEU) {
    for (let m = 300; m < 306; m++) {
      const logs = [];
      for (const wert of [0.03, 0.97]) {
        zufall.wert = wert;
        zufall.n = 0;
        gebaut.length = 0;
        const start = jetzt;
        const c = buehne();
        await lauf(c, fenster(a, m, start));
        // (Herzchen sind hier still: Sie streuen auf jedem Gerät anders, wie überall)
        assert.equal(zufall.n, 0, `${a}: Math.random ${zufall.n}-mal gefragt`);
        const kugel = gebaut.filter((e) => /sb-|angelp/.test(e.className) || e.classList.je.has('snowy')).map((e) => [e.className, e.style.left, e.style.transform, e.style['--px']]);
        logs.push(JSON.stringify([c.log, kugel, jetzt - start]));
        klingeln();
      }
      assert.equal(logs[0], logs[1], `${a}, Fenster ${m}`);
    }
  }
  zufall.wert = 0.5;
  // auf einer anderen Kartengröße derselbe Ablauf (Sprüche, Haltungen, Reihenfolge), nur die Wege sind andere
  for (const a of NEU) {
    const m = suche((r) => r(6) < 0.3 && r(3) < 0.5);
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

test('Schnee: Abbruch an jeder Wartestelle lässt kein Requisit, keine Haltung und keine Höhe zurück', async () => {
  for (const a of NEU) {
    for (const [still, m] of [[false, suche((r) => r(6) < 0.3)], [false, suche((r) => r(6) >= 0.3 && r(1) >= 0.5)], [true, 77]]) {
      ruhe.matches = still;
      const voll = await lauf(buehne(), fenster(a, m));
      klingeln();
      assert.equal(voll.fertig, true);
      assert.ok(voll.n >= (still ? 8 : 12), `${a}: nur ${voll.n} Wartestellen`);
      for (let stopp = 0; stopp < voll.n; stopp++) {
        gebaut.length = 0;
        const c = buehne();
        const R = await lauf(c, fenster(a, m), { stopp });
        const wo = `${a}${still ? ' (Bewegung reduzieren)' : ''}, Abbruch an Wartestelle ${stopp}`;
        assert.equal(R.fertig, false, wo);
        assert.equal(c._action, null, wo);
        assert.equal(c._lift, 0, wo);
        assert.equal(c._aprops?.size || 0, 0, wo);
        for (const el of requisiten()) assert.deepEqual([el.classList.contains('on'), el.classList.contains('off')], [false, true], wo);
        const stehen = [...c._el.pika.classList.s].filter((k) => !BLEIBT.has(k));
        assert.deepEqual(stehen, [], wo);
        // mitten im Schieben bleibt er stehen, wo er ist (sonst glitte er ohne Hoppeln ans Ende der Etappe)
        assert.ok(c.eingefroren <= 1, wo);
        assert.ok(c._x >= c._g.pW * 0.45 - 0.01 && c._x <= c._g.xR + 0.01, `${wo}: steht bei ${c._x}`);
        // nach einer Sekunde ist auch im Baum nichts mehr davon da
        klingeln();
        assert.equal(c._el.acts.children.length + c._el.actsf.children.length + c._el.fx.children.length, 0, wo);
        assert.deepEqual([...c._el.pika.classList.s].filter((k) => k !== 'left'), [], wo);
      }
    }
  }
  ruhe.matches = false;
  // Abbruch mitten im Schieben: _cleanup hält ihn an (er trägt dabei .walking)
  const c = buehne();
  let n = -1;
  await lauf(c, fenster('snowball', 77), { bei: (i, k) => { if (n < 0 && k._el.pika.classList.contains('sb-push')) n = i; } });
  klingeln();
  assert.ok(n > 0);
  const d = buehne();
  await lauf(d, fenster('snowball', 77), { stopp: n });
  assert.equal(d.eingefroren, 1);
});

test('Schnee: ändert sich die Größe der Karte, während Abdruck oder Kugel da sind, bricht er ab', async () => {
  for (const a of NEU) {
    const voll = await lauf(buehne(), fenster(a, 77));
    klingeln();
    // an jeder Wartestelle bis kurz vor Schluss: Größe ändern → _layout bricht ab (wie bei Pfütze und Schnee-Pika)
    for (let stopp = 0; stopp < voll.n - 1; stopp++) {
      const c = buehne();
      await lauf(c, fenster(a, 77), { stopp, aufraeumen: false });
      assert.ok(c._aprops.size > 0, `${a}, Wartestelle ${stopp}: Requisit steht`);
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
});

test('Schnee: auf schmalen Karten bleibt alles im Bild – der Abdruck wird kleiner, die Kugel rollt kürzer oder wächst am Platz', async () => {
  const rollt = {};
  for (const [W, Hs] of GROESSEN) {
    for (const m of [77, 78, 79, suche((r) => r(6) < 0.3)]) {
      // Schneeengel
      gebaut.length = 0;
      let c = buehne(W, Hs);
      const { pW, hayR, rock, xR } = c._g;
      await lauf(c, fenster('angel', m));
      let [el] = requisiten();
      let [l, w] = [parseFloat(el.style.left), parseFloat(el.style.width)];
      const wo = `${W} × ${Hs}, Fenster ${m}`;
      assert.ok(w >= pW * 0.62 - 0.1 && w <= pW * 1.05 + 0.1, `${wo}: Abdruck ${w} px bei Pika-Breite ${pW}`);
      assert.ok(l >= 0 && l + w <= W, `${wo}: Abdruck ${l} … ${l + w}`);
      // er liegt zwischen Vorrat und Stein; nur wo die Wiese schmaler ist als der kleinste Abdruck, ragt er mittig darüber
      const rand = Math.max(0, (w - (rock.l - hayR)) / 2) + c._H * 0.04;
      assert.ok(l >= hayR - rand && l + w <= rock.l + rand, `${wo}: Abdruck ${l} … ${l + w}, Wiese ${hayR} … ${rock.l}`);
      for (const x of c.log.filter((e) => e[0] === 'x').map((e) => Number(e.slice(1)))) assert.ok(x >= pW * 0.45 - 0.1 && x <= xR + 0.1, `${wo}: Pika bei ${x}`);
      klingeln();
      // Schneeball
      gebaut.length = 0;
      c = buehne(W, Hs);
      await lauf(c, fenster('snowball', m));
      [el] = requisiten();
      [l, w] = [parseFloat(el.style.left), parseFloat(el.style.width)];
      assert.ok(l >= 0 && l + w <= W, `${wo}: Kugel und Spur ${l} … ${l + w}`);
      const weg = w - parseFloat(el.style.height);
      (rollt[`${W}×${Hs}`] ??= []).push(weg > 0);
      if (weg > 0) {
        assert.ok(weg >= pW * 0.35 - 0.1 && weg <= pW * 1.5 + 0.1, `${wo}: Weg ${weg}`);
        // die Mitte der Kugel bleibt zwischen Vorrat und Stein, auch die kleine am Anfang ragt nicht hinaus
        const r1 = c._g.pH * 0.1;
        const [von, bis] = [l + parseFloat(el.style.height) / 2, l + w - parseFloat(el.style.height) / 2];
        assert.ok(von - r1 >= hayR && bis + r1 <= rock.l, `${wo}: Weg ${von} … ${bis} zwischen Vorrat ${hayR} und Stein ${rock.l}`);
      } else {
        // am Platz: kein Schieben, kein Hinterherhüpfen, auch wenn das Fenster „rollt davon“ sagt
        assert.equal(c._el.pika.classList.je.has('sb-push'), false, wo);
        assert.equal(c.hopser, 0, wo);
        assert.equal(c.log.some((e) => /halt/i.test(e)), false, wo);
      }
      for (const x of c.log.filter((e) => e[0] === 'x').map((e) => Number(e.slice(1)))) assert.ok(x >= pW * 0.45 - 0.1 && x <= xR + 0.1, `${wo}: Pika bei ${x}`);
      klingeln();
    }
  }
  // breit genug zum Rollen sind 600 × 248, 380 × 184 und 1000 × 200; auf den schmalen Hochkant-Karten wächst sie am Platz
  assert.deepEqual(Object.fromEntries(Object.entries(rollt).map(([k, v]) => [k, [...new Set(v)].join()])),
    { '600×248': 'true', '380×184': 'true', '250×184': 'false', '320×400': 'false', '340×248': 'false', '1000×200': 'true' });
});

test('Schneeball: ein Gerät, das später dazukommt, sieht die Kugel dort und so groß wie die anderen', async () => {
  for (const run of [false, true]) {
    const m = suche((r) => (r(6) < 0.3) === run && r(3) < 0.5);
    const start = jetzt;
    // Karte A von Anfang an: Ziel und Größe der Kugel am Ende jeder Etappe
    gebaut.length = 0;
    const A = buehne();
    await lauf(A, fenster('snowball', m, start));
    const elA = requisiten()[0];
    const weg = parseFloat(gebaut.find((e) => e.classList.je.has('sb-track')).style.width);
    const rMax = parseFloat(elA.style.height) / 2;
    const endeX = A._x;
    klingeln();
    // Karte B wird zur Planzeit T0 + t frisch geladen (noch von niemandem gesehen): Wo liegt die Kugel, wo steht er?
    const T0 = start + T.ACT_WALK;
    const bei = (t) => {
      jetzt = T0 + t;
      gebaut.length = 0;
      const B = buehne();
      B._blindAt = jetzt - 200;
      B._blindFirst = true;
      const S = fenster('snowball', m, start);
      return lauf(B, S, { stopp: 0 }).then(() => {
        const ball = gebaut.find((e) => e.classList.je.has('sb-ball'));
        const size = gebaut.find((e) => e.classList.je.has('sb-size'));
        const el = requisiten()[0];
        klingeln();
        return {
          f: zahl(ball.style.transform, /translateX\((-?[\d.]+)px\)/) / weg, r: zahl(size.style.transform, /scale\(([\d.]+)\)/) * rMax,
          x: Number(B.log.find((e) => e[0] === 'x').slice(1)), links: el.style.left, breite: el.style.width,
        };
      });
    };
    const pH = A._g.pH;
    const pW = A._g.pW;
    let vor = await bei(1500);
    assert.equal(vor.f, 0, 'beim Zusammenscharren liegt sie noch am Anfang');
    assert.ok(vor.r > 0 && vor.r < pH * 0.1, 'und ist noch nicht ganz zusammengescharrt');
    vor = await bei(1750);
    const ende = T.ACT_LEN.snowball((n) => T.seedRnd('mini', m, 10 + n));
    const etappe2 = await bei(7200);
    for (let t = 1800; t < ende - 4000; t += 100) {
      const P = await bei(t);
      const wo = `${run ? 'rollt davon' : 'normal'}, ${t} ms`;
      // derselbe Platz auf beiden Geräten, und die Kugel rollt stetig vorwärts und wächst dabei (keine Sprünge)
      assert.deepEqual([P.links, P.breite], [elA.style.left, elA.style.width], wo);
      assert.ok(P.f >= vor.f - 1e-3 && P.f - vor.f < 0.1, `${wo}: Weg ${vor.f} → ${P.f}`);
      assert.ok(P.r >= vor.r - 0.02 && P.r - vor.r < pH * 0.012, `${wo}: Radius ${vor.r} → ${P.r}`);
      // er steht mit Nase und Pfoten an ihr; rollt sie gerade von selbst davon, steht er noch am Ende der zweiten
      // Etappe (wie auf Karte A, die ihr gleich hinterherhüpft)
      const mitte = parseFloat(P.links) + rMax + P.f * weg;
      if (run && t > 7200 && t < 7200 + 500 + 1240 - 600) assert.equal(P.x, etappe2.x, wo);
      else assert.ok(Math.abs(mitte - P.x - (pW * 0.4 + P.r * 0.9)) < 0.6, `${wo}: Pika ${P.x}, Kugel ${mitte}`);
      vor = P;
    }
    // am Ende dort, wo sie auf Karte A liegt, und so groß; er steht, wo er auf A steht
    vor = await bei(ende - 500);
    assert.ok(Math.abs(vor.f - 1) < 1e-3 && Math.abs(vor.r - pH * (run ? 0.274 : 0.25)) < 0.05, JSON.stringify(vor));
    assert.ok(Math.abs(vor.x - endeX) < 0.2, `B steht bei ${vor.x}, A bei ${endeX}`);
    // Stufen zu den festen Zeiten: nach dem Scharren 0,10, nach der ersten Etappe 0,17, nach der zweiten 0,25 Pika-Höhen
    for (const [t, r] of [[1800, 0.1], [4200, 0.17], [4700, 0.17], [7200, 0.25]]) {
      assert.ok(Math.abs((await bei(t)).r / pH - r) < 0.002, `Radius bei ${t} ms`);
    }
    // mitten in einer Etappe: Die Überblendung läuft mit negativer Verzögerung weiter (nicht von vorn)
    jetzt = T0 + 1800 + 1000;
    gebaut.length = 0;
    const B = buehne();
    Object.assign(B, { _blindAt: jetzt - 200, _blindFirst: true });
    let n = -1;
    await lauf(B, fenster('snowball', m, start), { bei: (i, k) => { if (n < 0 && k._el.pika.classList.contains('sb-push')) n = i; } });
    klingeln();
    gebaut.length = 0;
    jetzt = T0 + 1800 + 1000;
    const C = buehne();
    Object.assign(C, { _blindAt: jetzt - 200, _blindFirst: true });
    await lauf(C, fenster('snowball', m, start), { stopp: n, aufraeumen: false });
    const ball = gebaut.find((e) => e.classList.je.has('sb-ball'));
    // (60 ms steht er schon da, bevor es weitergeht: _goSpot)
    assert.match(ball.style.transition, /^transform 2400ms linear -1060ms$/);
    assert.match(C._el.pika.style.transition, /^transform (1440|1200|1680)ms linear$/, 'er selbst trippelt den Rest der Etappe');
    C._cleanup();
    klingeln();
    jetzt = start + 60000;
  }
});

test('Schnee: mit „Bewegung reduzieren“ plumpst und rollt nichts – der Abdruck blendet neben ihm ein, die Kugel wächst am Platz', async () => {
  ruhe.matches = true;
  try {
    for (const m of [77, suche((r) => r(6) < 0.3)]) {
      // Schneeengel
      gebaut.length = 0;
      let c = buehne();
      let S = fenster('angel', m);
      const t0 = jetzt;
      let R = await lauf(c, S);
      assert.equal(R.fertig, true);
      let je = c._el.pika.classList.je;
      for (const k of ['angel-dn', 'angel-go', 'angel-up']) assert.equal(je.has(k), false, `Schneeengel: ${k}`);
      assert.equal(c.hopser, 0, 'kein Hüpfer');
      assert.equal(c.log.some((e) => e.startsWith('Sprung')), false);
      assert.equal(gebaut.some((e) => e.classList.je.has('snowy')), false, 'kein Schneegestöber');
      let [el] = requisiten();
      assert.ok(el.classList.je.has('b') && el.classList.je.has('w') && el.classList.je.has('drift'));
      assert.match(el.style['--ag'], /^\d{4}ms$/, 'der ganze Abdruck blendet langsam ein');
      assert.equal(el.style['--aw'], undefined, 'die Flügel wachsen nicht');
      // er steht von Anfang an daneben und schaut hin; gleich lang wie auf den anderen Geräten
      const xs = [...new Set(c.log.filter((e) => e[0] === 'x'))];
      assert.ok(xs.length <= 1, `er läuft nur hin: ${xs}`);
      const mitte = parseFloat(el.style.left) + parseFloat(el.style.width) / 2;
      assert.ok(Math.abs(c._x - mitte) > parseFloat(el.style.width) / 2);
      assert.match(c.log.join(' '), /„(Ein|Mein) Schneeengel!/);
      assert.ok(jetzt - t0 >= S.end - S.start + 3000 + 1600, 'so lang wie mit Bewegung');
      klingeln();
      // Schneeball
      gebaut.length = 0;
      c = buehne();
      S = fenster('snowball', m);
      R = await lauf(c, S);
      assert.equal(R.fertig, true);
      je = c._el.pika.classList.je;
      assert.equal(je.has('sb-push'), false, 'Schneeball: kein Schieben');
      assert.equal(c.hopser, 0);
      assert.equal(c.log.some((e) => /halt/i.test(e)), false, 'sie rollt nicht davon');
      assert.ok([...new Set(c.log.filter((e) => e[0] === 'x'))].length <= 1, 'er läuft nur hin und bleibt an seinem Platz');
      const ball = gebaut.find((e) => e.classList.je.has('sb-ball'));
      const track = gebaut.find((e) => e.classList.je.has('sb-track'));
      const marks = gebaut.find((e) => e.classList.je.has('sb-size')).teile['.sb-rot'];
      assert.equal(ball.style.transform, 'translateX(0.0px)');
      assert.match(marks.style.transform, /^rotate\(-?0deg\)$/, 'nichts dreht sich');
      assert.equal(track.style.display, 'none');
      // sie wächst trotzdem bis zur dritten Größe und sackt am Ende zusammen
      [el] = requisiten();
      const size = gebaut.find((e) => e.classList.je.has('sb-size'));
      assert.ok(Math.abs((zahl(size.style.transform, /scale\(([\d.]+)\)/) * parseFloat(el.style.height)) / 2 / c._g.pH - 0.25) < 0.002);
      assert.ok(el.classList.je.has('off'));
      assert.match(c.log.join(' '), /„[sS]o groß!/);
      klingeln();
    }
  } finally {
    ruhe.matches = false;
  }
  // der Stil nimmt unter „Bewegung reduzieren“ das Wachsen der Flügel und das Klopfen heraus
  const stil = quell('stil/beschaeftigungen.js');
  const red = stil.slice(stil.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  for (const k of ['.ap-w, .ap-s { transform: none; }', '.sb-pat .paws { animation: none;']) assert.ok(red.includes(k), k);
});

test('Schnee: die Vorschau hat Knöpfe für Schneeengel und Schneeball', () => {
  const html = fs.readFileSync(new URL('../preview.html', import.meta.url), 'utf8');
  const bar = html.slice(html.indexOf('id="bar-act"'), html.indexOf('Ende Aktivitäten'));
  for (const a of ['snowpika', ...NEU]) assert.match(bar, new RegExp(`<button data-act="${a}">[^<]+</button>`), a);
});
