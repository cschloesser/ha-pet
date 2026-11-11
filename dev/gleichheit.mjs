// Gleichheitsbeweis für einen reinen Umzug: vergleicht die Karte eines alten Stands (eine Datei, eine IIFE) mit dem
// Bündel aus src/. Beide laufen durch denselben esbuild-Drucker, danach wird verglichen:
//   1. Zeilenbilanz: jede Zeile des alten Drucks steht genauso oft im neuen (Rest wird aufgelistet)
//   2. alle Namen der oberen Ebene: Werte gleich (Strings zeichengleich, Funktionen mit gleichem Quelltext)
//   3. die Klasse: gleiche Methoden, Setter, statische Methoden, gleicher Quelltext, gleiche Eigenschaften
//   4. Testexport, getConfigForm, getStubConfig, eine frisch erzeugte Instanz, was beim Laden passiert
//
//   node dev/gleichheit.mjs [git-stand]      Vorgabe d2f19de (0.32.0, die letzte Karte aus einer Datei)
//
// Ende mit Code 1 bei einer Abweichung. Gedacht für Commits, die nur umziehen (wie 0.33.0, der Schnitt in Module).
// Eine neue Versionsnummer gehört zu jedem Commit: Sie wird genannt und vom Vergleich ausgenommen.
// Verglichen wird Druck gegen Druck. Dass esbuilds Drucker selbst nichts verändert (er schreibt Strings mit
// doppelten Anführungszeichen, lässt Kommentare und überflüssige Klammern weg), prüft dieses Skript nicht.
// Erlaubt sind im neuen Druck nur die Pfadkommentare von esbuild, Kopf und Fuß der Klassenteile und der Zusammenbau
// in src/karte.js.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stand = process.argv[2] || 'd2f19de';
console.log(`Vergleich: ${stand}:pika-pet-card.js gegen src/ (esbuild ${esbuild.version})`);
const OPT = { bundle: true, format: 'iife', write: false, charset: 'utf8', target: 'esnext', treeShaking: false, legalComments: 'none', logLevel: 'silent' };
const bad = [];
const note = (s) => console.log(s);
const fail = (s) => { bad.push(s); console.log('ABWEICHUNG ' + s); };

// --- alter Stand: Hülle der IIFE abnehmen, damit esbuild die obere Ebene genauso behandelt wie die der Module
const alt = execFileSync('git', ['show', `${stand}:pika-pet-card.js`], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, '\n');
const aL = alt.split('\n');
const open = aL.findIndex((l) => l === '(() => {');
let end = aL.length - 1; while (aL[end] === '') end--;
if (open < 0 || aL[end] !== '})();') throw new Error('alte Datei: IIFE-Hülle nicht gefunden');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pika-gleichheit-'));
const tmp = path.join(tmpDir, 'alt-ohne-huelle.js');
fs.writeFileSync(tmp, aL.slice(open + 1, end).join('\n') + '\n');
let O = (await esbuild.build({ ...OPT, entryPoints: [tmp], absWorkingDir: tmpDir })).outputFiles[0].text;
fs.rmSync(tmpDir, { recursive: true, force: true });
const N = (await esbuild.build({ ...OPT, entryPoints: ['src/index.js'], absWorkingDir: repo })).outputFiles[0].text;
const version = (t) => /^  var VERSION = "([^"]*)";$/m.exec(t)?.[1];
if (version(O) !== version(N)) {
  note(`VERSION: alt ${version(O)}, neu ${version(N)} (vom Vergleich ausgenommen)`);
  O = O.replace(`  var VERSION = "${version(O)}";`, `  var VERSION = "${version(N)}";`);
}
const disk = fs.readFileSync(path.join(repo, 'pika-pet-card.js'), 'utf8').replace(/\r\n/g, '\n');
const diskBody = disk.slice(disk.indexOf('(() => {'));
if (diskBody !== N) fail('pika-pet-card.js im Repo ist nicht das Bündel aus src/ (ohne Kopfkommentar verglichen)');
else note('Bündel im Repo = Bau aus src/ (ohne Kopfkommentar): ja');
const headOld = aL.slice(0, open).join('\n'), headNew = disk.slice(0, disk.indexOf('(() => {')).replace(/\n$/, '');
if (headOld !== headNew) fail('Kopfkommentar weicht ab'); else note(`Kopfkommentar: gleich (${open} Zeilen)`);

// --- 1. Zeilenbilanz
const count = (t) => { const m = new Map(); for (const l of t.split('\n')) m.set(l, (m.get(l) || 0) + 1); return m; };
const cO = count(O), cN = count(N);
const onlyO = [], onlyN = [];
for (const [l, n] of cO) { const d = n - (cN.get(l) || 0); if (d > 0) onlyO.push([l, d]); }
for (const [l, n] of cN) { const d = n - (cO.get(l) || 0); if (d > 0) onlyN.push([l, d]); }
note(`\n1. Zeilen: alt ${O.split('\n').length}, neu ${N.split('\n').length}`);
note(`   nur im alten Druck: ${onlyO.reduce((a, [, d]) => a + d, 0)} Zeilen`);
for (const [l, d] of onlyO.slice(0, 40)) note(`     -${d}× ${l.slice(0, 140)}`);
note(`   nur im neuen Druck: ${onlyN.reduce((a, [, d]) => a + d, 0)} Zeilen in ${onlyN.length} Arten`);
for (const [l, d] of onlyN) note(`     +${d}× ${l.slice(0, 140)}`);
// erwartet im neuen: Pfadkommentare, Köpfe und Füße der Teile, Leerzeilen, der Zusammenbau
const okNew = (l) => l === '' || /^  \/\/ src\/[\w\/.-]+\.js$/.test(l) || /^  var [A-Z][A-Za-z0-9]* = class \{$/.test(l) || l === '  };'
  || /^  var TEILE = \[/.test(l) || /^    [A-Z][A-Za-z0-9]*,?$/.test(l) || l === '  ];' || /^  for \(const Teil of TEILE\) \{$/.test(l) || /^    for \(const k of Reflect\.ownKeys\(Teil(\.prototype)?\)\) \{$/.test(l)
  || /^      if \(k !== "constructor"\) Object\.defineProperty\(PikaPetCard\.prototype, k, Object\.getOwnPropertyDescriptor\(Teil\.prototype, k\)\);$/.test(l)
  || /^      if \(!\["length", "name", "prototype"\]\.includes\(k\)\) Object\.defineProperty\(PikaPetCard, k, Object\.getOwnPropertyDescriptor\(Teil, k\)\);$/.test(l)
  || l === '    }' || l === '  }';
for (const [l] of onlyO) if (!/^  \/\/ .*alt-ohne-huelle\.js$/.test(l)) fail('Zeile fehlt im neuen Druck: ' + l.slice(0, 160));
for (const [l] of onlyN) if (!okNew(l)) fail('unerwartete neue Zeile: ' + l.slice(0, 160));

// --- beide laden, mit einem Guckloch in die IIFE
const names = [...new Set([...O.matchAll(/^  var ([A-Za-z_$][\w$]*) = /gm)].map((m) => m[1]))];
const namesN = [...new Set([...N.matchAll(/^  var ([A-Za-z_$][\w$]*) = /gm)].map((m) => m[1]))];
const load = (code, label) => {
  const i = code.lastIndexOf('})();');
  const hooked = code.slice(0, i) + '  globalThis.__guck = (n) => eval(n);\n' + code.slice(i);
  const log = [];
  let T = null, defined = null;
  const ctx = {
    window: { matchMedia: () => ({ matches: false }), customCards: [] },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    HTMLElement: class { attachShadow() { return { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }; } addEventListener() {} },
    customElements: { get: () => null, define: (n, c) => { defined = [n, c]; } },
    console: { info: (...a) => log.push(['info', ...a]), log: (...a) => log.push(['log', ...a]), warn: (...a) => log.push(['warn', ...a]) },
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Date, Math, JSON, Promise, Intl, AbortController,
    __pikaTest: (x) => (T = x),
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(hooked, ctx, { filename: label });
  return { T, defined, log, ctx, guck: ctx.__guck };
};
const A = load(O, 'alt'), B = load(N, 'neu');

// Wert → vergleichbarer Text (Funktionen und Klassen mit Quelltext, Verweise auf schon Gesehenes als Pfad)
const ser = (v, seen = new Map(), p = '$') => {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'string') return JSON.stringify(v);
  if (t === 'number' || t === 'boolean' || t === 'undefined' || t === 'bigint') return String(v) + (Object.is(v, -0) ? '(-0)' : '');
  if (t === 'symbol') return v.toString();
  if (seen.has(v)) return '→' + seen.get(v);
  seen.set(v, p);
  if (t === 'function') {
    let s = 'ƒ' + Function.prototype.toString.call(v);
    const own = Reflect.ownKeys(v).filter((k) => !['length', 'name', 'prototype', 'arguments', 'caller'].includes(k));
    if (own.length) s += '{' + own.map((k) => String(k) + ':' + ser(v[k], seen, p + '.' + String(k))).join(',') + '}';
    if (v.prototype && Reflect.ownKeys(v.prototype).length > 1) s += '«' + Reflect.ownKeys(v.prototype).sort().map((k) => { const d = Object.getOwnPropertyDescriptor(v.prototype, k); return String(k) + ':' + ['value', 'get', 'set'].filter((x) => typeof d[x] === 'function' && k !== 'constructor').map((x) => x + Function.prototype.toString.call(d[x])).join('|'); }).join(',') + '»';
    return s;
  }
  const tag = Object.prototype.toString.call(v);
  if (tag === '[object RegExp]') return String(v);
  if (tag === '[object Date]') return 'Date(' + v.getTime() + ')';
  if (tag === '[object Map]') return 'Map[' + [...v].map(([k, x], i) => ser(k, seen, p + '#k' + i) + '=>' + ser(x, seen, p + '#v' + i)).join(',') + ']';
  if (tag === '[object Set]') return 'Set[' + [...v].map((x, i) => ser(x, seen, p + '#' + i)).join(',') + ']';
  if (Array.isArray(v)) return '[' + v.map((x, i) => ser(x, seen, p + '[' + i + ']')).join(',') + ']' + (Object.isFrozen(v) ? '❄' : '');
  return '{' + Reflect.ownKeys(v).map((k) => {
    const d = Object.getOwnPropertyDescriptor(v, k);
    return String(k) + ':' + ('value' in d ? ser(d.value, seen, p + '.' + String(k)) : 'acc(' + ser(d.get, seen, p + '.get ' + String(k)) + ',' + ser(d.set, seen, p + '.set ' + String(k)) + ')');
  }).join(',') + '}' + (Object.isFrozen(v) ? '❄' : '');
};
const firstDiff = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return `ab Zeichen ${i}: alt „${a.slice(i, i + 80)}“ neu „${b.slice(i, i + 80)}“`; };

// --- 2. Namen der oberen Ebene
note(`\n2. Namen der oberen Ebene: alt ${names.length}, neu ${namesN.length}`);
const extra = namesN.filter((n) => !names.includes(n));
note(`   nur neu (${extra.length}): ${extra.join(', ')}`);
for (const n of names) if (!namesN.includes(n)) fail(`Name fehlt im neuen Bündel: ${n}`);
let same = 0, strs = 0, fns = 0, chars = 0;
const styles = [];
for (const n of names) {
  if (n === 'PikaPetCard') continue;
  let a, b;
  try { a = A.guck(n); } catch (e) { fail(`alt: ${n} nicht lesbar (${e.message})`); continue; }
  try { b = B.guck(n); } catch (e) { fail(`neu: ${n} nicht lesbar (${e.message})`); continue; }
  const sa = ser(a), sb = ser(b);
  if (sa !== sb) { fail(`${n} weicht ab, ${firstDiff(sa, sb)}`); continue; }
  same++;
  if (typeof a === 'string') { strs++; chars += a.length; if (/^STYLE/.test(n)) styles.push(`${n} ${a.length}`); }
  if (typeof a === 'function') fns++;
}
note(`   gleich: ${same} von ${names.length - 1} (davon ${fns} Funktionen, ${strs} Strings mit zusammen ${chars} Zeichen)`);
note(`   Stil-Strings zeichengleich: ${styles.join(', ')}`);
for (const ex of ['STYLE + STYLE_SKY + STYLE_FEST + STYLE_FRIEND + STYLE_BOTE + STYLE_COFFEE + STYLE_ACT + STYLE_GIFT + STYLE_DIARY_BTN', 'STYLE_DIARY']) {
  const a = A.guck(ex), b = B.guck(ex);
  if (a !== b) fail(`Stil zusammengesetzt weicht ab: ${ex}`); else note(`   Stil in Reihenfolge der Karte (${ex.split(' + ').length} Blöcke): zeichengleich, ${a.length} Zeichen`);
}

// --- 3. die Klasse
const KA = A.defined?.[1], KB = B.defined?.[1];
note('\n3. Klasse');
if (!KA || !KB) fail('customElements.define wurde nicht aufgerufen');
else {
  if (A.defined[0] !== B.defined[0]) fail('Elementname weicht ab');
  if (KA.name !== KB.name) fail(`Klassenname: ${KA.name} / ${KB.name}`);
  if (Object.getPrototypeOf(KA) !== A.ctx.HTMLElement || Object.getPrototypeOf(KB) !== B.ctx.HTMLElement) fail('Klasse erbt nicht von HTMLElement');
  if (Object.getPrototypeOf(KB.prototype) !== B.ctx.HTMLElement.prototype) fail('Prototypkette weicht ab');
  for (const [what, a, b] of [['Methode', KA.prototype, KB.prototype], ['statisch', KA, KB]]) {
    const ka = Reflect.ownKeys(a).map(String), kb = Reflect.ownKeys(b).map(String);
    for (const k of ka) if (!kb.includes(k)) fail(`${what} fehlt neu: ${k}`);
    for (const k of kb) if (!ka.includes(k)) fail(`${what} nur neu: ${k}`);
    let n = 0, len = 0;
    for (const k of ka) {
      if (!kb.includes(k)) continue;
      if (what === 'statisch' && k === 'prototype') { n++; continue; } // der Prototyp ist oben Methode für Methode verglichen
      const da = Object.getOwnPropertyDescriptor(a, k), db = Object.getOwnPropertyDescriptor(b, k);
      const flags = (d) => ['enumerable', 'configurable', 'writable'].map((f) => f + '=' + d[f]).join(' ') + ' ' + ['value', 'get', 'set'].filter((x) => x in d).map((x) => x + ':' + typeof d[x]).join(' ');
      if (flags(da) !== flags(db)) { fail(`${what} ${k}: Eigenschaften ${flags(da)} / ${flags(db)}`); continue; }
      let ok = true;
      for (const x of ['value', 'get', 'set']) {
        if (typeof da[x] === 'function') {
          if (what === 'statisch' && k === 'prototype') continue;
          const sa = Function.prototype.toString.call(da[x]), sb = Function.prototype.toString.call(db[x]);
          if (k === 'constructor' && what === 'Methode') continue; // die Klasse selbst, unten über den Konstruktor-Quelltext
          if (sa !== sb) { ok = false; fail(`${what} ${k} (${x}): Quelltext weicht ab, ${firstDiff(sa, sb)}`); } else len += sa.length;
          if (da[x].name !== db[x].name || da[x].length !== db[x].length) { ok = false; fail(`${what} ${k}: name/length weicht ab`); }
        } else if (x in da && ser(da[x]) !== ser(db[x])) { ok = false; fail(`${what} ${k}: Wert weicht ab`); }
      }
      if (ok) n++;
    }
    note(`   ${what}: alt ${ka.length}, neu ${kb.length}, gleich ${n} (Quelltext zusammen ${len} Zeichen)`);
    const ord = ka.join(',') === kb.join(',');
    note(`   Reihenfolge der Namen ${what === 'Methode' ? 'am Prototyp' : 'an der Klasse'}: ${ord ? 'gleich' : 'anders (alt: Reihenfolge der Datei, neu: Kern zuerst, dann die Teile)'}`);
  }
  // Konstruktor: Quelltext der Klasse im neuen Bündel enthält nur den Kern; den constructor-Rumpf herausschneiden
  const ctor = (K) => { const s = Function.prototype.toString.call(K); const i = s.indexOf('    constructor('); const j = s.indexOf('\n    }', i); return i < 0 ? null : s.slice(i, j + 6); };
  if (!ctor(KA) || ctor(KA) !== ctor(KB)) fail('constructor weicht ab'); else note(`   constructor: gleich (${ctor(KA).length} Zeichen)`);
  // 4. Aufrufe
  note('\n4. Aufrufe und Laden');
  for (const f of ['getConfigForm', 'getStubConfig']) {
    const a = ser(KA[f]()), b = ser(KB[f]());
    if (a !== b) fail(`${f}() weicht ab, ${firstDiff(a, b)}`); else note(`   ${f}(): gleich (${a.length} Zeichen)`);
  }
  try {
    const ia = new KA(), ib = new KB();
    const a = ser(ia), b = ser(ib);
    if (a !== b) fail(`frische Instanz weicht ab, ${firstDiff(a, b)}`); else note(`   new PikaPetCard(): gleiche ${Reflect.ownKeys(ia).length} Felder mit gleichen Werten`);
  } catch (e) { fail('new PikaPetCard() mit den Attrappen nicht möglich: ' + e.message); }
}
const ta = Object.keys(A.T || {}), tb = Object.keys(B.T || {});
if (ta.join() !== tb.join()) fail('Testexport: Schlüssel weichen ab');
let tn = 0;
for (const k of ta) { if (k === 'PikaPetCard') { if (B.T[k] !== KB) fail('Testexport: PikaPetCard ist nicht die Klasse'); else tn++; continue; } const a = ser(A.T[k]), b = ser(B.T[k]); if (a !== b) fail(`Testexport ${k} weicht ab`); else tn++; }
note(`   Testexport: ${ta.length} Schlüssel, gleich ${tn}`);
const la = ser(A.log), lb = ser(B.log);
if (la !== lb) fail('Konsole beim Laden weicht ab'); else note(`   Konsole beim Laden: gleich (${A.log.length} Zeile)`);
const ca = ser(A.ctx.window.customCards), cb = ser(B.ctx.window.customCards);
if (ca !== cb) fail('window.customCards weicht ab'); else note('   window.customCards: gleich');

note(bad.length ? `\n${bad.length} ABWEICHUNGEN` : '\nKeine Abweichung.');
process.exit(bad.length ? 1 : 0);
