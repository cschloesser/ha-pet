// Album 2: das Vogelhäuschen (Schatz t2 = 0) – Daten, Wahl der Aktionen, Szene, Spiel, Trick, Gold, Tipp, Auspacken,
// Tagebuch. Ohne echte Szene: Elemente sind Attrappen. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { welt } from './welt.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const sek = (t) => Math.round(t / 1000) * 1000;

// Ein Element, soweit Szene, Vögel und Auspacken es anfassen
class El {
  constructor(tag = 'div') {
    this.tag = tag;
    this.cls = new Set();
    this.classList = {
      add: (...k) => k.forEach((x) => this.cls.add(x)), remove: (...k) => k.forEach((x) => this.cls.delete(x)),
      contains: (k) => this.cls.has(k), toggle: (k, on) => ((on ?? !this.cls.has(k)) ? this.cls.add(k) : this.cls.delete(k)),
    };
    this.style = { setProperty() {} };
    this.dataset = {};
    this.kinder = [];
    this.weg = false;
    this.isConnected = true;
    this.innerHTML = '';
    this.parentElement = null;
    this.offsetLeft = 0;
    this.offsetWidth = 10;
    this.hoerer = {};
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

  addEventListener(k, f) {
    this.hoerer[k] = f;
  }

  appendChild(k) {
    this.kinder.push(k);
    k.parentElement = this;
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
    return { left: 100, top: 50, right: 130, bottom: 110, width: 30, height: 60 };
  }

  getAnimations() {
    return [];
  }
}

// Eine Karte ohne Szene, mit Album 1 voll (Trick) und Album 2 auf Stufe lv des Vogelhäuschens. ruf: was sie tut
const karte = (lv = 1, extra = {}) => {
  const W = welt({ start: new Date(2026, 6, 15, 12).getTime() });
  W.dok.createElement = (t) => new El(t);
  const { T } = W;
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const w = (lv >= 1 ? 1 : 0) | (lv >= 2 ? 0x100 : 0) | (lv >= 3 ? 0x10000 : 0);
  const leer = () => {};
  Object.assign(c, {
    _cfg: { gifts: true }, _W: 600, _H: 248, _x: 200, _dir: 1, _wx: {}, _wind: 0,
    _g: { gy: 210, pW: 119, pH: 99, hayR: 220, fMin: 0.4, fMax: 0.72, rock: { l: 440, w: 150, ku: 1.5, cx: 515 }, hole: { l: 60, r: 120, cx: 90 } },
    _el: { pika: new El(), fx: new El(), gifts: new El(), birds: new El(), scene: new El() },
    _plan: { gift: { u: 255, v: 255, w, z: 4, o: 4, i: 32 } },
    _say: (t) => ruf.push(['sagt', t]), _wait: async () => {}, _walkTo: async (x) => ruf.push(['geht', Math.round(x)]), _face: (d) => (c._dir = d),
    _sparkle: leer, _cls: leer, _mimik: leer, _happy: () => ruf.push(['freut']), _jump: leer, _peep: (x, y, t) => ruf.push(['piep', t]),
    _tweet: () => ruf.push(['zwitschert']), _found: (k) => ruf.push(['entdeckt', k]), _keyTap: leer, _away: () => false, _urlaubFern: () => false,
    _planOp: (op) => ruf.push(['op', op.t, op.z]), _giftFromPlan: () => ruf.push(['plan']), _giftFeier: async (was) => ruf.push(['feier', was]),
    ...extra,
  });
  c._giftScene = () => c._a2Scene();
  return { W, T, c, ruf };
};

test('Vogelhäuschen: Daten wie die Schätze aus Album 1 (24 × 24, ohne id und class), gebaut, Aktionen gibt es', () => {
  const { c, T } = karte();
  const it = c._a2Item(0);
  assert.equal(it.key, 'feeder');
  assert.equal(it.built, true);
  assert.equal(it.mo, null);
  assert.match(it.icon, /^<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(it.icon, /\sid=|\sclass=|NaN|undefined/);
  for (const k of ['name', 'say', 'trick', 'gilt', 'use', 'gold']) assert.ok(it[k] && typeof it[k] === 'string', k);
  assert.ok(it.find?.t && it.find?.h);
  for (const [label, act, lv] of it.dbg) {
    assert.equal(typeof c[`_${act}`], 'function', label);
    assert.ok(lv >= 1 && lv <= 3);
  }
  // Alle acht haben Name und Bild; ein noch nicht gebauter (Platzhalter) wirft nicht, auch nicht über seine Hooks
  for (let t = 0; t < 8; t++) {
    const x = c._a2Item(t);
    assert.equal(x.key, T.A2_KEYS[t]);
    assert.ok(x.name && x.say, x.key);
    assert.match(x.icon, /viewBox="0 0 24 24"/);
    if (!x.built) assert.doesNotThrow(() => c._a2Hook(x.key, 'Acts', { wx: {} }, 1));
  }
});

test('Vogelhäuschen: Er mag es bei Tag, im Winter öfter; nicht bei Regen, Sturm, nachts; Trick erst ab Stufe 2', () => {
  const { c } = karte(1);
  const acts = (wx = {}, cls = []) => {
    c._el.scene.cls = new Set(cls);
    return plain(c._a2FeederActs({ wx }, c._a2Lv('feeder')));
  };
  assert.deepEqual(acts(), [[0.3, 'a2FeederPlay'], [0, 'a2FeederFill']]);
  assert.deepEqual(acts({ wet: true }), []);
  assert.deepEqual(acts({ storm: true }), []);
  assert.deepEqual(acts({}, ['night']), []);
  assert.ok(acts({}, ['dusk'])[0][0] < 0.3);
  // Schnee: öfter
  assert.equal(acts({ snowcover: true })[0][0], 0.7);
  c._wx = { snowcover: true };
  assert.equal(c._a2FeederWinter(), true);
  c._wx = {};
  // Winter (Dezember), auf der Südhalbkugel ist dann Sommer
  c._dbgDate = new Date(2026, 11, 10, 12).getTime();
  assert.equal(c._a2FeederWinter(), true);
  c._hass = { config: { latitude: -34 } };
  assert.equal(c._a2FeederWinter(), false);
  c._hass = null;
  c._dbgDate = null;
  // Stufe 2: der Trick kommt dazu
  const { c: c2 } = karte(2);
  c2._el.scene.cls = new Set();
  assert.ok(c2._a2FeederActs({ wx: {} }, 2)[1][0] > 0);
  // Wahl über die Schnittstelle: nur mit Album 2, nicht mit Ballon, nicht verreist
  assert.deepEqual(plain(c._a2Acts({ wx: {} })).map((a) => a[1]), ['a2FeederPlay']);
  c._gb = { z: 5 };
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
  c._gb = null;
  c._urlaubFern = () => true;
  assert.deepEqual(plain(c._a2Acts({ wx: {} })), []);
  const { c: c0 } = karte(0);
  assert.deepEqual(plain(c0._a2Acts({ wx: {} })), []);
});

test('Vogelhäuschen: steht am linken Fuß des Steins auf der hinteren Reihe, wenn Platz ist; sonst nur für seinen Moment', () => {
  const { c } = karte(1);
  c._a2Scene();
  const el = c._a2Els.get('feeder');
  assert.ok(el, 'steht da');
  assert.ok(el.cls.has('gt') && el.cls.has('a2-feeder'));
  assert.equal(c._el.gifts.kinder[0], el);
  const F = c._a2FeederPos();
  assert.equal(el.style.left, `${F.x.toFixed(1)}px`);
  assert.ok(F.x > c._g.hayR && Math.abs(F.x - (440 + 1.5 * 6)) < 0.01);
  assert.ok(Number(el.style.zIndex) > 0);
  // golden: .gilt
  c._plan.gift.w = 0x10101;
  c._a2Scene();
  assert.ok(el.cls.has('gilt'));
  // schmale Wiese: weg; für sein Spiel holt er es hervor, danach ist es wieder weg
  c._g.rock.l = 300;
  c._a2Scene();
  assert.equal(c._a2Els.has('feeder'), false);
  assert.equal(el.weg, true);
  c._a2FeederShow();
  assert.ok(c._a2Els.has('feeder'));
  c._a2FeederEnd();
  // (blendet aus, dann räumt die Szene es weg)
  assert.ok(c._a2Els.get('feeder').cls.has('a2out'));
  // Festdeko an der Stelle: auch kein Platz
  c._g.rock.l = 440;
  c._festPos = { cake: { l: 445, w: 20 } };
  assert.equal(c._a2FeederRoom(), false);
  // nicht da (Stufe 0): nichts
  const { c: c0 } = karte(0);
  c0._a2Scene();
  assert.equal(c0._a2Els?.has('feeder') ?? false, false);
});

test('Vogelhäuschen, Stufe 1: Er geht hin, Vögel kommen ans Brett, er schaut zu, sie fliegen wieder weg', async () => {
  const { c, ruf } = karte(1);
  c._a2Scene();
  await c._a2FeederPlay({ n: 2 });
  const F = c._a2FeederPos();
  const geht = ruf.find((r) => r[0] === 'geht');
  assert.ok(geht[1] < F.x - 100, `steht links mit Abstand (${geht[1]} vor ${Math.round(F.x)})`);
  const voegel = c._el.birds.kinder;
  assert.equal(voegel.length, 2);
  assert.ok(voegel.every((v) => v.cls.has('bird') && v.cls.has('a2b')));
  assert.ok(!voegel.some((v) => /Gimpel/.test(v.innerHTML)), 'kein Gimpel auf Stufe 1');
  // nicht this._bird (der Besuch nach der Uhr bleibt unberührt)
  assert.equal(c._bird, undefined);
  assert.equal(c._a2FeederBusy, false);
  assert.ok(ruf.some((r) => r[0] === 'freut'));
  // Antippen eines Vogels: Er fliegt weg (Entdeckung „Besuch“)
  const { c: c2, ruf: r2 } = karte(1);
  c2._a2Scene();
  const b = c2._a2FeederBird(0, { name: 'Spatz', body: '#b38d66', head: '#a8805a', wing: '#86603f', breast: '#ebe0cf', beak: '#4a3a2c' });
  b.el.unter.hoerer.click({ stopPropagation() {} });
  assert.equal(b.gone, true);
  assert.deepEqual(r2.filter((r) => r[0] === 'entdeckt'), [['entdeckt', 'visitor']]);
  // Aufräumen (Ende oder Abbruch): alle Vögel weg, kein Zeitgeber bleibt
  const b2 = c2._a2FeederBird(1, { name: 'Spatz', body: '#b38d66', head: '#a8805a', wing: '#86603f', breast: '#ebe0cf', beak: '#4a3a2c' });
  c2._a2Cleanup();
  assert.equal(b2.gone, true);
  c2._a2Detach();
  assert.equal(c2._a2FeederBirds.size, 0);
});

test('Vogelhäuschen, Stufe 2 und 3: Er füllt Körner nach; golden kommt (mit Abstand und Würfel) ein Gimpel aufs Dach', async () => {
  const { c, ruf } = karte(2);
  c._a2Scene();
  const el = c._a2Els.get('feeder');
  await c._a2FeederFill();
  assert.ok(ruf.some((r) => r[0] === 'piep' && r[1] === 'riesel!'));
  assert.ok(!el.cls.has('leer') && !el.cls.has('fill'), 'Körner wieder da');
  assert.ok(c._el.fx.kinder.some((k) => k.cls.has('a2seed')), 'Körner fliegen');
  // auf Stufe 1 gibt es den Trick nicht
  const { c: c1, ruf: r1 } = karte(1);
  await c1._a2FeederFill();
  assert.deepEqual(r1, []);
  // golden: der Gimpel sitzt auf dem First (Platz 2)
  const { c: g, ruf: rg } = karte(3);
  g._a2Scene();
  g._dbgGold = true;
  await g._a2FeederPlay({ n: 1 });
  const voegel = g._el.birds.kinder;
  assert.equal(voegel.length, 2);
  assert.match(voegel[1].innerHTML, /aria-label="Gimpel"/);
  assert.ok(rg.some((r) => r[0] === 'sagt' && /Gimpel|Bäuchlein/.test(r[1])));
  // ohne _dbgGold: höchstens alle 3 Minuten
  const { c: h } = karte(3);
  h._a2Scene();
  const R = { cd: 3 * 6e4, p: 1 };
  assert.equal(h._a2GoldOk('feeder', R), true);
  assert.equal(h._a2GoldOk('feeder', R), false);
  // nicht golden: nie
  const { c: n } = karte(2);
  assert.equal(n._a2GoldOk('feeder'), false);
});

test('Vogelhäuschen: Tipp darauf wackelt es, Körner rieseln, Zone in der Welt, Entdeckung zählt', () => {
  const { c, ruf } = karte(1);
  c._a2Scene();
  const Z = [];
  c._a2Zones(Z, { left: 0, top: 0 });
  assert.equal(Z.length, 1);
  assert.deepEqual([Z[0].k, Z[0].a2], ['feeder', true]);
  assert.equal(c._a2Tap(Z[0]), true);
  assert.ok(c._a2Els.get('feeder').cls.has('a2tap'));
  assert.ok(ruf.some((r) => r[1] === 'riesel!'));
  // die Entdeckung kennt das Tagebuch (sonst würde sie überlesen)
  const { T } = karte();
  assert.deepEqual([...T.findsParse('head,feeder,unbekannt')], ['head', 'feeder']);
  assert.equal(T.findsSer(new Set(['feeder', 'head'])), 'head,feeder');
});

test('Vogelhäuschen auspacken: was er sagt (neu, Trick, golden), an seinen Platz, vorführen; „Album 2 ganz golden“ feiert', async () => {
  const auspacken = async (lv, w) => {
    const { c, ruf } = karte(lv, {});
    c._plan = { gift: { u: 255, v: 255, w, z: 7, o: 6, i: 32 } };
    const B = { z: 7, el: new El(), x: 300, gold: lv === 3, item: 0, alb: 2, stage: 'ground' };
    c._gb = B;
    // (das Verstauen fliegt mit getComputedStyle und Web Animations: Das zeigt die Vorschau, hier nur, dass es kommt)
    c._a2Stow = async (t, ie, l) => ruf.push(['zeigt', l]);
    await c._giftOpen();
    return { ruf, c, B };
  };
  let { ruf, c, B } = await auspacken(1, 1);
  assert.ok(ruf.some((r) => r[0] === 'sagt' && r[1] === 'ein Vogelhäuschen!'));
  assert.deepEqual(ruf.filter((r) => r[0] === 'zeigt' || r[0] === 'op'), [['op', 'gopen', 7], ['zeigt', 1]]);
  assert.deepEqual([c._gb, c._a2Hide, c._giftHide, B.stage], [null, null, null, 'open']);
  ({ ruf } = await auspacken(2, 0x101));
  assert.ok(ruf.some((r) => r[1] === 'neuer Trick: Körner nachfüllen!'));
  ({ ruf } = await auspacken(3, 0x10101));
  assert.ok(ruf.some((r) => r[1] === 'ein goldenes Vogelhäuschen!'));
  assert.ok(!ruf.some((r) => r[0] === 'feier'));
  ({ ruf } = await auspacken(3, 0xffffff));
  assert.deepEqual(ruf.filter((r) => r[0] === 'feier'), [['feier', 'gold2']]);
  // ein Schatz, den diese Version noch nicht gebaut hat (von einem Gerät mit einer späteren verschenkt): Name aus den
  // Daten, Platzhalter, kein Fehler. (Sind alle gebaut, entfällt das.)
  const { c: k, ruf: rk } = karte(1);
  const u = [...Array(8).keys()].find((t) => !k._a2Item(t).built);
  if (u != null) {
    k._plan = { gift: { u: 255, v: 255, w: 1 | (1 << u), z: 7, o: 6, i: 32 + u } };
    k._gb = { z: 7, el: new El(), x: 300, gold: false, item: u, alb: 2, stage: 'ground' };
    k._a2Stow = async (t, ie, l) => rk.push(['zeigt', t, l]);
    await k._giftOpen();
    assert.ok(rk.some((r) => r[1] === k._a2Item(u).say));
    assert.deepEqual(rk.find((r) => r[0] === 'zeigt'), ['zeigt', u, 1]);
    assert.deepEqual(k._errs ?? [], []);
  }
  // … und ohne Hook Stow (leere Klasse) freut er sich nur: _a2Stow ruft ihn nicht auf, wenn es ihn nicht gibt
  assert.equal(typeof k._a2FeederStow, 'function');
});

test('Tagebuch: Album 2 im Verlauf (neu, Trick, golden, alle golden) und die Sätze dazu', () => {
  const { W, T, c } = karte(0);
  const t0 = W.jetzt();
  let P = T.planApply(T.planBlank(t0), { t: 'gstart', k: sek(t0 - 864e5) }, t0);
  P = T.planApply(P, { t: 'gdbg', f: { n: 3, y: 2, u: 255, v: 0xffff, z: 10, o: 10, w: 0xfefefe } }, t0);
  const L = [{ t: t0 - 9e5, v: P }];
  const schenken = (t, i, gold) => {
    const a = L.at(-1).v;
    const b = T.planApply(T.planApply(a, { t: 'gdbg', f: gold ? { y: 1 } : { n: 1 } }, t), { t: 'give', z: a.gift.z + 1, i: i + (gold ? 16 : 0), gold, x: sek(t), r: 1 }, t);
    L.push({ t, v: b }, { t: t + 30000, v: T.planApply(b, { t: 'gopen', z: b.gift.z }, t + 30000) });
  };
  schenken(t0 - 8e5, 32, false);
  schenken(t0 - 7e5, 32, false);
  schenken(t0 - 6e5, 32, true);
  const R = T.diaryDerive([], L, t0 - 1e6, { decayAt: () => Infinity, until: t0 });
  const pk = plain(R.ev.filter((e) => e.k === 'parcel'));
  assert.deepEqual(pk.map((e) => [e.it, e.alb, e.what, e.gold, e.all]), [[0, 2, 'new', false, false], [0, 2, 'trick', false, false], [0, 2, 'gilt', true, true]]);
  assert.match(c._diaryParcel(pk[0], t0), /Drin war ein Vogelhäuschen!$/);
  assert.match(c._diaryParcel(pk[1], t0), /neuen Trick: Körner nachfüllen!$/);
  assert.match(c._diaryParcel(pk[2], t0), /^Ein goldenes Päckchen!.*Jetzt hab ich ein goldenes Vogelhäuschen\.$/);
});

// 0.48.1: Das Häuschen steht nicht in der Schneewehe des Schlittens. Liegt Schnee (Schlitten da) oder die Wehe, steht
// es links von ihrem Fuß; ist dort kein Platz, blendet es aus, solange die Wehe liegt.
test('Vogelhäuschen: links vom Fuß der Schneewehe, sonst während des Rodelns ausgeblendet', () => {
  const { c } = karte(1);
  const x0 = c._a2FeederPos().x;
  c._a2Scene();
  const el = c._a2Els.get('feeder');
  assert.ok(el && !el.cls.has('a2hid'));
  // die Wehe liegt: links von ihrem Fuß
  c._a2SledS = { drift: {}, u0: c._a2SledU0() };
  const F = c._a2FeederPos();
  const foot = c._a2SledFoot();
  assert.ok(F.x + F.w / 2 <= foot, JSON.stringify([F.x, F.w, foot]));
  assert.ok(F.x - F.w / 2 >= c._g.hayR, 'nicht im Heu');
  assert.ok(F.x < x0);
  c._a2Scene();
  assert.equal(el.style.left, F.x.toFixed(1) + 'px');
  assert.ok(!el.cls.has('a2hid'));
  // Schnee liegt und der Schlitten ist da (ohne Wehe): steht schon dort, rückt beim Rodeln nicht
  c._a2SledS = null;
  c._plan.gift.w |= 4;
  c._wx = { snowcover: true };
  assert.equal(c._a2FeederPos().x, F.x);
  // ohne Schnee wieder am Stein
  c._wx = {};
  assert.equal(c._a2FeederPos().x, x0);
  // kein Platz links von der Wehe (das Heu reicht bis kurz davor; mit echten Maßen kommt das nicht vor, der Fuß liegt
  // immer mindestens 0,6 Pika-Breiten rechts vom Vorrat): ausgeblendet, Tipp ohne Antwort
  const u0 = c._a2SledU0();
  c._g = { ...c._g, hayR: foot - 20 };
  c._a2SledS = { drift: {}, u0 };
  c._a2FeederTemp = true;
  c._a2Scene();
  assert.ok(el.cls.has('a2hid'));
  assert.equal(c._a2FeederTap({ el }), false);
  c._a2SledS = null;
  c._a2Scene();
  assert.ok(!el.cls.has('a2hid'));
});

// 0.48.1: toter Code weg (Vorschau-Schalter, die niemand mehr setzt, eine Klasse ohne Stil)
test('Album 2: kein toter Code mehr (_dbgGimpel, _a2CameraDbgMotif, a2still)', () => {
  for (const f of ['album2-feeder.js', 'album2-camera.js']) {
    const s = fs.readFileSync(new URL('../src/karte/' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(s, /_dbgGimpel|_a2CameraDbgMotif|a2still/, f);
  }
});

// 0.48.1 (Nachtrag D): Tippflächen nur, wo gezeichnet ist (je Form ein Rechteck, 4 px Rand), nicht die ganze Box; was
// ausblendet, bekommt keine
test('Vogelhäuschen: Tippfläche nur auf der Zeichnung (Pfahl, Dach), nicht rechts neben dem Pfahl; ausgeblendet keine', () => {
  const { c } = karte(1);
  c._a2Scene();
  const el = c._a2Els.get('feeder');
  const rect = (l, t, r, b) => ({ getBoundingClientRect: () => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }), closest: () => null });
  el.getBoundingClientRect = () => ({ left: 100, top: 50, right: 140, bottom: 130, width: 40, height: 80 });
  el.querySelectorAll = () => [rect(100, 50, 140, 75), rect(117, 75, 123, 130)];
  const sr = { left: 0, top: 0 };
  const Z = [];
  c._a2Zones(Z, sr);
  assert.equal(Z.length, 2);
  const T = c.__proto__.constructor ? null : null;
  const hit = (x, y) => Z.some((z) => x >= z.l && x <= z.r && y >= z.t && y <= z.b);
  assert.ok(hit(120, 60), 'Dach');
  assert.ok(hit(120, 110), 'Pfahl');
  assert.ok(!hit(135, 110), 'rechts neben dem Pfahl: frei (der Stein bekommt den Tipp)');
  el.classList.add('a2out');
  const Z2 = [];
  c._a2Zones(Z2, sr);
  assert.equal(Z2.length, 0);
  el.classList.remove('a2out');
  el.classList.add('a2hid');
  c._a2Zones(Z2, sr);
  assert.equal(Z2.length, 0);
});
