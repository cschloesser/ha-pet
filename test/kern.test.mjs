// Kern der Karte in der Testwelt (welt.mjs): Vorschau im Editor, Echo oder fremder Stand (Kennungen von HA), der
// Zeitgeber für unbestätigte Schreiben, Schlüssel im Browser beim Umbenennen, Namen, gebündeltes Auslegen und die
// Nachbesserungen am Tagesplan von 0.42.2. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const sek = (t) => Math.round(t / 1000) * 1000;
const CFG = { name: 'Pika', entity: ZUSTAND, plan_entity: PLAN, sleep_start: '21:00', sleep_end: '07:00' };

// Eine Welt mit gefüllten Helfern (wie in zwei-karten.test.mjs): Zustand 60/60 von eben, im Plan zwei Päckchen im
// Vorrat, drei Freundschaftstage, heute dreimal gestreichelt, ein Erlebnis. max: max. Länge des Plan-Helfers.
const anfang = (opt, max = 255) => {
  const W = welt(opt);
  const { T } = W;
  const t0 = W.jetzt();
  const tag = T.pikaDay(t0);
  let P = T.planBlank(t0);
  for (const op of [
    { t: 'gstart', k: sek(t0 - 5 * 864e5) },
    { t: 'gdbg', f: { n: 2, a: 10, f: 3, p: sek(t0 - 36e5) } },
    { t: 'pet', d: tag, n: 3 },
    { t: 'mem', d: tag, b: 1 },
  ]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 60, g: 60 }), 'anfang', { max: 100 });
  const helfer = () => T.planParse(W.ha.wert(PLAN));
  return { W, T, tag, helfer, gift: () => plain(helfer().gift), cute: () => plain(helfer().cute), stand: () => T.parseStats(W.ha.wert(ZUSTAND)) };
};
const einig = (W, T, ...karten) => {
  for (const K of karten) {
    assert.equal(T.planSer(K.c._plan), W.ha.wert(PLAN), `${K.name} sieht den Plan aus dem Helfer`);
    assert.equal(K.c._planSent.length, 0, `${K.name}: kein Schreiben des Plans ohne Echo`);
    assert.ok(!K.c._planOps.some((o) => o.at > K.c._planAck), `${K.name}: keine unbestätigte Änderung`);
    assert.equal(K.c._sent.length, 0, `${K.name}: kein Schreiben des Zustands ohne Echo`);
  }
};
const um = (a, b, tol = 0.3) => Math.abs(a - b) <= tol;

// ---------- Vorschau im Editor (Fehler Nr. 16 der Durchsicht) ----------

test('Vorschau im Editor (preview = true): Ein versehentlich gewählter Helfer wird nicht mit Startwerten überschrieben, die Karte spielt im Speicher', async () => {
  const { W } = anfang();
  const FREMD = 'input_text.einkauf';
  W.ha.setze(FREMD, 'Milch, Brot', 'anfang', { max: 100 });
  // Im Editor ist im Feld „Zustand“ der falsche Text-Helfer gewählt. HA setzt preview nach dem ersten hass.
  const V = W.karte('V', { entity: FREMD });
  V.c.preview = true;
  await W.vor(10 * 6e4);
  assert.equal(W.ha.wert(FREMD), 'Milch, Brot', 'der fremde Helfer bleibt, wie er war');
  assert.deepEqual(V.aufrufe, []);
  assert.ok(V.c._stats && V.werte().s > 50, 'sie zeigt Startwerte');
  // Füttern und Streicheln in der Vorschau: im Speicher, nichts geht hinaus, auch nicht beim Verstecken (pagehide,
  // _flush) oder Abhängen, und kein Zeitgeber wartet darauf
  const s0 = V.werte().s;
  V.fuettern(10);
  V.streicheln();
  await W.vor(60000);
  assert.ok(um(V.werte().s, Math.min(100, s0 + 10), 0.5), `satt ${s0} → ${V.werte().s}`);
  assert.equal(V.plan().cute.n, 4, 'gestreichelt ist bei ihr schon');
  V.verstecken();
  await W.vor(60000);
  V.zeigen();
  await W.vor(60000);
  assert.deepEqual(V.aufrufe, []);
  assert.deepEqual([V.c._saveT, V.c._sentT, V.c._planT, V.c._planRT].map((x) => x ?? null), [null, null, null, null], 'kein Zeitgeber fürs Speichern');
  V.abhaengen();
  await W.vor(60000);
  assert.deepEqual(V.aufrufe, []);
  assert.equal(W.wecker(), 0, 'abgehängt läuft kein Zeitgeber mehr');
  assert.equal(W.warnungen.length, 1);
  assert.match(W.warnungen[0], /enthält "Milch, Brot", fange neu an/);
  // Gegenprobe, dieselbe Karte ohne Vorschau (so gespeichert, das Dashboard wird nicht mehr bearbeitet): Mit dem
  // nächsten hass schreibt sie wie bisher Startwerte samt dem Gefütterten in den Helfer
  V.einhaengen();
  V.c.preview = false;
  W.regung();
  await W.vor(5000);
  assert.equal(V.geschrieben(FREMD).length, 1);
  assert.ok(W.T.parseStats(W.ha.wert(FREMD)), 'jetzt steht ein Zustand im Helfer');
  assert.equal(V.c._saveHeld, false);
});

test('Vorschau im Editor: mit den richtigen Helfern liest sie mit und führt zusammen, schreibt aber weder Zustand noch Tagesplan; danach geht alles hinaus', async () => {
  const { W, T, tag, stand, cute } = anfang();
  const V = W.karte('V');
  V.c.preview = true;
  const B = W.karte('B'); // die Karte im Dashboard eines anderen Geräts
  await W.vor(100);
  V.fuettern(10);
  V.streicheln(0);
  V.c._planOp({ t: 'mem', d: tag, b: 4 });
  await W.vor(30000);
  assert.deepEqual(V.aufrufe, [], 'die Vorschau schreibt nichts');
  assert.ok(um(stand().s, 60), `im Helfer weiter satt ${stand().s}`);
  assert.deepEqual(cute(), { d: tag, n: 3, m: 1 });
  assert.ok(um(V.werte().s, 70), `in der Vorschau satt ${V.werte().s}`);
  assert.deepEqual([V.plan().cute.n, V.plan().cute.m], [4, 5]);
  // Ein anderes Gerät füttert und streichelt: Die Vorschau führt es im Speicher mit ihrem Stand zusammen
  B.fuettern(5);
  B.streicheln(0);
  await W.vor(30000);
  assert.ok(um(stand().s, 65), `im Helfer satt ${stand().s}`);
  assert.ok(um(V.werte().s, 75), `in der Vorschau satt ${V.werte().s} (60 + 5 von B + 10 von hier)`);
  assert.equal(cute().n, 4);
  assert.equal(V.plan().cute.n, 5, 'ihr Streicheln zählt auf das von B obendrauf');
  assert.deepEqual(V.aufrufe, []);
  assert.deepEqual([V.c._saveT, V.c._planT, V.c._planRT].map((x) => x ?? null), [null, null, null]);
  // Die Vorschau endet an derselben Karte (das Dashboard wird nicht mehr bearbeitet): Mit dem nächsten hass geht ihr
  // Stand hinaus, auf den von dann gelegt
  V.c.preview = false;
  W.regung();
  await W.vor(20000);
  assert.ok(um(stand().s, 75), `satt ${stand().s}`);
  assert.deepEqual(cute(), { d: tag, n: 5, m: 5 });
  assert.deepEqual([V.geschrieben(ZUSTAND).length, V.geschrieben(PLAN).length], [1, 1]);
  einig(W, T, V, B);
  assert.deepEqual(W.warnungen, []);
});

// ---------- Echo oder fremder Stand (Fehler Nr. 17 der Durchsicht) ----------

// Zwei Geräte füttern in derselben Sekunde und streicheln im selben Augenblick: Beide senden denselben Text, das
// zweite Schreiben ändert in HA nichts mehr. antwort: Die Antwort auf das eigene Schreiben kommt vor oder nach dem
// neuen Stand bei der Karte an.
const zugleich = async (antwort, opt) => {
  const { W, T, tag, stand, cute } = anfang(opt);
  const A = W.karte('A');
  const B = W.karte('B');
  A.antwort = B.antwort = antwort;
  await W.vor(100);
  A.fuettern(10);
  B.fuettern(10);
  A.c._petCount();
  B.c._petCount();
  // (der Plan geht nach 0,4 s hinaus, der Zustand nach 1,2 s)
  await W.vor(430);
  assert.equal(A.geschrieben(PLAN)[0], B.geschrieben(PLAN)[0], 'beide senden denselben Plan');
  assert.equal(W.ha.zeilen(PLAN).length, 2, 'das zweite Schreiben ändert in HA nichts');
  await W.vor(800);
  assert.equal(A.geschrieben(ZUSTAND)[0], B.geschrieben(ZUSTAND)[0], 'und denselben Zustand');
  assert.equal(W.ha.zeilen(ZUSTAND).length, 2);
  await W.vor(20000);
  return { W, T, tag, stand, cute, A, B };
};
for (const antwort of ['zuerst', 'danach']) {
  test(`Zwei Geräte zugleich, derselbe Text: beide Portionen und beide Streichler zählen (Antwort von HA ${antwort === 'zuerst' ? 'vor' : 'nach'} dem neuen Stand)`, async () => {
    const { W, T, tag, stand, cute, A, B } = await zugleich(antwort);
    assert.ok(um(stand().s, 80), `satt ${stand().s} (60 + 10 + 10)`);
    assert.deepEqual(cute(), { d: tag, n: 5, m: 1 }, 'zweimal gestreichelt sind zwei mehr');
    assert.deepEqual([A.geschrieben(ZUSTAND).length, B.geschrieben(ZUSTAND).length], [1, 2], 'B legt seine Portion noch einmal obendrauf');
    assert.deepEqual([A.geschrieben(PLAN).length, B.geschrieben(PLAN).length], [1, 2]);
    assert.deepEqual(A.werte(), B.werte());
    einig(W, T, A, B);
    // Das eigene Echo zählt weiter nur einmal, in beiden Reihenfolgen
    A.fuettern(5);
    A.c._petCount();
    await W.vor(20000);
    B.fuettern(5);
    B.c._petCount();
    await W.vor(20000);
    assert.ok(um(stand().s, 90), `satt ${stand().s}`);
    assert.equal(cute().n, 7);
    assert.deepEqual([A.geschrieben(ZUSTAND).length, B.geschrieben(ZUSTAND).length], [2, 3]);
    assert.deepEqual([A.geschrieben(PLAN).length, B.geschrieben(PLAN).length], [2, 3]);
    einig(W, T, A, B);
    // Drei auf einmal: Auch das dritte geht nicht unter
    const C = W.karte('C');
    C.antwort = antwort;
    await W.vor(100);
    for (const K of [A, B, C]) {
      K.fuettern(2);
      K.c._petCount();
    }
    await W.vor(30000);
    assert.ok(um(stand().s, 96), `satt ${stand().s} (90 + 3 × 2)`);
    assert.equal(cute().n, 10);
    einig(W, T, A, B, C);
    assert.deepEqual(W.warnungen, []);
  });
}

for (const antwort of ['zuerst', 'danach']) {
  test(`Zwei Geräte streicheln im selben Augenblick: beide zählen (Antwort von HA ${antwort === 'zuerst' ? 'vor' : 'nach'} dem neuen Stand)`, async () => {
    const { W, T, tag, cute } = anfang();
    const A = W.karte('A');
    const B = W.karte('B');
    A.antwort = B.antwort = antwort;
    await W.vor(100);
    A.c._petCount();
    B.c._petCount();
    await W.vor(430);
    assert.equal(A.geschrieben(PLAN)[0], B.geschrieben(PLAN)[0], 'beide senden denselben Plan');
    assert.equal(W.ha.zeilen(PLAN).length, 2, 'das zweite Schreiben ändert in HA nichts');
    assert.equal(cute().n, 4);
    await W.vor(20000);
    assert.deepEqual(cute(), { d: tag, n: 5, m: 1 }, 'zweimal gestreichelt sind zwei mehr');
    assert.deepEqual([A.geschrieben(PLAN).length, B.geschrieben(PLAN).length], [1, 2], 'B zählt sein Streicheln noch einmal obendrauf');
    assert.equal(B.c._planSeq, 2);
    einig(W, T, A, B);
    // Dasselbe zur selben Zeit, das kein Streicheln ist (beide tragen dieselbe Beschäftigung ein): Da zählt nichts doppelt
    A.c._planOp({ t: 'rec', k: 1000, a: 'paint', v: 'blume' });
    B.c._planOp({ t: 'rec', k: 1000, a: 'paint', v: 'blume' });
    await W.vor(20000);
    assert.equal(cute().n, 5);
    assert.deepEqual([A.geschrieben(PLAN).length, B.geschrieben(PLAN).length], [2, 3]);
    einig(W, T, A, B);
    assert.deepEqual(W.warnungen, []);
  });
}

test('Zwei Geräte zugleich an einem HA ohne Kennungen (ältere Version): Es bleibt beim Wortlaut, nichts zählt doppelt', async () => {
  const { W, T, tag, stand, cute, A, B } = await zugleich('danach', { kontext: false });
  // wie bis 0.43.0: Das zweite Gerät hält den gleichlautenden Stand für sein Echo
  assert.ok(um(stand().s, 70), `satt ${stand().s}`);
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 });
  assert.deepEqual([A.geschrieben(ZUSTAND).length, B.geschrieben(ZUSTAND).length], [1, 1]);
  einig(W, T, A, B);
  A.fuettern(5);
  await W.vor(20000);
  assert.ok(um(stand().s, 75), `satt ${stand().s}`);
  einig(W, T, A, B);
});

// ---------- Unbestätigte Schreiben des Zustands: Zeitgeber, Wiedereinhängen ----------

test('Zustand: ohne Echo und ohne hass schaut die Karte höchstens 30 Min lang nach – liefert HA wieder, geht es weiter', async () => {
  const { W, T, stand } = anfang();
  const A = W.karte('A');
  await W.vor(100);
  const ruhe = W.wecker(); // die Takte der eingehängten Karte
  // Ein Schreiben ohne Echo, und HA meldet nichts mehr (kein hass): Die Prüfung stellt sich mit wachsender Pause neu
  A.leitung = 'verlieren';
  A.fuettern(10);
  await W.vor(10 * 6e4);
  assert.equal(A.c._sent.length, 1);
  assert.equal(W.wecker(), ruhe + 1, 'die Prüfung läuft noch');
  await W.vor(25 * 6e4);
  assert.equal(W.wecker(), ruhe, 'nach 30 Min ruht sie');
  assert.equal(A.c._sent.length, 1, 'das Schreiben gilt weiter als unbestätigt');
  await W.vor(3 * 36e5);
  assert.equal(W.wecker(), ruhe);
  // HA liefert wieder: Jetzt wird wieder nachgesehen, das Schreiben gilt als verloren und geht neu hinaus
  A.leitung = 'sofort';
  W.regung();
  await W.vor(20000);
  assert.equal(A.geschrieben(ZUSTAND).length, 2);
  assert.ok(um(stand().s, 70), `satt ${stand().s}`);
  assert.equal(W.ha.wert(ZUSTAND), T.serialize(A.c._stats));
  einig(W, T, A);
});

test('Zustand: eine abgehängte Karte hält für ein unbestätigtes Schreiben keinen Zeitgeber am Leben – wieder eingehängt, schaut sie wieder nach', async () => {
  const { W, T } = anfang();
  const A = W.karte('A');
  await W.vor(100);
  A.leitung = 'verlieren';
  A.fuettern(10);
  await W.vor(2000);
  assert.equal(A.c._sent.length, 1);
  // andere Ansicht, oder die Karte ist ganz weggeworfen: Bis 0.43.0 stellte sich die Prüfung alle 5 Min neu, für immer
  A.abhaengen();
  await W.vor(1000);
  assert.equal(W.wecker(), 0, 'eine abgehängte Karte hält keinen Zeitgeber');
  await W.vor(3 * 36e5);
  assert.equal(W.wecker(), 0);
  assert.equal(A.geschrieben(ZUSTAND).length, 1);
  assert.equal(A.c._sent.length, 1, 'das Schreiben gilt weiter als unbestätigt');
  // Wieder eingehängt: Es wird wieder nachgesehen und neu gesendet
  A.leitung = 'sofort';
  A.einhaengen();
  await W.vor(20000);
  assert.equal(A.geschrieben(ZUSTAND).length, 2);
  assert.equal(W.ha.wert(ZUSTAND), T.serialize(A.c._stats));
  einig(W, T, A);
  assert.deepEqual(W.warnungen, []);
});

test('Zustand: ein abgelehntes Schreiben sendet eine abgehängte Karte nicht immer wieder neu – erst, wenn sie wieder eingehängt ist', async () => {
  const { W, T } = anfang();
  const A = W.karte('A');
  await W.vor(100);
  A.leitung = 'ablehnen';
  A.fuettern(1);
  await W.vor(1500);
  assert.equal(A.geschrieben(ZUSTAND).length, 1);
  A.abhaengen();
  await W.vor(36e5);
  assert.equal(A.geschrieben(ZUSTAND).length, 1, 'kein neuer Versuch aus der abgehängten Karte');
  assert.equal(W.wecker(), 0);
  A.leitung = 'sofort';
  A.einhaengen();
  await W.vor(20000);
  assert.equal(A.geschrieben(ZUSTAND).length, 2);
  assert.equal(W.ha.wert(ZUSTAND), T.serialize(A.c._stats));
  einig(W, T, A);
  assert.equal(W.warnungen.length, 1);
});

// weg: so lange nach dem Füttern wird A abgehängt (das Schreiben geht nach 1,2 s hinaus: davor oder danach)
const doppelt = async (weg) => {
  const { W, T, stand } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  await W.vor(100);
  // A füttert, und noch vor dem Echo wechselt die Ansicht
  A.fuettern(10);
  await W.vor(weg);
  assert.equal(A.geschrieben(ZUSTAND).length, weg > 1200 ? 1 : 0);
  A.abhaengen();
  await W.vor(5000);
  assert.equal(A.geschrieben(ZUSTAND).length, 1);
  assert.ok(um(stand().s, 70), 'das Füttern ist in HA angekommen');
  assert.equal(A.c._sent.length, 1, 'A hat das Echo nicht mehr bekommen');
  // B füttert auf diesem Stand
  B.fuettern(10);
  await W.vor(60000);
  assert.ok(um(stand().s, 80), `satt ${stand().s}`);
  // A kommt zurück und sieht den Stand von B: Der enthält A's Füttern schon. Bis 0.43.0 legte A es noch einmal darauf.
  A.einhaengen();
  await W.vor(30000);
  assert.ok(um(stand().s, 80), `satt ${stand().s} (60 + 10 + 10, nicht 90)`);
  assert.equal(A.geschrieben(ZUSTAND).length, 1, 'A schreibt nichts mehr');
  assert.deepEqual(A.werte(), B.werte());
  einig(W, T, A, B);
  // Gegenprobe: Kam das Schreiben nie bei HA an (keine Antwort), fehlt es dem fremden Stand wirklich und kommt obendrauf
  A.leitung = 'verlieren';
  A.fuettern(10);
  await W.vor(1210);
  A.abhaengen();
  A.leitung = 'sofort';
  B.fuettern(5);
  await W.vor(60000);
  const s = stand().s;
  A.einhaengen();
  await W.vor(30000);
  assert.ok(um(stand().s, s + 10), `satt ${s} → ${stand().s}`);
  assert.deepEqual(A.werte(), B.werte());
  einig(W, T, A, B);
  assert.deepEqual(W.warnungen, []);
};
test('Zustand: gefüttert und gleich abgehängt – beim Wiedereinhängen zählt das Füttern nicht doppelt, wenn ein anderes Gerät inzwischen darauf aufgebaut hat', () => doppelt(1210));
test('Zustand: … auch nicht, wenn das Schreiben erst aus der schon abgehängten Karte hinausging', () => doppelt(500));

// ---------- Schlüssel im Browser, Namen (Fehler Nr. 15 der Durchsicht) ----------

test('Umbenennen im Editor: alle Schlüssel mit dem Namen der Karte ziehen mit, auch Entdeckungen und die gesehene Postkarte', async () => {
  // Alle Schlüssel der Form `pika-pet-…:${Name}` im Quelltext
  const quell = fs.readdirSync(new URL('../src/', import.meta.url), { recursive: true }).map(String).filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(new URL(`../src/${f.replaceAll('\\', '/')}`, import.meta.url), 'utf8')).join('\n');
  const alle = [...new Set([...quell.matchAll(/`(pika-pet-[a-z-]+):\$\{this\._cfg\??\.name\}`/g)].map((m) => m[1]))].sort();
  for (const k of ['pika-pet-card', 'pika-pet-plan', 'pika-pet-finds', 'pika-pet-post', 'pika-pet-diary', 'pika-pet-diary-seen', 'pika-pet-gift', 'pika-pet-chronik']) {
    assert.ok(alle.includes(k), `${k} im Quelltext gefunden`);
  }
  const W = welt({ speicher: true });
  const M = W.speicher;
  for (const k of alle) M.set(`${k}:Pika`, `wert-${k}`);
  M.set('pika-pet-plan:Pika', W.T.planSer(W.T.planBlank(W.jetzt())));
  const K = W.karte('K', { entity: undefined, plan_entity: undefined });
  // Der Editor ruft setConfig bei jedem Tastendruck
  for (const name of ['Pik', 'Pi', 'P', 'M', 'Mo', 'Mom', 'Momo']) K.c.setConfig({ ...CFG, entity: undefined, plan_entity: undefined, name });
  for (const k of alle) {
    assert.equal(M.get(`${k}:Momo`), M.get(`${k}:Pika`), `${k} ist unter dem neuen Namen da`);
    assert.ok(M.has(`${k}:Pika`), `${k}: der alte bleibt (das Bearbeiten kann abgebrochen werden)`);
    for (const zw of ['Pik', 'Pi', 'P', 'M', 'Mo', 'Mom']) assert.ok(!M.has(`${k}:${zw}`), `${k}:${zw} ist wieder weg`);
  }
  assert.equal(M.get('pika-pet-finds:Momo'), 'wert-pika-pet-finds');
  assert.equal(M.get('pika-pet-post:Momo'), 'wert-pika-pet-post');
});

test('Name der Karte: null, leer oder nur Leerzeichen wird zum üblichen Namen, Ränder fallen weg (auch friend_name)', () => {
  const W = welt({ speicher: true });
  const K = W.karte('K', { entity: undefined, plan_entity: undefined });
  const mit = (cfg) => {
    K.c.setConfig({ ...CFG, entity: undefined, plan_entity: undefined, ...cfg });
    return [K.c._cfg.name, K.c._cfg.friend_name];
  };
  assert.deepEqual(mit({}), ['Pika', 'Pino']);
  assert.deepEqual(mit({ name: null, friend_name: null }), ['Pika', 'Pino']);
  assert.equal(K.c._lsKey(), 'pika-pet-card:Pika');
  assert.equal(K.c._planLsKey(), 'pika-pet-plan:Pika');
  assert.equal(K.c._el.name.textContent, 'Pika');
  assert.equal(K.c._frName(), 'Pino');
  assert.deepEqual(mit({ name: '', friend_name: '' }), ['Pika', 'Pino']);
  assert.deepEqual(mit({ name: '   ', friend_name: ' \t' }), ['Pika', 'Pino']);
  assert.deepEqual(mit({ name: undefined, friend_name: undefined }), ['Pika', 'Pino']);
  assert.deepEqual(mit({ name: '  Momo ', friend_name: ' Kiki  ' }), ['Momo', 'Kiki']);
  assert.equal(K.c._lsKey(), 'pika-pet-card:Momo');
  assert.equal(K.c._el.name.textContent, 'Momo');
  assert.deepEqual(mit({ name: 7, friend_name: 8 }), ['7', '8']);
  // Kein Schlüssel „…:null“ oder „…:“ im Browser
  K.fuettern(1);
  K.c._saveNow();
  assert.deepEqual([...W.speicher.keys()].filter((k) => /:(null|undefined|\s*)$/.test(k)), []);
  // Ohne Angabe bleibt die Konfiguration des Aufrufers unberührt
  const cfg = { name: null };
  K.c.setConfig(cfg);
  assert.equal(cfg.name, null);
  assert.equal(K.c._cfg.name, 'Pika');
});

test('Name der Karte: Was bis 0.43.0 unter dem rohen Namen im Browser lag („…:null“, „…: Momo “), zieht unter den bereinigten mit', () => {
  const W = welt({ speicher: true });
  const { T } = W;
  const M = W.speicher;
  const alt = T.serialize({ ...T.freshStats(W.jetzt()), s: 33, g: 44 });
  M.set('pika-pet-card:null', alt);
  M.set('pika-pet-finds:null', 'feed');
  M.set('pika-pet-card: Momo ', alt);
  const K = W.karte('K', { entity: undefined, plan_entity: undefined, name: null });
  assert.equal(K.c._cfg.name, 'Pika');
  assert.equal(M.get('pika-pet-card:Pika'), alt);
  assert.equal(M.get('pika-pet-finds:Pika'), 'feed');
  assert.ok(um(K.werte().s, 33), 'der Pika von bisher ist da');
  const L = W.karte('L', { entity: undefined, plan_entity: undefined, name: ' Momo ' });
  assert.equal(M.get('pika-pet-card:Momo'), alt);
  assert.ok(um(L.werte().g, 44));
  // Was unter dem bereinigten Namen schon liegt, bleibt
  M.set('pika-pet-card:Pika', T.serialize({ ...T.freshStats(W.jetzt()), s: 55, g: 55 }));
  const K2 = W.karte('K2', { entity: undefined, plan_entity: undefined, name: null });
  assert.ok(um(K2.werte().s, 55));
  // … und es ist keine Kopie auf Zeit (wie die Zwischenstände beim Tippen im Editor): Wird danach umbenannt, bleibt es
  K.c.setConfig({ ...CFG, entity: undefined, plan_entity: undefined, name: 'Kiki' });
  assert.ok(M.has('pika-pet-card:Pika') && M.has('pika-pet-card:Kiki'));
});

// ---------- Größe der Szene ----------

test('ResizeObserver: die erste Meldung legt sofort aus, beim Ziehen am Fenster höchstens alle 100 ms, die letzte Größe geht nicht verloren', async () => {
  const W = welt();
  const K = W.karte('K', { entity: undefined, plan_entity: undefined });
  const lauf = []; // wann ausgelegt wurde
  K.c._layout = function () {
    lauf.push(W.jetzt());
    this._g ??= {};
  };
  K.abhaengen();
  K.einhaengen();
  assert.equal(lauf.length, 1, '_attach legt selbst aus');
  const melden = () => K.c._ro.cb();
  // Die erste Meldung des ResizeObservers kommt gleich nach dem Einhängen: sofort (hatte die Szene beim Einhängen noch
  // keine Größe, ist es das erste Auslegen überhaupt)
  melden();
  assert.equal(lauf.length, 2, 'sofort, im selben Aufruf');
  // Ziehen am Fenster: eine Meldung je Bild, 60 Bilder
  const t0 = W.jetzt();
  let letzte = 0;
  for (let i = 0; i < 60; i++) {
    await W.vor(16);
    melden();
    letzte = W.jetzt();
  }
  const n = lauf.length - 2;
  assert.ok(n >= 8 && n <= 11, `${n}-mal ausgelegt in ${letzte - t0} ms (bisher 60-mal)`);
  for (let i = 3; i < lauf.length; i++) assert.ok(lauf[i] - lauf[i - 1] >= 100, `Abstand ${lauf[i] - lauf[i - 1]} ms`);
  // … und nach der letzten Meldung noch einmal, mit der Größe von dann
  await W.vor(200);
  assert.ok(lauf.at(-1) >= letzte, 'das letzte Auslegen kam nach der letzten Meldung');
  const fertig = lauf.length;
  await W.vor(5000);
  assert.equal(lauf.length, fertig, 'danach ist Ruhe');
  // Eine einzelne Meldung nach einer Pause (iPad gedreht): wieder sofort
  melden();
  assert.equal(lauf.length, fertig + 1);
  // Abgehängt wird ein anstehender Nachlauf abgeräumt
  melden();
  assert.equal(lauf.length, fertig + 1, 'steht an');
  K.abhaengen();
  await W.vor(1000);
  assert.equal(lauf.length, fertig + 1);
  assert.equal(W.wecker(), 0);
  // … und nach dem Wiedereinhängen ist die erste Meldung wieder sofort dran
  K.einhaengen();
  const m = lauf.length;
  melden();
  assert.equal(lauf.length, m + 1);
});

// ---------- Nachbesserungen am Tagesplan von 0.42.2 ----------

test('Tagesplan: nach langer Pause gestreichelt – das Zurückgehaltene geht hinaus, sobald der Stand als frisch gilt', async () => {
  const { W, T, tag, cute } = anfang();
  const A = W.karte('A');
  await W.vor(100);
  // Vier Minuten im Hintergrund (die Verbindung blieb): Beim Wiedersehen gilt der Stand 4 s lang als veraltet
  A.verstecken();
  await W.vor(4 * 6e4);
  A.zeigen();
  assert.equal(A.c._planStale, true);
  await W.vor(1000);
  A.c._petCount();
  await W.vor(2900);
  assert.deepEqual([A.geschrieben(PLAN).length, A.c._planHeld, A.c._planStale], [0, true, true], 'wartet, solange der Stand als veraltet gilt');
  // Bis 0.43.0 schaute das Zurückgehaltene nur alle 5 s nach und ging erst rund 6 s nach dem Streicheln hinaus
  await W.vor(700);
  assert.deepEqual([A.c._planStale, A.geschrieben(PLAN).length], [false, 1], 'eine halbe Sekunde nach der Frist ist es gesendet');
  await W.vor(5000);
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 });
  einig(W, T, A);
  await W.vor(60000);
  assert.deepEqual([A.c._planHeld, A.c._planT, A.c._planRT], [false, null, null]);
  assert.equal(A.geschrieben(PLAN).length, 1);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: wird die Seite versteckt (pagehide, _flush), geht ein zurückgehaltenes Schreiben gleich hinaus, wenn es darf – vorher nicht', async () => {
  const { W, T, tag, cute } = anfang();
  const A = W.karte('A');
  await W.vor(100);
  A.verstecken();
  await W.vor(4 * 6e4);
  A.zeigen();
  await W.vor(1000);
  A.c._petCount();
  await W.vor(1000);
  A.c._flush();
  await W.vor(0);
  assert.deepEqual([A.c._planStale, A.geschrieben(PLAN).length], [true, 0], 'noch gilt der Stand als veraltet: Die Sperre hält auch bei _flush');
  // Die Frist ist um (4 s nach dem Wiedersehen), das nächste Nachsehen steht noch aus: Jetzt nimmt _flush es mit.
  // Bis 0.43.0 kannte _flush nur das gebündelte, noch nicht versuchte Schreiben (_planT).
  await W.vor(2050);
  assert.deepEqual([A.c._planStale, A.c._planHeld, A.geschrieben(PLAN).length], [false, true, 0]);
  A.c._flush();
  assert.equal(A.geschrieben(PLAN).length, 1, '_flush schickt es hinaus');
  await W.vor(5000);
  assert.deepEqual(cute(), { d: tag, n: 4, m: 1 });
  einig(W, T, A);
  await W.vor(60000);
  assert.deepEqual([A.c._planHeld, A.c._planT, A.c._planRT], [false, null, null]);
  assert.equal(A.geschrieben(PLAN).length, 1);
  assert.deepEqual(W.warnungen, []);
});

test('Tagesplan: ein Plan, der auch ohne Verlauf nicht in den Helfer passt, wird nicht gesendet (eine Warnung), bis er wieder passt', async () => {
  const { W, T, tag, helfer } = anfang({}, 180);
  const A = W.karte('A');
  await W.vor(100);
  assert.equal(A.c._planMax(), 180);
  // Große Zahlen (Vorschau) und ein Verlauf: _planFit lässt den Verlauf weg, der Rest ist immer noch zu lang
  A.c._planOp({ t: 'rec', k: 1000, a: 'paint', v: 'blume' });
  A.c._planOp({ t: 'gdbg', f: { a: 2 ** 52, z: 2 ** 52, o: 2 ** 52, d: 2 ** 52, n: 2 ** 52, y: 2 ** 52, i: 2 ** 52, f: 2 ** 40, x: 2 ** 52, b: 2 ** 52 } });
  for (let i = 0; i < 3; i++) A.c._planOp({ t: 'feed', f: { t: sek(W.jetzt()) + i * 1000, x: 40 + i, k: 0, e: false } });
  A.c._planOp({ t: 'fdrop', f: { t: sek(W.jetzt()), c: 2, x: 50, k: false } });
  const lang = T.planSer(A.c._plan);
  assert.ok(lang.length > 180, `${lang.length} Zeichen`);
  assert.equal(A.c._plan.rec.length, 0, 'der Verlauf ist schon weggelassen');
  await W.vor(10 * 6e4);
  assert.deepEqual(A.geschrieben(PLAN), [], 'nichts gesendet');
  assert.equal(W.warnungen.length, 1);
  assert.match(W.warnungen[0], /Der Tagesplan ist mit \d+ Zeichen zu lang für input_text\.pika_plan \(max\. Länge 180\)/);
  assert.equal(T.planSer(A.c._plan), lang, 'auf dem Gerät gilt er weiter');
  assert.deepEqual([A.c._planT, A.c._planRT ?? null], [null, null], 'kein Versuch steht an');
  // Weitere Änderungen: weiter nichts, und keine zweite Warnung
  A.c._petCount();
  await W.vor(10 * 6e4);
  assert.deepEqual(A.geschrieben(PLAN), []);
  assert.equal(W.warnungen.length, 1);
  // Passt er wieder, geht er hinaus
  A.c._planOp({ t: 'gdbg', f: { a: 1, z: 1, o: 1, d: 0, n: 1, y: 0, i: 3, f: 3, x: 0, b: null } });
  await W.vor(5000);
  assert.equal(A.geschrieben(PLAN).length, 1);
  assert.ok(A.geschrieben(PLAN)[0].length <= 180);
  assert.equal(helfer().cute.n, 4);
  assert.equal(helfer().gift.z, 1);
  assert.equal(tag, helfer().cute.d);
  einig(W, T, A);
});

// ---------- Echo per Kennung: nur, wenn sie nichts anderes heißen kann (Nachbesserung zu 0.43.1) ----------

// Das Schreiben erreicht HA und wird ausgeführt, die Verbindung reißt aber vor der Antwort ('kappen'). Die Karte hält es
// für verloren und sendet denselben Text noch einmal: Der ändert in HA nichts und bekommt eine andere Kennung als der
// Stand, den der erste Versuch erzeugt hat.
const gekappt = async (zurueck, laufzeit) => {
  const { W, T, stand } = anfang();
  const A = W.karte('A');
  const B = W.karte('B'); // ein zweites Gerät, das nur zusieht
  await W.vor(100);
  A.laufzeit = laufzeit; // so lange brauchen die frischen Zustände nach dem Wiederverbinden
  A.leitung = 'kappen';
  A.fuettern(15);
  await W.vor(1200);
  assert.deepEqual(A.aufrufe.filter((e) => e.id === ZUSTAND).map((e) => e.weg), ['gekappt']);
  A.leitung = 'sofort';
  A.trennen();
  await W.vor(zurueck);
  A.aufbauen();
  A.verbinden();
  await W.vor(60000);
  const rufe = A.aufrufe.filter((e) => e.id === ZUSTAND);
  assert.ok(um(stand().s, 75), `satt ${stand().s} (60 + 15, nicht 90); A schrieb ${rufe.map((e) => `${e.s.split(',')[0]}/${e.weg}`).join(', ')}`);
  assert.ok(rufe.every((e) => e.s === rufe[0].s), 'A hat nur diesen einen Text gesendet');
  assert.deepEqual(A.werte(), B.werte());
  einig(W, T, A, B);
  return rufe.length;
};
test('Zustand: Ein Schreiben kam an, die Antwort nicht – der neue Versuch mit demselben Text macht das eigene Echo nicht zu einem fremden Stand', async () => {
  // Wieder verbunden zwischen „gilt als verloren“ (5 s nach dem Fehler) und dem neuen Senden (1,2 s danach): Der frische
  // Stand trifft auf den zweiten Versuch. Bis zur Nachbesserung zählte das Füttern dann doppelt.
  assert.equal(await gekappt(6100, 300), 2);
  // … oder später, und der frische Stand braucht länger als die 1,2 s bis zum neuen Senden
  assert.equal(await gekappt(20000, 1500), 2);
  // Gegenproben: schneller wieder da (das Echo trifft das erste, noch unbestätigte Schreiben), und später mit dem
  // frischen Stand vor dem neuen Senden (spätes Echo eines verlorenen Schreibens)
  assert.equal(await gekappt(2000, 300), 1);
  assert.equal(await gekappt(20000, 300), 1);
});

// B streichelt dreimal und ist gleich danach weg (andere Ansicht oder Verbindung): Sein Schreiben T kommt an, das Echo
// sieht B nicht mehr. A hat im selben Augenblick einmal gestreichelt, ist langsamer und überschreibt T mit seinem
// Plan; A's Echo-Prüfung (planKeep) stellt B's Zähler nach 2 s wieder her: derselbe Wortlaut wie T, unter A's
// Kennung. B kommt zurück und sieht T mit fremder Kennung.
const verpasst = async (weg, zurueck) => {
  const { W, T, tag, cute } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  A.laufzeit = 300;
  await W.vor(1000);
  for (let i = 0; i < 3; i++) B.c._petCount(); // 3 → 6
  A.c._petCount(); // 3 → 4
  await W.vor(410);
  assert.deepEqual([T.planParse(B.geschrieben(PLAN)[0]).cute.n, T.planParse(A.geschrieben(PLAN)[0]).cute.n], [6, 4]);
  if (weg === 'abhaengen') B.abhaengen();
  else B.trennen();
  await W.vor(zurueck);
  assert.deepEqual(W.ha.zeilen(PLAN).map((z) => `${z.split(':')[0]}:${T.planParse(z.slice(z.indexOf(' ') + 1)).cute.n}`), ['anfang:3', 'B:6', 'A:4', 'A:6'], 'A hat überschrieben und wiederhergestellt');
  if (weg === 'abhaengen') B.einhaengen();
  else B.verbinden();
  await W.vor(60000);
  // (viermal gestreichelt ab 3: Nach der Regel „der höchste Zähler gewinnt“ sind es 6, in keinem Fall mehr als 7)
  assert.deepEqual(cute(), { d: tag, n: 6, m: 1 }, 'B zählt sein Streicheln nicht noch einmal');
  assert.equal(B.geschrieben(PLAN).length, 1);
  einig(W, T, A, B);
};
test('Tagesplan: das Echo verpasst (andere Ansicht), ein anderes Gerät stellt denselben Wortlaut wieder her – das Streicheln zählt nicht noch einmal', () => verpasst('abhaengen', 5000));
test('Tagesplan: … ebenso, wenn die Verbindung weg war', () => verpasst('trennen', 5000));

test('Tagesplan: ohne Lücke, aber das eigene Echo ging in einer Meldung mit dem nächsten Stand unter – ein wiederhergestellter Wortlaut ist kein fremder', async () => {
  const { W, T, tag, cute } = anfang();
  const B = W.karte('B');
  // Dieses Gerät bekommt mit jeder Meldung den Stand von dann, wenn sie ankommt (das Frontend fasst zusammen), und es ist langsam
  B.nurLetzter = true;
  B.laufzeit = 300;
  await W.vor(1000);
  const t0 = W.jetzt();
  const alt = W.ha.wert(PLAN);
  for (let i = 0; i < 3; i++) B.c._petCount(); // 3 → 6, geht nach 0,4 s hinaus und steht nach 0,7 s im Helfer
  await W.vor(800);
  const eigen = W.ha.wert(PLAN);
  assert.equal(T.planParse(eigen).cute.n, 6);
  // Ein anderes Gerät überschreibt mit einem älteren Plan, ehe die Meldung bei B ist (B sieht nur den) …
  W.ha.setze(PLAN, T.planSer(T.planApply(T.planParse(alt), { t: 'mem', d: tag, b: 2 }, W.jetzt())), 'fremd');
  await W.vor(250);
  assert.equal(B.c._planSt, W.ha.wert(PLAN), 'B hat den fremden Stand gesehen, sein Echo nie');
  assert.equal(B.c._planSent.length, 1);
  // … und stellt gleich darauf B's Wortlaut wieder her (mit dem Erlebnis wäre es ein anderer Text: hier genau derselbe)
  W.ha.setze(PLAN, eigen, 'fremd');
  await W.vor(60000);
  assert.ok(W.jetzt() - t0 > 0);
  assert.equal(cute().n, 6, 'B zählt sein Streicheln nicht noch einmal');
  einig(W, T, B);
});

test('Zustand: nach dem Zusammenführen trägt das nächste Schreiben einen Gewinn, der schon in HA stehen kann – ein gleichlautender fremder Stand gilt dann als Echo', async () => {
  const { W, T, stand } = anfang();
  const A = W.karte('A');
  A.laufzeit = 100;
  await W.vor(1000);
  A.fuettern(10);
  await W.vor(1250); // gesendet nach 1,2 s, in HA nach 1,3 s
  // Ein fremder Stand erreicht HA knapp vor A's Schreiben und A vor dessen Echo: A führt zusammen (fremd + 10) …
  const F = T.serialize({ ...T.parseStats(W.ha.wert(ZUSTAND)), g: 77 });
  W.ha.setze(ZUSTAND, F, 'fremd');
  await W.vor(300);
  assert.equal(A.c._sent.length, 0, 'das Echo des ersten Schreibens ist da');
  assert.ok(A.c._pendingWrite && A.c._gain.s === 10, 'der Gewinn steckt wieder im Ungesendeten');
  // … und während A's zweites Schreiben unterwegs ist, schreibt jemand genau diesen Text (er enthält die 10 also schon)
  await W.vor(1000);
  assert.equal(A.geschrieben(ZUSTAND).length, 2);
  W.ha.setze(ZUSTAND, A.geschrieben(ZUSTAND)[1], 'fremd');
  await W.vor(60000);
  assert.ok(um(stand().s, 70), `satt ${stand().s} (60 + 10)`);
  assert.equal(stand().g, 77);
  assert.equal(A.geschrieben(ZUSTAND).length, 2, 'A legt die 10 nicht noch einmal obendrauf');
  einig(W, T, A);
});

test('Zustand: zwei füttern in derselben Sekunde, eins ist vor dem Echo abgehängt – steht der gleichlautende Stand beim Zurückkommen noch da, zählt seine Portion; hat jemand darauf aufgebaut, fehlt sie (bekannte Grenze)', async () => {
  const { W, T, stand } = anfang();
  const A = W.karte('A');
  const B = W.karte('B');
  B.laufzeit = 60;
  await W.vor(1000);
  A.fuettern(10);
  B.fuettern(10);
  await W.vor(300);
  B.abhaengen();
  await W.vor(5000);
  assert.ok(um(stand().s, 70), 'B\'s Schreiben hat in HA nichts geändert (derselbe Text wie das von A)');
  // B kommt zurück, der gleichlautende Stand steht noch im Helfer und trägt eine andere Kennung als B's Aufruf: Er
  // stammt nicht von B. Anders als beim Tagesplan stellt beim Zustand niemand einen fremden Wortlaut wieder her: Wer
  // denselben Text schrieb, hat selbst gefüttert. B's Portion fehlt also und kommt obendrauf.
  B.einhaengen();
  await W.vor(30000);
  assert.ok(um(stand().s, 80), `satt ${stand().s} (60 + 10 + 10)`);
  assert.equal(B.geschrieben(ZUSTAND).length, 2);
  einig(W, T, A, B);
  // Hat inzwischen jemand auf dem Stand aufgebaut, ist das nicht mehr zu erkennen: HA hat B's Aufruf beantwortet (das
  // tut es auch, wenn der Wert derselbe war und sich nichts änderte), und der spätere Stand sähe genauso aus, wenn
  // B's Schreiben gegolten hätte. Dann gilt es als angekommen (_sentSettle), die Portion fehlt. Das ist gewollt: Der
  // umgekehrte Fehler (nach jedem Ansichtswechsel doppelt, siehe oben „gefüttert und gleich abgehängt“) wäre häufiger.
  A.fuettern(10);
  B.fuettern(10);
  await W.vor(300);
  B.abhaengen();
  await W.vor(5000);
  A.fuettern(10);
  await W.vor(5000);
  B.einhaengen();
  await W.vor(30000);
  assert.ok(um(stand().s, 100), `satt ${stand().s} (80 + 10 + 10; B's zweite Portion fehlt)`);
  assert.equal(B.geschrieben(ZUSTAND).length, 3);
  einig(W, T, A, B);
});

// ---------- Zufallsläufe ----------
// Mehrere Karten füttern und streicheln durcheinander (oft im selben Augenblick), werden ab- und eingehängt, verlieren
// die Verbindung. Am Ende darf nie mehr im Helfer stehen, als gefüttert und gestreichelt wurde, und alle Karten sehen
// dasselbe. (Weniger kommt vor: Zwei Geräte, die fast gleichzeitig schreiben, führen nicht immer verlustfrei
// zusammen, und beim Streicheln gewinnt der höchste Zähler. Verlorene, gehaltene und gekappte Schreiben sind hier
// nicht dabei: Dort ist „zu viel“ nicht auszuschließen, siehe den Test zum gekappten Schreiben.) Feste Startwerte,
// darunter die drei, die vor der Nachbesserung doppelt zählten (ruhig 126, trennen 119 und 264).
const zufall = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const zufallslauf = async (modus, seed) => {
  const r = zufall(seed);
  const pick = (L) => L[Math.floor(r() * L.length)];
  const W = welt();
  const { T } = W;
  const t0 = W.jetzt();
  const tag = T.pikaDay(t0);
  W.ha.setze(PLAN, T.planSer(T.planApply(T.planBlank(t0), { t: 'pet', d: tag, n: 3 }, t0)), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 20, g: 20 }), 'anfang', { max: 100 });
  const K = [];
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const k = W.karte('ABC'[i]);
    k.antwort = pick(['zuerst', 'danach']);
    k.laufzeit = pick([5, 20, 20, 80, 300]);
    Object.assign(k, { da: true, an: true });
    K.push(k);
  }
  await W.vor(500);
  let futter = 0;
  let streichler = 0;
  const spur = [];
  const schritte = 15 + Math.floor(r() * 25);
  for (let i = 0; i < schritte; i++) {
    const k = pick(K);
    const x = r();
    let was = '';
    if (x < 0.35) {
      if (k.da) {
        k.fuettern(1);
        futter++;
        was = 'füttern';
      }
    } else if (x < 0.6) {
      if (k.da) {
        k.c._petCount();
        streichler++;
        was = 'streicheln';
      }
    } else if (modus !== 'ruhig' && x < 0.7) {
      if (modus.includes('haengen')) {
        if (k.da) k.abhaengen();
        else k.einhaengen({ hass: r() < 0.7 });
        k.da = !k.da;
        was = k.da ? 'einhängen' : 'abhängen';
      }
    } else if (modus !== 'ruhig' && x < 0.8) {
      if (modus.includes('trennen')) {
        if (k.an) k.trennen();
        else {
          if (r() < 0.5) k.aufbauen();
          k.verbinden();
        }
        k.an = !k.an;
        was = k.an ? 'verbinden' : 'trennen';
      }
    }
    const dt = pick([0, 0, 1, 15, 25, 100, 400, 450, 1200, 1250, 3000, 6000, 16000]);
    if (was) spur.push(`${W.jetzt() - t0}: ${k.name} ${was}`);
    await W.vor(dt);
  }
  // alles wieder heil, dann zur Ruhe kommen lassen
  for (const k of K) {
    if (!k.an) k.verbinden();
    if (!k.da) k.einhaengen();
  }
  for (let i = 0; i < 12; i++) {
    W.regung();
    await W.vor(60000);
  }
  const st = T.parseStats(W.ha.wert(ZUSTAND));
  const satt = Math.max(0, st.s - ((W.jetzt() - st.st) / 3.6e6) * 5) - (20 + futter - ((W.jetzt() - t0) / 3.6e6) * 5);
  const gestreichelt = T.planParse(W.ha.wert(PLAN)).cute.n - (3 + streichler);
  const einigkeit = K.every((k) => Math.abs(k.werte().s - K[0].werte().s) < 0.15 && T.planSer(k.c._plan) === W.ha.wert(PLAN));
  return { satt, gestreichelt, einigkeit, spur: `${K.map((k) => `${k.name}:${k.laufzeit}/${k.antwort}`).join(' ')} | ${spur.join(', ')}` };
};
test('Zufallsläufe: nie mehr satt oder öfter gestreichelt als geschehen, und am Ende sind sich alle Karten einig', async () => {
  const laeufe = [
    ['ruhig', 101, 140], ['haengen', 101, 135], ['trennen', 101, 135], ['haengen-trennen', 101, 135], ['trennen', 264, 264],
  ];
  let n = 0;
  for (const [modus, von, bis] of laeufe) {
    for (let seed = von; seed <= bis; seed++) {
      const R = await zufallslauf(modus, seed);
      n++;
      assert.ok(R.satt < 0.45, `${modus} ${seed}: satt ${R.satt.toFixed(1)} zu viel – ${R.spur}`);
      assert.ok(R.gestreichelt <= 0, `${modus} ${seed}: ${R.gestreichelt}-mal zu oft gestreichelt – ${R.spur}`);
      assert.ok(R.einigkeit, `${modus} ${seed}: die Karten sehen nicht dasselbe – ${R.spur}`);
    }
  }
  assert.equal(n, 146);
});
