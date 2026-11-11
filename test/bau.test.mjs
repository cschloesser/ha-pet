// Tests für den Bau (dev/build.mjs): Die Datei im Wurzelverzeichnis ist das Bündel aus src/, und die Prüfung der
// Klassenteile lässt keine doppelten Namen durch. node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { baue, pruefeTeile, kopfVon, ZIEL } from '../dev/build.mjs';

const lf = (t) => t.replace(/\r\n/g, '\n');

test('Bündel: pika-pet-card.js im Wurzelverzeichnis ist der aktuelle Bau aus src/', async () => {
  const neu = await baue();
  const alt = lf(fs.readFileSync(ZIEL, 'utf8'));
  // kein assert.equal auf den ganzen Text: Die Meldung wäre ein Megabyte lang
  assert.ok(alt === neu, 'pika-pet-card.js ist veraltet oder von Hand geändert: "node dev/build.mjs" ausführen und die Datei mit committen');
});

test('Bündel: Kopfkommentar und VERSION stehen lesbar in der gebauten Datei', () => {
  const alt = lf(fs.readFileSync(ZIEL, 'utf8'));
  const index = lf(fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8'));
  const kopf = kopfVon(index);
  assert.ok(kopf.includes('Pika Pet Card') && kopf.includes('type: custom:pika-pet-card'));
  assert.ok(alt.startsWith(kopf + '\n(() => {\n'), 'die Datei beginnt mit dem Kopfkommentar, dann die IIFE');
  const version = /const VERSION = '(\d+\.\d+\.\d+)';/.exec(fs.readFileSync(new URL('../src/version.js', import.meta.url), 'utf8'))?.[1];
  assert.ok(version, 'src/version.js nennt die Version');
  assert.ok(alt.includes(`var VERSION = "${version}";`), 'VERSION steht im Bündel');
  assert.ok(alt.split('\n').length > 5000, 'nicht verkleinert: viele Zeilen');
  assert.throws(() => kopfVon('const a = 1;'), /Kopfkommentar/);
});

// kleine Karte aus Kern und Teilen
const KERN = (teile, rumpf = 'constructor() { super(); this._n = 0; }') => `
import { A } from './karte/a.js';
class PikaPetCard extends HTMLElement {
  ${rumpf}
}
const TEILE = [${teile}];
export { PikaPetCard };`;
const teil = (name, rumpf) => `export class ${name} {\n${rumpf}\n}`;
const pruefe = (kern, teile) => pruefeTeile({ 'src/karte.js': kern, ...Object.fromEntries(Object.entries(teile).map(([k, v]) => [`src/karte/${k}.js`, v])) });

test('Klassenteile: verschiedene Namen, Paar aus get und set, static neben gleichnamiger Methode sind in Ordnung', () => {
  const f = pruefe(KERN('A, B', 'constructor() { super(); this._n = 0; }\n  set hass(h) { this._hass = h; }\n  get hass() { return this._hass; }'), {
    a: teil('A', '  _wetter() { this._n += 1; this.hass = null; }\n  static form() { return 1; }\n  form() { return 2; }'),
    b: teil('B', '  async _besuch() { const [a, b] = [1, 2]; this._a = a; }'),
  });
  assert.deepEqual(f, []);
});

test('Klassenteile: derselbe Methodenname in zwei Teilen oder zweimal in einem bricht den Bau ab', () => {
  const zwei = pruefe(KERN('A, B'), { a: teil('A', '  _tick() {}'), b: teil('B', '  _tick() {}') });
  assert.equal(zwei.length, 1);
  assert.match(zwei[0], /_tick ist 2-mal definiert: src\/karte\/a\.js:2, src\/karte\/b\.js:2/);
  const mitKern = pruefe(KERN('A', 'constructor() { super(); }\n  _tick() {}'), { a: teil('A', '  _tick() {}') });
  assert.match(mitKern[0], /_tick ist 2-mal definiert/);
  const einer = pruefe(KERN('A'), { a: teil('A', '  _tick() {}\n  _tick() {}') });
  assert.match(einer[0], /_tick ist 2-mal definiert/);
  const statisch = pruefe(KERN('A, B'), { a: teil('A', '  static form() {}'), b: teil('B', '  static form() {}') });
  assert.match(statisch[0], /static form ist 2-mal definiert/);
  // get und set desselben Namens in zwei verschiedenen Teilen sind kein Paar: Das zweite ersetzte das erste
  const halb = pruefe(KERN('A, B'), { a: teil('A', '  get wert() { return 1; }'), b: teil('B', '  set wert(v) {}') });
  assert.match(halb[0], /wert ist 2-mal definiert/);
});

test('Klassenteile: ein Feld, das eine Methode überdeckt, bricht den Bau ab (wie _boteEnd in 0.29)', () => {
  const f = pruefe(KERN('A, B'), {
    a: teil('A', '  _boteEnd() { return 1; }'),
    b: teil('B', '  _boteRead() {\n    const run = () => { this._boteEnd = Date.now(); };\n    run();\n  }'),
  });
  assert.equal(f.length, 1);
  assert.match(f[0], /Feld this\._boteEnd \(src\/karte\/b\.js:3\) überdeckt die Methode _boteEnd \(src\/karte\/a\.js:2\)/);
  // auch im constructor des Kerns, als Zähler, im Muster und als Klassenfeld
  assert.match(pruefe(KERN('A', 'constructor() { super(); this._tick = 0; }'), { a: teil('A', '  _tick() {}') })[0], /Feld this\._tick/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _tick() {}\n  _los() { this._tick++; }') })[0], /Feld this\._tick/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _tick() {}\n  _los() { [this._x, this._tick] = [1, 2]; }') })[0], /Feld this\._tick/);
  assert.match(pruefe(KERN('A', '_tick = 0;\n  constructor() { super(); }'), { a: teil('A', '  _tick() {}') })[0], /Feld this\._tick/);
  // auch über einen festen Schlüssel, als Laufvariable, im Vorgabewert eines Parameters und in einem Klassenfeld
  assert.match(pruefe(KERN('A'), { a: teil('A', "  _tick() {}\n  _los() { this['_tick'] = 1; }") })[0], /Feld this\._tick/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _tick() {}\n  _los() { for (this._tick of [1]) ; }') })[0], /Feld this\._tick/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _tick() {}\n  _los(a = (this._tick = 1)) {}') })[0], /Feld this\._tick/);
  assert.match(pruefe(KERN('A', '_los = () => { this._tick = 1; };\n  constructor() { super(); }'), { a: teil('A', '  _tick() {}') })[0], /Feld this\._tick/);
  // gewollte Überdeckung (so legt _festForce einen Schritt über _step): ausgenommen nur für das genannte Modul
  const quellen = {
    'src/karte.js': KERN('A, B'),
    'src/karte/a.js': teil('A', '  _step() {}\n  _force() { this._step = () => { delete this._step; }; }'),
    'src/karte/b.js': teil('B', '  _b() {}'),
  };
  assert.match(pruefeTeile(quellen)[0], /Feld this\._step/);
  assert.deepEqual(pruefeTeile(quellen, { gewollt: { _step: 'src/karte/a.js' } }), []);
  quellen['src/karte/b.js'] = teil('B', '  _b() { this._step = 5; }');
  assert.match(pruefeTeile(quellen, { gewollt: { _step: 'src/karte/a.js' } })[0], /Feld this\._step \(src\/karte\/b\.js:2\)/);
  // this in einer eingeschachtelten function ist nicht die Karte; ein Setter darf beschrieben werden
  assert.deepEqual(pruefe(KERN('A'), { a: teil('A', '  _tick() {}\n  _los() { const o = { f: function () { this._tick = 1; } }; return o; }') }), []);
  assert.deepEqual(pruefe(KERN('A', 'constructor() { super(); }\n  set hass(h) {}'), { a: teil('A', '  _los() { this.hass = 1; }') }), []);
});

test('Klassenteile: ein Teil ohne Eintrag in TEILE, mit constructor, extends, super oder Klassenfeld fällt auf', () => {
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _a() {}'), b: teil('B', '  _b() {}') })[0], /B steht nicht in TEILE/);
  assert.match(pruefe(KERN('A, C'), { a: teil('A', '  _a() {}') })[0], /TEILE nennt C/);
  assert.match(pruefe(KERN('A, A'), { a: teil('A', '  _a() {}') })[0], /doppelt/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  constructor() {}\n  _a() {}') })[0], /constructor in einem Teil/);
  assert.match(pruefe(KERN('A'), { a: 'export class A extends Object {\n  _a() {}\n}' })[0], /erbt/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _a() { return super.toString(); }') })[0], /benutzt super/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _n = 0;\n  _a() {}') })[0], /Klassenfeld _n in einem Teil/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _a() {}') + '\nexport class Zwei {}' })[0], /genau eine Klasse/);
  assert.match(pruefe(KERN('A'), { a: 'export class A {\n  _a() {\n}' })[0], /nicht lesbar/);
  // Modul kopiert, Klasse nicht umbenannt: Der zweite Teil ginge unter. Eine Klasse ohne Namen lässt sich nicht eintragen.
  assert.match(pruefe(KERN('A'), { a: teil('A', '  _a() {}'), b: teil('A', '  _b() {}') })[0], /die Klasse A gibt es schon in src\/karte\/a\.js/);
  assert.match(pruefe(KERN('A'), { a: teil('A', '  get wert() { return 1; }'), b: teil('A', '  set wert(v) {}') }).join('\n'), /wert ist 2-mal definiert/);
  assert.match(pruefe(KERN('A'), { a: 'export default class {\n  _a() {}\n}' })[0], /braucht einen Namen/);
  assert.match(pruefeTeile({ 'src/karte.js': 'class PikaPetCard extends HTMLElement {}' })[0], /TEILE fehlt/);
});
