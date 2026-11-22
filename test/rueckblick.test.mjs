// Rückblick (0.45.0): die Seite im Tagebuch, die die Chronik zeigt. Der reine Teil (Monatsraster, Serien, Summen,
// Sätze), der Reiter nur mit chronicle_entity, kein Aufruf an HA ohne die Option, nur lesen (kein einziger
// Dienstaufruf), jede Zeile statt des Kalenders, Kalender und Tastatur, fünf Reiter, Kontraste. node --test
//
// Die Zeitzone muss stehen, bevor irgendein Datum entsteht (unter Windows wirkt die Variable der Shell nicht): darum
// zuerst TZ, und alles andere wird erst danach geladen.
process.env.TZ = 'Europe/Berlin';
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const fs = (await import('node:fs')).default;
const vm = (await import('node:vm')).default;

// Steht die Zone wirklich? (Januar eine Stunde, Ende März und im Sommer zwei Stunden vor UTC)
const BERLIN = [new Date(2026, 0, 15, 12), new Date(2026, 2, 29, 12), new Date(2026, 6, 15, 12), new Date(2026, 9, 25, 12)]
  .map((d) => d.getTimezoneOffset()).join() === '-60,-120,-120,-60';
const OHNE_ZONE = BERLIN ? false : 'die Zeitzone Europe/Berlin lässt sich in diesem Prozess nicht einstellen';

// ---------- das Bündel, mit einem kleinen DOM für das Fenster des Tagebuchs (wie in tagebuch-a11y.test.mjs) ----------
// Elemente entstehen aus dem HTML, das die Karte wirklich schreibt (innerHTML): Schlagwörter mit Attributen, in
// Reihenfolge des Dokuments. Dazu, was der Kalender braucht: tabIndex (aus tabindex, Knöpfe 0) und getAttribute.
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

  get tabIndex() {
    return 'tabindex' in this.attr ? Number(this.attr.tabindex) : ['button', 'summary'].includes(this.tag) ? 0 : -1;
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
    const W = this.wurzel;
    if (W.activeElement && !W.alle().includes(W.activeElement)) W.activeElement = null;
  }

  alle() {
    return this.kinder.flatMap((k) => [k, ...k.alle()]);
  }

  contains(e) {
    return e === this || this.alle().includes(e);
  }

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

  getAttribute(k) {
    return k in this.attr ? this.attr[k] : null;
  }

  addEventListener(typ, fn) {
    (this.horcher[typ] ||= []).push(fn);
  }

  // Ereignis an die Horcher dieses Elements (kein Aufsteigen: Die Tests rufen dort, wo die Karte horcht)
  melde(typ, e = {}) {
    for (const fn of this.horcher[typ] || []) fn(e);
    return e;
  }

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
const wecker = []; // was die Karte auf die Uhr legt (hier läuft keine): [ms]
const leise = []; // console.debug
const WELT = {
  window: { matchMedia: () => ({ matches: false }), customCards: [] },
  document: { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: (tag) => new El(tag), body: { appendChild: (e) => koerper.push(e) } },
  HTMLElement: class {},
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn() {}, debug: (...a) => leise.push(a) },
  setTimeout: (fn, ms) => wecker.push(ms), clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController, performance,
  __pikaTest: (x) => (T = x),
};
vm.runInNewContext(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'), WELT, { filename: 'pika-pet-card.js' });

const atmen = () => new Promise((r) => { setImmediate(r); });
// (was aus dem Bündel kommt, hat die Prototypen seiner eigenen Welt: zum Vergleichen flach machen)
const plain = (x) => JSON.parse(JSON.stringify(x));
const CH = 'todo.pikas_chronik';
// Sonntag, 22. 11. 2026, mittags: Der laufende Pika-Tag ist der 22.
const JETZT = new Date(2026, 10, 22, 12).getTime();
const HEUTE = T.chronikTag('2026-11-22');
// Ein Eintrag der Liste, geschrieben wie von der Karte (chronikKod)
let uid = 0;
const zeile = (d, { futter = 1, streicheln = 2, putzen = 0, paeckchen = 0, besuch = [], gut = false, urlaub = false } = {}) => ({
  uid: `u${++uid}`, status: 'needs_action',
  summary: T.chronikKod({ d, futter, streicheln, putzen, paeckchen, besuch, x: { ...(gut ? { gut: '1' } : {}), ...(urlaub ? { urlaub: '1' } : {}) } }),
});
// Tage für die reinen Funktionen: „g“ gut, „n“ aufgeschrieben und nicht gut, „u“ Urlaub, „b“ gut und Urlaub, „-“ kein
// Eintrag; der erste Buchstabe ist der Tag ab (Datum)
const folge = (ab, s) => T.rueckTage([...s].flatMap((z, i) => (z === '-' ? [] : [zeile(T.chronikDatum(T.chronikTag(ab) + i), { gut: z === 'g' || z === 'b', urlaub: z === 'u' || z === 'b' })])));

// Die Liste für die Seite: 15. Oktober bis 21. November 2026, mit Lücke, Urlaub, allen Freunden, 99 und Fremdem
const LISTE = () => [
  zeile('2026-10-15', { futter: 2, streicheln: 5, besuch: ['kirby'], gut: true }),
  zeile('2026-10-30', { futter: 1, streicheln: 1 }),
  zeile('2026-11-02', { futter: 2, streicheln: 9, besuch: ['rufus', 'falter'], gut: true }),
  zeile('2026-11-03', { futter: 1, streicheln: 4, urlaub: true }),
  zeile('2026-11-04', { futter: 0, streicheln: 0, urlaub: true }),
  zeile('2026-11-05', { futter: 2, streicheln: 6, urlaub: true, gut: true }),
  { uid: 'm1', status: 'needs_action', summary: 'Blumen gießen' },
  { uid: 'm2', status: 'completed', summary: 'Pika-Tag 2026-11-07: war schön' },
  zeile('2026-11-10', { futter: 3, streicheln: 12, putzen: 2, paeckchen: 1, besuch: ['pino', 'vogel'] }),
  zeile('2026-11-12', { futter: 2, streicheln: 99, besuch: ['katzumi'], gut: true }),
  zeile('2026-11-19', { futter: 2, streicheln: 8, putzen: 1, besuch: ['pino'], gut: true }),
  zeile('2026-11-20', { futter: 3, streicheln: 10, besuch: ['vogel'], gut: true }),
  zeile('2026-11-21', { futter: 1, streicheln: 7, putzen: 3, gut: true }),
];

// Ein Tagebuch an einer Karte ohne Szene (echtes _diaryOpen, _diaryRender, _chronikLesbar, _chronikHol und alles
// vom Rückblick). Z zählt jeden Aufruf an HA: Z.ws (callWS), Z.dienste (callService). Z.antwort(m) ersetzt die Antwort
// der Liste.
const karte = ({ cfg = {}, items = LISTE(), hass = {}, zustand = undefined, jetzt = JETZT, nacht = false, vorschau = false } = {}) => {
  const Z = { ws: [], dienste: [], items, antwort: null };
  const H = {
    connected: true,
    states: { [CH]: zustand === undefined ? { state: String(items.length), attributes: { friendly_name: 'Pikas Chronik', supported_features: 127 } } : zustand },
    callWS: (m) => {
      Z.ws.push(m);
      return Z.antwort ? Z.antwort(m) : Promise.resolve({ items: Z.items.map((x) => ({ ...x })) });
    },
    callService: (...a) => {
      Z.dienste.push(a);
      return Promise.resolve();
    },
    ...hass,
  };
  if (zustand === null) delete H.states[CH];
  const c = Object.create(T.PikaPetCard.prototype);
  const seite = { start: jetzt, entries: [{ t: jetzt, part: 'Mittags', icon: 'wake', text: 'Guten Morgen.' }], chips: [], fazit: 'Liebes Tagebuch, heute ist ein gemütlicher Tag.', early: false };
  Object.assign(c, {
    _cfg: { name: 'Pika', chronicle_entity: CH, ...cfg }, _hass: H, _planOk: true, _plan: { gift: { z: 1, o: 1 } },
    _el: { scene: { classList: { contains: (k) => nacht && k === 'night' } }, stats: { hidden: false, isConnected: false }, tbbtn: {} },
    _haNow: () => jetzt, _urlaubCardSeen() {}, _diaryDot() {}, _diarySig: () => 'x',
    // Heute und Gestern kommen fertig (ihr Verlauf ist hier nicht das Thema), Schätze und Entdeckungen sind leer
    _diaryBuild: async () => ({ fail: false, none: false, days: [seite, seite] }),
    _diaryTreasures: () => '<p class="fazit">Schätze</p>', _diaryFinds: () => '<p class="fazit">Entdeckungen</p>',
  });
  if (vorschau) c.preview = true;
  const D = {
    c, Z, H,
    get host() {
      return c._dia?.host;
    },
    get root() {
      return c._dia?.root;
    },
    get pg() {
      return c._dia?.root.querySelector('.page');
    },
    async auf(tab = 'rueck') {
      c._diaryOpen(tab);
      await atmen();
      return D;
    },
    zu() {
      c._diaryClose();
    },
    reiter: () => D.root.querySelectorAll('[data-tab]').map((b) => b.dataset.tab),
    // Text der Seite ohne Zeichnungen und Schlagwörter
    text: () => D.pg.html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(),
    // Tipp auf ein Element der Seite (dort horcht die Karte)
    tipp(el) {
      D.pg.melde('click', { target: el });
    },
    tag: (d) => D.pg.querySelectorAll('button.tg').find((b) => b.dataset.tag === d) || null,
    blatt: (dir) => D.pg.querySelectorAll('[data-rb]').find((b) => b.dataset.dir === String(dir)),
    monat: () => D.pg.html.match(/<div class="kn">[\s\S]*?<b>([^<]*)<\/b>/)?.[1],
    gewaehlt: () => D.pg.querySelectorAll('button.tg').filter((b) => b.className.split(' ').includes('sel')).map((b) => b.dataset.tag),
    taste(key, shiftKey = false) {
      const e = { key, shiftKey, verhindert: false, gestoppt: false };
      e.preventDefault = () => (e.verhindert = true);
      e.stopPropagation = () => (e.gestoppt = true);
      return D.host.melde('keydown', e);
    },
    wo() {
      const a = D.root.activeElement;
      if (!a) return null;
      return a.dataset.tag || a.dataset.tab || (a.dataset.dir ? `mon${a.dataset.dir}` : '') || a.className || a.tag;
    },
  };
  return D;
};

// ====================================================================================================================
// 1 Der reine Teil
// ====================================================================================================================

// Prüft ein Raster gegen den Kalender des Geräts: jeder Tag genau einmal, in der Spalte seines Wochentags
const pruefeRaster = (j, m) => {
  const K = T.rueckMonat(j, m);
  const z = plain(K.zellen);
  assert.equal(z.length % 7, 0, `${K.name}: volle Wochen`);
  const tage = z.filter(Boolean);
  const soll = new Date(j, m, 0).getDate();
  assert.equal(tage.length, soll, `${K.name}: ${soll} Tage`);
  assert.equal(K.tage, soll);
  assert.equal(new Set(tage).size, soll, `${K.name}: kein Tag doppelt`);
  tage.forEach((d, i) => {
    assert.equal(d, `${j}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
    // Spalte 0 = Montag; mittags in Ortszeit, da gibt es jeden Tag genau einmal
    assert.equal(z.indexOf(d) % 7, (new Date(j, m - 1, i + 1, 12).getDay() + 6) % 7, `${d} steht in der Spalte seines Wochentags`);
  });
  // leere Felder nur vor dem Ersten und nach dem Letzten, und nie eine ganze leere Woche
  assert.deepEqual(z.slice(0, K.vor), Array(K.vor).fill(null));
  assert.ok(K.vor < 7 && z.length - K.vor - soll < 7);
  assert.equal(z.slice(K.vor, K.vor + soll).every(Boolean), true);
  return K;
};

test('Monatsraster: November 2026 beginnt am Sonntag (sechs Wochenzeilen), Februar 2027 am Montag (genau vier)', { skip: OHNE_ZONE }, () => {
  const nov = pruefeRaster(2026, 11);
  assert.deepEqual([nov.name, nov.vor, nov.tage, nov.zellen.length], ['November 2026', 6, 30, 42]);
  assert.deepEqual(plain(nov.zellen.slice(0, 9)), [null, null, null, null, null, null, '2026-11-01', '2026-11-02', '2026-11-03']);
  assert.deepEqual(plain(nov.zellen.slice(-7)), ['2026-11-30', null, null, null, null, null, null]);
  const feb = pruefeRaster(2027, 2);
  assert.deepEqual([feb.name, feb.vor, feb.tage, feb.zellen.length], ['Februar 2027', 0, 28, 28]);
  assert.equal(feb.zellen[0], '2027-02-01');
  assert.equal(feb.zellen.at(-1), '2027-02-28');
  // Schaltjahr, und ein Monat, der am Montag beginnt und fünf Zeilen braucht
  assert.deepEqual([pruefeRaster(2028, 2).tage, pruefeRaster(2026, 6).vor, pruefeRaster(2026, 6).zellen.length], [29, 0, 35]);
  // Dezember und Januar: Jahreswechsel
  assert.equal(pruefeRaster(2026, 12).name, 'Dezember 2026');
  assert.equal(pruefeRaster(2027, 1).zellen.find(Boolean), '2027-01-01');
});

test('Monatsraster an der Zeitumstellung: März und Oktober haben jeden Tag genau einmal (gebaut aus Jahr, Monat, Tag, nie „plus 24 Stunden“)', { skip: OHNE_ZONE }, () => {
  // 29. 3. 2026 hat 23 Stunden, 25. 10. 2026 hat 25: Wer in Ortszeit 24 Stunden weiterzählt, bekommt den 25. 10. doppelt
  const naiv = [];
  for (let t = new Date(2026, 9, 1).getTime(), i = 0; i < 31; i++, t += 864e5) naiv.push(new Date(t).getDate());
  assert.notEqual(new Set(naiv).size, 31, 'die Falle gibt es in dieser Zeitzone wirklich');
  const mrz = pruefeRaster(2026, 3);
  assert.deepEqual([mrz.vor, mrz.tage, mrz.zellen.length], [6, 31, 42], 'der März 2026 beginnt am Sonntag');
  assert.deepEqual(plain(mrz.zellen.slice(28, 36)), ['2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30']);
  const okt = pruefeRaster(2026, 10);
  assert.deepEqual([okt.vor, okt.tage, okt.zellen.length], [3, 31, 35]);
  assert.deepEqual(plain(okt.zellen.slice(21, 28)), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  for (const [j, m] of [[2027, 3], [2027, 10], [2025, 3], [2025, 10]]) pruefeRaster(j, m);
  // Blättern und Vergleichen der Monate, über den Jahreswechsel
  assert.deepEqual(plain([T.rueckJmPlus([2026, 12], 1), T.rueckJmPlus([2027, 1], -1), T.rueckJmPlus([2026, 11], -1), T.rueckJmPlus([2026, 3], 22)]), [[2027, 1], [2026, 12], [2026, 10], [2028, 1]]);
  assert.ok(T.rueckJmVgl([2026, 12], [2027, 1]) < 0 && T.rueckJmVgl([2027, 1], [2026, 12]) > 0 && T.rueckJmVgl([2026, 11], [2026, 11]) === 0);
  assert.deepEqual(plain(T.rueckJm('2026-11-22')), [2026, 11]);
  // Wochentag und Datum im Satz hängen auch nicht an der Ortszeit
  assert.equal(T.rueckDatum('2026-03-29', { wt: true }), 'Sonntag, 29. März');
  assert.equal(T.rueckDatum('2026-10-25', { wt: true }), 'Sonntag, 25. Oktober');
  assert.equal(T.rueckDatum('2026-11-10', { wt: true }), 'Dienstag, 10. November');
  assert.equal(T.rueckDatum('2026-11-12', { jahr: true }), '12. November 2026');
  assert.equal(T.rueckDatum('2026-02-30'), '', 'ein Datum, das es nicht gibt');
});

test('Liste → Tage: gelesen wie von der Chronik (Fremdes fehlt, Dopplungen zusammengeführt, unbekannte Felder stören nicht)', () => {
  const tage = plain(T.rueckTage([
    { summary: 'Pika-Tag 2026-11-10 · futter=3 streicheln=12 putzen=2 paeckchen=1 besuch=pino,vogel', uid: 'a' },
    { summary: 'Blumen gießen', uid: 'b' },
    { summary: 'Pika-Tag 2026-11-07: war schön', uid: 'c' },
    // eine spätere Version: Felder, die diese nicht kennt, und ein Besuch, den sie nicht kennt
    { summary: 'Pika-Tag 2026-11-08 · futter=2 streicheln=4 besuch=igel,kirby gut=1 laune=prima wetter=7', uid: 'd' },
    // derselbe Tag zweimal (zwei Geräte): das Größere, der Besuch vereinigt
    { summary: 'Pika-Tag 2026-11-09 · futter=1 streicheln=3 putzen=0 paeckchen=0 besuch=-', uid: 'e' },
    { summary: 'Pika-Tag 2026-11-09 · futter=2 streicheln=2 putzen=0 paeckchen=0 besuch=falter urlaub=1', uid: 'f' },
    // nur Kopf und Datum; ein Feld doppelt (nicht sauber lesbar: wird übergangen)
    { summary: 'Pika-Tag 2026-11-06', uid: 'g' },
    { summary: 'Pika-Tag 2026-11-05 · futter=1 futter=2', uid: 'h' },
    { summary: 'Pika-Tag 2026-02-30 · futter=1', uid: 'i' },
    null, { uid: 'j' },
  ]));
  assert.deepEqual(tage.map((t) => t.d), ['2026-11-06', '2026-11-08', '2026-11-09', '2026-11-10']);
  assert.deepEqual(tage[3], { d: '2026-11-10', tag: T.chronikTag('2026-11-10'), futter: 3, streicheln: 12, putzen: 2, paeckchen: 1, besuch: ['pino', 'vogel'], gut: false, urlaub: false });
  assert.deepEqual(tage[0], { d: '2026-11-06', tag: T.chronikTag('2026-11-06'), futter: 0, streicheln: 0, putzen: 0, paeckchen: 0, besuch: [], gut: false, urlaub: false });
  assert.deepEqual([tage[1].gut, tage[1].urlaub, tage[1].besuch], [true, false, ['kirby', 'igel']]);
  assert.deepEqual([tage[2].futter, tage[2].streicheln, tage[2].urlaub, tage[2].besuch], [2, 3, true, ['falter']]);
  assert.deepEqual(plain(T.rueckTage([])), []);
  assert.deepEqual(plain(T.rueckTage(null)), []);
});

test('Serien guter Tage: ein nicht guter Tag und ein Tag ohne Eintrag beenden sie, ein Urlaubstag weder noch', () => {
  const S = (s, heute = null) => plain(T.rueckSerien(folge('2026-11-01', s), heute));
  assert.deepEqual(S(''), { laengste: 0, aktuell: 0 });
  assert.deepEqual(S('nnn'), { laengste: 0, aktuell: 0 });
  assert.deepEqual(S('ggg'), { laengste: 3, aktuell: 3 });
  assert.deepEqual(S('ggngggg'), { laengste: 4, aktuell: 4 });
  assert.deepEqual(S('ggggngg'), { laengste: 4, aktuell: 2 });
  // Lücke: ein Tag ganz ohne Eintrag
  assert.deepEqual(S('ggg-gg'), { laengste: 3, aktuell: 2 });
  assert.deepEqual(S('g-g-g'), { laengste: 1, aktuell: 1 });
  // Urlaub: Die Serie ruht, vier Tage lang, und geht danach weiter; die Urlaubstage selbst zählen nicht mit
  assert.deepEqual(S('gguuuugg'), { laengste: 4, aktuell: 4 });
  assert.deepEqual(S('uuu'), { laengste: 0, aktuell: 0 });
  assert.deepEqual(S('gguu'), { laengste: 2, aktuell: 2 }, 'er ist noch verreist: Die Serie steht');
  // … aber eine Lücke im Urlaub oder ein nicht guter Tag danach beendet sie
  assert.deepEqual(S('ggu-ug'), { laengste: 2, aktuell: 1 });
  assert.deepEqual(S('gguung'), { laengste: 2, aktuell: 1 });
  // ein guter Tag, an dem er abends abgereist ist (gut=1 und urlaub=1), zählt als guter Tag
  assert.deepEqual(S('gbuubg'), { laengste: 4, aktuell: 4 });
  // aktuell: Heute läuft noch und steht nie in der Liste. Gestern darf am Morgen noch fehlen (wird erst nachgetragen);
  // fehlen zwei Tage, ist die Serie vorbei. Die längste bleibt.
  const t0 = T.chronikTag('2026-11-01');
  assert.deepEqual(S('nggg', t0 + 4), { laengste: 3, aktuell: 3 }, 'gestern steht da');
  assert.deepEqual(S('nggg', t0 + 5), { laengste: 3, aktuell: 3 }, 'gestern fehlt noch');
  assert.deepEqual(S('nggg', t0 + 6), { laengste: 3, aktuell: 0 }, 'gestern und vorgestern fehlen');
  assert.deepEqual(S('nggg', t0 + 40), { laengste: 3, aktuell: 0 });
  assert.deepEqual(S('gggn', t0 + 4), { laengste: 3, aktuell: 0 });
});

test('Summen: Zähler, „99 oder öfter“ als Untergrenze, Besuch nach Häufigkeit, erster und letzter Tag', () => {
  const tage = T.rueckTage(LISTE());
  const S = plain(T.rueckSummen(tage, HEUTE));
  assert.deepEqual(S, {
    n: 11, gut: 7, urlaub: 3, futter: 19, streicheln: 161, mehr: true, putzen: 6, paeckchen: 1,
    besuch: [['pino', 2], ['vogel', 2], ['kirby', 1], ['rufus', 1], ['katzumi', 1], ['falter', 1]],
    laengste: 3, aktuell: 3, erster: '2026-10-15', letzter: '2026-11-21',
  });
  // ohne einen Tag am Anschlag ist die Summe genau
  assert.equal(T.rueckSummen(tage.filter((t) => t.streicheln < 99), HEUTE).mehr, false);
  // Besuch: die häufigsten zuerst, bei Gleichstand in der Reihenfolge der Chronik; Unbekanntes (auch „constructor“,
  // das als Kürzel durch den Leser kommt) zählt nicht
  const B = (...b) => plain(T.rueckSummen(T.rueckTage(b.map((x, i) => zeile(T.chronikDatum(HEUTE - 20 + i), { besuch: x }))), HEUTE).besuch);
  assert.deepEqual(B(['falter'], ['falter', 'vogel'], ['falter', 'katzumi'], ['vogel', 'pino']), [['falter', 3], ['vogel', 2], ['pino', 1], ['katzumi', 1]]);
  assert.deepEqual(B(['constructor', 'igel', 'tostring'], ['rufus']), [['rufus', 1]]);
  assert.deepEqual(B([], []), []);
  assert.deepEqual(plain(T.rueckSummen([], HEUTE)), { n: 0, gut: 0, urlaub: 0, futter: 0, streicheln: 0, mehr: false, putzen: 0, paeckchen: 0, besuch: [], laengste: 0, aktuell: 0, erster: null, letzter: null });
});

test('Der Tag aus seiner Sicht: Zähler, Besuch mit Namen, 99 oder öfter, Urlaub, guter Tag, stiller Tag', () => {
  const satz = (d, o, fr) => {
    const z = T.rueckSatz(T.rueckTage([zeile(d, o)])[0], fr);
    return `${z.kopf}: ${z.text}`;
  };
  assert.equal(satz('2026-11-10', { futter: 3, streicheln: 12, putzen: 2, paeckchen: 1, besuch: ['pino', 'vogel'] }),
    'Dienstag, 10. November: 3-mal gefüttert, 12-mal gestreichelt, 2 Häufchen weggemacht, 1 Päckchen ausgepackt. Pino und ein Vögelchen waren da.');
  assert.equal(satz('2026-11-13', { futter: 4, streicheln: 99, putzen: 3, besuch: ['vogel'], gut: true }),
    'Freitag, 13. November: 4-mal gefüttert, 99-mal oder öfter gestreichelt, 3 Häufchen weggemacht. Ein Vögelchen war da. Das war ein guter Tag!');
  assert.equal(satz('2026-11-14', { futter: 1, streicheln: 98 }), 'Samstag, 14. November: 1-mal gefüttert, 98-mal gestreichelt.');
  // der Freund heißt, wie er in der Karte heißt; die drei anderen heißen fest
  assert.equal(satz('2026-11-15', { futter: 2, streicheln: 0, besuch: ['pino', 'kirby', 'rufus', 'katzumi', 'falter'] }, 'Momo'),
    'Sonntag, 15. November: 2-mal gefüttert. Momo, Kirby, Rufus, Katzumi und ein Schmetterling waren da.');
  assert.equal(satz('2026-11-16', { futter: 0, streicheln: 5, besuch: ['falter'] }), 'Montag, 16. November: 5-mal gestreichelt. Ein Schmetterling war da.');
  // Urlaub: ganz weg, oder nur einen Teil des Tages (Abreise, Rückkehr)
  assert.equal(satz('2026-11-04', { futter: 0, streicheln: 0, urlaub: true }), 'Mittwoch, 4. November: Da war ich bei Pino.');
  assert.equal(satz('2026-11-04', { futter: 0, streicheln: 0, urlaub: true }, 'Momo'), 'Mittwoch, 4. November: Da war ich bei Momo.');
  assert.equal(satz('2026-11-03', { futter: 3, streicheln: 25, putzen: 3, urlaub: true, gut: true }),
    'Dienstag, 3. November: 3-mal gefüttert, 25-mal gestreichelt, 3 Häufchen weggemacht. Einen Teil des Tages war ich bei Pino. Das war ein guter Tag!');
  // nichts gezählt, niemand da
  assert.equal(satz('2026-11-17', { futter: 0, streicheln: 0 }), 'Dienstag, 17. November: Da war es ganz ruhig bei mir.');
  assert.equal(satz('2026-11-18', { futter: 0, streicheln: 0, paeckchen: 2, putzen: 1 }), 'Mittwoch, 18. November: 1 Häufchen weggemacht, 2 Päckchen ausgepackt.');
  // unbekannter Besuch (spätere Version) wird überlesen, auch für die Bilder
  const z = T.rueckSatz(T.rueckTage([{ summary: 'Pika-Tag 2026-11-08 · futter=2 besuch=igel,kirby,constructor' }])[0]);
  assert.equal(z.text, '2-mal gefüttert. Kirby war da.');
  assert.deepEqual(plain(z.gaeste), ['kirby']);
  assert.equal(T.rueckGast('constructor'), null);
  assert.deepEqual(plain([T.rueckGast('pino', 'Momo'), T.rueckGast('vogel'), T.rueckGast('rufus')]), [['Momo', 'Momo'], ['ein Vögelchen', 'Vögelchen'], ['Rufus', 'Rufus']]);
});

test('Der Satz oben: nennt den ersten Tag und die guten Tage, auf allen Geräten derselbe, mehrere Fassungen', () => {
  const S = (n, gut, erster = '2026-11-12') => ({ n, gut, erster });
  const f = (...a) => T.rueckFazit(...a);
  // fest: dieselbe Eingabe, derselbe Satz
  assert.equal(f(S(10, 9), HEUTE), f(S(10, 9), HEUTE));
  const alle = new Set();
  for (let n = 2; n <= 60; n++) {
    const s = f(S(n, n - 1), HEUTE);
    assert.match(s, /12\. November/, s);
    assert.match(s, new RegExp(`(^|\\s)${n - 1 === 1 ? '(Ein|Einen) gute[rn] Tag' : `${n - 1} gute Tage`} `), s);
    assert.doesNotMatch(s, /\{|undefined|2026/, s);
    alle.add(s.replace(/\d+/g, '#'));
  }
  assert.ok(alle.size >= 5, `nur ${alle.size} Fassungen`);
  assert.ok([...alle].some((s) => s.startsWith('Seit dem #. November schreibe ich jeden Tag auf. # gute Tage waren schon dabei!')), [...alle].join(' | '));
  // Sonderfälle: noch kein guter Tag, genau einer, jeder, ein einziger Tag, ein anderes Jahr, leer
  for (let n = 1; n <= 30; n++) {
    assert.match(f(S(n, 0), HEUTE), /(kommen bestimmt noch|fehlt mir noch)/);
    assert.match(f(S(n + 1, 1), HEUTE), /(Ein guter Tag war schon dabei|Einen guten Tag hab ich schon gezählt)/);
    assert.match(f(S(n + 1, n + 1), HEUTE), /Und jeder war ein guter Tag!$/);
    assert.doesNotMatch(f(S(1, 1), HEUTE - n), /1 Tage|1 gute Tage|jeder/);
    assert.match(f(S(n, 0, '2025-12-30'), HEUTE), /30\. Dezember 2025/);
  }
  assert.ok([...Array(40).keys()].some((i) => /ein Tag steht schon drin/.test(f(S(1, 0, T.chronikDatum(HEUTE - 1 - i)), HEUTE))));
  assert.equal(f(S(0, 0, null), HEUTE), 'Ich fange gerade erst an aufzuschreiben. Morgen steht hier der erste Tag.');
});

// ====================================================================================================================
// 2 Der Reiter
// ====================================================================================================================

test('Reiter „Rückblick“: nur mit chronicle_entity und Tagebuch; ohne die Option vier Reiter, kein Aufruf an HA, nichts gemerkt', async () => {
  const ohne = karte({ cfg: { chronicle_entity: null } });
  assert.equal(ohne.c._rueckOn(), false);
  await ohne.auf('heute');
  assert.deepEqual(ohne.reiter(), ['heute', 'gestern', 'schatz', 'entd']);
  assert.doesNotMatch(ohne.root.html.replace(/<style>[\s\S]*?<\/style>/, ''), /Rückblick|class="tabs t5"|data-rb/);
  assert.match(ohne.root.html, /<div class="tabs" role="tablist">/);
  // auch wer den Reiter ausdrücklich verlangt (Vorschau, ein alter Aufruf), landet auf Heute
  for (const tab of ['rueck', 'gestern', 'schatz', 'entd', 'rueck']) {
    ohne.c._diaryOpen(tab);
    await atmen();
    assert.equal(ohne.c._dia.tab, tab === 'rueck' ? 'heute' : tab);
  }
  ohne.zu();
  await ohne.auf('rueck');
  assert.equal(ohne.c._dia.tab, 'heute');
  assert.match(ohne.text(), /^Liebes Tagebuch/);
  ohne.zu();
  assert.deepEqual([ohne.Z.ws.length, ohne.Z.dienste.length], [0, 0], 'kein Aufruf an HA');
  assert.equal(ohne.c._rueckStand, undefined);
  assert.equal(ohne.c._rueckLauf, undefined);
  assert.equal(ohne.c._errs, undefined);

  // mit der Option: fünf Reiter, die drei Seiten über die Zeit zuerst
  const mit = await karte().auf('heute');
  assert.equal(mit.c._rueckOn(), true);
  assert.deepEqual(mit.reiter(), ['heute', 'gestern', 'rueck', 'schatz', 'entd']);
  assert.deepEqual(mit.root.querySelectorAll('[data-tab]').map((b) => [b.attr.role, b.tag]), Array(5).fill(['tab', 'button']));
  assert.match(mit.root.html, /<div class="tabs t5" role="tablist">/);
  assert.match(mit.root.html, />Heute<\/button><button role="tab" data-tab="gestern">Gestern<\/button><button role="tab" data-tab="rueck">Rückblick<\/button><button role="tab" data-tab="schatz">Schätze<\/button><button role="tab" data-tab="entd">Entdeckungen</);
  // solange niemand den Reiter aufschlägt, wird die Liste nicht gelesen
  for (const tab of ['gestern', 'schatz', 'entd', 'heute']) mit.c._diaryTab(tab);
  await atmen();
  assert.equal(mit.Z.ws.length, 0);
  mit.root.querySelectorAll('[data-tab]')[2].melde('click');
  await atmen();
  assert.deepEqual(plain(mit.Z.ws), [{ type: 'todo/item/list', entity_id: CH }]);
  assert.equal(mit.root.querySelector('.dt').textContent, 'Was bisher geschah');
  assert.deepEqual(mit.root.querySelectorAll('[data-tab]').map((b) => b.attr['aria-selected']), ['false', 'false', 'true', 'false', 'false']);
  mit.zu();

  // diary: false: nur die Schätze, kein Rückblick, kein Lesen
  const aus = karte({ cfg: { diary: false } });
  assert.equal(aus.c._rueckOn(), false);
  await aus.auf('rueck');
  assert.equal(aus.c._dia.tab, 'schatz');
  assert.deepEqual(aus.reiter(), []);
  assert.equal(aus.Z.ws.length, 0);
  aus.zu();
});

test('Rückblick liest nur: ein Lesen der Liste beim Aufschlagen, kein einziger Dienstaufruf, was man auch antippt', async () => {
  const D = await karte().auf();
  assert.deepEqual(plain(D.Z.ws), [{ type: 'todo/item/list', entity_id: CH }], 'derselbe Aufruf wie die Chronik');
  assert.equal(D.c._rueckStand.st, 'ok');
  // alles antippen: jeden Tag, beide Richtungen, hin und her zwischen den Reitern, Pfeiltasten
  for (let i = 0; i < 4; i++) {
    for (const b of D.pg.querySelectorAll('button.tg')) D.tipp(D.tag(b.dataset.tag));
    const z = D.blatt(i % 2 ? 1 : -1);
    if (z) D.tipp(z);
  }
  D.pg.querySelector('button.tg').focus();
  for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', 'Tab', 'Tab']) D.taste(k);
  for (const tab of ['heute', 'rueck', 'schatz', 'rueck', 'entd', 'rueck']) {
    D.c._diaryTab(tab);
    await atmen();
  }
  D.zu();
  await D.auf();
  D.zu();
  assert.equal(D.Z.dienste.length, 0, 'kein Dienstaufruf');
  assert.equal(D.Z.ws.length, 1, 'und in fünf Minuten nur ein Lesen');
  assert.equal(D.Z.ws.every((m) => m.type === 'todo/item/list'), true);
  // die Liste selbst blieb, wie sie war
  assert.deepEqual(D.Z.items.map((x) => x.summary), LISTE().map((x) => x.summary));
  // der Stand der Chronik (zum Schreiben) ist nicht angefasst, und es läuft kein Lauf
  assert.deepEqual([D.c._chronikStand, D.c._chronikBusy, D.c._chronikNext, D.c._chronikFails], [undefined, undefined, undefined, undefined]);
  assert.equal(D.c._errs, undefined);
});

test('Rückblick merkt sich die Liste fünf Minuten und liest beim späteren Aufschlagen neu; der alte Stand bleibt so lange stehen', async () => {
  const D = await karte().auf();
  assert.equal(D.Z.ws.length, 1);
  assert.match(D.text(), /11 Tage aufgeschrieben/);
  // gleich wieder: nichts gelesen (auch nach Schließen und Öffnen: Der Stand liegt an der Karte)
  D.c._diaryTab('heute');
  D.c._diaryTab('rueck');
  D.zu();
  await D.auf();
  assert.equal(D.Z.ws.length, 1);
  // nach fünf Minuten: Inzwischen steht ein Tag mehr in der Liste
  assert.equal(T.RUECK.frisch, 5 * 60000);
  D.c._rueckStand.at -= T.RUECK.frisch + 1;
  D.Z.items.push(zeile('2026-11-18', { futter: 1, streicheln: 1 }));
  let los = null;
  D.Z.antwort = () => new Promise((ja) => { los = () => ja({ items: D.Z.items }); });
  D.c._diaryTab('heute');
  D.c._diaryTab('rueck');
  assert.equal(D.Z.ws.length, 2);
  assert.match(D.text(), /11 Tage aufgeschrieben/, 'solange gelesen wird, steht der alte Stand da');
  // ein zweites Aufschlagen, während gelesen wird, fragt nicht noch einmal
  D.c._diaryTab('schatz');
  D.c._diaryTab('rueck');
  assert.equal(D.Z.ws.length, 2);
  los();
  await atmen();
  assert.match(D.text(), /12 Tage aufgeschrieben/);
  assert.ok(D.tag('2026-11-18'));
  // eine andere Liste: Der gemerkte Stand gilt nicht für sie
  D.c._cfg = { ...D.c._cfg, chronicle_entity: 'todo.andere' };
  D.H.states['todo.andere'] = { state: '0', attributes: {} };
  D.Z.antwort = null;
  D.Z.items = [];
  D.c._diaryTab('rueck');
  assert.match(D.text(), /^Ich blättere zurück …$/);
  await atmen();
  assert.equal(D.Z.ws.at(-1).entity_id, 'todo.andere');
  assert.match(D.text(), /^Ich fange gerade erst an aufzuschreiben\./);
  D.zu();
  assert.equal(D.Z.dienste.length, 0);
});

test('Rückblick liest auch dort, wo die Chronik nicht schreibt: Vorschau im Editor, Liste ohne Schreibrecht, ohne die Helfer', async () => {
  for (const [name, o] of [
    ['Vorschau-Karte im Editor', { vorschau: true }],
    ['Liste nimmt nichts an (supported_features 0)', { zustand: { state: '3', attributes: { supported_features: 0 } } }],
    ['ohne entity und plan_entity', {}],
  ]) {
    const D = karte(o);
    assert.equal(D.c._chronikLesbar(), null, name);
    await D.auf();
    assert.equal(D.Z.ws.length, 1, name);
    assert.match(D.text(), /11 Tage aufgeschrieben/, name);
    D.zu();
    assert.equal(D.Z.dienste.length, 0, name);
  }
  // die Chronik selbst (die schreibt) bleibt an der Vorschau-Karte aus
  const V = karte({ vorschau: true, cfg: { entity: 'input_text.s', plan_entity: 'input_text.p' } });
  V.c._diaryHa = () => ({ haS: true, haP: true });
  assert.equal(V.c._chronikOn(), false);
  assert.equal(await V.c._chronikNow(), null);
  assert.equal(await V.c._chronikLesen(), null);
  assert.deepEqual([V.Z.ws.length, V.Z.dienste.length], [0, 0]);
});

// ====================================================================================================================
// 3 Statt des Kalenders: je Lage eine Zeile
// ====================================================================================================================

test('Rückblick, Zeilen statt des Kalenders: lädt noch, Liste fehlt oder nicht erreichbar, nicht verbunden, leer, HA lehnt ab', async () => {
  const nurZeile = (D, re, name) => {
    assert.match(D.text(), re, name);
    assert.equal(D.pg.querySelectorAll('button').length, 0, `${name}: kein Kalender`);
    assert.equal(D.pg.kinder.length, 1, `${name}: eine Zeile`);
    assert.equal(D.pg.kinder[0].tag, 'p');
  };
  const l0 = leise.length;

  // lädt noch: Die Antwort steht aus
  const L = karte();
  let los = null;
  L.Z.antwort = () => new Promise((ja) => { los = ja; });
  await L.auf();
  nurZeile(L, /^Ich blättere zurück …$/, 'lädt');
  assert.equal(L.pg.kinder[0].className, 'wait');
  los({ items: L.Z.items });
  await atmen();
  assert.match(L.text(), /^Seit dem|^Mein Rückblick|^Am 15\. Oktober/);
  L.zu();

  // Liste fehlt / nicht erreichbar / noch unbekannt: gar kein Aufruf, kein Fehler
  for (const [name, zustand] of [['fehlt', null], ['unavailable', { state: 'unavailable', attributes: {} }], ['unknown', { state: 'unknown', attributes: {} }]]) {
    const D = await karte({ zustand }).auf();
    nurZeile(D, /^Ich finde meine Chronik gerade nicht\. Die Liste gibt es in Home Assistant nicht, oder sie ist nicht erreichbar\.$/, name);
    assert.equal(D.pg.kinder[0].className, 'none');
    assert.equal(D.c._chronikLesbar(), 'fehlt');
    assert.deepEqual([D.Z.ws.length, D.c._errs], [0, undefined], name);
    // beim nächsten Aufschlagen wird es wieder versucht: Jetzt ist sie da
    D.H.states[CH] = { state: '11', attributes: {} };
    D.c._diaryTab('heute');
    D.c._diaryTab('rueck');
    await atmen();
    assert.equal(D.Z.ws.length, 1, name);
    assert.match(D.text(), /11 Tage aufgeschrieben/, name);
    D.zu();
  }

  // nicht verbunden: kein Aufruf
  const G = await karte({ hass: { connected: false } }).auf();
  nurZeile(G, /^Ich komme gerade nicht an meine Chronik: Home Assistant ist nicht verbunden\.$/, 'getrennt');
  assert.equal(G.c._chronikLesbar(), 'getrennt');
  assert.deepEqual([G.Z.ws.length, G.c._errs], [0, undefined]);
  G.H.connected = true;
  G.zu();
  await G.auf();
  assert.match(G.text(), /11 Tage aufgeschrieben/);
  G.zu();

  // leere Liste, und eine, in der nur Fremdes steht
  for (const items of [[], [{ uid: 'a', summary: 'Blumen gießen' }, { uid: 'b', summary: 'Pika-Tag 2026-11-20: war schön' }]]) {
    const D = await karte({ items }).auf();
    nurZeile(D, /^Ich fange gerade erst an aufzuschreiben\. Morgen steht hier der erste Tag\.$/, 'leer');
    assert.deepEqual([D.Z.ws.length, D.c._errs], [1, undefined]);
    D.zu();
  }

  // HA lehnt ab (ein schlichtes Objekt, eine Zahl), oder die Antwort enthält keine Liste: eine Zeile, kein Fehler der
  // Karte, höchstens leise in der Konsole. Beim nächsten Aufschlagen wird neu gelesen (nichts davon wird gemerkt).
  for (const [name, antwort, laut] of [
    ['abgelehnt', () => Promise.reject({ code: 'not_found', message: 'Entity not found' }), 1],
    ['Verbindung reißt', () => Promise.reject(3), 1],
    ['Antwort ohne Liste', () => Promise.resolve({}), 0],
    ['Antwort leer', () => Promise.resolve(null), 0],
  ]) {
    const D = karte();
    const l1 = leise.length;
    D.Z.antwort = antwort;
    await D.auf();
    nurZeile(D, /^Meine Chronik klemmt gerade\. Schlag den Rückblick gleich noch einmal auf\.$/, name);
    assert.equal(D.c._errs, undefined, `${name}: kein Fehler der Karte`);
    assert.equal(leise.length - l1, laut, name);
    assert.equal(D.c._rueckStand.st, 'fehler');
    D.c._diaryTab('gestern');
    D.c._diaryTab('rueck');
    await atmen();
    assert.equal(D.Z.ws.length, 2, `${name}: beim nächsten Aufschlagen noch einmal`);
    D.Z.antwort = null;
    D.zu();
    await D.auf();
    assert.equal(D.Z.ws.length, 3);
    assert.match(D.text(), /11 Tage aufgeschrieben/, name);
    D.zu();
    assert.equal(D.Z.dienste.length, 0);
  }
  assert.ok(leise.length > l0);

  // Ein Error stammt aus dem eigenen Code: Der steht im Fehlerspeicher (und damit im Fuß des Tagebuchs)
  const E = karte();
  E.Z.antwort = () => Promise.reject(vm.runInContext('new Error("kaputt")', WELT));
  await E.auf();
  nurZeile(E, /^Meine Chronik klemmt gerade\./, 'Error');
  assert.deepEqual(plain(E.c._errs).map((e) => [e.where, e.msg]), [['Rückblick', 'kaputt']]);
  assert.match(E.root.querySelector('.ft').html, /1 Fehler seit dem Laden/);
  E.zu();

  // Ein Lesen, auf das HA nie antwortet, hält den Reiter nicht für immer fest: nach RUECK.haengt wird neu gefragt
  const H = karte();
  H.Z.antwort = () => new Promise(() => {});
  await H.auf();
  H.c._diaryTab('heute');
  H.c._diaryTab('rueck');
  assert.equal(H.Z.ws.length, 1);
  H.c._rueckLauf.at -= T.RUECK.haengt + 1;
  H.Z.antwort = null;
  H.c._diaryTab('heute');
  H.c._diaryTab('rueck');
  await atmen();
  assert.equal(H.Z.ws.length, 2);
  assert.match(H.text(), /11 Tage aufgeschrieben/);
  H.zu();
});

// ====================================================================================================================
// 4 Die Seite: Kalender, Tag, Summen
// ====================================================================================================================

test('Rückblick, Kalender: laufender Monat, Montag zuerst, Zeichen je Tag, heute umrandet, der jüngste Tag gewählt', async () => {
  const D = await karte().auf();
  assert.equal(D.monat(), 'November 2026');
  assert.match(D.pg.html, /<div class="kw" aria-hidden="true"><span>M<\/span><span>D<\/span><span>M<\/span><span>D<\/span><span>F<\/span><span>S<\/span><span>S<\/span><\/div>/);
  const kt = D.pg.querySelector('.kt');
  assert.equal(kt.kinder.length, 42, 'sechs Wochen');
  // sechs leere Felder, dann der 1. (ein Sonntag)
  assert.deepEqual(kt.kinder.slice(0, 7).map((z) => [z.tag, z.className, z.html]).slice(0, 6), Array(6).fill(['span', '', '']));
  // Tage mit Eintrag sind Knöpfe, alle anderen nicht
  const knoepfe = D.pg.querySelectorAll('button.tg');
  assert.deepEqual(knoepfe.map((b) => b.dataset.tag), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-10', '2026-11-12', '2026-11-19', '2026-11-20', '2026-11-21']);
  assert.equal(kt.kinder.filter((z) => z.tag === 'span' && z.className.startsWith('tg')).length, 21);
  // der von Hand umgeschriebene 7. bleibt leer
  assert.equal(D.tag('2026-11-07'), null);
  // Zeichen: Pfote im Umriss (aufgeschrieben), gefüllte Pfote (gut), Koffer (Urlaub); gut geht vor Urlaub
  const zeichen = (d) => {
    const h = D.pg.html.match(new RegExp(`data-tag="${d}"[^>]*>\\d+<i>(<svg[\\s\\S]*?</svg>)</i>`))[1];
    return /<rect/.test(h) ? 'koffer' : /fill="none"/.test(h) ? 'umriss' : 'pfote';
  };
  assert.deepEqual(['2026-11-10', '2026-11-12', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-21'].map(zeichen), ['umriss', 'pfote', 'koffer', 'koffer', 'pfote', 'pfote']);
  const kl = (d) => D.tag(d).className;
  assert.deepEqual([kl('2026-11-10'), kl('2026-11-12'), kl('2026-11-04'), kl('2026-11-21')], ['tg', 'tg gut', 'tg', 'tg gut sel']);
  // heute (22.) läuft noch: kein Knopf, aber umrandet und für Vorleser als heute ausgewiesen
  const heute = kt.kinder.filter((z) => z.className.split(' ').includes('heute'));
  assert.deepEqual(heute.map((z) => [z.tag, z.attr['aria-current'], z.attr.title]), [['span', 'date', 'heute']]);
  assert.match(D.pg.html, /<span class="tg heute" aria-current="date" title="heute">22<\/span>/);
  // gewählt ist der jüngste aufgeschriebene Tag, sein Satz steht unter dem Kalender
  assert.deepEqual(D.gewaehlt(), ['2026-11-21']);
  assert.equal(D.tag('2026-11-21').attr['aria-pressed'], 'true');
  assert.equal(D.tag('2026-11-20').attr['aria-pressed'], 'false');
  assert.match(D.text(), /Samstag, 21\. November guter Tag 1-mal gefüttert, 7-mal gestreichelt, 3 Häufchen weggemacht\. Das war ein guter Tag!/);
  // jeder Knopf sagt seinen Tag ganz (für Vorleser), und die Legende nennt den Freund
  assert.equal(D.tag('2026-11-10').attr['aria-label'], 'Dienstag, 10. November: 3-mal gefüttert, 12-mal gestreichelt, 2 Häufchen weggemacht, 1 Päckchen ausgepackt. Pino und ein Vögelchen waren da.');
  assert.match(D.text(), /aufgeschrieben guter Tag bei Pino/);
  // der Satz oben und die Summen
  assert.match(D.pg.html, /^<p class="fazit">[^<]*15\. Oktober[^<]*<\/p>/);
  const t = D.text();
  for (const s of ['Alles zusammen', '11 Tage aufgeschrieben', '7 gute Tage', 'Gute Tage am Stück: längstens 3, gerade 3', '3 Tage bei Pino', '19× gefüttert', 'mindestens 161× gestreichelt',
    '6 Häufchen weggemacht', '1 Päckchen ausgepackt', 'Wer zu Besuch war', 'Pino 2× Vögelchen 2× Kirby 1× Rufus 1× Katzumi 1× Schmetterling 1×',
    'Heute steht noch nicht drin: Einen Tag schreibe ich erst auf, wenn er vorbei ist.']) assert.ok(t.includes(s), `„${s}“ fehlt in: ${t}`);
  // Bilder der Freunde beim Besuch (die drei mit eigener Figur), nirgends ein Schlagwort im Text
  assert.equal((D.pg.html.match(/class="pk fri"/g) || []).length, 3);
  assert.doesNotMatch(t, /undefined|NaN|\[object/);
  D.zu();

  // ein anderer Freundesname, und ohne Urlaub keine Koffer-Legende
  const M = await karte({ cfg: { friend_name: 'Momo' }, items: [zeile('2026-11-20', { besuch: ['pino'] }), zeile('2026-11-21', { urlaub: true, futter: 0, streicheln: 0 })] }).auf();
  assert.match(M.text(), /bei Momo .*Da war ich bei Momo\. .*1 Tag bei Momo .*Momo 1×/);
  assert.match(M.pg.html, /Bin bei Momo/);
  M.zu();
  const O = await karte({ items: [zeile('2026-11-21', { gut: true })] }).auf();
  assert.doesNotMatch(O.text(), /bei Pino/);
  assert.match(O.text(), /1 Tag aufgeschrieben 1 guter Tag Gute Tage am Stück: längstens 1, gerade 1/);
  O.zu();
});

test('Rückblick: Tag antippen zeigt seinen Satz, Blättern vom ersten aufgeschriebenen Monat bis zum laufenden', async () => {
  const D = await karte().auf();
  // Tag antippen
  D.tipp(D.tag('2026-11-10'));
  assert.deepEqual(D.gewaehlt(), ['2026-11-10']);
  assert.match(D.text(), /Dienstag, 10\. November 3-mal gefüttert, 12-mal gestreichelt, 2 Häufchen weggemacht, 1 Päckchen ausgepackt\. Pino und ein Vögelchen waren da\./);
  assert.equal(D.pg.querySelector('.rt').querySelectorAll('.ic').length, 2, 'Bilder von Pino und dem Vögelchen');
  // 99 oder öfter, mit Katzumis Bild
  D.tipp(D.tag('2026-11-12'));
  assert.match(D.text(), /Donnerstag, 12\. November guter Tag 2-mal gefüttert, 99-mal oder öfter gestreichelt\. Katzumi war da\. Das war ein guter Tag!/);
  assert.equal(D.pg.querySelector('.rt').querySelectorAll('.fri').length, 1);
  // Urlaubstag: das Schild an der Tür
  D.tipp(D.tag('2026-11-04'));
  assert.match(D.text(), /Mittwoch, 4\. November Da war ich bei Pino\. Alles zusammen/);
  assert.equal(D.pg.querySelector('.rt').querySelectorAll('.sg').length, 1);
  assert.match(D.pg.html, /<i class="sg"><svg[^>]*>[\s\S]*?>Bin bei Pino<\/text>/);
  // ein Tipp auf das Zeichen im Knopf trifft den Knopf
  D.tipp(D.tag('2026-11-19').kinder[0]);
  assert.deepEqual(D.gewaehlt(), ['2026-11-19']);
  // Blättern: im laufenden Monat geht es nur zurück
  assert.deepEqual([D.blatt(-1).disabled, D.blatt(1).disabled], [false, true]);
  assert.deepEqual([D.blatt(-1).attr['aria-label'], D.blatt(1).attr['aria-label']], ['Monat davor: Oktober 2026', 'Monat danach: Dezember 2026']);
  D.tipp(D.blatt(1)); // gesperrt: nichts
  assert.equal(D.monat(), 'November 2026');
  D.tipp(D.blatt(-1));
  assert.equal(D.monat(), 'Oktober 2026');
  assert.deepEqual(D.pg.querySelectorAll('button.tg').map((b) => b.dataset.tag), ['2026-10-15', '2026-10-30']);
  // der gewählte Tag bleibt gewählt (sein Satz steht weiter da), im Oktober ist nur keiner markiert
  assert.deepEqual(D.gewaehlt(), []);
  assert.match(D.text(), /Donnerstag, 19\. November/);
  // Oktober ist der erste aufgeschriebene Monat: weiter zurück geht es nicht
  assert.deepEqual([D.blatt(-1).disabled, D.blatt(1).disabled], [true, false]);
  D.tipp(D.blatt(-1));
  assert.equal(D.monat(), 'Oktober 2026');
  D.tipp(D.tag('2026-10-15'));
  assert.match(D.text(), /Donnerstag, 15\. Oktober guter Tag 2-mal gefüttert, 5-mal gestreichelt\. Kirby war da\./);
  D.tipp(D.blatt(1));
  assert.equal(D.monat(), 'November 2026');
  assert.deepEqual(D.gewaehlt(), []);
  // Auswahl und Monat gelten, solange das Tagebuch offen ist (auch über einen anderen Reiter hinweg) …
  D.tipp(D.blatt(-1));
  D.c._diaryTab('schatz');
  D.c._diaryTab('rueck');
  assert.deepEqual([D.monat(), D.gewaehlt()], ['Oktober 2026', ['2026-10-15']]);
  // … und beginnen beim nächsten Öffnen wieder vorn
  D.zu();
  await D.auf();
  assert.deepEqual([D.monat(), D.gewaehlt()], ['November 2026', ['2026-11-21']]);
  D.zu();
  assert.deepEqual([D.Z.ws.length, D.Z.dienste.length], [1, 0]);

  // Am Monatsersten zeigt der Kalender den neuen Monat (nur heute, umrandet), der jüngste Tag steht darunter
  const E = await karte({ jetzt: new Date(2026, 11, 1, 9).getTime() }).auf();
  assert.equal(E.monat(), 'Dezember 2026');
  assert.equal(E.pg.querySelectorAll('button.tg').length, 0);
  assert.match(E.pg.html, /<span class="tg heute" aria-current="date" title="heute">1<\/span>/);
  assert.match(E.text(), /Samstag, 21\. November/);
  assert.deepEqual([E.blatt(-1).disabled, E.blatt(1).disabled], [false, true]);
  // … und vor 4 Uhr nachts gilt noch der Vortag als heute (der Pika-Tag wechselt um 4)
  E.zu();
  const N = await karte({ jetzt: new Date(2026, 11, 1, 3, 30).getTime() }).auf();
  assert.equal(N.monat(), 'November 2026');
  assert.match(N.pg.html, /<span class="tg heute" aria-current="date" title="heute">30<\/span>/);
  N.zu();
  // Steht ein späterer Tag in der Liste (eine Geräteuhr ging vor), lässt sich bis dorthin blättern
  const V = await karte({ items: [...LISTE(), zeile('2026-12-02')] }).auf();
  assert.deepEqual([V.monat(), V.blatt(1).disabled, V.gewaehlt()], ['November 2026', false, []]);
  V.tipp(V.blatt(1));
  assert.deepEqual([V.monat(), V.gewaehlt(), V.blatt(1).disabled], ['Dezember 2026', ['2026-12-02'], true]);
  V.zu();
});

test('Rückblick, Tastatur: ein Halt im Kalender, Pfeiltasten von Tag zu Tag, der Fokus bleibt nach dem Wählen und Blättern im Fenster', async () => {
  const D = await karte().auf();
  // genau ein Tag ist Halt für die Tab-Taste: der gewählte
  const halte = () => D.pg.querySelectorAll('button.tg').filter((b) => b.tabIndex === 0).map((b) => b.dataset.tag);
  assert.deepEqual(halte(), ['2026-11-21']);
  assert.equal(D.pg.querySelectorAll('button.tg').filter((b) => b.tabIndex === -1).length, 8);
  // Tab: ✕, fünf Reiter, Seite, Monat zurück (vor ist gesperrt), der eine Tag, wieder ✕
  D.root.querySelector('.x').focus();
  const weg = [];
  for (let i = 0; i < 10; i++) {
    assert.equal(D.taste('Tab').verhindert, true);
    weg.push(D.wo());
  }
  assert.deepEqual(weg, ['heute', 'gestern', 'rueck', 'schatz', 'entd', 'page', 'mon-1', '2026-11-21', 'x', 'heute']);
  D.root.querySelector('.x').focus();
  D.taste('Tab', true);
  assert.equal(D.wo(), '2026-11-21');
  // Pfeiltasten: links und rechts zum nächsten Tag mit Eintrag, hoch und runter zum selben Wochentag, Pos1 und Ende
  const pfeil = (k) => {
    const e = D.taste(k);
    return [D.wo(), e.verhindert];
  };
  assert.deepEqual(pfeil('ArrowLeft'), ['2026-11-20', true]);
  assert.deepEqual(pfeil('ArrowLeft'), ['2026-11-19', true]);
  assert.deepEqual(pfeil('ArrowUp'), ['2026-11-12', true], 'eine Woche zurück');
  assert.deepEqual(pfeil('ArrowUp'), ['2026-11-05', true]);
  assert.deepEqual(pfeil('ArrowUp'), ['2026-11-05', true], 'darüber steht nichts: bleibt, die Seite rollt nicht weg');
  assert.deepEqual(pfeil('ArrowDown'), ['2026-11-12', true]);
  assert.deepEqual(pfeil('ArrowRight'), ['2026-11-19', true]);
  assert.deepEqual(pfeil('Home'), ['2026-11-02', true]);
  assert.deepEqual(pfeil('ArrowLeft'), ['2026-11-02', true]);
  // (vom 2. aus nach unten: Der 9. hat keinen Eintrag, der 16. auch nicht: bleibt)
  assert.deepEqual(pfeil('ArrowDown'), ['2026-11-02', true]);
  assert.deepEqual(pfeil('ArrowRight'), ['2026-11-03', true]);
  // (vom 3. aus: Der 10. steht da)
  assert.deepEqual(pfeil('ArrowDown'), ['2026-11-10', true]);
  assert.deepEqual(pfeil('End'), ['2026-11-21', true]);
  assert.deepEqual(pfeil('ArrowRight'), ['2026-11-21', true]);
  // andere Tasten bleiben der Seite; der Halt ist mit dem Fokus gewandert
  assert.deepEqual(pfeil('a'), ['2026-11-21', false]);
  D.taste('ArrowLeft');
  assert.deepEqual(halte(), ['2026-11-20']);
  // Eingabetaste (der Klick des Knopfs): gewählt, und der Fokus liegt wieder auf dem Tag (er wurde neu gezeichnet)
  D.tipp(D.root.activeElement);
  assert.deepEqual([D.gewaehlt(), D.wo(), halte()], [['2026-11-20'], '2026-11-20', ['2026-11-20']]);
  // Pfeiltasten wirken nur von einem Tag aus: auf einem Reiter oder der Seite tun sie nichts
  D.pg.focus();
  assert.deepEqual(pfeil('ArrowDown'), ['page', false]);
  D.root.querySelectorAll('[data-tab]')[2].focus();
  assert.deepEqual(pfeil('ArrowRight'), ['rueck', false]);
  // Blättern mit der Tastatur: Der Knopf „zurück“ behält den Fokus; ist er danach gesperrt, bekommt ihn die Seite
  const R = await karte({ items: [zeile('2026-09-10'), ...LISTE()] }).auf();
  R.blatt(-1).focus();
  R.tipp(R.root.activeElement);
  assert.deepEqual([R.monat(), R.wo()], ['Oktober 2026', 'mon-1']);
  R.tipp(R.root.activeElement);
  assert.deepEqual([R.monat(), R.wo(), R.blatt(-1).disabled], ['September 2026', 'page', true]);
  R.taste('Tab');
  assert.equal(R.wo(), 'mon1');
  // im Monat ohne den gewählten Tag ist der letzte Tag mit Eintrag der Halt
  assert.deepEqual(R.pg.querySelectorAll('button.tg').filter((b) => b.tabIndex === 0).map((b) => b.dataset.tag), ['2026-09-10']);
  // ein Tipp mit dem Finger (kein Fokus in der Seite) zieht den Fokus nicht an sich
  R.root.querySelector('.sheet').focus();
  R.tipp(R.tag('2026-09-10'));
  assert.equal(R.wo(), 'sheet');
  // Escape schließt wie überall
  const e = R.taste('Escape');
  assert.deepEqual([e.gestoppt, R.c._dia], [true, null]);
  D.zu();
});

test('Rückblick: Kommt der Verlauf für Heute und Gestern erst später, bleibt die Seite an ihrer Stelle und der Fokus auf dem Tag', async () => {
  const D = karte();
  let los = null;
  const seiten = await D.c._diaryBuild();
  D.c._diaryBuild = () => new Promise((ja) => { los = () => ja(seiten); });
  await D.auf();
  assert.match(D.text(), /11 Tage aufgeschrieben/, 'der Rückblick wartet nicht auf den Verlauf');
  // mit der Tastatur auf einen Tag, die Seite ein Stück gerollt
  D.tag('2026-11-12').focus();
  D.tipp(D.root.activeElement);
  D.pg.scrollTop = 140;
  los();
  await atmen();
  assert.deepEqual([D.wo(), D.pg.scrollTop, D.gewaehlt()], ['2026-11-12', 140, ['2026-11-12']]);
  // (Heute ist inzwischen gefüllt)
  D.c._diaryTab('heute');
  assert.match(D.text(), /Guten Morgen\./);
  D.zu();
  // dasselbe, wenn der Verlauf scheitert: Der Fehler steht im Fuß, der Rückblick bleibt stehen
  const F = karte();
  let ab = null;
  F.c._diaryBuild = () => new Promise((ja, nein) => { ab = () => nein(vm.runInContext('new Error("Verlauf kaputt")', WELT)); });
  await F.auf();
  F.tag('2026-11-10').focus();
  F.pg.scrollTop = 90;
  ab();
  await atmen();
  assert.deepEqual([F.wo(), F.pg.scrollTop], ['2026-11-10', 90]);
  assert.match(F.root.querySelector('.ft').html, /1 Fehler seit dem Laden/);
  assert.match(F.text(), /11 Tage aufgeschrieben/);
  F.zu();
});

test('Rückblick zählt als Berührung: Tippen und Tasten stellen die Uhr des Selbstschließens neu (60 s)', async () => {
  const D = await karte().auf();
  const n0 = wecker.length;
  assert.equal(wecker.at(-1), 60000);
  // ein Tipp auf einen Tag kommt als pointerdown am Fenster an (dort horcht das Tagebuch für alle Seiten)
  D.host.melde('pointerdown', {});
  D.tipp(D.tag('2026-11-10'));
  assert.deepEqual(wecker.slice(n0), [60000]);
  D.pg.querySelector('button.tg').focus();
  D.taste('ArrowRight');
  D.host.melde('wheel', {});
  D.pg.melde('scroll', {});
  assert.deepEqual(wecker.slice(n0), [60000, 60000, 60000, 60000]);
  D.zu();
});

// ====================================================================================================================
// 5 Stil: fünf Reiter, Maße, Kontraste
// ====================================================================================================================

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
const kontrast = (a, b) => {
  const [x, y] = [leuchte(a), leuchte(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const rund = (v) => Math.round(v * 100) / 100;
const regeln = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => [m[1].replace(/\s+/g, ' ').trim(), m[2].replace(/\s+/g, ' ').trim()]);
const regel = (R, sel) => {
  const r = R.find(([s]) => s === sel);
  assert.ok(r, `Regel „${sel}“ fehlt`);
  return r[1];
};
const wert = (dekl, eig) => {
  const m = [...dekl.matchAll(new RegExp(`(?:^|;)\\s*${eig}:\\s*([^;]+)`, 'g'))].at(-1);
  assert.ok(m, `„${eig}“ fehlt in: ${dekl}`);
  return m[1].trim();
};
const marken = (dekl) => Object.fromEntries([...dekl.matchAll(/(--[\w-]+):\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));

test('Kontrast-Rechnung dieser Datei: dieselben Werte wie in tagebuch-a11y.test.mjs', () => {
  assert.equal(rund(kontrast('#000', '#fff')), 21);
  assert.equal(rund(kontrast('#777777', '#fff')), 4.48);
  assert.equal(rund(kontrast('#8a7461', ueber('rgba(90, 64, 48, .08)', '#fbf5e6'))), 3.58);
  assert.equal(ueber('rgba(0, 0, 0, .5)', '#fff'), 'rgb(127.5, 127.5, 127.5)');
});

test('Rückblick, Farben am Tag und in der Nacht: Schrift 4,5 : 1, Zeichen und Ränder 3 : 1, auf Papier, Reiter-Grund und goldenem Grund', async () => {
  const D = await karte().auf();
  const stil = D.root.stil;
  const R = regeln(stil);
  D.zu();
  const paletten = { Tag: marken(regel(R, '.bd')), Nacht: { ...marken(regel(R, '.bd')), ...marken(regel(R, '.bd.night')) } };
  // die Regeln des Rückblicks hängen an den Farben des Notizbuchs …
  const v = (sel, eig) => wert(regel(R, sel), eig);
  assert.equal(v('.tg', 'color'), 'var(--soft)');
  assert.equal(v('.tg i', 'color'), 'var(--soft)');
  assert.equal(v('button.tg', 'color'), 'var(--ink)');
  assert.equal(v('button.tg', 'background'), 'var(--tab)');
  assert.equal(v('.tg.gut i', 'color'), 'var(--acc)');
  assert.equal(v('.kl i.g', 'color'), 'var(--acc)');
  assert.equal(v('.tg.heute', 'border'), '2px dashed var(--soft)');
  assert.equal(v('.tg.sel', 'border'), '2px solid var(--ink)');
  assert.equal(v('.kw span', 'color'), 'var(--soft)');
  assert.equal(v('.kl', 'color'), 'var(--soft)');
  assert.equal(v('.kn button', 'color'), 'var(--soft)');
  assert.equal(v('.kn button', 'background'), 'var(--tab)');
  assert.equal(v('.rt', 'background'), 'var(--tab)');
  assert.equal(v('.rt .bdg', 'color'), 'var(--soft)');
  assert.equal(v('.rt .bdg i', 'color'), 'var(--acc)');
  // … und die einzigen neuen Farben sind der goldene Grund des guten Tags, am Tag und in der Nacht
  const gold = { Tag: v('.tg.gut', 'background'), Nacht: v('.night .tg.gut', 'background') };
  assert.match(gold.Tag, /^rgba\(/);
  assert.match(gold.Nacht, /^rgba\(/);
  assert.notEqual(gold.Tag, gold.Nacht);
  for (const [name, P] of Object.entries(paletten)) {
    const pp = P['--pp'];
    const grund = ueber(P['--tab'], pp);
    const golden = ueber(gold[name], pp);
    // [was, vorn, hinten, mindestens]
    const paare = [
      ['Zahl eines Tags ohne Eintrag, Wochentage, Legende (--soft, 12 px)', P['--soft'], pp, 4.5],
      ['Zahl eines aufgeschriebenen Tags', P['--ink'], grund, 4.5],
      ['Zahl eines guten Tags', P['--ink'], golden, 4.5],
      ['Pfote im Umriss, Koffer', P['--soft'], grund, 3],
      ['gefüllte Pfote des guten Tags', P['--acc'], golden, 3],
      ['Pfote in der Legende', P['--acc'], pp, 3],
      ['Rand „heute“', P['--soft'], pp, 3],
      ['Rand des gewählten Tags auf Papier', P['--ink'], pp, 3],
      ['Rand des gewählten Tags gegen den goldenen Grund', P['--ink'], golden, 3],
      ['Rand des gewählten Tags gegen den Grund eines Tags', P['--ink'], grund, 3],
      ['Winkel zum Blättern', P['--soft'], grund, 3],
      ['Satz des Tags', P['--ink'], grund, 4.5],
      ['„guter Tag“ am Satz des Tags (12 px)', P['--soft'], grund, 4.5],
      ['Pfote am Satz des Tags', P['--acc'], grund, 3],
      ['Zähler der Summen', P['--ink'], grund, 4.5],
      ['Fokusring um einen guten Tag', P['--acc'], pp, 3],
    ];
    for (const [was, vorn, hinten, min] of paare) {
      const k = kontrast(vorn, hinten);
      assert.ok(k >= min, `${name}, ${was}: ${vorn} auf ${hinten} hat ${rund(k)}, soll ${min}`);
    }
    // der gute Tag hebt sich vom gewöhnlichen nicht nur durch die Farbe ab (Form: gefüllt statt Umriss), der goldene
    // Grund ist warm (Rot > Grün > Blau)
    const [r, g, b] = farbe(gold[name]);
    assert.ok(r > g && g > b, `${name}: ${gold[name]}`);
  }
  // Maße: Felder des Kalenders mindestens 32 px hoch, Knöpfe zum Blättern 40 px, sieben Spalten
  assert.ok(parseFloat(v('.tg', 'height')) >= 32, v('.tg', 'height'));
  assert.deepEqual([v('.kn button', 'width'), v('.kn button', 'height')], ['40px', '40px']);
  assert.equal(v('.kw, .kt', 'grid-template-columns'), 'repeat(7, minmax(0, 1fr))');
  // der Fokusring der anderen Knöpfe des Tagebuchs gilt auch hier (echte Knöpfe)
  assert.ok(R.some(([s]) => s === 'button:focus-visible, .page:focus-visible, summary:focus-visible'));
  // keine Bewegung: Der Rückblick bringt keine Animation und keinen Übergang mit
  const neu = stil.slice(stil.indexOf('.tabs.t5'), stil.indexOf('@keyframes tbin'));
  assert.ok(neu.length > 500);
  assert.doesNotMatch(neu, /animation|transition/);
});

test('Fünf Reiter: enger in einer Reihe, bis 420 px in zwei Reihen (drei und zwei); ohne Rückblick bleibt alles, wie es war', async () => {
  const D = await karte().auf();
  const css = D.root.stil.replace(/\/\*[\s\S]*?\*\//g, '');
  D.zu();
  const R = regeln(css);
  // die Regeln der vier Reiter sind unverändert
  assert.equal(regel(R, '.tabs'), 'display: flex; gap: 6px; padding: 6px 16px 10px;');
  assert.match(regel(R, '.tabs button'), /^flex: 1 1 auto; min-width: 0; height: 38px; padding: 0 6px; border-radius: 12px; font-size: 14px;/);
  // fünf: eigene Regeln an .t5
  assert.equal(regel(R, '.tabs.t5'), 'gap: 4px;');
  assert.equal(regel(R, '.tabs.t5 button'), 'padding: 0 4px;');
  const block = css.match(/@media \(max-width: 420px\) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/);
  assert.ok(block, '@media (max-width: 420px)');
  const M = regeln(block[1]);
  assert.deepEqual(M.map(([s]) => s), ['.tabs.t5', '.tabs.t5 button', '.tabs.t5 button:nth-child(n+4)'], 'nur die fünf Reiter');
  assert.equal(wert(regel(M, '.tabs.t5'), 'display'), 'grid');
  assert.equal(wert(regel(M, '.tabs.t5'), 'grid-template-columns'), 'repeat(6, minmax(0, 1fr))');
  assert.equal(wert(regel(M, '.tabs.t5 button'), 'grid-column'), 'span 2');
  assert.equal(wert(regel(M, '.tabs.t5 button:nth-child(n+4)'), 'grid-column'), 'span 3');
  // in zwei Reihen bleibt die Schrift 14 px, auch auf ganz schmalen Handys (dort sonst 13 px)
  assert.equal(wert(regel(M, '.tabs.t5 button'), 'font-size'), '14px');
  // Rechnung für die schmalen Blätter: Reihe 1 drei, Reihe 2 zwei Reiter, jeder breit genug für sein Wort (gemessen
  // in Segoe UI fett 14 px: Rückblick 64 px, Entdeckungen 94 px)
  for (const [breit, rand] of [[320, 10], [360, 16], [390, 16], [420, 16]]) {
    const innen = breit - 2 * rand;
    assert.ok((innen - 2 * 5) / 3 >= 64 + 16, `${breit} px: drei in einer Reihe`);
    assert.ok((innen - 5) / 2 >= 94 + 16, `${breit} px: zwei in einer Reihe`);
  }
});

test('Vorschau: die Zeile „Chronik“ hat die Knöpfe für den Rückblick', () => {
  const html = fs.readFileSync(new URL('../preview.html', import.meta.url), 'utf8');
  const bar = html.match(/<div class="bar" id="bar-chronik">[\s\S]*?<\/div>/)[0];
  assert.match(bar, /<button id="chr-rueck">Rückblick: sechs Wochen füllen<\/button>/);
  assert.match(bar, /<button id="chr-rueck-auf">Rückblick öffnen/);
  assert.match(html, /_diaryOpen\('rueck'\)/);
});
