// Advent: Der Pika wärmt sich am Kranz die Pfoten, und am Adventssonntag zündet er die neue Kerze selbst an.
// node --test (lädt wie pika.test.mjs die gebaute pika-pet-card.js mit ein paar Attrappen).
// Geprüft wird über die echten Methoden der Karte (_festToday, _festActs, _festRender, _festUpdate, _festAdvent) an
// einer Karte ohne DOM: Die Schichten der Festdeko merken sich ihr HTML, der Pika ist eine Klassenliste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let T = null;
// „Bewegung reduzieren“: Die Karte fragt beim Laden einmal nach und liest danach nur noch .matches. Darum bekommt
// sie hier immer dasselbe Objekt, der Test dazu stellt es um.
const RUHIG = { matches: false };
const WELT = {
  window: { matchMedia: () => RUHIG, customCards: [] },
  document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  HTMLElement: class {},
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn() {}, debug() {} },
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController, performance,
  __pikaTest: (x) => (T = x),
};
vm.runInNewContext(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'), WELT, { filename: 'pika-pet-card.js' });

const plain = (v) => JSON.parse(JSON.stringify(v));
// 2026: 1. Advent am 29. 11., dann 6. 12. (zugleich Nikolaus), 13. 12. und 20. 12.; Heiligabend ist ein Donnerstag
const am = (mo, d, h = 9, mi = 0, y = 2026) => new Date(y, mo - 1, d, h, mi).getTime();

// Klassenliste eines Elements
const klassen = (init = '') => {
  const s = new Set(init.split(/\s+/).filter(Boolean));
  return {
    add: (...a) => a.forEach((k) => s.add(k)),
    remove: (...a) => a.forEach((k) => s.delete(k)),
    contains: (k) => s.has(k),
    toggle(k, on = !s.has(k)) {
      if (on) s.add(k);
      else s.delete(k);
      return on;
    },
    liste: () => [...s].sort(),
  };
};
// Eine Schicht der Festdeko: merkt sich ihr HTML; querySelector('.x') gibt das erste <div> mit dieser Klasse als
// Element mit Klassenliste (dasselbe, bis neu gezeichnet wird, wie im Browser)
const schicht = () => {
  let html = '';
  const els = new Map();
  return {
    get innerHTML() {
      return html;
    },
    set innerHTML(v) {
      html = v;
      els.clear();
    },
    querySelector(sel) {
      const k = sel.slice(1);
      if (!els.has(k)) {
        const m = html.match(new RegExp(`<div class="([^"]*\\b${k}\\b[^"]*)"`));
        els.set(k, m ? { classList: klassen(m[1]) } : null);
      }
      return els.get(k);
    },
    querySelectorAll: () => [],
  };
};

// Eine Karte 600 × 248 im Erdhügel zur Zeit t, hell (himmel 'day') oder dunkel ('night', 'dusk'). Laufen, Warten,
// Sprechen, Springen und Funken werden nur aufgeschrieben (c.log); warten(n) kann die n-te Wartezeit abbrechen lassen.
const karte = (t, himmel = 'day') => {
  const c = Object.create(T.PikaPetCard.prototype);
  const log = { say: [], jump: [], spark: [], walk: [], later: [], warten: 0, abbruch: 0, fky: null };
  const pika = { classList: klassen('pika'), style: { setProperty: (k, v) => (log.fky = k === '--fky' ? v : log.fky) } };
  Object.assign(c, {
    _cfg: { festive: true }, _dbgDate: t, _W: 600, _H: 248, _Hs: 248, _arealKey: 'huegel', _areal: () => T.AREALE.huegel, _windDir: 1,
    _g: { gy: 223, pW: 119, pH: 99.2, hole: { l: 62, r: 99, cx: 80 }, rock: { l: 430, w: 120 }, bur: { l: -9, base: 114, u: 1.79 }, hayL: 180, hayR: 250 },
    _x: 300, _dir: 1,
    _el: { scene: { classList: klassen(`scene ${himmel}`) }, pika, friends: { classList: klassen() } },
    _festEls: { sky: schicht(), back: schicht(), on: schicht(), front: schicht(), cf: schicht(), light: schicht() },
    _festFwSync() {}, _urlaubFern: () => false,
    _walkTo: async (x) => {
      log.walk.push(x);
      c._x = x;
    },
    _face: (d) => (c._dir = d),
    _wait: async () => {
      if (++log.warten === log.abbruch) throw new Error('abgebrochen');
    },
    _say: (text) => log.say.push(text),
    _jump: (k) => log.jump.push(k),
    _sparkle: (...a) => log.spark.push(a),
    _festLater: (fn, ms) => log.later.push([fn, ms]),
  });
  c.log = log;
  c.pika = pika;
  c._festUpdate(true);
  return c;
};
// Uhr und Himmel der Karte umstellen, dann der Takt (_tickFest ruft _festUpdate)
const stelle = (c, t, himmel) => {
  c._dbgDate = t;
  if (himmel) c._el.scene.classList = klassen(`scene ${himmel}`);
  c._festUpdate();
};
// Der Kranz, wie er gezeichnet ist: Kerzen, Flammen, Lichtscheine, und wie viele Kerzen gerade brennen
// (.unlit am Kranz blendet die Gruppe .fnew aus, in der Schein und Flamme der neuen Kerze stehen)
const kranz = (c) => {
  const html = c._festEls.front.innerHTML;
  const m = html.match(/<div class="fi fwreath[^"]*"[\s\S]*?<\/div>/);
  if (!m) return null;
  const n = (re) => (m[0].match(re) || []).length;
  const el = c._festWreathEl;
  const neu = n(/class="fnew"/g);
  const aus = el.classList.contains('unlit');
  return { kerzen: n(/<rect /g), flammen: n(/class="flm"/g), scheine: n(/class="nite"/g), neu, aus, brennt: n(/class="flm"/g) - (aus ? neu : 0), html: m[0] };
};
const gewicht = (c, name = 'festAdvent') => (plain(c._festActs({ wx: {}, g: 50 })).find((r) => r[1] === name) || [null])[0];

test('Advent im Kalender: Kerzen je Adventssonntag, „neu“ nur am Sonntag selbst', () => {
  const c = Object.create(T.PikaPetCard.prototype);
  c._cfg = { festive: true };
  const adv = (...a) => plain(c._festToday(am(...a))).advent;
  assert.equal(adv(11, 28), undefined); // Samstag davor
  assert.deepEqual(adv(11, 29), { candles: 1, neu: T.festDay(2026, 11, 29) });
  assert.deepEqual(adv(11, 29, 0, 5), { candles: 1, neu: T.festDay(2026, 11, 29) }); // ab Mitternacht
  assert.deepEqual(adv(11, 30), { candles: 1 });
  assert.deepEqual(adv(12, 5, 12), { candles: 1 });
  assert.deepEqual(adv(12, 6), { candles: 2, neu: T.festDay(2026, 12, 6) });
  assert.deepEqual(adv(12, 13), { candles: 3, neu: T.festDay(2026, 12, 13) });
  assert.deepEqual(adv(12, 20), { candles: 4, neu: T.festDay(2026, 12, 20) });
  assert.deepEqual(adv(12, 24), { candles: 4 }); // Donnerstag
  assert.equal(adv(12, 25), undefined);
  // 2023 fiel der 4. Advent auf Heiligabend
  assert.deepEqual(adv(12, 24, 9, 0, 2023), { candles: 4, neu: T.festDay(2023, 12, 24) });
  // festive: false lässt nur die Geburtstage übrig
  c._cfg = { festive: false };
  assert.equal(adv(12, 13), undefined);
});

test('Advent: die Aktion gibt es nur im Advent und nur mit Kranz', () => {
  // außerhalb des Advents: kein Kranz, keine Aktion
  for (const t of [am(11, 28), am(12, 25), am(6, 21), am(1, 3, 9, 0, 2027)]) {
    const c = karte(t);
    assert.equal(kranz(c), null);
    assert.equal(gewicht(c), null, new Date(t).toDateString());
  }
  // im Advent (Montag): ab und zu, mit Pause danach; der Name bleibt in der Liste (Vorschau „Aktion!“)
  const c = karte(am(11, 30));
  assert.ok(gewicht(c) > 0 && gewicht(c) < 3);
  c._festMark('festAdvent');
  assert.equal(gewicht(c), 0);
  // Kranz steht (noch) nicht, etwa vor dem ersten Auslegen: keine Aktion
  c._festPos = {};
  assert.equal(gewicht(c), null);
  // Heiligabend: Kranz und Baum, beide Aktionen
  const h = karte(am(12, 24, 18, 30), 'night');
  assert.ok(gewicht(h) > 0);
  assert.ok(gewicht(h, 'festTree') > 0);
});

test('Kein Adventssonntag: alle Kerzen brennen, er wärmt sich nur die Pfoten', async () => {
  const c = karte(am(12, 8)); // Dienstag nach dem 2. Advent
  const K = kranz(c);
  assert.deepEqual([K.kerzen, K.flammen, K.scheine, K.neu, K.aus, K.brennt], [4, 2, 2, 0, false, 2]);
  assert.equal(c._festCandleOff(), false);
  await c._festAdvent();
  assert.equal(c.log.walk.length, 1);
  assert.equal(c.log.say.length, 1);
  assert.ok(['schön warm!', 'mmh, Tannenduft!'].includes(c.log.say[0]), c.log.say[0]);
  assert.deepEqual(c.log.jump, []); // kein Hüpfer, nichts angezündet
  assert.equal(c._festLit, undefined);
  assert.equal(kranz(c).brennt, 2);
  // danach ist alles wieder weg: Pfoten, Blick, Schein am Kranz
  assert.deepEqual(c.pika.classList.liste().filter((k) => /^fest-|happy|sniff/.test(k)), []);
  assert.equal(c._festWreathEl.classList.contains('warm'), false);
  assert.equal(gewicht(c), 0); // Pause
});

test('Advent: die Sprüche, „bald ist Weihnachten!“ erst nach dem 4. Advent und nicht mehr an Heiligabend', async () => {
  const zufall = Math.random;
  const sagt = async (t) => {
    const s = new Set();
    for (const r of [0.01, 0.3, 0.6, 0.99]) {
      Math.random = () => r;
      const c = karte(t);
      await c._festAdvent();
      s.add(c.log.say.at(-1));
    }
    return [...s].sort();
  };
  try {
    assert.deepEqual(await sagt(am(12, 15)), ['mmh, Tannenduft!', 'schön warm!']);
    assert.deepEqual(await sagt(am(12, 22)), ['bald ist Weihnachten!', 'schön warm!']);
    assert.deepEqual(await sagt(am(12, 24, 11)), ['mmh, Tannenduft!', 'schön warm!']);
  } finally {
    Math.random = zufall;
  }
});

test('Adventssonntag: die neue Kerze brennt erst, wenn er sie angezündet hat', async () => {
  const c = karte(am(12, 13)); // 3. Advent, 9 Uhr
  let K = kranz(c);
  // alle vier Kerzen stehen da, drei haben Flamme und Schein, die neue ist ausgeblendet
  assert.deepEqual([K.kerzen, K.flammen, K.scheine, K.neu, K.aus, K.brennt], [4, 3, 3, 1, true, 2]);
  assert.equal(c._festCandleOff(), true);
  // Schein und Flamme der neuen Kerze stehen zusammen in .fnew (Tag und Nacht bleiben gleich), die Kerze selbst nicht
  const neu = K.html.match(/<g class="fnew">(.*?)<\/g><\/g><\/g>/)[0];
  assert.equal((neu.match(/class="nite"/g) || []).length, 1);
  assert.equal((neu.match(/class="flm"/g) || []).length, 1);
  assert.ok(!neu.includes('<rect'));
  // er kommt bald und ohne Pause, auch wenn ihn beim ersten Anlauf etwas unterbrochen hat
  assert.ok(gewicht(c) >= 10);
  c._festMark('festAdvent');
  assert.ok(gewicht(c) >= 10);
  // ein Neuzeichnen (Karte ändert ihre Größe) lässt sie aus
  c._festUpdate(true);
  assert.equal(kranz(c).brennt, 2);

  await c._festAdvent();
  K = kranz(c);
  assert.deepEqual([K.aus, K.brennt], [false, 3]);
  assert.equal(c._festCandleOff(), false);
  assert.deepEqual(c.log.say.slice(0, 1), ['Dritter Advent!']);
  assert.equal(c.log.say.length, 2); // danach wärmt er sich noch die Pfoten
  assert.deepEqual(c.log.jump, ['hop1']);
  // Funke am Docht der dritten Kerze (vorn links im Kranz), die Pfote reicht hinunter bis dorthin
  const p = c._festPos.wreath;
  const [fx, fy] = c.log.spark[0];
  assert.ok(Math.abs(fx - (p.l + (9 / 44) * p.w)) < 0.01 && fy > p.top && fy < p.top + p.h / 2, `${fx} ${fy}`);
  assert.match(c.log.fky, /^\d+\.\dpx$/);
  // er sitzt links daneben (die dritte Kerze steht links) und schaut zum Kranz
  assert.ok(c._x < p.l && c._dir === 1, `${c._x} ${c._dir}`);
  // die Flamme springt kurz auf, die Klasse dafür räumt ein Zeitgeber wieder weg
  assert.equal(c._festWreathEl.classList.contains('lit'), true);
  assert.equal(c.log.later.length, 1);
  c.log.later[0][0]();
  assert.equal(c._festWreathEl.classList.contains('lit'), false);
  assert.deepEqual(c.pika.classList.liste().filter((k) => /^fest-/.test(k)), []);
  // jetzt nur noch ab und zu; ein Neuzeichnen und der nächste Takt lassen sie an
  assert.ok(gewicht(c) < 3);
  c._festUpdate(true);
  assert.equal(kranz(c).brennt, 3);
  stelle(c, am(12, 13, 15));
  assert.equal(kranz(c).brennt, 3);
  // noch einmal an den Kranz: kein zweites Anzünden
  c.log.say.length = c.log.jump.length = 0;
  c._festLast = {};
  await c._festAdvent();
  assert.equal(c.log.say.some((s) => /Advent!/.test(s)), false);
  assert.deepEqual(c.log.jump, []);
  // am Montag brennen ohnehin alle, die Gruppe .fnew gibt es dann nicht mehr
  stelle(c, am(12, 14));
  K = kranz(c);
  assert.deepEqual([K.flammen, K.neu, K.aus, K.brennt], [3, 0, false, 3]);
});

test('Adventssonntag: jede der vier Kerzen, von ihrer Seite aus, mit ihrem Spruch', async () => {
  const seite = [1, -1, 1, -1]; // Kerzen 1 und 3 stehen links im Kranz, 2 und 4 rechts
  const spruch = ['Erster Advent!', 'Zweiter Advent!', 'Dritter Advent!', 'Vierter Advent!'];
  for (const [i, d] of [[0, [11, 29]], [1, [12, 6]], [2, [12, 13]], [3, [12, 20]]]) {
    const c = karte(am(...d));
    assert.equal(kranz(c).brennt, i, `${i + 1}. Advent vorher`);
    await c._festAdvent();
    assert.equal(kranz(c).brennt, i + 1, `${i + 1}. Advent nachher`);
    assert.equal(c.log.say[0], spruch[i]);
    assert.equal(c._dir, seite[i]);
    const p = c._festPos.wreath;
    assert.ok(seite[i] > 0 ? c._x < p.x : c._x > p.x);
  }
});

test('Adventssonntag: nach dem Neuladen zündet er sie noch einmal an, zwei Geräte teilen nichts', async () => {
  const a = karte(am(11, 29));
  const b = karte(am(11, 29));
  await a._festAdvent();
  assert.equal(kranz(a).brennt, 1);
  assert.equal(kranz(b).brennt, 0); // das andere Gerät hat seine eigene Kerze
  const neuGeladen = karte(am(11, 29));
  assert.equal(kranz(neuGeladen).brennt, 0);
  await neuGeladen._festAdvent();
  assert.deepEqual(neuGeladen.log.say.slice(0, 1), ['Erster Advent!']);
  assert.equal(kranz(neuGeladen).brennt, 1);
  // gemerkt ist nur dieser Sonntag: Am nächsten ist die nächste Kerze wieder aus
  stelle(a, am(12, 6, 8));
  assert.deepEqual([kranz(a).flammen, kranz(a).brennt], [2, 1]);
});

test('Adventssonntag: kommt er nicht dazu, brennt die Kerze ab der Abenddämmerung von selbst, spätestens ab 17 Uhr', () => {
  // die Nacht auf Sonntag und der dunkle Morgen: noch aus (dunkel heißt nicht Abend)
  const c = karte(am(12, 13, 0, 10), 'night');
  assert.equal(kranz(c).brennt, 2);
  stelle(c, am(12, 13, 7, 30), 'dusk');
  assert.equal(kranz(c).brennt, 2);
  stelle(c, am(12, 13, 11, 59), 'night');
  assert.equal(kranz(c).brennt, 2);
  // heller Nachmittag: noch aus, die Aktion steht weiter an
  stelle(c, am(12, 13, 15, 30), 'day');
  assert.equal(kranz(c).brennt, 2);
  assert.ok(gewicht(c) >= 10);
  // Abenddämmerung: Der Takt nimmt .unlit weg, ohne neu zu zeichnen
  const el = c._festWreathEl;
  stelle(c, am(12, 13, 16, 20), 'dusk');
  assert.equal(c._festWreathEl, el);
  assert.equal(kranz(c).brennt, 3);
  assert.ok(gewicht(c) < 3); // jetzt wärmt er sich dort nur noch die Pfoten
  stelle(c, am(12, 13, 20), 'night');
  assert.equal(kranz(c).brennt, 3);
  // ein Himmel, der nicht dunkel wird (er folgt der Schlafenszeit): spätestens um 17 Uhr
  const h = karte(am(12, 13, 16, 59), 'day');
  assert.equal(kranz(h).brennt, 2);
  stelle(h, am(12, 13, 17, 0));
  assert.equal(kranz(h).brennt, 3);
  // wer das Gerät erst abends einschaltet, sieht sie brennen
  assert.equal(kranz(karte(am(12, 13, 18), 'night')).brennt, 3);
  // und am 1. Advent brennt abends eine, nicht keine
  assert.equal(kranz(karte(am(11, 29, 12, 0), 'dusk')).brennt, 1);
});

test('Adventssonntag: verreist geschieht nichts, die Kerze brennt trotzdem ab der Dämmerung', async () => {
  const c = karte(am(12, 6));
  c._urlaubFern = () => true;
  await c._festAdvent();
  assert.deepEqual([c.log.walk, c.log.say, c.log.jump, c.log.spark], [[], [], [], []]);
  assert.equal(c._festLit, undefined);
  assert.equal(kranz(c).brennt, 1);
  assert.equal(c._festLast?.festAdvent, undefined); // auch keine Pause gemerkt
  stelle(c, am(12, 6, 16, 30), 'dusk');
  assert.equal(kranz(c).brennt, 2);
  // ebenso an einem gewöhnlichen Adventstag
  const m = karte(am(12, 8));
  m._urlaubFern = () => true;
  await m._festAdvent();
  assert.deepEqual([m.log.walk, m.log.say], [[], []]);
});

test('Adventssonntag: beim Anlauf unterbrochen bleibt die Kerze aus und er versucht es wieder', async () => {
  const c = karte(am(12, 20));
  // die vierte Wartezeit ist die mit ausgestreckter Pfote, kurz vor dem Funken
  c.log.abbruch = 4;
  await assert.rejects(c._festAdvent(), /abgebrochen/);
  assert.equal(kranz(c).brennt, 3);
  assert.deepEqual(c.log.say, []);
  // aufgeräumt wird trotzdem (die Klassen kennt _cleanup nicht)
  assert.deepEqual(c.pika.classList.liste().filter((k) => /^fest-/.test(k)), []);
  assert.ok(gewicht(c) >= 10);
  c.log.abbruch = 0;
  await c._festAdvent();
  assert.equal(kranz(c).brennt, 4);
  assert.equal(c.log.say[0], 'Vierter Advent!');
});

test('Adventssonntag mit „Bewegung reduzieren“: kein Hüpfer, kein Funke, die Flamme blendet nur ein', async () => {
  RUHIG.matches = true;
  try {
    const c = karte(am(12, 6));
    await c._festAdvent();
    assert.equal(kranz(c).brennt, 2);
    assert.equal(c.log.say[0], 'Zweiter Advent!');
    assert.deepEqual(c.log.jump, []);
    assert.deepEqual(c.log.spark, []);
    // .lit ließe die Flamme aufspringen: nicht gesetzt, es bleibt beim Einblenden über .unlit
    assert.equal(c._festWreathEl.classList.contains('lit'), false);
    assert.deepEqual(c.log.later, []);
  } finally {
    RUHIG.matches = false;
  }
  // und im Stil ruhen Aufspringen und Pfotenreiben
  const ruhe = T.STYLES.slice(T.STYLES.indexOf('.fpn, .fmai .rb { animation: none !important; }'));
  assert.match(ruhe.slice(0, 400), /\.fwreath\.lit \.fpop, \.pika\.fest-warm:not\(\.fest-reach\) \.paws \{ animation: none; \}/);
});

test('Kranz im Stil: nur .unlit blendet die neue Kerze aus, der Schein dazu hängt an derselben Gruppe', () => {
  const S = T.STYLES;
  assert.match(S, /\.fwreath\.unlit \.fnew \{ opacity: 0; \}/);
  // Keine Regel versteckt .fnew, .fpop oder die Flammen des Kranzes ohne .unlit (sonst fehlte die Kerze den ganzen Tag)
  const regeln = [...S.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
  for (const [sel, body] of regeln) {
    if (!/\.fnew|\.fpop|\.fwreath/.test(sel) || !/display:\s*none|opacity:\s*0\s*[;}]|opacity:\s*0$|visibility:\s*hidden/.test(body.trim())) continue;
    assert.match(sel, /\.unlit/, `versteckt ohne .unlit: ${sel}`);
  }
  // Pfoten wärmen und Anzünden zeigen die Pfoten, die sonst verborgen sind
  assert.match(S, /\.pika\.fest-warm \.paws \{ display: inline;/);
  // Der Schein am Tag (Pfoten wärmen) darf den der Dämmerung und Nacht nicht überstimmen
  assert.match(S, /\.scene:not\(\.dusk\):not\(\.night\) \.fwreath\.warm \.nite/);
});

test('Vorschau: Knopf „Adventssonntag (Kerze anzünden)“, „Aktion!“ nimmt die Aktion zum Knopf', () => {
  const html = fs.readFileSync(new URL('../preview.html', import.meta.url), 'utf8');
  assert.match(html, /<button data-fest="kerze">Adventssonntag \(Kerze anzünden\)<\/button>/);
  assert.match(html, /kerze: \[kerze, 'day'\]/);
  assert.match(html, /if \(k === 'kerze'\) c\._festLit = null;/);
  assert.match(html, /c\._next = acts\.includes\(akt\) \? akt : acts\[0\];/);
});

test('Adventssonntag: kommt er nicht ganz an die Kerze heran (Rand der Wiese), greift die Pfote um genau so viel kürzer (--fkx)', async () => {
  const c = karte(am(12, 13)); // 3. Advent: die Kerze links vorn
  const props = {};
  c.pika.style.setProperty = (k, v) => (props[k] = v);
  // _walkTo hält ihn 6 px zu weit rechts an (wie die Grenze pW · 0,45 auf „Stumpf“ oder dem schmalen „Fels“)
  let ziel = null;
  c._walkTo = async (x) => {
    ziel = x;
    c._x = x + 6;
  };
  await c._festAdvent();
  // 6 px bei pW 119 sind 6,05 Einheiten der Pika-Grafik (120 breit), in Blickrichtung zurück
  assert.equal(props['--fkx'], '6.1px');
  // Pfote (bei x 113 von 120, um --fkx zurückgenommen) über dem Docht
  const p = c._festPos.wreath;
  const pfote = c._x + c._dir * c._g.pW * (113 / 120 - 0.5) - c._dir * (parseFloat(props['--fkx']) * c._g.pW) / 120;
  assert.ok(Math.abs(pfote - (p.l + (9 / 44) * p.w)) < 0.5, `Pfote ${pfote.toFixed(1)}, Ziel ${ziel.toFixed(1)}`);
  // steht er genau da, wohin er wollte, bleibt es bei der vollen Reichweite
  const d = karte(am(12, 13));
  const p2 = {};
  d.pika.style.setProperty = (k, v) => (p2[k] = v);
  await d._festAdvent();
  assert.equal(p2['--fkx'], '0.0px');
  // im Stil: die Reichweite nimmt --fkx zurück, auch bei Regen (die andere Pfote)
  assert.match(T.STYLES, /\.pika\.fest-warm\.fest-reach \.paws \{ transform: translate\(calc\(15px - var\(--fkx, 0px\)\), var\(--fky, 8px\)\); \}/);
  assert.match(T.STYLES, /\.fest-reach \.paws \{ transform: translate\(calc\(29px - var\(--fkx, 0px\)\)/);
});
