// Szene, Animation und Aufräumen (0.43.1): getragene Laterne, Box des Drachens (Safari), „Bewegung reduzieren“,
// Arbeit, die keiner sieht, toter Stil der alten Glühwürmchen, kleine Zustandslecks.
// node --test (lädt wie pika.test.mjs die gebaute pika-pet-card.js mit ein paar Attrappen).
// Geprüft wird am echten Stylesheet (T.STYLES) und an den echten Grafiken (aus src/grafik/, reine Textbausteine):
// Die Grafik wird zu einem kleinen Baum gelesen, in die Hüllen gehängt, die die Karte baut, und ein kleiner
// Selektor-Vergleich mit Kaskade (Gewicht, Reihenfolge, !important, @media) sagt, was an einem Element gilt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { FEST_CARRY, FEST_BAT } from '../src/grafik/feste.js';
import { KITE_SVG, PUDDLE_SVG } from '../src/grafik/beschaeftigungen.js';
import { PIKA_SVG } from '../src/grafik/pika.js';
import { BIRDS, BIRD_SVG, MOUSE_SVG, FROG_SVG, SNAILS, SNAIL_SVG } from '../src/grafik/besucher.js';
import { BFLY_COLORS, BFLY_SVG } from '../src/grafik/momente.js';
import { SIG_VAC } from '../src/grafik/signale.js';
import { BOTE_SVG } from '../src/grafik/haus-bote.js';
import { LANE_S, LANE_DY } from '../src/logik/einstellungen.js';

let T = null;
const uhrwerk = { gestellt: [], geloescht: [] };
const WELT = {
  window: { matchMedia: () => ({ matches: false }), customCards: [] },
  document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  HTMLElement: class {},
  customElements: { get: () => null, define() {} },
  console: { info() {}, log() {}, warn() {}, debug() {} },
  setTimeout, clearTimeout, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController, performance,
  // Takte werden nur aufgeschrieben (Flugzeuge): Nichts läuft von selbst
  setInterval: (fn, ms) => {
    const h = { fn, ms };
    uhrwerk.gestellt.push(h);
    return h;
  },
  clearInterval: (h) => uhrwerk.geloescht.push(h),
  __pikaTest: (x) => (T = x),
};
vm.runInNewContext(fs.readFileSync(new URL('../pika-pet-card.js', import.meta.url), 'utf8'), WELT, { filename: 'pika-pet-card.js' });
const P = T.PikaPetCard.prototype;

// ---------- Stylesheet lesen ----------

// Zeichen für Zeichen mit Klammertiefe; was in Anführungszeichen steht, zählt nicht ([fill^="var(--pk-"])
const zeichen = function* (s) {
  let tiefe = 0;
  let zitat = null;
  for (const ch of s) {
    const innen = !!zitat;
    if (zitat) zitat = ch === zitat ? null : zitat;
    else if (ch === '"' || ch === "'") zitat = ch;
    else if (ch === '(' || ch === '[') tiefe++;
    else if (ch === ')' || ch === ']') tiefe--;
    yield [ch, innen || zitat ? tiefe + 1 : tiefe];
  }
};
// An Kommas (bzw. einem anderen Zeichen) teilen, aber nicht in Klammern
const teile = (s, an = ',') => {
  const out = [];
  let cur = '';
  for (const [ch, tiefe] of zeichen(s)) {
    if (ch === an && !tiefe) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
const dekl = (text) => teile(text, ';').map((d) => {
  const i = d.indexOf(':');
  const wert = d.slice(i + 1).trim();
  return [d.slice(0, i).trim(), wert.replace(/\s*!important$/, ''), /!important$/.test(wert)];
}).filter(([p]) => p);
// Regeln { sel, dekl, media, nr } in der Reihenfolge des Stylesheets; Keyframes nach Namen
const REGELN = [];
const KEYFRAMES = new Map();
const liesCss = (text, media = null) => {
  let i = 0;
  while (i < text.length) {
    const auf = text.indexOf('{', i);
    if (auf < 0) break;
    const kopf = text.slice(i, auf).trim();
    let tiefe = 1;
    let j = auf + 1;
    for (; tiefe && j < text.length; j++) tiefe += text[j] === '{' ? 1 : text[j] === '}' ? -1 : 0;
    const rumpf = text.slice(auf + 1, j - 1);
    if (kopf.startsWith('@media')) liesCss(rumpf, kopf.slice(6).trim());
    else if (kopf.startsWith('@keyframes')) KEYFRAMES.set(kopf.slice(10).trim(), rumpf);
    else if (!kopf.startsWith('@')) for (const sel of teile(kopf)) REGELN.push({ sel, dekl: dekl(rumpf), media, nr: REGELN.length });
    i = j;
  }
};
liesCss(T.STYLES.replace(/\/\*[\s\S]*?\*\//g, ''));

// ---------- Selektoren ----------

// Selektor → [[Kombinator, Verbund], …]; Verbund: Tag, Klassen, Attribute, :not(…), :is(…), :where(…), :nth-…,
// Pseudo-Element, Zustand (:hover …). Was der Test nicht kennt (eine neue Pseudo-Klasse etwa), trifft nie, wie ein
// Zustand, und steht in UNBEKANNT: Der Test „Werkzeug“ nennt es, die übrigen Tests laufen weiter.
const VERBUND = new Map();
const UNBEKANNT = new Set();
const STRUKTUR = ['nth-child', 'nth-of-type', 'nth-last-child', 'first-child', 'last-child', 'first-of-type', 'last-of-type', 'only-child'];
const ZUSTAND = ['hover', 'active', 'focus-visible', 'focus-within', 'focus', 'host', 'disabled', 'enabled', 'checked', 'empty', 'target',
  'link', 'visited', 'any-link', 'root', 'defined', 'placeholder-shown', 'host-context', 'has', 'dir', 'lang'];
const verbund = (s) => {
  if (VERBUND.has(s)) return VERBUND.get(s);
  const v = { tag: null, cls: [], nicht: [], ist: [], wo: [], nth: [], attr: [], pe: null, dyn: false };
  let rest = s;
  const m0 = /^(\*|[a-zA-Z][\w-]*)/.exec(rest);
  if (m0) {
    if (m0[1] !== '*') v.tag = m0[1];
    rest = rest.slice(m0[0].length);
  }
  while (rest) {
    let m;
    if ((m = /^\.([\w-]+)/.exec(rest))) v.cls.push(m[1]);
    else if ((m = /^::([\w-]+)(\([^)]*\))?/.exec(rest))) v.pe = m[1];
    else if ((m = /^\[([\w-]+)(?:([\^$*~|]?)=(?:"([^"]*)"|'([^']*)'|([^\]\s]*))(?:\s+[is])?)?\]/.exec(rest))) {
      v.attr.push([m[1], m[3] ?? m[4] ?? m[5], m[2] || '']);
    } else if ((m = /^:([\w-]+)(\()?/.exec(rest))) {
      // :name oder :name(…) bis zur passenden Klammer
      let j = m[0].length;
      if (m[2]) {
        j -= 1;
        for (const [, tiefe] of zeichen(rest.slice(j))) {
          j++;
          if (!tiefe) break;
        }
      }
      const arg = m[2] ? rest.slice(m[0].length, j - 1) : '';
      if (m[1] === 'not') v.nicht.push(teile(arg));
      else if (m[1] === 'is') v.ist.push(teile(arg));
      else if (m[1] === 'where') v.wo.push(teile(arg));
      else if (STRUKTUR.includes(m[1])) v.nth.push([m[1], arg]);
      else {
        v.dyn = true;
        if (!ZUSTAND.includes(m[1])) UNBEKANNT.add(s);
      }
      m = [rest.slice(0, j)];
    } else {
      // gar nicht zu lesen: trifft nie
      v.dyn = true;
      UNBEKANNT.add(s);
      m = [rest];
    }
    rest = rest.slice(m[0].length);
  }
  VERBUND.set(s, v);
  return v;
};
const KETTE = new Map();
const kette = (sel) => {
  if (KETTE.has(sel)) return KETTE.get(sel);
  const out = [];
  let komb = null;
  let cur = '';
  const ab = () => {
    if (!cur) return;
    out.push([komb, verbund(cur)]);
    cur = '';
    komb = ' ';
  };
  for (const [ch, tiefe] of zeichen(sel)) {
    if (!tiefe && /[\s>+~]/.test(ch)) {
      ab();
      if (/[>+~]/.test(ch)) komb = ch;
    } else cur += ch;
  }
  ab();
  KETTE.set(sel, out);
  return out;
};
// an+b: gilt für Platz i (ab 1)?
const nthOk = (formel, i) => {
  const f = formel.replace(/\s+/g, '');
  if (f === 'odd') return i % 2 === 1;
  if (f === 'even') return i % 2 === 0;
  const m = /^([+-]?\d*)n([+-]\d+)?$/.exec(f);
  if (!m) return i === Number(f);
  const a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  const b = Number(m[2] || 0);
  return a === 0 ? i === b : (i - b) / a >= 0 && (i - b) % a === 0;
};
const passt = (el, v) => {
  if (v.dyn || v.pe || (v.tag && el.tag !== v.tag) || !v.cls.every((k) => el.cls.has(k))) return false;
  const hat = (k, w, op) => k in el.attr && (w === undefined || (op === '^' ? el.attr[k].startsWith(w)
    : op === '$' ? el.attr[k].endsWith(w) : op === '*' ? el.attr[k].includes(w) : op === '~' ? el.attr[k].split(/\s+/).includes(w)
      : op === '|' ? el.attr[k] === w || el.attr[k].startsWith(`${w}-`) : el.attr[k] === w));
  if (!v.attr.every((a) => hat(...a))) return false;
  /* eslint-disable no-use-before-define */
  if (v.nicht.some((liste) => liste.some((s) => trifft(el, s)))) return false;
  if (![...v.ist, ...v.wo].every((liste) => liste.some((s) => trifft(el, s)))) return false;
  /* eslint-enable no-use-before-define */
  const alle = el.eltern ? el.eltern.kinder : [el];
  const art = alle.filter((e) => e.tag === el.tag);
  return v.nth.every(([k, f]) => ({
    'only-child': () => alle.length === 1,
    'nth-child': () => nthOk(f, alle.indexOf(el) + 1),
    'nth-last-child': () => nthOk(f, alle.length - alle.indexOf(el)),
    'nth-of-type': () => nthOk(f, art.indexOf(el) + 1),
    'first-child': () => alle[0] === el,
    'last-child': () => alle.at(-1) === el,
    'first-of-type': () => art[0] === el,
    'last-of-type': () => art.at(-1) === el,
  })[k]());
};
const trifft = (el, sel) => {
  const K = kette(sel);
  const geh = (e, i) => {
    if (!passt(e, K[i][1])) return false;
    if (i === 0) return true;
    const k = K[i][0];
    const g = e.eltern ? e.eltern.kinder : [];
    const j = g.indexOf(e);
    if (k === '>') return !!e.eltern && geh(e.eltern, i - 1);
    if (k === '+') return j > 0 && geh(g[j - 1], i - 1);
    if (k === '~') return g.slice(0, Math.max(0, j)).some((o) => geh(o, i - 1));
    for (let p = e.eltern; p; p = p.eltern) if (geh(p, i - 1)) return true;
    return false;
  };
  return geh(el, K.length - 1);
};
// Gewicht [Klassen und Pseudo-Klassen, Tags]; :not und :is zählen wie ihr schwerster Teil, :where zählt nicht
const gewicht = (sel) => kette(sel).reduce((a, [, v]) => {
  const n = [...v.nicht, ...v.ist].map((l) => l.map(gewicht).sort((x, y) => y[0] - x[0] || y[1] - x[1])[0] || [0, 0]);
  return [a[0] + v.cls.length + v.attr.length + v.nth.length + (v.dyn ? 1 : 0) + n.reduce((s, g) => s + g[0], 0),
    a[1] + (v.tag ? 1 : 0) + (v.pe ? 1 : 0) + n.reduce((s, g) => s + g[1], 0)];
}, [0, 0]);
for (const r of REGELN) r.gew = gewicht(r.sel);

// ---------- Elemente ----------

const neu = (eltern, tag, cls = '', attr = {}) => {
  const el = { tag, attr: { ...attr }, cls: new Set(String(cls).split(/\s+/).filter(Boolean)), kinder: [], eltern };
  eltern?.kinder.push(el);
  return el;
};
// Grafik (HTML oder SVG als Text) unter eltern hängen → die neuen Kinder
const haenge = (eltern, html) => {
  let auf = eltern;
  const vorher = eltern.kinder.length;
  for (const [, zu, tag, a, selbst] of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([\w-]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    if (zu) {
      assert.equal(auf.tag, tag, `</${tag}> schließt <${auf.tag}>`);
      auf = auf.eltern;
      continue;
    }
    const attr = Object.fromEntries([...a.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
    const el = neu(auf, tag, attr.class || '', attr);
    if (!selbst) auf = el;
  }
  assert.equal(auf, eltern, 'Grafik nicht sauber geschlossen');
  return eltern.kinder.slice(vorher);
};
// Kette von Hüllen: huelle(szene, 'div.fx', 'div.bub') → das innerste Element
const huelle = (eltern, ...teileH) => teileH.reduce((p, t) => {
  const [tag, ...cls] = t.split('.');
  return neu(p, tag, cls.join(' '));
}, eltern);
const alle = (el, test2, out = []) => {
  for (const k of el.kinder) {
    if (test2(k)) out.push(k);
    alle(k, test2, out);
  }
  return out;
};
const mit = (k) => (el) => el.cls.has(k);
const szene = (cls = 'day') => neu(null, 'div', `scene ${cls}`);
// Der Pika, wie _build ihn baut: Hüllen bis .br, darin die Grafik
const pika = (sz, cls = '') => {
  const p = huelle(sz, `div.pika${cls ? `.${cls.split(/\s+/).join('.')}` : ''}`);
  haenge(huelle(p, 'div.clipw', 'div.depth', 'div.flip', 'div.jump', 'div.hop', 'div.br'), PIKA_SVG);
  return p;
};

// ---------- Kaskade ----------

// Was an el gilt: Map Eigenschaft → Wert. ruhig: mit „Bewegung reduzieren“ (prefers-reduced-motion: reduce).
// Die Kurzschreibweise animation setzt animation-play-state zurück (running, außer sie nennt paused).
const gilt = (el, { ruhig = false } = {}) => {
  const tr = [];
  for (const r of REGELN) {
    if (r.media && !(ruhig && /prefers-reduced-motion:\s*reduce/.test(r.media))) continue;
    if (!trifft(el, r.sel)) continue;
    r.dekl.forEach(([prop, wert, wichtig], j) => tr.push({ prop, wert, wichtig, gew: r.gew, nr: r.nr, j }));
  }
  dekl(el.attr.style || '').forEach(([prop, wert, wichtig], j) => tr.push({ prop, wert, wichtig, gew: [1e6, 0], nr: 1e9, j }));
  tr.sort((a, b) => a.wichtig - b.wichtig || a.gew[0] - b.gew[0] || a.gew[1] - b.gew[1] || a.nr - b.nr || a.j - b.j);
  const st = new Map();
  for (const t of tr) {
    st.set(t.prop, t.wert);
    if (t.prop === 'animation') st.set('animation-play-state', teile(t.wert).map((a) => (/\bpaused\b/.test(a) ? 'paused' : 'running')).join(', '));
  }
  return st;
};
// Animationen, die an el endlos laufen (nicht angehalten)
const endlos = (el, opt) => {
  const st = gilt(el, opt);
  const an = teile(st.get('animation') || 'none');
  const lauf = teile(st.get('animation-play-state') || 'running');
  return an.filter((a, i) => /\binfinite\b/.test(a) && lauf[i % lauf.length] !== 'paused');
};
// Deckkraft in Ruhe (ohne Animation): Stil, sonst das Attribut der Grafik, sonst 1
const deckkraft = (el, opt) => Number(gilt(el, opt).get('opacity') ?? el.attr.opacity ?? 1);

test('Werkzeug: das Stylesheet ist gelesen, jeder Selektor verstanden, die Kaskade rechnet wie der Browser', () => {
  assert.ok(REGELN.length > 900, `nur ${REGELN.length} Regeln gelesen`);
  assert.ok(REGELN.some((r) => r.media && /prefers-reduced-motion/.test(r.media)));
  assert.ok(KEYFRAMES.has('ksway') && KEYFRAMES.has('smoke'));
  // Was der Test nicht lesen kann, trifft bei ihm nie: Das darf keine Regel sein, auf die sich ein Test hier stützt
  // (kommt eine neue Schreibweise ins Stylesheet, hier nachtragen)
  const WICHTIG = /\.(smoke|flower|kite|kl|kr|kb|kt|bub|bfly|fbat|cst|sig-led|flid|snail|mouse|bird|gbs|hb-bubs|hb-drip|hb-heat|hb-steam|pd-dot|lgl|lgk|fest-carry|ff|fl|frsay|bubble|cloud|gt-can)\b/;
  assert.deepEqual([...UNBEKANNT].filter((s) => WICHTIG.test(s)), [], 'Selektor nicht verstanden');
  assert.ok(UNBEKANNT.size <= REGELN.length / 50, `${UNBEKANNT.size} Selektoren nicht verstanden: ${[...UNBEKANNT].slice(0, 5).join(' | ')}`);
  // … und er liest, was es an Schreibweisen gibt
  const probe = neu(neu(null, 'div', 'a'), 'i', 'b c', { role: 'button', 'data-x': 'eins zwei' });
  for (const s of ['.a > i.b', '[role=button]', '[role="button"]', '[data-x~="zwei"]', '.a :is(.b, .z)', ':where(.a) .c:only-child', 'i:not(.z):not([hidden])']) {
    assert.ok(trifft(probe, s), `${s} trifft nicht`);
  }
  for (const s of ['.b:hover', '.b::after', '[role=link]', '.a :is(.y, .z)', '.b:neu-erfunden(1)', '.b:has(.q)', '.z .b']) assert.ok(!trifft(probe, s), `${s} trifft`);
  assert.deepEqual(gewicht('.a :is(.b, i.c.d)'), [3, 1]);
  assert.deepEqual(gewicht(':where(.a) .c'), [1, 0]);
  assert.ok(UNBEKANNT.has('.b:neu-erfunden(1)') && !UNBEKANNT.has('.b:has(.q)'));
  UNBEKANNT.delete('.b:neu-erfunden(1)');
  // Gewicht, Reihenfolge, :not und nth-child an einer bekannten Stelle: Wolken ruhen ausgeblendet, laufen eingeblendet
  const sz = szene('day');
  const himmel = huelle(sz, 'div.clouds');
  const w1 = neu(himmel, 'div', 'cloud');
  const w2 = neu(himmel, 'div', 'cloud on');
  assert.equal(endlos(w1).length, 0);
  assert.equal(endlos(w2).length, 1);
  assert.equal(deckkraft(w1), 0);
  assert.equal(deckkraft(w2), 0.92);
  // „Bewegung reduzieren“ hält auch die eingeblendete an (!important schlägt die Regel mit mehr Gewicht nicht nötig)
  assert.equal(endlos(w2, { ruhig: true }).length, 0);
  assert.deepEqual(gewicht('.scene.night:not(.windy) .flower.grow'), [5, 0]);
  assert.deepEqual(gewicht('.hb-heat > g'), [1, 1]);
  assert.ok(nthOk('-n+2', 1) && nthOk('-n+2', 2) && !nthOk('-n+2', 3) && nthOk('2', 2) && nthOk('odd', 3) && !nthOk('2n', 3));
});

// ---------- 1 · getragene Laterne ----------

test('St. Martin: Der Lichtkern der getragenen Laterne deckt nachts die bunten Streifen nicht zu, der Schein leuchtet voll', () => {
  const kern = [];
  const schein = [];
  for (const himmel of ['day', 'dusk', 'night']) {
    const sz = szene(himmel);
    const hop = huelle(sz, 'div.pika.fest-lantern', 'div.clipw', 'div.depth', 'div.flip', 'div.jump', 'div.hop');
    haenge(huelle(hop, 'div.fest-carry'), FEST_CARRY);
    // der Kern: die cremefarbene Ellipse im Laternenkörper; der Schein: der große Kreis mit Verlauf
    const [k] = alle(sz, (e) => e.tag === 'ellipse' && e.attr.fill === '#fff1b8');
    const [s] = alle(sz, (e) => e.tag === 'circle' && /^url\(#fst-cg\)$/.test(e.attr.fill || ''));
    assert.ok(k && s, 'Kern oder Schein nicht gefunden');
    kern.push(deckkraft(k));
    schein.push(deckkraft(s));
    assert.ok(s.cls.has('lgl') && !k.cls.has('lgl'), 'der Kern trägt eine eigene Klasse');
  }
  // Der Kern bleibt durchscheinend (die hängende Laterne hält ihn bei .45), wird zur Nacht hin aber nicht blasser
  for (const d of kern) assert.ok(d >= 0.4 && d <= 0.55, `Kern mit Deckkraft ${d}`);
  assert.ok(kern[0] <= kern[1] && kern[1] <= kern[2]);
  assert.deepEqual(schein, [0.45, 0.8, 1]);
  // Dahinter liegen die Streifen des Körpers: Sie stehen in der Grafik vor dem Kern (der Kern malt darüber)
  assert.ok(FEST_CARRY.indexOf('#f6c945') < FEST_CARRY.indexOf('#fff1b8'));
});

// ---------- 2 · Drachen: Box für Safari ----------

// Pfad in Punkte (M L H V Q T Z, groß und klein; Bögen fein unterteilt)
const pfadPunkte = (d) => {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g);
  const N = { M: 2, L: 2, H: 1, V: 1, Q: 4, T: 2, Z: 0 };
  const pts = [];
  let i = 0;
  let cmd = 'M';
  let [x, y, sx, sy, qx, qy] = [0, 0, 0, 0, null, null];
  const bogen = (cx, cy, ex, ey) => {
    for (let t = 0.1; t < 1.001; t += 0.1) {
      pts.push([(1 - t) ** 2 * x + 2 * t * (1 - t) * cx + t * t * ex, (1 - t) ** 2 * y + 2 * t * (1 - t) * cy + t * t * ey]);
    }
    [qx, qy, x, y] = [cx, cy, ex, ey];
  };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const C = cmd.toUpperCase();
    assert.ok(C in N, `Pfadbefehl ${cmd} kennt der Test nicht`);
    const rel = cmd !== C;
    const v = Array.from({ length: N[C] }, () => parseFloat(tok[i++]));
    const ax = (n, k) => (rel ? (k ? y : x) + n : n);
    if (C === 'Z') [x, y] = [sx, sy];
    else if (C === 'H') x = ax(v[0], 0);
    else if (C === 'V') y = ax(v[0], 1);
    else if (C === 'Q') bogen(ax(v[0], 0), ax(v[1], 1), ax(v[2], 0), ax(v[3], 1));
    else if (C === 'T') bogen(qx == null ? x : 2 * x - qx, qy == null ? y : 2 * y - qy, ax(v[0], 0), ax(v[1], 1));
    else [x, y] = [ax(v[0], 0), ax(v[1], 1)];
    if (C !== 'Q' && C !== 'T') [qx, qy] = [null, null];
    pts.push([x, y]);
    if (C === 'M') {
      [sx, sy] = [x, y];
      cmd = rel ? 'l' : 'L';
    }
  }
  return pts;
};
// Zahlen der Bewegung aus dem Stylesheet (ändert sich dort etwas, sagt es der Test)
const zahl = (re, text, was) => {
  const m = re.exec(text);
  assert.ok(m, `${was} nicht gefunden`);
  return m.slice(1).map(Number);
};
const regel = (sel) => REGELN.find((r) => r.sel === sel && !r.media);
const drachenBewegung = () => {
  const [sw0, sw1] = zahl(/from \{ transform: rotate\((-?[\d.]+)deg\); \} to \{ transform: rotate\((-?[\d.]+)deg\); \}/, KEYFRAMES.get('ksway'), 'ksway');
  const [tug, tugS] = zahl(/transform: rotate\((-?[\d.]+)deg\) scale\(([\d.]+)\)/, KEYFRAMES.get('ktug'), 'ktug');
  const [bob] = zahl(/to \{ transform: rotate\((-?[\d.]+)deg\)/, KEYFRAMES.get('kbob'), 'kbob');
  const [skew] = zahl(/to \{ transform: skewX\((-?[\d.]+)deg\)/, KEYFRAMES.get('ktail'), 'ktail');
  const kl = new Map(regel('.kite .kl').dekl);
  const [s0] = zahl(/^rotate\(var\(--k0, 0deg\)\) scale\(([\d.]+)\)$/, kl.get('transform'), 'Startlage .kl');
  assert.equal(kl.get('transform-origin'), '0 0');
  assert.equal(kl.get('transform-box'), 'view-box');
  assert.equal(new Map(regel('.kite .kr').dekl).get('transform-origin'), '0 0');
  assert.equal(new Map(regel('.kite .kb').dekl).get('transform-origin'), '50% 30%');
  assert.equal(new Map(regel('.kite .kt').dekl).get('transform-origin'), '50% 0');
  // --k0 setzt die Karte: Windrichtung × 60°
  const quelle = fs.readFileSync(new URL('../src/karte/beschaeftigungen-gross.js', import.meta.url), 'utf8');
  const [k0] = zahl(/setProperty\('--k0', `\$\{kd \* (\d+)\}deg`\)/, quelle, '--k0');
  return { sway: [sw0, sw1], tug, tugS, bob, skew, s0, k0 };
};
// Alles, was der Drachen in irgendeiner Lage bemalt: [x, y, halbe Linienbreite] um die Pfote (0, 0). kd: Windrichtung.
// Lagen: Schwanz wedelt (.kt, skewX um die Oberkante seiner Box), Drachen schaukelt (.kb, um 50 % 30 % seiner Box,
// die den Schwanz mit einschließt), Schnur schwankt und ruckt (.kr, um die Pfote), Aufstieg und Einholen (.kl: von
// rotate(kd · 60°) scale(.25) bis none, Winkel und Größe gleiten gemeinsam).
const drachenFlaeche = (svg, kd, B) => {
  const wurzel = neu(null, 'div', 'kite');
  const [s] = haenge(wurzel, svg);
  const formen = alle(s, (e) => ['path', 'circle'].includes(e.tag)).map((e) => {
    let [dx, dy, kt, kb] = [0, 0, false, false];
    for (let p = e.eltern; p; p = p.eltern) {
      const m = /^translate\((-?[\d.]+) (-?[\d.]+)\)$/.exec(p.attr.transform || '');
      assert.ok(m || !p.attr.transform, `transform ${p.attr.transform} kennt der Test nicht`);
      if (m) [dx, dy] = [dx + Number(m[1]), dy + Number(m[2])];
      kt ||= p.cls.has('kt');
      kb ||= p.cls.has('kb');
    }
    const pts = e.tag === 'circle'
      ? Array.from({ length: 12 }, (_, i) => [Number(e.attr.cx) + Number(e.attr.r) * Math.cos(i * Math.PI / 6), Number(e.attr.cy) + Number(e.attr.r) * Math.sin(i * Math.PI / 6)])
      : pfadPunkte(e.attr.d);
    return { pts, dx, dy, kt, kb, sw: e.attr.stroke ? Number(e.attr['stroke-width'] || 1) / 2 : 0 };
  });
  assert.ok(formen.some((f) => f.kt) && formen.some((f) => f.kb && !f.kt) && formen.some((f) => !f.kb), 'Aufbau des Drachens anders als erwartet');
  const box = (pp) => pp.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const grad = Math.PI / 180;
  const out = [];
  const drehen = [];
  for (const a of [B.sway[0], 0, B.sway[1]]) drehen.push([a, 1]);
  for (let t = 0.25; t <= 1; t += 0.25) drehen.push([B.tug * t, 1 + (B.tugS - 1) * t]);
  for (const skew of [-B.skew, 0, B.skew]) {
    const ktBox = box(formen.filter((f) => f.kt).flatMap((f) => f.pts));
    const [ox, oy] = [(ktBox[0] + ktBox[2]) / 2, ktBox[1]];
    const nachKt = formen.map((f) => ({ ...f, pts: f.kt ? f.pts.map(([x, y]) => [x + Math.tan(skew * grad) * (y - oy), y]) : f.pts }));
    void ox;
    const kbBox = box(nachKt.filter((f) => f.kb).flatMap((f) => f.pts));
    const [px, py] = [kbBox[0] + (kbBox[2] - kbBox[0]) * 0.5, kbBox[1] + (kbBox[3] - kbBox[1]) * 0.3];
    for (const bob of [-B.bob, 0, B.bob]) {
      const [c, si] = [Math.cos(bob * grad), Math.sin(bob * grad)];
      const lage = nachKt.map((f) => ({
        sw: f.sw,
        pts: f.pts.map(([x, y]) => (f.kb ? [px + (x - px) * c - (y - py) * si, py + (x - px) * si + (y - py) * c] : [x, y])).map(([x, y]) => [x + f.dx, y + f.dy]),
      }));
      // um die Pfote: Schwanken und Ruck (oben), dazu der Aufstieg
      for (let t = 0; t <= 1.0001; t += 0.05) {
        for (const [a, sc] of drehen) {
          const w = (kd * B.k0 * (1 - t) + a) * grad;
          const g = (B.s0 + (1 - B.s0) * t) * sc;
          for (const f of lage) for (const [x, y] of f.pts) out.push([g * (x * Math.cos(w) - y * Math.sin(w)), g * (x * Math.sin(w) + y * Math.cos(w)), f.sw * g]);
        }
      }
    }
  }
  return out;
};
// Die Box des <svg>: Inhalt 1 × 1 an der Pfote, vergrößert um padding, mit margin zurückgezogen → [l, t, r, b] um die Pfote
const drachenBox = (svg) => {
  const [s] = haenge(neu(null, 'div', 'kite'), svg);
  assert.equal(s.tag, 'svg');
  assert.deepEqual([s.attr.width, s.attr.height, s.attr.viewBox], ['1', '1', undefined], 'Maß und Ursprung des <svg> bleiben (Drehpunkt der Schnur ist die Pfote)');
  const st = new Map(dekl(s.attr.style || ''));
  const px = (v) => teile(v || '', ' ').map((w) => {
    assert.match(w, /^-?[\d.]+(px)?$/, `Maß ${w}`);
    return parseFloat(w);
  });
  const pad = px(st.get('padding'));
  const mar = px(st.get('margin'));
  assert.equal(pad.length, 4, `padding am <svg>: ${s.attr.style}`);
  assert.equal(st.get('box-sizing'), 'content-box');
  // margin zieht die Box um genau das padding zurück: Der Inhalt (und damit die Zeichnung) bleibt, wo er war
  assert.ok(Math.abs(mar[0] + pad[0]) < 0.01 && Math.abs(mar[3] + pad[3]) < 0.01, `margin ${mar} gleicht padding ${pad} nicht aus`);
  return [-pad[3], -pad[0], 1 + pad[1], 1 + pad[2]];
};
// Lagen wie in _kite: K = 0,12 H; der Drache steht 0,26–0,38 W in Windrichtung und bei 0,10–0,17 der Höhe
const DRACHEN = [
  ['breite Karte, Wind nach rechts', 600, 248, 1, 0.26, 0.1],
  ['breite Karte, Wind nach links', 600, 248, -1, 0.38, 0.17],
  ['schmale Karte, Wind nach rechts', 320, 248, 1, 0.38, 0.1],
  ['schmale Karte, Wind nach links', 320, 248, -1, 0.26, 0.17],
  ['Standardhöhe', 480, 180, 1, 0.32, 0.13],
].map(([name, W, H, kd, fx, fy]) => {
  const K = H * 0.12;
  // Pfote etwa auf halber Höhe des Pikas (pH = 0,4 H über der Bodenlinie bei 0,9 H)
  return { name, kd, K, kx: kd * W * fx, ky: H * fy - H * 0.7 };
});

test('Überstand: die Box des Drachens deckt Schnur, Drachen und Schwanz in jeder Lage (sonst schneidet Safari ihn unter Wolken ab)', () => {
  const B = drachenBewegung();
  // Der Lichtfilter liegt auf .kite (0 × 0): Was zählt, ist die Box des <svg> darin
  assert.ok(REGELN.some((r) => r.sel === '.shade .kite' && r.dekl.some(([p]) => p === 'filter')));
  const kite = new Map(regel('.kite').dekl);
  assert.deepEqual([kite.get('width'), kite.get('height')], ['0', '0']);
  const ksvg = new Map(regel('.kite svg').dekl);
  assert.deepEqual([ksvg.get('position'), ksvg.get('left'), ksvg.get('top'), ksvg.get('overflow')], ['absolute', '0', '0', 'visible']);
  for (const L of DRACHEN) {
    const svg = KITE_SVG(L.kx, L.ky, L.K);
    const [l, t, r, b] = drachenBox(svg);
    const N = [Infinity, Infinity, -Infinity, -Infinity]; // so weit malt er
    for (const [x, y, sw] of drachenFlaeche(svg, L.kd, B)) {
      assert.ok(x - sw >= l && x + sw <= r && y - sw >= t && y + sw <= b,
        `${L.name}: Punkt ${x.toFixed(1)}, ${y.toFixed(1)} liegt außerhalb der Box ${[l, t, r, b].map((v) => v.toFixed(1))}`);
      N[0] = Math.min(N[0], x - sw); N[1] = Math.min(N[1], y - sw); N[2] = Math.max(N[2], x + sw); N[3] = Math.max(N[3], y + sw);
    }
    // eng: Die Box ist die gefilterte Fläche, also nicht viel größer als nötig (je Seite höchstens ein Viertel Drachen)
    const zuviel = [N[0] - l, N[1] - t, r - N[2], b - N[3]];
    for (const z of zuviel) assert.ok(z <= L.K * 0.25 + 2, `${L.name}: Box ${zuviel.map((v) => v.toFixed(1))} px größer als die Zeichnung`);
  }
  // Die Box fängt keine Tipps: Die Schicht der Drachen lässt alles durch, nichts darin holt sie zurück
  assert.equal(new Map(regel('.kites').dekl).get('pointer-events'), 'none');
  assert.ok(!REGELN.some((r) => /\.kite/.test(r.sel) && r.dekl.some(([p, w]) => p === 'pointer-events' && w !== 'none')));
});

// ---------- 3 · Bewegung reduzieren ----------

// Was von selbst endlos läuft und nicht zum Körper des Pikas gehört: [Name, Elemente in ihrer Hülle]
const AMBIENT = [
  ['Seifenblase', () => [huelle(szene(), 'div.fx', 'div.bub', 'i')]],
  ['Schmetterlingsflügel', () => {
    const h = huelle(szene(), 'div.fx', 'div.bfly');
    haenge(h, BFLY_SVG(BFLY_COLORS[0]));
    return alle(h, (e) => e.cls.has('bwl') || e.cls.has('bwr'));
  }],
  ['Fledermausflügel', () => {
    const h = huelle(szene('night'), 'div.fest-b', 'div.fsky', 'div.fbat');
    haenge(h, FEST_BAT);
    return alle(h, mit('w'));
  }],
  ['Kaffeedampf', () => alle(pika(szene(), 'coffee hot ck-mug'), (e) => e.tag === 'path' && e.eltern.cls.has('cst'))],
  ['Störungslicht des Saugroboters', () => {
    const h = huelle(szene(), 'div.props', 'div.sig-vac.stuck', 'i');
    haenge(h, SIG_VAC);
    return alle(h, mit('sig-led'));
  }],
  ['Froschlid', () => {
    const h = huelle(szene(), 'div.mice', 'div.frog.left', 'div.cw', 'div.cf', 'div.cb');
    haenge(h, FROG_SVG);
    return alle(h, mit('flid'));
  }],
  ['Schnecke kriecht', () => {
    const h = huelle(szene(), 'div.mice', 'div.snail.left.crawl', 'div.cw', 'div.cf', 'div.cb');
    haenge(h, SNAIL_SVG(SNAILS[0]));
    return alle(h, (e) => ['sbody', 'sshell', 'sfeel'].some((k) => e.cls.has(k)));
  }],
  ['Schnecke schaut', () => {
    const h = huelle(szene(), 'div.mice', 'div.snail.left.peer', 'div.cw', 'div.cf', 'div.cb');
    haenge(h, SNAIL_SVG(SNAILS[0]));
    return alle(h, mit('sfeel'));
  }],
  ['Maus läuft', () => {
    const m = huelle(szene(), 'div.mice', 'div.mouse.run');
    haenge(huelle(m, 'div.mw', 'div.mf', 'div.mb'), MOUSE_SVG);
    return alle(m, (e) => e.cls.has('mb') || e.cls.has('mtail'));
  }],
  ['Maus schnuppert', () => {
    const m = huelle(szene(), 'div.mice', 'div.mouse.sniff');
    haenge(huelle(m, 'div.mw', 'div.mf', 'div.mb'), MOUSE_SVG);
    return alle(m, (e) => e.cls.has('mnose') || e.cls.has('whisk'));
  }],
  ['Vogel fliegt', () => {
    const v = huelle(szene(), 'div.birds', 'div.bird.flying');
    haenge(huelle(v, 'div.bw', 'div.bf', 'div.bb'), BIRD_SVG(BIRDS[0]));
    return alle(v, mit('wu'));
  }],
  ['Spielfigur im Gameboy', () => alle(pika(szene(), 'gaming'), (e) => e.tag === 'rect' && e.eltern.cls.has('gbs')).filter((e) => endlos(e).length)],
];

test('Bewegung reduzieren: Was am Rand von selbst endlos läuft, ruht (Blasen, Flügel, Dampf, Blinklicht, Besucher, Spielfigur)', () => {
  for (const [name, bau] of AMBIENT) {
    const els = bau();
    assert.ok(els.length, `${name}: nichts gefunden`);
    for (const el of els) {
      // sonst läuft es (sonst stimmt die Hülle im Test nicht) …
      assert.ok(endlos(el).length, `${name}: läuft im Test gar nicht (${el.tag}.${[...el.cls].join('.')})`);
      // … mit „Bewegung reduzieren“ nicht mehr
      assert.deepEqual(endlos(el, { ruhig: true }), [], `${name}: läuft mit „Bewegung reduzieren“ weiter`);
    }
  }
  // Eine Seifenblase, die platzt, tut das weiter (kurz, einmal)
  const blase = huelle(szene(), 'div.fx', 'div.bub.pop', 'i');
  assert.match(gilt(blase, { ruhig: true }).get('animation'), /^bpop /);
  // Der Körper des Pikas bleibt, wie er ist: Hoppeln, Kauen, Putzen, Winken
  for (const [cls, teil] of [['walking', 'hop'], ['eating', 'mouth-g'], ['groom', 'paws'], ['waving', 'wpaw']]) {
    const els = alle(pika(szene(), cls), mit(teil));
    assert.ok(els.length && els.every((e) => endlos(e, { ruhig: true }).length), `.${cls} .${teil} ruht`);
  }
});

test('Bewegung reduzieren: Rauch, Blasen, Tropfen, warme Luft, Dampf und Regenringe stehen still da, statt zu verschwinden', () => {
  const R = { ruhig: true };
  const sichtbar = (els, was, min = els.length) => {
    assert.ok(els.length, `${was}: nichts gefunden`);
    for (const el of els) assert.deepEqual(endlos(el, R), [], `${was}: läuft weiter`);
    const da = els.filter((el) => deckkraft(el, R) > 0.25);
    assert.ok(da.length >= min, `${was}: ${da.length} von ${els.length} zu sehen`);
    return da;
  };
  const versetzt = (els, was) => {
    const tr = els.map((el) => gilt(el, R).get('transform') || 'none');
    assert.equal(new Set(tr).size, tr.length, `${was}: liegen aufeinander (${tr.join(' | ')})`);
  };
  // Schornsteinrauch (Erdhügel): bei Kälte, in Dämmerung und Nacht ein stehendes Wölkchen aus versetzten Kringeln
  for (const lage of ['day chilly', 'dusk', 'night']) {
    const sz = szene(lage);
    haenge(neu(huelle(sz, 'div.lights'), 'svg'), T.AREALE.huegel.lights);
    const kringel = alle(sz, (e) => e.tag === 'circle' && e.eltern.cls.has('smoke'));
    assert.equal(kringel.length, 3);
    // ohne die Einstellung ruhen sie unsichtbar und erscheinen nur in der Animation
    assert.ok(kringel.every((e) => deckkraft(e) === 0 && endlos(e).length === 1));
    versetzt(sichtbar(kringel, `Rauch (${lage})`, 2), `Rauch (${lage})`);
  }
  // an einem warmen Tag raucht es auch mit der Einstellung nicht
  {
    const sz = szene('day');
    haenge(neu(huelle(sz, 'div.lights'), 'svg'), T.AREALE.huegel.lights);
    for (const e of alle(sz, (el) => el.tag === 'circle' && el.eltern.cls.has('smoke'))) assert.equal(deckkraft(e, R), 0);
  }
  // Haus-Bote: Geräte in ihrer Hülle (.hb > .hb-i > svg)
  const geraet = (typ, view) => {
    const h = neu(huelle(szene(), 'div.props', `div.hb.hb-${typ}.hb-run`, 'div.hb-i'), 'svg');
    haenge(h, BOTE_SVG[typ](view, 0).svg);
    return h;
  };
  // Waschzuber und Spülschüssel: mindestens zwei stehende Blasen, nicht aufeinander
  for (const typ of ['washer', 'dishwasher']) {
    const blasen = alle(geraet(typ, 'run'), (e) => e.tag === 'circle' && e.eltern.cls.has('hb-bubs'));
    assert.ok(blasen.every((e) => deckkraft(e) === 0 && endlos(e).length === 1));
    versetzt(sichtbar(blasen, `Blasen (${typ})`, 2), `Blasen (${typ})`);
  }
  // Wäscheleine: Die Tropfen hängen an der Wäsche
  sichtbar(alle(geraet('washer', 'empty'), mit('hb-drip')), 'Tropfen');
  // Trockner: warme Luft im Betrieb, Dampf über den fertigen Handtüchern
  sichtbar(alle(geraet('dryer', 'run'), (e) => e.tag === 'g' && e.eltern.cls.has('hb-heat')), 'warme Luft', 2);
  sichtbar(alle(geraet('dryer', 'done'), (e) => e.tag === 'g' && e.eltern.cls.has('hb-steam')), 'Dampf', 2);
  // … und der Dampf verschwindet weiter, wenn die Handtücher weggeräumt sind (.hb-gone an der Gruppe)
  assert.ok(REGELN.some((r) => r.sel === '.hb .hb-gone' && r.dekl.some(([p, w]) => p === 'opacity' && w === '0')));
  // Kaffee: Solange er heiß ist, steht eine Dampffahne über dem Becher
  sichtbar(alle(pika(szene(), 'coffee hot ck-mug'), (e) => e.tag === 'path' && e.eltern.cls.has('cst')), 'Kaffeedampf', 1);
  // … kalt keine
  for (const e of alle(pika(szene(), 'coffee ck-mug'), mit('cst'))) assert.equal(gilt(e, R).get('display'), 'none');
  // Pfütze: die zwei kleinen Ringe vom Regen
  const pf = huelle(szene('day rain'), 'div.acts', 'div.aprop.puddle');
  haenge(pf, PUDDLE_SVG);
  sichtbar(alle(pf, mit('pd-dot')), 'Regenringe in der Pfütze');
});

// ---------- 4 · Arbeit, die keiner sieht ----------

test('Schnee: Unter der Schneedecke schaukeln die Blumen nicht weiter (auch bei Wind und frisch gewachsen)', () => {
  for (const lage of ['day snowcover', 'day snowcover windy', 'night snowcover', 'night snowcover windy', 'dusk snowcover windy']) {
    for (const cls of ['flower', 'flower grow']) {
      const f = neu(huelle(szene(lage), 'div.land', 'div.flowers'), 'div', cls);
      assert.equal(deckkraft(f), 0, `${lage}: Blume unter dem Schnee zu sehen`);
      assert.deepEqual(endlos(f), [], `${lage} .${cls.replace(' ', '.')}: schaukelt unsichtbar weiter`);
    }
  }
  // ohne Schnee schaukeln sie wie bisher, nachts ohne Wind stehen sie
  const blume = (lage) => neu(huelle(szene(lage), 'div.land', 'div.flowers'), 'div', 'flower');
  assert.equal(endlos(blume('day')).length, 1);
  assert.equal(endlos(blume('day windy')).length, 1);
  assert.equal(endlos(blume('night')).length, 0);
  assert.equal(endlos(blume('night windy')).length, 1);
});

test('Wiese: Sieht keiner hin, wächst keine Blume nach', () => {
  const karte = (weg) => {
    const c = Object.create(P);
    c.gewachsen = 0;
    Object.assign(c, { _g: {}, _flowers: [], _away: () => weg, _addFlower: () => c.gewachsen++ });
    return c;
  };
  const weg = karte(true);
  weg._regrow();
  assert.equal(weg.gewachsen, 0);
  const da = karte(false);
  da._regrow();
  assert.equal(da.gewachsen, 1);
  // wie bisher: nicht ohne Maße, nicht über sechs
  Object.assign(da, { _flowers: [1, 2, 3, 4, 5, 6] })._regrow();
  Object.assign(da, { _flowers: [], _g: null })._regrow();
  assert.equal(da.gewachsen, 1);
});

test('Flugzeuge: Sieht keiner hin, steht der Takt; beim Wiedersehen läuft er wieder an', () => {
  uhrwerk.gestellt.length = uhrwerk.geloescht.length = 0;
  const c = Object.create(P);
  let weg = false;
  // _g fehlt: Der Takt kehrt nach den Prüfungen um, ohne zu zeichnen
  Object.assign(c, { _planes: new Map([['x1', {}]]), _attached: true, _g: null, _away: () => weg });
  c._planeLoop();
  assert.equal(uhrwerk.gestellt.length, 1);
  const takt = c._planeT;
  assert.equal(takt, uhrwerk.gestellt[0]);
  assert.equal(takt.ms, 5000);
  // Karte weg, das Flugzeug ist noch in der Liste: Der nächste Takt stellt sich ab (sonst liefe er die ganze Nacht)
  weg = true;
  takt.fn();
  assert.equal(c._planeT, null);
  assert.ok(uhrwerk.geloescht.includes(takt));
  // solange sie weg ist, stellt ihn nichts wieder an
  c._planeLoop();
  c._planeSnap();
  assert.equal(uhrwerk.gestellt.length, 1);
  assert.equal(c._planeT, null);
  // wieder da: _visSync ruft _planeSnap, das Flugzeug steht gleich richtig und der Takt läuft
  weg = false;
  c._planeSnap();
  assert.equal(uhrwerk.gestellt.length, 2);
  assert.equal(c._planeT, uhrwerk.gestellt[1]);
  assert.equal(c._planes.get('x1').snap, true);
  assert.match(String(P._visSync), /this\._planeSnap\(\)/);
  // ohne Flugzeuge wie bisher: Takt aus
  c._planes.clear();
  c._planeT.fn();
  assert.equal(c._planeT, null);
});

// ---------- 5 · toter Stil der alten Glühwürmchen ----------

test('Glühwürmchen: Der alte Stil und die sechs Platzhalter sind weg, die echten haben, was sie davon brauchten', () => {
  // weg: Regel für die Platzhalter, ihre Keyframes, die Klasse summer an der Szene
  assert.ok(!REGELN.some((r) => /^\.ff i$|\.summer\b/.test(r.sel)), 'alte Regel noch da');
  assert.ok(!KEYFRAMES.has('fly') && !KEYFRAMES.has('glow'), 'alte Keyframes noch da');
  assert.doesNotMatch(T.STYLES, /animation:[^;]*\b(fly|glow) /);
  for (const k of Object.getOwnPropertyNames(P)) {
    const d = Object.getOwnPropertyDescriptor(P, k);
    if (typeof d.value === 'function') assert.doesNotMatch(String(d.value), /['"]summer['"]/, `${k} setzt noch summer`);
  }
  // _build legt die Ebene leer an, _ffBuild füllt sie
  assert.match(String(P._build), /<div class="ff"><\/div>/);
  assert.match(String(P._ffBuild), /<i class="fl\$\{/);
  // Die Fliege am Häufchen (.fly) gibt es weiter
  assert.ok(REGELN.some((r) => r.sel === '.fly') && KEYFRAMES.has('buzz'));
  // Ein echtes Glühwürmchen: frei gesetzt (left/top wirken nur so), rund, schwebt und glimmt
  const sz = szene('night');
  const fl = neu(huelle(sz, 'div.ff.on'), 'i', 'fl', { style: '--fd:9.0s;--fdl:-3.00s;--fp:2.00s;--fpl:-1.00s' });
  const st = gilt(fl);
  assert.equal(st.get('position'), 'absolute');
  assert.equal(st.get('border-radius'), '50%');
  assert.deepEqual(endlos(fl).map((a) => a.split(' ')[0]), ['ff-drift', 'ff-pulse']);
  // Bewegung reduzieren: Es glimmt an seinem Platz
  assert.deepEqual(endlos(fl, { ruhig: true }).map((a) => a.split(' ')[0]), ['ff-pulse']);
});

// ---------- 6 · kleine Zustandslecks ----------

// Klassenliste eines Elements
const klassenliste = (init = '') => {
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

test('Schleife: „auch ohne passendes Wetter“ gilt nur für den Schritt, der es setzt, nicht für den Drachen danach', async () => {
  const S = { act: 'kite' };
  const log = [];
  const c = Object.create(P);
  Object.assign(c, {
    _g: {}, _el: { pika: { classList: klassenliste() } }, _lift: 0, _foods: [], _wx: {}, _asleep: false, _inside: false, _next: null,
    slot: null,
    _urlaubNext: () => null, _coffeeDue: () => false, _sleepTime: () => false, _slotArm() {}, _planWait: () => false,
    _friendUrgent: () => null, _slotNow: () => c.slot,
    _run: async (was) => log.push([was, c._forced]),
    _runSlot: async (s) => log.push([s.act, c._forced]),
  });
  // Häufchen, Tür, Fenster: _next ohne Berührung. Der Schritt läuft „erzwungen“ …
  for (const was of ['poop', 'sigDoor', 'winAuf']) {
    log.length = 0;
    c._next = was;
    c.slot = null;
    await c._step();
    assert.deepEqual(log, [[was, true]]);
    // … der nächste ist eine Beschäftigung aus dem Tagesplan: Sie richtet sich wieder nach dem Wind
    c.slot = S;
    await c._step();
    assert.deepEqual(log.at(-1), ['kite', false], `nach ${was} bleibt der Drachen erzwungen`);
  }
  // Die Vorschau („Drachen“ ohne Wind) erzwingt weiter, eine Berührung nicht
  c.slot = null;
  c._next = 'kite';
  await c._step();
  assert.deepEqual(log.at(-1), ['kite', true]);
  c._next = 'petReact';
  c._nextAt = Date.now();
  await c._step();
  assert.deepEqual(log.at(-1), ['petReact', false]);
  // Auch wer vorher abbiegt (herunter vom Stein), nimmt den Merker nicht mit
  c._forced = true;
  c._lift = 20;
  await c._step();
  assert.deepEqual(log.at(-1), ['hopDown', false]);
});

test('Urlaub: Ist er fort, steht er nicht mehr auf dem Stein (auch wenn der Abschied mitten im Sprung abbrach)', async () => {
  const karte = (mehr = {}) => {
    const c = Object.create(P);
    Object.assign(c, {
      _el: { pika: { classList: klassenliste('pika') }, psay: { classList: klassenliste('psay') } }, _g: { pW: 120 }, _W: 600, _x: 300,
      _lift: 34, _onHam: false, _asleep: false, _inside: false, _fort: false,
      _plan: { ur: { t: Date.now() - 1000, d: null } }, _haNow: () => Date.now(), _sleepTime: () => false,
      _face() {}, _say() {}, _jump() {}, _frName: () => 'Pino',
    }, mehr);
    return c;
  };
  // gleich weg (Neuladen mitten im Urlaub)
  const a = karte();
  a._urlaubWeg();
  assert.deepEqual([a._fort, a._lift], [true, 0]);
  assert.ok(a._el.pika.classList.contains('fort'));
  // Abschied vom Stein, im Sprung unterbrochen: _hopTo hat _lift noch nicht auf 0 gesetzt
  const b = karte({ _hopDown: async () => { throw new Error('unterbrochen'); } });
  await assert.rejects(() => b._urlAbreise(), /unterbrochen/);
  assert.deepEqual([b._fort, b._lift], [true, 0]);
  // ebenso aus der Hängematte
  const h = karte({ _onHam: true, _giftHamDown: async () => { throw new Error('unterbrochen'); } });
  await assert.rejects(() => h._urlAbreise(), /unterbrochen/);
  assert.deepEqual([h._fort, h._lift, h._onHam], [true, 0, false]);
});

test('Sprechblasen: Auf der hinteren Spur ist die Blase eines Freunds verkleinert, die Schrift bleibt trotzdem bei 10 px', () => {
  // Stil: .frsay wird dort um LANE_S verkleinert, die Untergrenze gleicht das aus
  const blase = (spur) => {
    const sw = neu(huelle(szene(), 'div.friends'), 'div', `frsay${spur ? ' lane1' : ''}`);
    return gilt(huelle(sw, 'div.anchor', 'div.bubble.say')).get('font-size');
  };
  const vorn = /^max\(([\d.]+)px, calc\(var\(--ph\) \* \.15\)\)$/.exec(blase(false));
  const hinten = /^max\(([\d.]+)px, calc\(var\(--ph\) \* \.15\)\)$/.exec(blase(true));
  assert.ok(vorn && hinten, `${blase(false)} / ${blase(true)}`);
  assert.equal(Number(vorn[1]), 10);
  assert.ok(Number(hinten[1]) * LANE_S >= 10 - 1e-9, `hinten ${hinten[1]} px × ${LANE_S} = ${Number(hinten[1]) * LANE_S} px`);
  assert.ok(Number(hinten[1]) * LANE_S <= 10.5, 'hinten größer als vorn');
  // Karte: _frSetX setzt die Spur auch an die Hülle der Blase
  const c = Object.create(P);
  Object.assign(c, { _cfg: { depth: true }, _H: 248, _W: 600, _g: { pW: 120 } });
  const teil = () => ({ style: {}, classList: klassenliste(), offsetWidth: 0 });
  const fr = { kind: 'katzumi', el: teil(), sw: teil(), say: teil(), x: 100, lift: 0, lane: 0 };
  fr.sw.classList.add('frsay');
  c._fr = fr;
  c._frSetX(fr, 200, 0, 'linear', 0, 1);
  assert.ok(fr.el.classList.contains('lane1') && fr.sw.classList.contains('lane1'), 'hintere Spur nicht an der Blase');
  assert.match(fr.sw.style.transform, new RegExp(`scale\\(${LANE_S.toFixed(3)}\\)`));
  assert.ok(fr.sw.style.transform.includes(`${(-248 * LANE_DY).toFixed(1)}px`));
  // zurück nach vorn, und auf dem Stein zählt die vordere Spur
  c._frSetX(fr, 200, 0, 'linear', 0, 0);
  assert.ok(!fr.sw.classList.contains('lane1') && !fr.el.classList.contains('lane1'));
  c._frSetX(fr, 200, 0, 'linear', 30, 1);
  assert.ok(!fr.sw.classList.contains('lane1'));
  // ohne depth gibt es keine hintere Spur
  c._cfg = {};
  c._frSetX(fr, 200, 0, 'linear', 0, 1);
  assert.ok(!fr.sw.classList.contains('lane1'));
});

// ---------- 6d · Geburtstagskuchen und Gießkanne ----------

// Maße der Bühne, gemessen in der Vorschau (preview.html): je Areal die Karte 600 × 248 und die schmale 380 × 184
const BUEHNEN = [
  ['huegel', 600, 248, { gy: 223.2, pW: 119, pH: 99.2, fMin: 0.431, fMax: 0.723, hole: { l: 70.2, r: 121, cx: 95.6, top: 161.2, lip: 216.3 }, rock: { l: 441.2, w: 148.8 }, bur: { l: -6.1, base: 109.3, u: 2.034 }, hayL: 182, hayR: 222.7 }],
  ['huegel', 380, 184, { gy: 165.6, pW: 88.3, pH: 73.6, fMin: 0.504, fMax: 0.669, hole: { l: 52.1, r: 89.8, cx: 70.9, top: 119.6, lip: 160.5 }, rock: { l: 259.6, w: 110.4 }, bur: { l: -4.5, base: 81.1, u: 1.509 }, hayL: 135, hayR: 165.2 }],
  ['fels', 600, 248, { gy: 223.2, pW: 119, pH: 99.2, fMin: 0.408, fMax: 0.723, hole: { l: 61.6, r: 99.1, cx: 80.4, top: 175, lip: 217 }, rock: { l: 441.2, w: 148.8 }, bur: { l: -8.9, base: 114.3, u: 1.786 }, hayL: 142.6, hayR: 211.1 }],
  ['fels', 380, 184, { gy: 165.6, pW: 88.3, pH: 73.6, fMin: 0.478, fMax: 0.669, hole: { l: 45.7, r: 73.5, cx: 59.6, top: 129.8, lip: 161 }, rock: { l: 259.6, w: 110.4 }, bur: { l: -6.6, base: 84.8, u: 1.325 }, hayL: 105.8, hayR: 156.6 }],
  ['stumpf', 600, 248, { gy: 223.2, pW: 119, pH: 99.2, fMin: 0.397, fMax: 0.723, hole: { l: 56.3, r: 92.9, cx: 74.6, top: 165.3, lip: 219.4 }, rock: { l: 441.2, w: 148.8 }, bur: { l: -4.8, base: 97.8, u: 1.587 }, hayL: 136.1, hayR: 204.6 }],
  ['stumpf', 380, 184, { gy: 165.6, pW: 88.3, pH: 73.6, fMin: 0.465, fMax: 0.669, hole: { l: 41.8, r: 68.9, cx: 55.3, top: 122.6, lip: 162.8 }, rock: { l: 259.6, w: 110.4 }, bur: { l: -3.5, base: 72.6, u: 1.178 }, hayL: 101, hayR: 151.8 }],
  ['alpin', 600, 248, { gy: 223.2, pW: 119, pH: 99.2, fMin: 0.422, fMax: 0.723, hole: { l: 65.8, r: 108.3, cx: 87, top: 172.9, lip: 214.1 }, rock: { l: 441.2, w: 148.8 }, bur: { l: -9.7, base: 107.1, u: 1.934 }, hayL: 150.8, hayR: 219.3 }],
  ['alpin', 380, 184, { gy: 165.6, pW: 88.3, pH: 73.6, fMin: 0.494, fMax: 0.669, hole: { l: 48.8, r: 80.4, cx: 64.6, top: 128.3, lip: 158.9 }, rock: { l: 259.6, w: 110.4 }, bur: { l: -7.2, base: 79.5, u: 1.435 }, hayL: 111.9, hayR: 162.7 }],
];
// Eine Schicht der Festdeko: merkt sich ihr HTML
const schicht = () => ({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] });
// Karte am Tag t mit Geburtstag (heute) auf einer der Bühnen; die Schätze sind echt gerechnet (_giftX, _sigBootSpot),
// ihre Elemente nur eine Liste (_gtEls: 6 ist die Gießkanne)
const festKarte = ([areal, W, H, g], t) => {
  const c = Object.create(P);
  const d = new Date(t);
  Object.assign(c, {
    _cfg: { festive: true, birthdays: [{ name: 'Mia', date: `${d.getMonth() + 1}-${d.getDate()}` }] }, _dbgDate: t, _W: W, _H: H, _Hs: H,
    _arealKey: areal, _areal: () => T.AREALE[areal], _windDir: 1, _g: g, _x: W / 2, _dir: 1,
    _el: { scene: { classList: klassenliste('scene day') }, pika: { classList: klassenliste('pika'), style: { setProperty() {} } }, friends: { classList: klassenliste() } },
    _festEls: { sky: schicht(), back: schicht(), on: schicht(), front: schicht(), cf: schicht(), light: schicht() },
    _festFwSync() {}, _urlaubFern: () => false, garderobe: 0,
    _sigWearSync() { this.garderobe++; },
  });
  c._festUpdate(true);
  return c;
};
const am = (mo, d, h = 12) => new Date(2026, mo - 1, d, h).getTime();
const ueberlappt = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]); // > 0: so viele px
const spanne = (p) => [p.l, p.l + p.w];
const px1 = (a) => a.map((v) => v.toFixed(1)).join(' … ');
// set hass ist durch: Was sich die Karte für „gleich danach“ vorgenommen hat (queueMicrotask), läuft
const nachSetHass = () => new Promise((r) => { setImmediate(r); });

test('Geburtstag im Advent: Steht die Gießkanne links der Tür, steht der Kuchen nicht auf ihr, und die Gummistiefel bleiben im Bild', async () => {
  // Die Kanne ist 0,085 H breit, wie die Karte es für den Kuchen annimmt
  assert.equal(new Map(regel('.gt-can').dekl).get('width'), 'calc(var(--H) * .085)');
  for (const B of BUEHNEN) {
    const [areal, W, H, g] = B;
    const wo = `${areal} ${W} × ${H}`;
    // 10. 12. 2026: Advent (Kranz rechts der Tür), kein Stiefel, kein Baum
    const c = festKarte(B, am(12, 10));
    assert.ok(c._fest.advent && c._fest.birthday && !c._fest.boot && !c._fest.xmas);
    const kanneX = c._giftX(6);
    assert.equal(kanneX, Math.max(H * 0.05, g.hole.l - H * 0.07), 'Schatz 6 ist nicht die Gießkanne');
    const kanne = [kanneX - H * 0.0425, kanneX + H * 0.0425];
    // ohne Kanne: der Kuchen links neben der Tür, in voller Größe (wie bisher) – genau dort stünde die Kanne
    const links = { ...c._festPos.cake };
    assert.ok(links.l >= 0 && links.l + links.w <= g.hole.l + H * 0.01 + 0.01, `${wo}: Kuchen ohne Kanne nicht links der Tür`);
    assert.ok(Math.abs(links.w - H * 0.14) < 0.01);
    assert.ok(ueberlappt(spanne(links), kanne) > H * 0.08, `${wo}: Kuchen und Kanne stünden gar nicht aufeinander`);
    // Die Kanne kommt dazu (ausgepackt, oder der Tagesplan kam nach der Deko): Der nächste Takt stellt den Kuchen um
    c._gtEls = new Map([[6, {}]]);
    c._festUpdate();
    const k = c._festPos.cake;
    assert.ok(ueberlappt(spanne(k), kanne) <= 0, `${wo}: Kuchen ${px1(spanne(k))} steht auf der Kanne ${px1(kanne)}`);
    assert.ok(ueberlappt(spanne(k), spanne(c._festPos.wreath)) <= 0, `${wo}: Kuchen steht im Adventskranz`);
    // auf der Wiese zwischen Heu und Stein, in voller Größe
    assert.ok(k.l >= g.hayR - 0.01 && k.l + k.w <= g.rock.l + 0.01, `${wo}: Kuchen ${px1(spanne(k))} nicht zwischen Heu und Stein`);
    assert.ok(Math.abs(k.w - H * 0.14) < 0.01, `${wo}: Kuchen verkleinert`);
    assert.match(c._festEls.front.innerHTML, new RegExp(`class="fi fcake" style="left:${k.l.toFixed(1)}px`));
    assert.equal(c.garderobe, 1, 'die Garderobe erfährt vom Umzug');
    // Regen ist gemeldet, die Gummistiefel stehen an der Tür: links neben der Kanne, im Bild, nicht im Kuchen
    const st = c._sigBootSpot();
    const stiefel = [st.left, st.left + st.w];
    assert.ok(st.left >= -2, `${wo}: Gummistiefel ragen ${(-st.left).toFixed(1)} px aus dem Bild`);
    assert.ok(ueberlappt(stiefel, kanne) <= 0 && ueberlappt(stiefel, spanne(k)) <= 0, `${wo}: Stiefel stehen auf Kanne oder Kuchen`);
    // ein weiterer Takt ändert nichts mehr
    const html = c._festEls.front.innerHTML;
    c._festUpdate();
    assert.equal(c._festEls.front.innerHTML, html);
    assert.equal(c.garderobe, 1);
    // Die Kanne ist wieder weg (Schätze abgeschaltet): Der Kuchen kommt an die Tür zurück, diesmal über set hass.
    // Dort läuft _hassFest vor dem Tagesplan (_hassPlan → _giftScene): Die Kanne verschwindet erst danach, nachgesehen
    // wird darum gleich nach dem ganzen Durchlauf.
    c._festCfg = c._cfg;
    c._hassFest({});
    c._gtEls = new Map();
    assert.equal(c._festEls.front.innerHTML, html, 'mitten in set hass wird nichts umgestellt');
    await nachSetHass();
    assert.deepEqual(spanne(c._festPos.cake), spanne(links), `${wo}: Kuchen nicht zurück an der Tür`);
    assert.equal(c.garderobe, 2);
    // … ebenso, wenn sie in set hass dazukommt
    c._hassFest({});
    c._hassFest({});
    c._gtEls = new Map([[6, {}]]);
    await nachSetHass();
    assert.deepEqual(spanne(c._festPos.cake), spanne(k), `${wo}: Kuchen nach set hass nicht auf der Wiese`);
    assert.equal(c.garderobe, 3);
    // … und ohne Anlass baut set hass nichts neu
    c._festEls.front.innerHTML = 'unberührt';
    c._hassFest({});
    await nachSetHass();
    assert.equal(c._festEls.front.innerHTML, 'unberührt');
  }
});

test('Geburtstag an Nikolaus und Heiligabend: Ist auch die Wiese besetzt, rückt der Kuchen links neben die Kanne', async () => {
  for (const B of BUEHNEN) {
    const [areal, W, H] = B;
    for (const [tag, t, was] of [['Nikolaus', am(12, 6), 'boot'], ['Heiligabend', am(12, 24), 'tree']]) {
      const wo = `${tag}, ${areal} ${W} × ${H}`;
      const c = festKarte(B, t);
      c._gtEls = new Map([[6, {}]]);
      c._festUpdate();
      const k = c._festPos.cake;
      const kanne = [c._giftX(6) - H * 0.0425, c._giftX(6) + H * 0.0425];
      assert.ok(c._festPos[was] && c._festPos.wreath, `${wo}: Stiefel bzw. Baum und Kranz fehlen`);
      // links der Kanne, höchstens einen Pixel in ihr (am Baumstumpf ist es am engsten), nicht unter 70 %
      assert.ok(k.l + k.w <= kanne[0] + 1, `${wo}: Kuchen ${px1(spanne(k))} steht auf der Kanne ${px1(kanne)}`);
      assert.ok(k.l >= 2, `${wo}: Kuchen ${px1(spanne(k))} ragt aus dem Bild`);
      assert.ok(k.w >= H * 0.14 * 0.7 - 0.01 && k.w <= H * 0.14 + 0.01);
      // nicht im Stiefel, nicht im Baum
      assert.ok(ueberlappt(spanne(k), spanne(c._festPos[was])) <= 0);
      // (Offen: Sind an diesen beiden Tagen auch noch Gummistiefel gemeldet, schiebt der Kuchen sie nach links aus
      // dem Bild, gemessen auf allen acht Bühnen −9 bis −15 px. Darum steht er sonst auf der Wiese, siehe oben.)
      assert.ok(c._sigBootSpot().left < 0);
      // und er bleibt dort (kein Hin und Her im Takt)
      const html = c._festEls.front.innerHTML;
      c._festUpdate();
      c._festCfg = c._cfg;
      c._hassFest({});
      await nachSetHass();
      assert.equal(c._festEls.front.innerHTML, html);
    }
  }
});

test('Geburtstag außerhalb des Advents: Der Kuchen steht rechts der Tür, die Gießkanne stört ihn nicht', async () => {
  const c = festKarte(BUEHNEN[0], am(6, 10));
  const vorher = { ...c._festPos.cake };
  assert.ok(vorher.l >= BUEHNEN[0][3].hole.r - 0.01);
  c._gtEls = new Map([[6, {}]]);
  c._festUpdate();
  c._festCfg = c._cfg;
  c._hassFest({});
  await nachSetHass();
  assert.deepEqual({ ...c._festPos.cake }, vorher);
  assert.equal(c.garderobe, 0);
});
