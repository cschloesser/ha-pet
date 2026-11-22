// Tagebuch und Karte, Lesbarkeit und Bedienung (0.43.1): Tab-Taste im Tagebuch, Tagesbeginn an den Tagen der
// Zeitumstellung, der Satz zum Advent, Kontraste (Tagebuch am Tag, Zähler am Päckchen-Knopf, Fokusringe), die
// Tippfläche des offenen Fensters und der Fuß des Tagebuchs über dem Home-Balken des iPhones. node --test
//
// Die Zeitzone muss stehen, bevor irgendein Datum entsteht (unter Windows wirkt die Variable der Shell nicht): darum
// zuerst TZ, und alles andere wird erst danach geladen.
process.env.TZ = 'Europe/Berlin';
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const fs = (await import('node:fs')).default;
const vm = (await import('node:vm')).default;
const { welt, ZUSTAND, PLAN } = await import('./welt.mjs');

// Steht die Zone wirklich? (Januar eine Stunde, Ende März und im Sommer zwei Stunden vor UTC)
const BERLIN = [new Date(2026, 0, 15, 12), new Date(2026, 2, 29, 12), new Date(2026, 6, 15, 12), new Date(2026, 9, 25, 12)]
  .map((d) => d.getTimezoneOffset()).join() === '-60,-120,-120,-60';

// ---------- das Bündel, mit einem kleinen DOM für das Fenster des Tagebuchs ----------
// Elemente entstehen aus dem HTML, das die Karte wirklich schreibt (innerHTML): Schlagwörter mit Attributen, in
// Reihenfolge des Dokuments. Mehr als das Tagebuch braucht, kann es nicht.
const LEER = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
class El {
  constructor(tag, attr = {}, wurzel = null) {
    this.tag = tag;
    this.attr = attr;
    this.wurzel = wurzel || this;
    this.eltern = null;
    this.kinder = [];
    this.horcher = {};
    this.sichtbar = true;
    this.scrollTop = 0;
    this.textContent = '';
    this.html = '';
    this.stil = ''; // Inhalt von <style> (nur an der Wurzel)
    this.activeElement = null;
  }

  get dataset() {
    return Object.fromEntries(Object.entries(this.attr).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5), v]));
  }

  get disabled() {
    return 'disabled' in this.attr;
  }

  get className() {
    return this.attr.class || '';
  }

  set className(v) {
    this.attr.class = v;
  }

  get innerHTML() {
    return this.html;
  }

  set innerHTML(h) {
    this.html = h;
    const stil = h.match(/<style>([\s\S]*?)<\/style>/);
    if (stil) this.stil = stil[1];
    this.kinder = [];
    let hier = this;
    for (const m of h.replace(/<style>[\s\S]*?<\/style>/g, '').matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|[^>"])*)>/g)) {
      const tag = m[2].toLowerCase();
      if (m[1]) {
        // schließt das nächste offene Element dieses Namens
        for (let e = hier; e !== this; e = e.eltern) {
          if (e.tag === tag) {
            hier = e.eltern;
            break;
          }
        }
        continue;
      }
      const attr = Object.fromEntries([...m[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? '']));
      const e = new El(tag, attr, this.wurzel);
      e.eltern = hier;
      hier.kinder.push(e);
      if (!/\/\s*$/.test(m[3]) && !LEER.has(tag)) hier = e;
    }
    // Was den Fokus hatte und nicht mehr im Dokument steht, hat ihn verloren (wie im Browser: er fällt an <body>)
    const W = this.wurzel;
    if (W.activeElement && !W.alle().includes(W.activeElement)) W.activeElement = null;
  }

  // alle Nachfahren in Reihenfolge des Dokuments
  alle() {
    return this.kinder.flatMap((k) => [k, ...k.alle()]);
  }

  contains(e) {
    return e === this || this.alle().includes(e);
  }

  // Selektoren, wie das Tagebuch sie braucht: Name, .klasse, [attribut], :not([attribut]), mit Komma gereiht
  passt(sel) {
    return sel.split(',').some((s) => {
      const m = s.trim().match(/^([a-z]+)?((?:\.[\w-]+)*)((?:\[[\w-]+\])*)((?::not\(\[[\w-]+\]\))*)$/);
      if (!m) throw new Error(`Selektor „${s.trim()}“ kennt die Attrappe nicht`);
      const kl = this.className.split(/\s+/);
      return (!m[1] || m[1] === this.tag)
        && m[2].split('.').filter(Boolean).every((k) => kl.includes(k))
        && [...m[3].matchAll(/\[([\w-]+)\]/g)].every((a) => a[1] in this.attr)
        && [...m[4].matchAll(/\[([\w-]+)\]/g)].every((a) => !(a[1] in this.attr));
    });
  }

  querySelectorAll(sel) {
    return this.alle().filter((e) => e.passt(sel));
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  closest(sel) {
    for (let e = this; e; e = e.eltern) if (e.tag !== '#wurzel' && e.passt(sel)) return e;
    return null;
  }

  setAttribute(k, v) {
    this.attr[k] = String(v);
  }

  addEventListener(typ, fn) {
    (this.horcher[typ] ||= []).push(fn);
  }

  // Ereignis an die Horcher dieses Elements (kein Aufsteigen: Die Tests rufen dort, wo die Karte horcht)
  melde(typ, e = {}) {
    for (const fn of this.horcher[typ] || []) fn(e);
    return e;
  }

  // Ein gesperrter Knopf nimmt den Fokus nicht an, ein unsichtbares Element auch nicht: .focus() tut dann nichts
  focus() {
    if (this.disabled || !this.sichtbar) return;
    this.wurzel.activeElement = this;
  }

  getClientRects() {
    for (let e = this; e; e = e.eltern) if (!e.sichtbar) return [];
    return [{}];
  }

  attachShadow() {
    this.schatten = new El('#wurzel');
    return this.schatten;
  }

  remove() {
    this.weg = true;
  }
}

let T = null;
const koerper = [];
const WELT = {
  window: { matchMedia: () => ({ matches: false }), customCards: [] },
  document: { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: (tag) => new El(tag), body: { appendChild: (e) => koerper.push(e) } },
  HTMLElement: class {},
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn() {}, debug() {} },
  // (das Tagebuch schließt sich nach einer Weile von selbst: hier läuft keine Uhr)
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController, performance,
  __pikaTest: (x) => (T = x),
};
vm.runInNewContext(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'), WELT, { filename: 'pika-pet-card.js' });

const atmen = () => new Promise((r) => { setImmediate(r); });
const MITTAG = new Date(2026, 10, 21, 12).getTime();
// Ein aufgeschlagenes Tagebuch (Seite Heute, echtes _diaryOpen und _diaryRender) an einer Karte ohne Szene.
// paket: Ein Päckchen liegt noch verpackt, der Knopf „Zu Pino schicken“ ist gesperrt. fehler: Im Fuß steht die
// Fehlerliste zum Aufklappen.
const tagebuch = async ({ paket = false, fehler = 0, nacht = false } = {}) => {
  const c = Object.create(T.PikaPetCard.prototype);
  const ruf = [];
  Object.assign(c, {
    _cfg: { name: 'Pika' }, _planOk: true, _plan: paket ? { gift: { z: 1, o: 0 } } : { gift: { z: 1, o: 1 } },
    _el: { scene: { classList: { contains: (k) => nacht && k === 'night' } }, stats: { hidden: false, isConnected: false }, tbbtn: {} },
    _haNow: () => MITTAG, _errs: [...Array(fehler).keys()].map((i) => ({ t: MITTAG - i * 6e4, where: 'Test', msg: `Fehler ${i}`, n: 1 })),
    _urlaubCardSeen() {}, _diaryDot() {}, _diarySig: () => 'x',
    _urlaubStart: () => ruf.push('los'), _urlaubEnde: () => ruf.push('zurück'),
    // eine Seite mit einem Eintrag, wie _diaryModel sie liefert
    _diaryBuild: async () => {
      const seite = { start: MITTAG, entries: [{ t: MITTAG, part: 'Mittags', icon: 'wake', text: 'Guten Morgen.' }], chips: [], fazit: 'Liebes Tagebuch, heute ist ein gemütlicher Tag.', early: false };
      return { fail: false, none: false, days: [seite, seite] };
    },
  });
  c._diaryOpen();
  await atmen();
  const host = koerper.at(-1);
  const root = host.schatten;
  return {
    c, host, root, ruf,
    // Taste am Fenster drücken (dort horcht die Karte)
    taste(key, shiftKey = false) {
      const e = { key, shiftKey, verhindert: false, gestoppt: false };
      e.preventDefault = () => (e.verhindert = true);
      e.stopPropagation = () => (e.gestoppt = true);
      return host.melde('keydown', e);
    },
    // Wo der Fokus steht, als Wort
    wo() {
      const a = root.activeElement;
      if (!a) return null;
      return a.dataset.tab || a.dataset.ur || (a.tag === 'button' ? a.className : a.tag === 'summary' ? 'fehler' : a.className);
    },
  };
};

// ---------- 1 Tab-Taste ----------
test('Tagebuch, Tab-Taste: Der gesperrte Knopf „Zu Pino schicken“ hält den Fokus nicht fest, die Fehlerliste ist erreichbar', async () => {
  const D = await tagebuch({ paket: true, fehler: 2 });
  // die Lage aus dem Audit: ein gesperrter Knopf auf der Seite, die Fehlerliste im Fuß
  const zu = D.root.querySelector('button[data-ur]');
  assert.ok(zu && zu.disabled && zu.closest('.page'), 'gesperrter Knopf auf der Seite');
  assert.ok(D.root.querySelector('.ft').querySelector('summary'), 'Fehlerliste im Fuß');
  D.root.querySelector('.x').focus();
  const weg = [];
  for (let i = 0; i < 8; i++) {
    const e = D.taste('Tab');
    assert.equal(e.verhindert, true, 'der Fokus bleibt im Fenster');
    weg.push(D.wo());
  }
  // bis 0.43.0: … 'page', 'page', 'page' (.focus() auf dem gesperrten Knopf tut nichts)
  assert.deepEqual(weg, ['heute', 'gestern', 'schatz', 'entd', 'page', 'fehler', 'x', 'heute']);
  // rückwärts vom ✕ ans Ende
  D.root.querySelector('.x').focus();
  const rueck = [];
  for (let i = 0; i < 3; i++) {
    D.taste('Tab', true);
    rueck.push(D.wo());
  }
  assert.deepEqual(rueck, ['fehler', 'page', 'entd']);
});

test('Tagebuch, Tab-Taste: Vom Fenster selbst geht es vorwärts zum ersten und rückwärts zum letzten Ziel; Unsichtbares zählt nicht', async () => {
  const D = await tagebuch({ fehler: 1 });
  // gleich nach dem Aufschlagen liegt der Fokus auf dem Fenster (nicht in der Reihe)
  assert.equal(D.wo(), 'sheet');
  D.taste('Tab');
  assert.equal(D.wo(), 'x');
  D.root.querySelector('.sheet').focus();
  D.taste('Tab', true);
  assert.equal(D.wo(), 'fehler');
  // der freie Knopf „Zu Pino schicken“ gehört dazu
  D.root.querySelector('.page').focus();
  D.taste('Tab');
  assert.equal(D.wo(), 'ask');
  D.taste('Tab');
  assert.equal(D.wo(), 'fehler');
  // ein Ziel, das nicht zu sehen ist, wird übersprungen (statt den Fokus festzuhalten)
  D.root.querySelector('.ft').sichtbar = false;
  D.root.querySelector('[data-ur]').focus();
  D.taste('Tab');
  assert.equal(D.wo(), 'x');
  D.taste('Tab', true);
  assert.equal(D.wo(), 'ask');
});

test('Tagebuch, Tastatur: Escape schließt; nach „Zu Pino schicken“ bleibt der Fokus im Fenster (der Knopf wird neu gezeichnet)', async () => {
  const D = await tagebuch();
  const ask = D.root.querySelector('[data-ur]');
  assert.equal(ask.dataset.ur, 'ask');
  ask.focus();
  D.root.querySelector('.page').melde('click', { target: ask });
  // die Nachfrage steht da, der alte Knopf ist fort: Der Fokus liegt auf der Seite, ein Tab weiter steht „Ja, los“
  assert.deepEqual(D.root.querySelectorAll('[data-ur]').map((b) => b.dataset.ur), ['go', 'no']);
  assert.equal(D.wo(), 'page');
  D.taste('Tab');
  assert.equal(D.wo(), 'go');
  D.root.querySelector('.page').melde('click', { target: D.root.activeElement });
  assert.deepEqual(D.ruf, ['los']);
  assert.equal(D.wo(), 'page');
  const e = D.taste('Escape');
  assert.deepEqual([e.gestoppt, D.host.weg, D.c._dia], [true, true, null]);
});

// ---------- 2 Tagesbeginn an den Tagen der Zeitumstellung ----------
test('Tagebuch: Der Pika-Tag beginnt auch an den Tagen der Zeitumstellung um 4 Uhr, wie pikaDay und die Chronik rechnen',
  { skip: BERLIN ? false : 'die Zeitzone Europe/Berlin lässt sich in diesem Prozess nicht einstellen' }, () => {
    const c = Object.create(T.PikaPetCard.prototype);
    let jetzt = 0;
    c._haNow = () => jetzt;
    const tag = (t, back = 0) => {
      jetzt = t;
      return new Date(c._diaryDay(back)).toString().slice(4, 21);
    };
    const um = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
    // ein gewöhnlicher Tag
    assert.equal(tag(um(2026, 11, 21, 12)), 'Nov 21 2026 04:00');
    assert.equal(tag(um(2026, 11, 21, 3, 59)), 'Nov 20 2026 04:00');
    assert.equal(tag(um(2026, 11, 21, 12), 1), 'Nov 20 2026 04:00');
    // 29. 3. 2026, 04:30 Sommerzeit (die Nacht hatte nur 23 Stunden). Bis 0.43.0: 28. 3., 04:00
    const fruehling = Date.UTC(2026, 2, 29, 2, 30);
    assert.equal(new Date(fruehling).toString().slice(4, 21), 'Mar 29 2026 04:30');
    assert.equal(tag(fruehling), 'Mar 29 2026 04:00');
    assert.equal(tag(fruehling, 1), 'Mar 28 2026 04:00');
    assert.equal(tag(um(2026, 3, 29, 3, 30)), 'Mar 28 2026 04:00');
    // 25. 10. 2026, 03:30 Winterzeit (die Stunde nach dem Zurückstellen). Bis 0.43.0: 25. 10., 04:00, also in der Zukunft
    const herbst = Date.UTC(2026, 9, 25, 2, 30);
    assert.equal(new Date(herbst).toString().slice(4, 21), 'Oct 25 2026 03:30');
    assert.equal(new Date(herbst).getTimezoneOffset(), -60);
    assert.equal(tag(herbst), 'Oct 24 2026 04:00');
    assert.equal(tag(herbst, 1), 'Oct 23 2026 04:00');
    assert.equal(tag(um(2026, 10, 25, 4, 30)), 'Oct 25 2026 04:00');
    // Viertelstunde für Viertelstunde durch beide Wochenenden: nie in der Zukunft, nie länger als ein Tag her (25 h im
    // Herbst), immer 4 Uhr, und derselbe Tag wie bei pikaDay und chronikStart
    for (const von of [um(2026, 3, 27, 0), um(2026, 10, 23, 0)]) {
      for (let t = von; t < von + 4 * 864e5; t += 9e5) {
        jetzt = t;
        const d0 = c._diaryDay(0);
        const d1 = c._diaryDay(1);
        const wann = new Date(t).toString();
        assert.ok(d0 <= t && t - d0 < 25 * 36e5 + 1, `${wann}: heute beginnt ${new Date(d0)}`);
        assert.deepEqual([new Date(d0).getHours(), new Date(d1).getHours()], [4, 4], wann);
        assert.ok(d0 - d1 >= 23 * 36e5 && d0 - d1 <= 25 * 36e5, wann);
        assert.equal(d0, T.chronikStart(T.pikaDay(t)), wann);
        assert.equal(T.pikaDay(d0), T.pikaDay(t), wann);
        assert.equal(T.pikaDay(d1), T.pikaDay(t) - 1, wann);
      }
    }
  });

// ---------- 3 Advent ----------
test('Tagebuch am Adventssonntag: Morgens steht da, dass heute eine Kerze dazukommt (er zündet sie erst im Lauf des Tages an)', async () => {
  const seite = async (y, mo, d) => {
    const W = welt({ start: new Date(y, mo - 1, d, 12).getTime() });
    const t0 = W.jetzt();
    W.ha.setze(PLAN, W.T.planSer(W.T.planBlank(t0)), 'anfang', { max: 255 });
    W.ha.setze(ZUSTAND, W.T.serialize({ ...W.T.freshStats(t0), s: 80, g: 80 }), 'anfang', { max: 100 });
    const K = W.karte('K', { festive: true });
    await W.vor(1000);
    const d0 = K.c._diaryDay(0);
    const M = K.c._diaryModel(d0, W.jetzt() + 1, { ev: [], stamps: [], pets: {}, data: true }, [], true, false);
    return M.entries.map((e) => e.text);
  };
  // 2026: 1. Advent am 29. 11., 2. Advent am 6. 12.
  const erster = await seite(2026, 11, 29);
  assert.ok(erster.includes('Der 1. Advent! Heute kommt am Kranz eine Kerze dazu.'), erster.join(' | '));
  const zweiter = await seite(2026, 12, 6);
  assert.ok(zweiter.includes('Der 2. Advent! Heute kommt am Kranz eine Kerze dazu.'), zweiter.join(' | '));
  // (bis 0.43.0 „brennt eine Kerze mehr“: Das stimmte morgens noch nicht)
  assert.equal([...erster, ...zweiter].some((s) => /brennt eine Kerze mehr/.test(s)), false);
  // ein Montag im Advent: kein Satz dazu
  const montag = await seite(2026, 11, 30);
  assert.equal(montag.some((s) => /Advent!/.test(s)), false, montag.join(' | '));
});

// ---------- Kontrast (WCAG 2.x) ----------
// Farbe aus dem Stylesheet: #rgb, #rrggbb oder rgb(a)(r, g, b[, a]) → [r, g, b, a]
const farbe = (s) => {
  const t = String(s).trim();
  let m = t.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((x) => parseInt(x + x, 16)).concat(1);
  m = t.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = t.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])];
  throw new Error(`Farbe „${s}“ nicht gelesen`);
};
// vorn (mit Deckkraft) über hinten (deckend)
const ueber = (vorn, hinten) => {
  const [a, b] = [farbe(vorn), farbe(hinten)];
  return `rgb(${[0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).join(', ')})`;
};
const leuchte = (s) => {
  const [r, g, b] = farbe(s).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Kontrastverhältnis zweier deckender Farben, 1 bis 21
const kontrast = (a, b) => {
  const [x, y] = [leuchte(a), leuchte(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const rund = (v) => Math.round(v * 100) / 100;

// Regeln eines Stylesheets ohne Kommentare: [Selektor, Deklarationen] (auch die in @media, ohne ihre Bedingung)
const regeln = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => [m[1].replace(/\s+/g, ' ').trim(), m[2].replace(/\s+/g, ' ').trim()]);
// Deklarationen der Regel mit genau diesem Selektor (die erste; in @media stehen spätere)
const regel = (R, sel) => {
  const r = R.find(([s]) => s === sel);
  assert.ok(r, `Regel „${sel}“ fehlt`);
  return r[1];
};
// Wert einer Eigenschaft (die letzte Angabe gilt)
const wert = (dekl, eig) => {
  const m = [...dekl.matchAll(new RegExp(`(?:^|;)\\s*${eig}:\\s*([^;]+)`, 'g'))].at(-1);
  assert.ok(m, `„${eig}“ fehlt in: ${dekl}`);
  return m[1].trim();
};
const marken = (dekl) => Object.fromEntries([...dekl.matchAll(/(--[\w-]+):\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
const mit = (v, M) => v.replace(/var\((--[\w-]+)\)/g, (_, k) => {
  assert.ok(M[k], `${k} ist nicht gesetzt`);
  return M[k];
});

test('Kontrast-Rechnung: Schwarz auf Weiß 21, die bekannten Werte des Audits, Deckkraft wird verrechnet', () => {
  assert.equal(rund(kontrast('#000', '#fff')), 21);
  assert.equal(rund(kontrast('#fff', '#ffffff')), 1);
  assert.equal(rund(kontrast('#777777', '#fff')), 4.48);
  // die Werte aus dem Audit (Tagebuch am Tag bis 0.43.0, Papier #fbf5e6)
  assert.equal(rund(kontrast('#c9853a', '#fbf5e6')), 2.8);
  assert.equal(rund(kontrast('#fff', '#c9853a')), 3.04);
  assert.equal(rund(kontrast('#8a7461', '#fbf5e6')), 4.06);
  assert.equal(rund(kontrast('#d9622b', '#fbf5e6')), 3.37);
  assert.equal(rund(kontrast('#fff', '#d99a12')), 2.45);
  assert.equal(rund(kontrast('#fff', '#e8584e')), 3.54);
  assert.equal(rund(kontrast('#8a7461', ueber('rgba(90, 64, 48, .08)', '#fbf5e6'))), 3.58);
  assert.equal(ueber('rgba(0, 0, 0, .5)', '#fff'), 'rgb(127.5, 127.5, 127.5)');
});

// ---------- 4 Tagebuch: Farben am Tag und in der Nacht ----------
test('Tagebuch am Tag: Überschriften, Reiter, Knöpfe, kleine graue Schrift und die Warnung erreichen 4,5 : 1 auf dem Papier', async () => {
  const D = await tagebuch();
  const R = regeln(D.root.stil);
  const tag = marken(regel(R, '.bd'));
  const pp = tag['--pp'];
  const f = (v) => mit(v, tag);
  const reiter = ueber(tag['--tab'], pp);
  const fokus = R.find(([s]) => s.startsWith('button:focus-visible'));
  // [was, Schrift, Grund, mindestens]
  const paare = [
    ['Tinte auf Papier', tag['--ink'], pp, 7],
    ['Überschrift der Tageszeit (h3, 13 px fett)', f(wert(regel(R, 'h3'), 'color')), pp, 4.5],
    ['gewählter Reiter', wert(regel(R, '.tabs button[aria-selected="true"]'), 'color'), f(wert(regel(R, '.tabs button[aria-selected="true"]'), 'background')), 4.5],
    ['Knopf im Ferien-Kasten', wert(regel(R, '.ur button'), 'color'), f(wert(regel(R, '.ur button'), 'background')), 4.5],
    ['Pfote einer Entdeckung', wert(regel(R, '.fd.ok > i'), 'color'), f(wert(regel(R, '.fd.ok > i'), 'background')), 3],
    ['Uhrzeit, Fuß, Hinweis (--soft, 11–13 px)', tag['--soft'], pp, 4.5],
    ['nicht gewählter Reiter, Schatz-Kachel (--soft auf --tab)', f(wert(regel(R, '.tabs button'), 'color')), reiter, 4.5],
    ['Ferien-Kasten, wenn er verreist ist (--soft auf .ur.on)', f(wert(regel(R, '.ur span'), 'color')), ueber(wert(regel(R, '.ur.on'), 'background'), pp), 4.5],
    ['Warnung bei den Schätzen (.row .w, 12 px fett)', f(wert(regel(R, '.row .w'), 'color')), pp, 4.5],
    ['Fokusring im Tagebuch', f(wert(fokus[1], 'outline').split(' ').at(-1)), pp, 3],
    ['Ring der Punkte „Gute Tage“', f(wert(regel(R, '.d7 u'), 'box-shadow').split(' ').at(-1)), pp, 3],
  ];
  for (const [was, vorn, hinten, min] of paare) {
    const k = kontrast(vorn, hinten);
    assert.ok(k >= min, `${was}: ${vorn} auf ${hinten} hat ${rund(k)}, soll ${min}`);
  }
  // der Fokusring gilt auch für die Fehlerliste im Fuß (seit 0.43.1 mit Tab erreichbar)
  assert.equal(fokus[0], 'button:focus-visible, .page:focus-visible, summary:focus-visible');
  // die kleine graue Schrift hängt wirklich an --soft, die Akzente an --acc
  for (const sel of ['.ht span', '.tm', '.ft', '.note', '.t span, .row span', '.fd span', '.x']) assert.equal(wert(regel(R, sel), 'color'), 'var(--soft)', sel);
  assert.equal(wert(regel(R, 'h3'), 'color'), 'var(--acc)');
  assert.equal(wert(regel(R, '.row .w'), 'color'), 'var(--warn)');
  // warm geblieben: Akzent und Warnung sind Orange-Braun (Rot > Grün > Blau), das Grau ist ein Braun
  for (const k of ['--acc', '--warn', '--soft']) {
    const [r, g, b] = farbe(tag[k]);
    assert.ok(r > g && g > b, `${k} ${tag[k]}`);
  }
});

test('Tagebuch in der Nacht: die Palette ist unverändert und reicht aus', async () => {
  const D = await tagebuch({ nacht: true });
  assert.match(D.root.html, /<div class="bd night">/);
  const R = regeln(D.root.stil);
  const nacht = marken(regel(R, '.bd.night'));
  // wie bis 0.43.0 (--warn ist neu als Name, die Farbe ist die alte)
  assert.deepEqual(nacht, {
    '--pp': '#262d4a', '--ink': '#ecebf7', '--soft': '#a9add0', '--line': 'rgba(255, 255, 255, .16)', '--rand': 'rgba(255, 150, 150, .3)',
    '--tab': 'rgba(255, 255, 255, .09)', '--acc': '#f2c56b', '--warn': '#ea7a45',
  });
  const pp = nacht['--pp'];
  assert.ok(kontrast(nacht['--ink'], pp) >= 7);
  assert.ok(kontrast(nacht['--soft'], pp) >= 6.1);
  assert.ok(kontrast(nacht['--soft'], ueber(nacht['--tab'], pp)) >= 4.5);
  assert.ok(kontrast(nacht['--acc'], pp) >= 4.5);
  for (const sel of ['.night .tabs button[aria-selected="true"]', '.night .ur button', '.night .fd.ok > i']) {
    assert.ok(kontrast(wert(regel(R, sel), 'color'), nacht['--acc']) >= 4.5, sel);
  }
  // Die Warnung hatte nachts 3,68 (#d9622b); mit #ea7a45 erreicht sie auch dort 4,5
  assert.ok(kontrast(nacht['--warn'], pp) >= 4.5, `Warnung nachts ${rund(kontrast(nacht['--warn'], pp))}`);
});

// ---------- 5 Karte: Zähler am Päckchen-Knopf, Fokusringe ----------
test('Päckchen-Knopf: Die Zahl am roten und am goldenen Zähler ist lesbar (4,5 : 1)', () => {
  const R = regeln(T.STYLES);
  const rot = regel(R, '.gnum');
  const gold = regel(R, '.gbtn.gold .gnum');
  const k1 = kontrast(wert(rot, 'color'), wert(rot, 'background'));
  const k2 = kontrast(wert(gold, 'color'), wert(gold, 'background'));
  assert.ok(k1 >= 4.5, `rot: ${rund(k1)}`);
  assert.ok(k2 >= 4.5, `gold: ${rund(k2)}`);
  // rot bleibt rot, gold bleibt gold
  const [r, g, b] = farbe(wert(rot, 'background'));
  assert.ok(r > 190 && g < 90 && b < 90, wert(rot, 'background'));
  assert.equal(wert(gold, 'background'), '#d99a12');
});

test('Fokusringe der Karte: zwei Töne, einer davon hebt sich von jedem Himmel ab (Leiste, Buch-Knopf, Pika, alles Antippbare)', () => {
  const R = regeln(T.STYLES);
  // Himmel aus dem Stylesheet (Verläufe von Tag, Dämmerung, Nacht, Grau) und die weiße Leiste
  const himmel = ['.sky-day', '.sky-dusk', '.sky-night', '.sky-grey'].flatMap((s) => wert(regel(R, s), 'background').match(/#[0-9a-f]{6}/g));
  assert.ok(himmel.length >= 9, himmel.join());
  // bis 0.43.0: ein weißer Ring, auf dem Taghimmel kaum zu sehen
  assert.ok(kontrast('#fff', himmel[0]) < 2 && kontrast('#fff', himmel[1]) < 2);
  for (const sel of ['.stats:focus-visible, .tbbtn:focus-visible', '.pika:focus-visible', '.ktap:focus-visible']) {
    const d = regel(R, sel);
    const linie = wert(d, 'outline').match(/^2px solid (#[0-9a-f]{3,6})$/);
    const schein = wert(d, 'box-shadow').match(/^(inset )?0 0 0 (\d)px (#[0-9a-f]{3,6})$/);
    assert.ok(linie && schein, `${sel}: ${d}`);
    // überall derselbe Ring: dunkle Linie innen, heller Rand außen (beim Pika beides nach innen gesetzt)
    const [a, b] = [linie[1], schein[3]];
    assert.ok(leuchte(a) < 0.05 && leuchte(b) > 0.9 && kontrast(a, b) >= 7, `${sel}: die beiden Töne ${a} und ${b}`);
    for (const h of [...himmel, '#fff']) {
      assert.ok(Math.max(kontrast(a, h), kontrast(b, h)) >= 3, `${sel} vor ${h}: ${rund(kontrast(a, h))} und ${rund(kontrast(b, h))}`);
    }
    // der Ring ragt höchstens 5 px über das Element (der Buch-Knopf sitzt 6 px unter dem Kartenrand)
    assert.ok(Number(schein[2]) <= 5, sel);
  }
  // die Linie liegt innerhalb des hellen Rands: außen 1 bis 3 px von 5, beim Pika innen 2 bis 4 px hinter 2 px Rand
  assert.deepEqual(['.stats:focus-visible, .tbbtn:focus-visible', '.ktap:focus-visible', '.pika:focus-visible'].map((s) => [wert(regel(R, s), 'outline-offset'), wert(regel(R, s), 'box-shadow')]),
    [['1px', '0 0 0 5px #fff'], ['1px', '0 0 0 5px #fff'], ['-4px', 'inset 0 0 0 2px #fff']]);
  // der Buch-Knopf behält dabei seinen Schatten
  assert.match(wert(regel(R, '.tbbtn:focus-visible'), 'box-shadow'), /^0 0 0 5px #fff, 0 2px 6px rgba\(0, 0, 0, \.18\)$/);
  assert.match(wert(regel(R, '.tbbtn'), 'box-shadow'), /^0 2px 6px rgba\(0, 0, 0, \.18\)$/);
});

// ---------- 6 Tippfläche des offenen Fensters ----------
test('Offenes Fenster: Die Tippfläche ist mindestens 44 px groß, sitzt mittig und reicht nie über die Tür', () => {
  const R = regeln(T.STYLES);
  const d = regel(R, '.fenster::after');
  assert.match(d, /border-radius: 50%/);
  assert.equal(wert(d, 'pointer-events'), 'none');
  assert.equal(wert(regel(R, '.fenster.da.auf::after'), 'pointer-events'), 'auto');
  // CSS-Rechnung für eine Kästchenbreite B (px): Prozente beziehen sich auf das Kästchen
  const rechne = (v, B) => Function('B', `return ${v.replace(/(-?[\d.]+)%/g, '($1 * B / 100)').replace(/(-?[\d.]+)px/g, '($1)')
    .replace(/calc\(/g, '(').replace(/\bmin\(/g, 'Math.min(').replace(/\bmax\(/g, 'Math.max(')};`)(B);
  const rand = (B) => Object.fromEntries(['left', 'top', 'right', 'bottom'].map((k) => [k, rechne(wert(d, k), B)]));
  // Maße des Erdhügels: Baubreite 0,82 H in 100 Einheiten, Fenstermitte bei 80 | 33 in einem Kästchen von 28 Einheiten
  // (FEN in src/grafik/fenster.js), die Tür endet rechts bei hole.x2
  const A = T.AREALE.huegel;
  const tuer = 80 - A.hole.x2;
  assert.ok(tuer > 14 && tuer < 20, `Tür ${tuer} Einheiten links der Fenstermitte`);
  const zeilen = [];
  for (const H of [120, 130, 140, 150, 154, 180, 200, 248, 320, 400, 600]) {
    const u = (A.w * H) / 100;
    const B = 28 * u;
    const r = rand(B);
    const [breit, hoch] = [B - r.left - r.right, B - r.top - r.bottom];
    const nachLinks = B / 2 - r.left;
    zeilen.push(`${H}: ${breit.toFixed(1)} × ${hoch.toFixed(1)}`);
    // nie kleiner als bisher (ein Kreis von 50 % des Kästchens) …
    assert.ok(breit >= B / 2 - 1e-9 && hoch >= B / 2 - 1e-9, `H ${H}`);
    // … mittig nach oben, unten und rechts, mindestens 22 px weit
    assert.ok(Math.abs(r.top - r.bottom) < 1e-9, `H ${H}`);
    assert.ok(hoch >= 44 - 1e-9 && B / 2 - r.right >= 22 - 1e-9, `H ${H}: ${breit.toFixed(1)} × ${hoch.toFixed(1)}`);
    // … und nach links höchstens bis an die Tür (deren Tipp sucht die Szene nach Rechtecken, das Fenster läge darüber)
    assert.ok(nachLinks <= tuer * u + 1e-9, `H ${H}: ${nachLinks.toFixed(1)} px nach links, die Tür beginnt bei ${(tuer * u).toFixed(1)}`);
    // ab 154 px Größeneinheit die vollen 44 px, ab da ein Kreis
    if (H >= 154) assert.ok(breit >= 44 - 1e-9 && Math.abs(breit - hoch) < 1e-9 && Math.abs(r.left - r.right) < 1e-9, `H ${H}: ${breit.toFixed(1)} × ${hoch.toFixed(1)}`);
    else assert.ok(breit >= 38, `H ${H}: ${breit.toFixed(1)}`);
    // große Karten: wie bisher 25 % Rand ringsum
    if (B >= 88) assert.deepEqual(Object.values(r).map(rund), [0.25 * B, 0.25 * B, 0.25 * B, 0.25 * B].map(rund), `H ${H}`);
  }
  // bis 0.43.0: 13,8 px bei der kleinsten Karte, 20,7 px bei 180, 28,5 px bei 248
  assert.deepEqual([zeilen[0], zeilen[5], zeilen[7]], ['120: 39.2 × 44.0', '180: 44.0 × 44.0', '248: 44.0 × 44.0']);
  // Was am Boden eine eigene Tippfläche hat, liegt weiter über dem Fenster und behält den Vorrang
  for (const k of ['blume', 'schatz', 'mausVorn', 'vogel', 'pino', 'pika', 'haeufchen', 'geraet', 'tonne', 'sauger']) assert.ok(T.BZ[k] > T.BZ.fenster, k);
  assert.ok(T.BZ.fenster > T.BZ.bau);
});

// ---------- 7 iPhone: Fuß des Tagebuchs über dem Home-Balken ----------
test('Tagebuch als Blatt von unten (bis 520 px): Der Fuß hält Abstand zum Home-Balken, die Seite gibt nach', async () => {
  const D = await tagebuch();
  const css = D.root.stil.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = css.match(/@media \(max-width: 520px\) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/);
  assert.ok(block, '@media (max-width: 520px)');
  const M = regeln(block[1]);
  assert.equal(wert(regel(M, '.ft'), 'padding-bottom'), 'max(8px, env(safe-area-inset-bottom))');
  // sonst wie bisher: Blatt am unteren Rand, höchstens 90 % hoch
  assert.equal(wert(regel(M, '.bd'), 'align-items'), 'flex-end');
  assert.equal(wert(regel(M, '.sheet'), 'height'), 'min(640px, 90%)');
  // ohne Einzug (alle anderen Geräte) bleibt es bei 8 px; der Fuß ist fest, die Seite darüber nimmt den Rest und rollt
  const R = regeln(css);
  assert.equal(wert(regel(R, '.ft'), 'padding'), '5px 18px 8px');
  assert.equal(wert(regel(R, '.ft'), 'flex'), 'none');
  assert.match(regel(R, '.page'), /flex: 1; min-height: 120px; overflow-y: auto;/);
  assert.equal(wert(regel(R, '.sheet'), 'flex-direction'), 'column');
});

// ---------- 6 Fokus nach dem Urlaubsschalter, Selbstschließ-Uhr (Nach-Audit 0.45.1) ----------
// Hier mit dem echten _urlaubStart/_urlaubEnde bis _urlaubFromPlan: Der zeichnet die Seite selbst neu (der Urlaub hat
// gewechselt), noch bevor der Klick-Horcher es tut. Bis 0.45.0 war der gedrückte Knopf da schon fort, und der Fokus
// fiel aus dem Fenster (die Prüfung im Horcher kam zu spät).
const urlaubBuch = async () => {
  const D = await tagebuch();
  const c = D.c;
  let on = false;
  delete c._urlaubStart;
  delete c._urlaubEnde;
  Object.assign(c, {
    _urlaubMay: () => true, _urlaubBusy: () => false, _urlaubOn: () => on, _careEval: () => null,
    _urlaubScene() {}, _urlaubRebase() {}, _awakeBack: (n) => n, _awakeMs: () => 0,
    // wie der Tagesplan den Urlaub einträgt bzw. beendet
    _planOp(op) {
      if (op.t === 'von') { on = true; c._plan.ur = { t: MITTAG }; }
      if (op.t === 'voff') { on = false; c._plan.ur = null; }
    },
  });
  c._plan.hay = { t: 0 };
  return D;
};
const klick = (D, ur) => {
  const b = D.root.querySelectorAll('[data-ur]').find((x) => x.dataset.ur === ur);
  b.focus();
  D.root.querySelector('.page').melde('click', { target: b });
};

test('Tagebuch, Tastatur: nach „Ja, los“ und „Zurückholen“ bleibt der Fokus im Fenster, auch wenn der Urlaub die Seite selbst neu zeichnet', async () => {
  const D = await urlaubBuch();
  klick(D, 'ask');
  klick(D, 'go');
  assert.equal(D.c._urlaubOn(), true);
  assert.deepEqual(D.root.querySelectorAll('[data-ur]').map((b) => b.dataset.ur), ['back']);
  assert.equal(D.wo(), 'page');
  D.taste('Tab');
  assert.equal(D.wo(), 'back');
  klick(D, 'back');
  assert.equal(D.c._urlaubOn(), false);
  assert.equal(D.wo(), 'page');
  // Escape schließt weiter (der Fokus liegt im Fenster, dort horcht die Karte)
  const e = D.taste('Escape');
  assert.deepEqual([e.gestoppt, D.c._dia], [true, null]);
});

test('Tagebuch, Tastatur: wechselt der Urlaub auf einem anderen Gerät, behält das Fenster den Fokus', async () => {
  const D = await urlaubBuch();
  D.root.querySelector('[data-ur]').focus();
  assert.equal(D.wo(), 'ask');
  D.c._diaryRender(true); // wie _urlaubFromPlan beim fremden Wechsel
  assert.equal(D.wo(), 'page');
  // Hatte nichts auf der Seite den Fokus, bleibt es dabei (das Neuzeichnen holt ihn nicht dorthin)
  D.root.querySelector('.x').focus();
  D.c._diaryRender(true);
  assert.equal(D.wo(), 'x');
});

test('Tagebuch: nach Escape schließt die Selbstschließ-Uhr kein danach wieder geöffnetes Tagebuch', async () => {
  const uhr = [];
  const alt = [WELT.setTimeout, WELT.clearTimeout];
  WELT.setTimeout = (fn, ms) => { const h = { fn, ms, weg: false }; uhr.push(h); return h; };
  WELT.clearTimeout = (h) => { if (h && typeof h === 'object') h.weg = true; };
  try {
    const D = await tagebuch();
    D.taste('Escape'); // schließt; poke sieht denselben Tastendruck danach
    assert.equal(D.c._dia, null);
    const scharf = uhr.filter((h) => !h.weg && h.ms === 60000);
    assert.equal(scharf.length, 0, 'nach Escape läuft keine Uhr mehr');
    D.c._diaryOpen();
    await atmen();
    const neu = D.c._dia;
    uhr.filter((h) => h !== neu.t).forEach((h) => !h.weg && h.ms === 60000 && h.fn());
    assert.equal(D.c._dia, neu, 'das neue Tagebuch bleibt offen');
    D.c._diaryClose();
  } finally {
    [WELT.setTimeout, WELT.clearTimeout] = alt;
  }
});
