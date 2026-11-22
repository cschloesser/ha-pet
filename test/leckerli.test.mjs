// Leckerli für Winter und Frühling (0.43): Haselnüsse, Bratapfel, Plätzchen, Möhre. node --test
// Geladen wird das gebaute Bündel in der Welt aus welt.mjs (eigene Uhr: so lässt sich der Monat stellen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const sek = (t) => Math.round(t / 1000) * 1000;
const W0 = welt();
const T0 = W0.T;
const P0 = T0.PikaPetCard.prototype;
// Inhalt Nummer i, wie ihn die Karte zeigt (GIFT_ITEMS selbst gibt das Bündel nicht heraus)
const item = (i) => P0._giftItem(i);
const TRE = 8; // ab hier Leckerli (GIFT_TRE)
const NEU = { 12: ['nuts', 'Haselnüsse', [10, 11, 0, 1]], 13: ['baked', 'Bratapfel', [11, 0, 1]], 14: ['cookie', 'Plätzchen', [11]], 15: ['carrot', 'Möhre', [2, 3]] };
const LECKERLI = [...Array(8).keys()].map((n) => TRE + n);
// Die Leckerli, die es im Monat mo gibt (0 = Januar)
const imMonat = (mo, bis = 16) => LECKERLI.filter((n) => n < bis && (!item(n).mo || item(n).mo.includes(mo)));

// Ein Element, soweit Auspacken und Tagebuch es anfassen
class El {
  constructor() {
    const s = new Set();
    this.classList = { add: (...k) => k.forEach((x) => s.add(x)), remove: (...k) => k.forEach((x) => s.delete(x)), contains: (k) => s.has(k), toggle() {} };
    this.style = {};
    this.kinder = [];
    this.weg = false;
  }

  querySelector() {
    return new El();
  }

  appendChild(k) {
    this.kinder.push(k);
    return k;
  }

  remove() {
    this.weg = true;
  }
}

test('Leckerli: sechzehn Inhalte, die alten an ihrem Platz, die vier neuen mit Name, Farbe und Monaten', () => {
  assert.deepEqual([...Array(16).keys()].map((i) => item(i).key),
    ['yarn', 'wheel', 'plush', 'shades', 'scope', 'hammock', 'can', 'bell', 'straw', 'rasp', 'apple', 'posy', 'nuts', 'baked', 'cookie', 'carrot']);
  // bis 0.42.2: Monate der vier alten unverändert (danach richten sich Karten, die noch nicht neu geladen sind)
  assert.deepEqual(plain([8, 9, 10, 11].map((i) => item(i).mo ?? null)), [[4, 5, 6], [6, 7, 8], [8, 9, 10], null]);
  for (const [i, [key, name, mo]] of Object.entries(NEU)) {
    const it = item(Number(i));
    assert.deepEqual([it.key, it.name, plain(it.mo)], [key, name, mo]);
    assert.match(it.color, /^#[0-9a-f]{6}$/, `${key}: Farbe`);
    // Dezember bis Februar und März, April: bisher gab es dort nur das Sträußchen
    assert.ok(mo.every((m) => m >= 10 || m <= 3), `${key}: ${mo}`);
  }
  // Mehr als 16 fasst gift.i nicht (vier Bits): eine 17. Zeile käme nie an
  assert.equal(item(16).key, 'posy');
});

test('Leckerli: jeder Monat bietet mindestens zwei, bis 0.42 gab es von Dezember bis April nur das Sträußchen', () => {
  const name = (L) => L.map((n) => item(n).key);
  const je = [...Array(12).keys()].map((mo) => name(imMonat(mo)));
  for (const [mo, L] of je.entries()) assert.ok(L.length >= 2, `Monat ${mo + 1}: ${L}`);
  assert.deepEqual(je, [
    ['posy', 'nuts', 'baked'], ['posy', 'nuts', 'baked'], ['posy', 'carrot'], ['posy', 'carrot'], ['straw', 'posy'], ['straw', 'posy'],
    ['straw', 'rasp', 'posy'], ['rasp', 'posy'], ['rasp', 'apple', 'posy'], ['apple', 'posy'], ['apple', 'posy', 'nuts'], ['posy', 'nuts', 'baked', 'cookie'],
  ]);
  // so war es bis 0.42.2 (nur die Nummern 8–11)
  assert.deepEqual([11, 0, 1, 2, 3].map((mo) => name(imMonat(mo, 12))), [['posy'], ['posy'], ['posy'], ['posy'], ['posy']]);
});

test('Auswahl: hängt nur an Nummer und Monat, auf allen Geräten gleich, jedes Leckerli des Monats kommt vor', () => {
  // ein zweites Gerät: eigenes Bündel, eigene Uhr (ein halbes Jahr später geladen)
  const P1 = welt({ start: new Date(2027, 5, 3, 9).getTime() }).T.PikaPetCard.prototype;
  for (let mo = 0; mo < 12; mo++) {
    const pool = imMonat(mo);
    const seen = new Set();
    for (let z = 1; z <= 300; z++) {
      const n = P0._giftTreat(z, mo);
      assert.equal(n, P0._giftTreat(z, mo));
      assert.equal(n, P1._giftTreat(z, mo), `Päckchen ${z}, Monat ${mo + 1}: zweites Gerät`);
      // dieselbe Formel wie bis 0.42.2, nur mit den Leckerli von heute
      assert.equal(n, pool[Math.floor(T0.seedRnd('gtreat', z) * pool.length)]);
      seen.add(n);
    }
    assert.deepEqual([...seen].sort((a, b) => a - b), pool, `Monat ${mo + 1}`);
  }
  // Mai bis Oktober kam nichts dazu: Dort würfelt eine Karte mit 0.42.2 dasselbe (verschenken zwei Geräte in derselben
  // Sekunde, sind sie sich einig)
  for (let mo = 4; mo <= 9; mo++) assert.deepEqual(imMonat(mo), imMonat(mo, 12), `Monat ${mo + 1}`);
});

// _giftPick auf einer Karte, deren Uhr auf dem Monat mo steht (Tag 15, mittags). lat: Breite des Hauses
const wuerfeln = (mo, lat, G, n = 200) => {
  const W = welt({ start: new Date(2026, mo, 15, 12).getTime() });
  const c = Object.create(W.T.PikaPetCard.prototype);
  c._hass = lat == null ? null : { config: { latitude: lat } };
  return { c, alle: [...Array(n).keys()].map((z) => c._giftPick(G, z + 1, false)) };
};

test('Auswahl: der Monat des Geräts, das verschenkt (Südhalbkugel um ein halbes Jahr versetzt), Schätze gehen vor', () => {
  const voll = { u: 255, v: 0xffff }; // alle Schätze golden: Es gibt nur noch Leckerli
  const arten = (mo, lat) => [...new Set(wuerfeln(mo, lat, voll).alle)].sort((a, b) => a - b);
  assert.deepEqual(arten(11, 50), [11, 12, 13, 14]);
  assert.deepEqual(arten(0, 50), [11, 12, 13]);
  assert.deepEqual(arten(2, null), [11, 15]);
  assert.deepEqual(arten(10, 50), [10, 11, 12]);
  assert.deepEqual(arten(6, 50), [8, 9, 11]);
  // Südhalbkugel: Dezember ist dort Sommer (Erdbeere), Juni Winter (Haselnüsse, Bratapfel, Plätzchen)
  assert.deepEqual(arten(11, -34), [8, 11]);
  assert.deepEqual(arten(5, -34), [11, 12, 13, 14]);
  // Fehlt noch ein Schatz, ist das erste Päckchen einer (und nie ein Leckerli mit einer Nummer unter 8)
  const { c, alle } = wuerfeln(11, 50, { u: 0, v: 0 }, 60);
  assert.ok(alle[0] < TRE);
  assert.ok(alle.some((n) => n >= 12) && alle.some((n) => n < TRE));
  alle.forEach((n, z) => assert.equal(n < TRE, W0.T.giftTre(z + 1), `Päckchen ${z + 1}`));
  // Vorschau: genau dieses Leckerli
  c._dbgTreat = 15;
  assert.equal(c._giftPick({ u: 0, v: 0 }, 1, false), 15);
  c._dbgTreat = null;
  assert.ok(c._giftPick({ u: 0, v: 0 }, 1, false) < TRE);
});

test('Tagesplan: ein neues Leckerli übersteht Schreiben und Lesen, der Text wird nicht länger, das Album bleibt', () => {
  const t0 = W0.jetzt();
  let P = T0.planBlank(t0);
  for (const op of [{ t: 'gstart', k: sek(t0 - 5 * 864e5) }, { t: 'gdbg', f: { n: 3, y: 2, u: 0b1010, v: 0b10, z: 40, o: 40, f: 12, p: sek(t0 - 36e5) } }]) P = T0.planApply(P, op, t0);
  const lang = [];
  for (const gold of [false, true]) {
    for (const i of LECKERLI) {
      const Q = T0.planApply(P, { t: 'give', z: 41, i: i + (gold ? 16 : 0), gold, x: sek(t0), r: 35 }, t0);
      assert.deepEqual([Q.gift.z, Q.gift.i, Q.gift.n, Q.gift.y], [41, i + (gold ? 16 : 0), gold ? 3 : 2, gold ? 1 : 2]);
      // ein Leckerli ändert weder Album noch Stufen
      assert.deepEqual([Q.gift.u, Q.gift.v], [0b1010, 0b10]);
      const s = T0.planSer(Q);
      lang.push(s.length);
      const R = T0.planParse(s);
      assert.deepEqual(plain(R.gift), plain(Q.gift), `Nummer ${i}${gold ? ' golden' : ''}`);
      assert.equal(R.gift.i & 15, i);
      assert.equal(T0.planSer(R), s);
      // ausgepackt: wie jedes andere
      assert.equal(T0.planApply(R, { t: 'gopen', z: 41 }, t0).gift.o, 41);
    }
  }
  // alle 16 gleich lang wie mit dem Sträußchen (Nummer 11), golden wie nicht
  assert.deepEqual([...new Set(lang)], [lang[3]]);
  // … und der Plan-Text unterscheidet sich nur in der einen Stelle am Ende
  const mit = (i) => T0.planSer(T0.planApply(P, { t: 'give', z: 41, i, gold: false, x: sek(t0), r: 35 }, t0));
  assert.equal(mit(11).slice(0, -1), mit(14).slice(0, -1));
  assert.deepEqual([mit(11).at(-1), mit(12).at(-1), mit(15).at(-1)], ['b', 'c', 'f']);
});

// Eine Welt mit Helfern und einem Päckchen im Vorrat; alle Schätze sind golden, es gibt also nur noch Leckerli
const zuhause = (start) => {
  const W = welt(start == null ? undefined : { start });
  const { T } = W;
  const t0 = W.jetzt();
  let P = T.planBlank(t0);
  for (const op of [{ t: 'gstart', k: sek(t0 - 5 * 864e5) }, { t: 'gdbg', f: { n: 2, a: 10, f: 3, u: 255, v: 0xffff, z: 6, o: 6, p: sek(t0 - 36e5) } }]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 50, g: 50 }), 'anfang', { max: 100 });
  return W;
};

test('Zwei Karten: Ein Gerät verschenkt Plätzchen, beide lesen dieselbe Nummer aus dem Plan, belohnt wird einmal', async () => {
  const W = zuhause(new Date(2026, 11, 6, 12).getTime());
  const A = W.karte('A', { gifts: true });
  const B = W.karte('B', { gifts: true });
  await W.vor(1000);
  // die Belohnung (in welt.mjs stillgelegt) soll hier echt laufen
  for (const K of [A, B]) {
    delete K.c._giftCredit;
    K.c._layout();
  }
  const vorher = A.werte();
  A.c._dbgTreat = 14;
  A.c._onGiftBtn();
  A.c._dbgTreat = null;
  assert.equal(A.c._plan.gift.i, 14);
  await W.vor(2000);
  for (const K of [A, B]) {
    K.c._giftCredit();
    assert.deepEqual([K.c._plan.gift.z, K.c._plan.gift.i, K.c._plan.gift.n], [7, 14, 1], K.name);
    assert.equal(K.c._giftOwn ?? null, null, K.name);
  }
  assert.equal(W.T.planParse(W.ha.wert(PLAN)).gift.i, 14);
  // Leckerli: Satt +15 und Glück +15, einmal (auf dem Gerät, das verschenkt hat; B liest denselben Zustand)
  await W.vor(3000);
  const nachher = A.werte();
  assert.ok(Math.abs(nachher.s - vorher.s - W.T.GIFT.treat) < 0.5, `Satt ${vorher.s} → ${nachher.s}`);
  assert.ok(Math.abs(nachher.g - vorher.g - W.T.GIFT.joy) < 0.5, `Glück ${vorher.g} → ${nachher.g}`);
  assert.deepEqual(B.werte(), nachher);
  // Der Schatz-Stand bleibt, auch solange das Päckchen fliegt (z > o): Ein Leckerli versteckt keinen Schatz
  assert.equal(A.c._plan.gift.z > A.c._plan.gift.o, true);
  assert.deepEqual(plain(B.c._giftInfo().lvs), [3, 3, 3, 3, 3, 3, 3, 3]);
  W.pruefe();
});

// Auspacken wie in _giftOpen, ohne Szene: was er sagt und frisst. item: die Nummer am Ballon
const auspacken = async (W, nr, z = 7) => {
  const { T } = W;
  W.dok.createElement = () => new El();
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  const B = { z, el: new El(), x: 300, gold: false, item: nr, stage: 'ground' };
  const leer = () => {};
  Object.assign(c, {
    _el: { pika: new El(), fx: new El() }, _g: { gy: 200, pW: 100 }, _H: 248, _x: 100, _gb: B, _plan: { gift: { z, o: z - 1, u: 255, v: 0xffff, i: nr & 15 } },
    _say: (t) => ruf.push(['sagt', t]), _wait: async () => {}, _walkTo: async () => {}, _face: leer, _sparkle: leer, _cls: leer, _mimik: leer,
    _happy: leer, _jump: leer, _giftFromPlan: () => ruf.push(['plan']), _planOp: (op) => ruf.push(['op', op.t, op.z]),
    _eat: async (farbe, ms, svg) => ruf.push(['frisst', farbe, svg]), _giftStow: async () => ruf.push(['verstaut']),
    _giftFeier: async (was) => ruf.push(['feier', was]),
  });
  await c._giftOpen();
  return { ruf, c, B, gezeigt: c._el.fx.kinder[0] };
};

test('Auspacken: Jedes neue Leckerli hält er hoch und frisst es; eine unbekannte Nummer zeigt das Sträußchen und wirft nicht', async () => {
  const W = welt();
  const posy = item(11);
  for (const nr of [8, 11, 12, 13, 14, 15, 16, 99]) {
    const it = nr < 16 ? W.T.PikaPetCard.prototype._giftItem(nr) : null;
    const { ruf, c, B, gezeigt } = await auspacken(W, nr);
    const soll = it || posy;
    assert.deepEqual(ruf, [['sagt', '!'], ['op', 'gopen', 7], ['sagt', `${soll.name}!`], ['frisst', soll.color, soll.svg], ['plan']], `Nummer ${nr}`);
    assert.equal(gezeigt.innerHTML, soll.svg);
    assert.ok(gezeigt.classList.contains('eat') && gezeigt.weg, `Nummer ${nr}: Bild wieder weg`);
    // aufgeräumt: kein Päckchen mehr, nichts versteckt
    assert.deepEqual([c._gb, c._giftHide, B.stage, B.el.classList.contains('fade')], [null, null, 'open', true]);
  }
  // das zehnte Päckchen: Die Feier fällt auch mit einem neuen Leckerli nicht aus
  const { ruf } = await auspacken(W, 13, 10);
  assert.deepEqual(ruf.slice(-2), [['feier', 10], ['plan']]);
});

test('Tagebuch: Eintrag mit Name und Bild des neuen Leckerlis, aus dem Verlauf des Plans gelesen; unbekannte Nummer ohne Namen', async () => {
  const W = zuhause();
  const { T } = W;
  const K = W.karte('K', { gifts: true });
  await W.vor(1000);
  const t0 = W.jetzt();
  // Verlauf wie im Recorder: verschenkt (z + 1, Nummer i), dann ausgepackt (o + 1)
  const P = [{ t: t0 - 9e5, v: T.planParse(W.ha.wert(PLAN)) }];
  const schenken = (t, i, gold = false) => {
    const a = P.at(-1).v;
    const b = T.planApply(T.planApply(a, { t: 'gdbg', f: gold ? { y: 1 } : { n: 1 } }, t), { t: 'give', z: a.gift.z + 1, i: i + (gold ? 16 : 0), gold, x: sek(t), r: 1 }, t);
    P.push({ t, v: b }, { t: t + 30000, v: T.planApply(b, { t: 'gopen', z: b.gift.z }, t + 30000) });
  };
  [12, 13, 14, 15].forEach((i, n) => schenken(t0 - 8e5 + n * 6e4, i, i === 13));
  const R = T.diaryDerive([], P, t0 - 1e6, { decayAt: () => Infinity, until: t0 });
  const pakete = plain(R.ev.filter((e) => e.k === 'parcel'));
  assert.deepEqual(pakete.map((e) => [e.it, e.what, e.gold, e.o]), [[12, 'treat', false, 7], [13, 'treat', true, 8], [14, 'treat', false, 9], [15, 'treat', false, 10]]);
  assert.equal(pakete[3].mile, true);
  // die Sätze der Karte
  const c = K.c;
  const satz = (e) => c._diaryParcel(e, t0);
  assert.match(satz(pakete[0]), /Drin war ein Leckerli: Haselnüsse\. Sofort aufgefuttert!$/);
  assert.match(satz(pakete[1]), /^Ein goldenes Päckchen!.* Drin war ein Leckerli: Bratapfel\. Sofort aufgefuttert!$/);
  assert.match(satz(pakete[2]), /Leckerli: Plätzchen\./);
  assert.match(satz(pakete[3]), /Leckerli: Möhre\./);
  // eine Nummer aus einer späteren Version: kein Name, kein „undefined“, kein Fehler
  for (const nr of [16, 99]) {
    const s = satz({ it: nr, what: 'treat', gold: false });
    assert.match(s, /Drin war ein Leckerli\. Sofort aufgefuttert!$/);
    assert.doesNotMatch(s, /undefined|null|:\s*\./);
  }
  assert.doesNotMatch(satz({ it: undefined, what: 'new', gold: false }), /undefined|Leckerli/);
  // die Seite von heute: jedes Päckchen mit dem Bild seines Inhalts, die unbekannte Nummer mit dem Sträußchen
  c._dbgDiary = () => ({ ev: [...pakete, { t: t0 - 1e5, k: 'parcel', it: 99, what: 'treat', gold: false }], stamps: [], pets: {} });
  const D = await c._diaryBuild();
  const zeilen = D.days[0].entries.filter((e) => e.icon === 'parcel' && /Leckerli/.test(e.text));
  assert.deepEqual(plain(zeilen.map((e) => e.svg)), [item(12).svg, item(13).svg, item(14).svg, item(15).svg, item(11).svg]);
  assert.match(zeilen[4].text, /Drin war ein Leckerli\. Sofort aufgefuttert!$/);
  // das zehnte Päckchen: der Meilenstein steht dahinter
  assert.ok(D.days[0].entries.some((e) => /10\. Päckchen/.test(e.text)));
  W.pruefe();
});

// (Eine unbekannte Nummer kann hier nicht ankommen: gift.i hat vier Bits, und alle 16 sind vergeben.)
test('Schätze: Ein Leckerli am Ballon (jede Nummer 11–15, auch golden verpackt) lässt das Album, wie es ist', async () => {
  const W = zuhause();
  const K = W.karte('K', { gifts: true });
  await W.vor(1000);
  const c = K.c;
  c._blooms ??= [];
  const album = (i) => {
    c._plan = { ...c._plan, gift: { ...c._plan.gift, u: 0b01011010, v: 0b00001000, z: 7, o: 6, i } };
    return { lvs: plain(c._giftInfo().lvs), html: c._diaryTreasures() };
  };
  for (const i of [11, 12, 13, 14, 15, 12 + 16, 15 + 16]) {
    const { lvs, html } = album(i);
    assert.deepEqual(lvs, [0, 1, 0, 2, 1, 0, 1, 0], `Nummer ${i}`);
    assert.match(html, /4 von 8 hab ich schon/);
    assert.doesNotMatch(html, /undefined|NaN/);
  }
  // zum Vergleich: Fliegt der Schatz 3 (Sonnenbrille) noch am Ballon, zeigt das Album ihn eine Stufe tiefer
  assert.deepEqual(album(3).lvs, [0, 1, 0, 1, 1, 0, 1, 0]);
});

test('Grafik der neuen Leckerli: 24 × 24 wie die alten, ohne id und class, keine kaputten Zahlen', () => {
  const alle = [...Array(16).keys()].map((i) => item(i).svg);
  // Die Grafiken stehen mehrfach im Dokument (Szene, Maul, Tagebuch): Eine id gäbe es dann doppelt, und mit denen der
  // Pika-Grafik (fur, bodyclip …) stieße sie zusammen. Wie die acht Schätze und vier alten Leckerli haben sie keine.
  for (const s of alle) assert.doesNotMatch(s, /\sid=/);
  for (const i of [12, 13, 14, 15]) {
    const { svg, key } = item(i);
    assert.match(svg, /^<svg viewBox="0 0 24 24" aria-hidden="true">/, key);
    assert.match(svg, /<\/svg>$/, key);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity|null|<!--|\$\{/, key);
    // _mouth setzt das Innere in die Pika-Grafik: Dort griffen deren Regeln nach Klassen, und ids gäbe es doppelt
    assert.doesNotMatch(svg, /\sclass=|\sid=|<defs|<style|url\(#|href=/, key);
    const innen = svg.replace(/^\s*<svg[^>]*>|<\/svg>\s*$/g, '');
    assert.doesNotMatch(innen, /<svg|<\/svg>/, key);
    const auf = (svg.match(/<g[\s>]/g) || []).length;
    assert.equal(auf, (svg.match(/<\/g>/g) || []).length, `${key}: <g> ausgeglichen`);
    assert.equal((svg.match(/<(path|circle|ellipse|rect)\b/g) || []).length, (svg.match(/\/>/g) || []).length, `${key}: jede Form geschlossen`);
    // Zahlen: höchstens zwei Nachkommastellen, alles in der Nähe des Bildes (24 × 24, die Möhre ist gedreht)
    const zahlen = [...svg.replace(/#[0-9a-f]{3,6}/gi, '').matchAll(/-?\d*\.?\d+/g)].map((m) => m[0]);
    for (const z of zahlen) {
      assert.ok(Number.isFinite(Number(z)) && Math.abs(Number(z)) <= 38, `${key}: Zahl ${z}`);
      assert.ok(!/\.\d{3,}/.test(z), `${key}: ${z} hat zu viele Nachkommastellen`);
    }
    // Umriss in der Farbe des Pikas, wie bei Erdbeere und Apfelschnitz
    assert.ok(svg.includes('stroke="#5a4030"'), `${key}: Umriss`);
    assert.ok(svg.length < 2600, `${key}: ${svg.length} Zeichen`);
  }
  // keine zwei Inhalte teilen sich Schlüssel oder Bild
  assert.equal(new Set(alle).size, 16);
  assert.equal(new Set([...Array(16).keys()].map((i) => item(i).key)).size, 16);
});

// Ein Urlaubs-Schritt ohne Urlaub im Plan (und ohne Beginn) warf "Cannot read properties of null (reading 'd')";
// die Änderung blieb dann 30 Minuten in der Liste und jede weitere am Plan scheiterte mit.
test('Tagesplan: voff und vclear ohne Urlaub im Plan werfen nicht', async () => {
  const L = await import('../src/logik/tagesplan.js');
  const P = L.planBlank(Date.UTC(2026, 10, 22, 12));
  for (const op of [{ t: 'vclear' }, { t: 'vclear', t0: 5 }, { t: 'voff' }, { t: 'voff', t0: 5, d: 60000 }]) {
    assert.doesNotThrow(() => L.planApply(P, op, Date.UTC(2026, 10, 22, 12)));
    assert.equal(L.planApply(P, op, Date.UTC(2026, 10, 22, 12)).ur, null);
  }
});
