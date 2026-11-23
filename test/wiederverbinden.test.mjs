// Mehrere Geräte verbinden sich im selben Augenblick wieder (HA startet neu, WLAN kommt zurück): Was eines ohne
// Verbindung verschenkt und ausgepackt hat, bleibt im Helfer (Fund 1 des Audits 0.48). Dazu ein kurzer Zufallstest
// mit festen Seeds (wie das Nachweisskript fuzz.mjs des Audits: drei Karten schenken, packen aus, streicheln, verlieren
// die Verbindung, werden abgehängt und neu geladen; derselbe Seed gibt denselben Lauf). node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welt, ZUSTAND, PLAN } from './welt.mjs';

const sek = (t) => Math.round(t / 1000) * 1000;

// Helfer mit Album 1 fertig, neun Päckchen verschenkt und ausgepackt, drei im Vorrat. Karte A belohnt echt.
const anfang = () => {
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  const t0 = W.jetzt();
  let P = T.planBlank(t0);
  for (const op of [
    { t: 'gstart', k: sek(t0 - 5 * 864e5) },
    { t: 'gdbg', f: { n: 3, a: 10, f: 3, p: sek(t0 - 36e5), u: 255, v: 255, z: 9, o: 9, y: 0 } },
    { t: 'pet', d: T.pikaDay(t0), n: 1 },
  ]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 60, g: 60 }), 'anfang', { max: 100 });
  return { W, T, helfer: () => T.planParse(W.ha.wert(PLAN)).gift };
};

// A und B ohne Verbindung. A schenkt, packt 25 s später aus; nach 60 s tut B etwas (was), dann verbinden sich beide,
// B ms nach A. Bis 0.48.0 fiel das Päckchen dabei weg: Das Echo bestätigte A seine schon über 15 s alten Änderungen,
// sie fielen sofort heraus, und das Schreiben von B (vom Stand vor dem Päckchen, aber mit mehr Streicheln, also
// nicht erwiesen veraltet) überschrieb es. Schenkte A danach noch einmal, kam dasselbe Päckchen ein zweites Mal.
for (const [was, ms] of [['pet', 5], ['pet', 0.5], ['pet', 30], ['mem', 5], ['rec', 5]]) {
  test(`Wiederverbinden: B (${was}) verbindet ${ms} ms nach A – das ohne Verbindung geschenkte Päckchen bleibt`, async () => {
    const { W, T, helfer } = anfang();
    const A = W.karte('A');
    const B = W.karte('B');
    A.c._g ??= {};
    delete A.c._giftCredit;
    const lohn = [];
    const add = A.c._add;
    A.c._add = function (k, d, self) {
      if (self && d === 15) lohn.push(k);
      return add.call(this, k, d, self);
    };
    await W.vor(200);
    A.trennen();
    B.trennen();
    A.c._onGiftBtn();
    const { z, i } = A.c._plan.gift;
    assert.equal(z, 10);
    await W.vor(25000);
    A.c._planOp({ t: 'gopen', z });
    await W.vor(35000);
    if (was === 'pet') B.streicheln();
    else if (was === 'mem') B.c._planOp({ t: 'mem', d: T.pikaDay(W.jetzt()), b: 4 });
    else B.c._planOp({ t: 'rec', k: 9e6, a: 'read' });
    await W.vor(1000);
    A.aufbauen();
    B.aufbauen();
    A.verbinden();
    await W.vor(ms);
    B.verbinden();
    await W.vor(5 * 6e4);
    const H = helfer();
    assert.deepEqual([H.z, H.o, H.i], [z, z, i], 'verschenkt und ausgepackt steht im Helfer');
    if (i >= 32) assert.ok(H.w & (1 << (i - 32)), 'der Schatz von Album 2 ist im Album');
    assert.equal(T.planSer(A.c._plan), W.ha.wert(PLAN), 'A sieht den Helfer');
    assert.equal(T.planSer(B.c._plan), W.ha.wert(PLAN), 'B sieht den Helfer');
    if (was === 'pet') assert.equal(T.planParse(W.ha.wert(PLAN)).cute.n, 2, 'und das Streicheln von B');
    assert.equal(lohn.length, 1, 'eine Belohnung');
    // Noch einmal schenken: das nächste Päckchen, nicht dasselbe ein zweites Mal
    A.c._onGiftBtn();
    await W.vor(30000);
    assert.equal(helfer().z, z + 1);
    assert.deepEqual(W.warnungen, []);
  });
}

// ---------- kurzer Zufallstest ----------
const mulberry = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Ein Lauf wie in fuzz.mjs (dieselben Schritte in derselben Reihenfolge, ein Seed gibt denselben Lauf). → was je im
// Helfer stand und am Ende fehlt, und gebrochene Regeln (o ≤ z, Gold nur mit Trick, Trick nur mit Schatz, Länge)
const lauf = async (seed, STEPS = 250) => {
  const R = mulberry(seed);
  const ri = (n) => Math.floor(R() * n);
  const W = welt({ laufzeit: 20 });
  const { T } = W;
  const t0 = W.jetzt();
  const tag = T.pikaDay(t0);
  let P = T.planBlank(t0);
  for (const op of [
    { t: 'gstart', k: sek(t0 - 5 * 864e5) },
    { t: 'gdbg', f: { n: 3, a: 10, f: 3, p: sek(t0 - 36e5), u: 255, v: [0xffff, 0xff, 0xfe, 0x7f7f][seed % 4], z: 9, o: 9, y: 2 } },
    { t: 'pet', d: tag, n: 1 },
  ]) P = T.planApply(P, op, t0);
  W.ha.setze(PLAN, T.planSer(P), 'anfang', { max: 255 });
  W.ha.setze(ZUSTAND, T.serialize({ ...T.freshStats(t0), s: 30, g: 30 }), 'anfang', { max: 100 });
  const neu = (name) => {
    const K = W.karte(name);
    delete K.c._giftCredit;
    K.c._g ??= {};
    return K;
  };
  const geraete = ['A', 'B', 'C'].map((name) => ({ name, K: neu(name), tot: false, ver: 0 }));
  await W.vor(200);
  const lebend = () => geraete.filter((g) => !g.tot);
  let ur = null;
  for (let s = 0; s < STEPS; s++) {
    const g = lebend()[ri(lebend().length)];
    const K = g.K;
    const c = K.c;
    const G = c._plan?.gift;
    const x = R();
    if (x < 0.22) c._onGiftBtn();
    else if (x < 0.36) { if (G && G.z > G.o && W.jetzt() - G.x >= 20000) c._planOp({ t: 'gopen', z: G.z }); }
    else if (x < 0.46) { if (G) c._planOp({ t: 'gearn', k: G.k, e: G.a + 1, p: sek(W.jetzt()) }); }
    else if (x < 0.50) { /* (fuzz.mjs: kein Nachfüllen) */ }
    else if (x < 0.58) K.streicheln();
    else if (x < 0.61) c._planOp({ t: 'mem', d: tag, b: 1 << ri(9) });
    else if (x < 0.64) c._planOp({ t: 'rec', k: 5000 + s, a: 'read' });
    else if (x < 0.67) {
      if (!ur && R() < 0.5) { ur = sek(W.jetzt()); c._planOp({ t: 'von', t0: ur }); }
      else if (ur) { c._planOp({ t: 'voff', t0: ur, d: Math.max(6e4, sek(W.jetzt()) - ur) }); ur = null; }
    } else if (x < 0.72) { if (K.verbunden) K.trennen(); else { K.aufbauen(); if (R() < 0.7) K.verbinden(); } }
    else if (x < 0.76) K.leitung = ['sofort', 'sofort', 'halten', 'verlieren', 'kappen', 'ablehnen'][ri(6)];
    else if (x < 0.78) { if (K.stau.length) K.freigeben(ri(K.stau.length) + 1); }
    else if (x < 0.81) { if (K.beliefert) K.abhaengen(); else K.einhaengen({ hass: R() < 0.7 }); }
    else if (x < 0.83) { if (c._away) K.zeigen(); else K.verstecken(); }
    else if (x < 0.85) K.laufzeit = [10, 20, 200, 1500, 4000][ri(5)];
    else if (x < 0.865) {
      c._flush();
      c.disconnectedCallback();
      Object.assign(K, { verbunden: false, beliefert: false, phase: null });
      g.tot = true;
      g.ver++;
      geraete.push({ name: g.name + g.ver, K: neu(g.name + g.ver), tot: false, ver: g.ver });
    } else if (x < 0.875) W.regung();
    const dt = [0, 50, 300, 1000, 3000, 8000, 16000, 40000][ri(8)];
    // Gehaltene Schreiben kommen nach höchstens 5 s an (HA führt einen Aufruf nicht Minuten später aus)
    for (let t = 0; t < dt; t += 1000) {
      await W.vor(Math.min(1000, dt - t));
      for (const g2 of geraete) {
        const n = g2.K.stau.filter((e) => e.t < W.jetzt() - 5000).length;
        if (n) g2.K.freigeben(n);
      }
    }
    if (!dt) await W.vor(0);
  }
  // Zur Ruhe: alle verbunden, eingehängt, sichtbar, und lange warten
  for (const { K } of lebend()) {
    K.leitung = 'sofort';
    K.laufzeit = 20;
    if (K.stau.length) K.freigeben();
    if (!K.verbunden) { K.aufbauen(); K.verbinden(); }
    if (!K.beliefert) K.einhaengen();
    if (K.c._away) K.zeigen();
  }
  for (let k = 0; k < 6; k++) { W.regung(); await W.vor(5 * 6e4); }
  const funde = [];
  const max = { u: 0, v: 0, w: 0, z: 0, o: 0 };
  for (const r of W.ha.verlauf.filter((e) => e.id === PLAN)) {
    if (r.s.length > 255) funde.push(`Länge ${r.s.length}`);
    const H = T.planParse(r.s)?.gift;
    if (!H) { funde.push(`ohne Päckchen: ${r.s.slice(0, 30)}`); continue; }
    const w = H.w || 0;
    for (let t = 0; t < 8; t++) {
      if (w & (1 << (16 + t)) && !(w & (1 << (8 + t)))) funde.push('w: Gold ohne Trick');
      if (w & (1 << (8 + t)) && !(w & (1 << t))) funde.push('w: Trick ohne Schatz');
      if (H.v & (1 << (8 + t)) && !(H.v & (1 << t))) funde.push('v: Gold ohne Trick');
    }
    if (H.o > H.z) funde.push(`o ${H.o} > z ${H.z}`);
    Object.assign(max, { u: max.u | H.u, v: max.v | H.v, w: max.w | w, z: Math.max(max.z, H.z), o: Math.max(max.o, H.o) });
  }
  const F = T.planParse(W.ha.wert(PLAN)).gift;
  const weg = [];
  if (max.w & ~(F.w || 0)) weg.push('w');
  if ((max.u & ~F.u) || (max.v & ~F.v)) weg.push('u/v');
  if (F.z < max.z) weg.push(`z ${max.z}→${F.z}`);
  if (F.o < max.o) weg.push(`o ${max.o}→${F.o}`);
  return { weg: weg.join(', '), funde: [...new Set(funde)].join(' | ') };
};

// 1054 und 1058 verloren bis 0.48.0 je ein Päckchen auf Dauer (fuzz.mjs, 30 von 1000 Läufen)
test('Wiederverbinden: Zufallstest mit festen Seeds – nichts geht auf Dauer verloren, keine Regel bricht', async () => {
  const rnd = Math.random;
  try {
    for (let seed = 1050; seed < 1066; seed++) {
      Math.random = mulberry(seed * 7919 + 1); // auch r in _onGiftBtn wiederholbar
      const r = await lauf(seed);
      assert.deepEqual(r, { weg: '', funde: '' }, `Seed ${seed}`);
    }
  } finally {
    Math.random = rnd;
  }
});
