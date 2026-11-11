// Baut pika-pet-card.js im Wurzelverzeichnis aus den Modulen unter src/: esbuild, eine IIFE, nicht verkleinert.
//   node dev/build.mjs             bauen und schreiben
//   node dev/build.mjs --pruefen   nur vergleichen; Code 1, wenn die Datei im Wurzelverzeichnis nicht dem Bau entspricht
// Vor dem Bündeln werden die Teile der Klasse geprüft (pruefeTeile): Bei doppelten Namen bricht der Bau ab.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ZIEL = path.join(ROOT, 'pika-pet-card.js');
const KERN = 'src/karte.js';
const TEILE_DIR = 'src/karte';
// Felder, die eine Methode mit Absicht überdecken, mit dem Modul, das es tun darf. _step: _festForce (Feste) legt
// für genau einen Schritt der Lebensschleife eine eigene Funktion über die Methode und löscht sie darin wieder.
const GEWOLLT = { _step: 'src/karte/feste.js' };

const lf = (t) => t.replace(/\r\n/g, '\n');
const lies = (rel) => lf(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// Alle Kindknoten eines ESTree-Knotens
const kinder = (n) => Object.keys(n).flatMap((k) => (k === 'loc' ? [] : [n[k]].flat())).filter((c) => c && typeof c.type === 'string');

// Namen, die eine Methode über `this.x = …`, `this['x'] = …`, `this.x += …`, `this.x++`, `[this.x, this.y] = …` oder
// `for (this.x of …)` setzt. `this` in einer eingeschachtelten function oder Klasse ist ein anderes Objekt und zählt
// nicht, in Pfeilfunktionen schon. Nicht erkannt wird, was erst zur Laufzeit feststeht: `Object.assign(this, …)`,
// `this[name] = …`, ein Umweg über `const me = this` oder eine Hilfsfunktion, die die Karte als Argument bekommt.
const felderIn = (knoten, gefunden) => {
  const ziel = (z) => {
    if (!z) return;
    if (z.type === 'MemberExpression') {
      if (z.object.type !== 'ThisExpression') return;
      if (!z.computed && z.property.type === 'Identifier') gefunden.push({ name: z.property.name, zeile: z.loc.start.line });
      else if (z.computed && z.property.type === 'Literal') gefunden.push({ name: String(z.property.value), zeile: z.loc.start.line });
    } else if (z.type === 'ArrayPattern') z.elements.forEach(ziel);
    else if (z.type === 'ObjectPattern') z.properties.forEach((p) => ziel(p.value || p.argument));
    else if (z.type === 'AssignmentPattern') ziel(z.left);
    else if (z.type === 'RestElement') ziel(z.argument);
  };
  const lauf = (n) => {
    if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration' || n.type === 'ClassExpression' || n.type === 'ClassDeclaration') return;
    if (n.type === 'AssignmentExpression') ziel(n.left);
    if (n.type === 'UpdateExpression') ziel(n.argument);
    if (n.type === 'ForInStatement' || n.type === 'ForOfStatement') ziel(n.left);
    kinder(n).forEach(lauf);
  };
  // eine Methode selbst (FunctionExpression): Parameter mit ihren Vorgabewerten und Rumpf
  if (knoten.type === 'FunctionExpression') [...knoten.params, knoten.body].forEach(lauf);
  else lauf(knoten);
};
const hatSuper = (n) => n.type === 'Super' || (n.type !== 'ClassExpression' && n.type !== 'ClassDeclaration' && kinder(n).some(hatSuper));

// Prüft die Teile der Klasse. quellen: { 'src/karte.js': Quelltext, 'src/karte/wetter.js': Quelltext, … }, der Kern
// (kern) enthält die Klasse selbst und die Liste TEILE. Gibt die Fehler als Texte zurück, leer = in Ordnung.
//   - kein Methodenname zweimal (über alle Teile hinweg; get und set desselben Namens in einem Modul sind ein Paar)
//   - kein Feld `this._x`, das eine Methode `_x` überdeckt (die Methode wäre für diese Instanz weg); ausgenommen
//     ist, was in gewollt steht: { Name: Modul, das ihn setzen darf }. Was felderIn nicht sieht, steht dort.
//   - jedes Modul unter karte/ liefert genau eine Klasse mit eigenem Namen, ohne constructor, extends, super und
//     Klassenfelder, und jede steht in TEILE (sonst würde sie stillschweigend nicht angehängt)
export const pruefeTeile = (quellen, { kern = KERN, gewollt = {} } = {}) => {
  const fehler = [];
  const mitglieder = new Map(); // "static name" | "name" → [{ art, datei, zeile }]
  const felder = [];
  const teilKlassen = new Map(); // Klassenname → Datei
  let liste = null;
  for (const [datei, text] of Object.entries(quellen)) {
    let ast;
    try {
      ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    } catch (e) {
      fehler.push(`${datei}: nicht lesbar (${e.message})`);
      continue;
    }
    const istKern = datei === kern;
    const klassen = [];
    for (let st of ast.body) {
      if ((st.type === 'ExportNamedDeclaration' || st.type === 'ExportDefaultDeclaration') && st.declaration) st = st.declaration;
      if (st.type === 'ClassDeclaration') klassen.push(st);
      if (istKern && st.type === 'VariableDeclaration') {
        for (const d of st.declarations) {
          if (d.id.name === 'TEILE' && d.init?.type === 'ArrayExpression') liste = d.init.elements.map((e) => e?.name);
        }
      }
    }
    if (klassen.length !== 1) {
      fehler.push(`${datei}: genau eine Klasse erwartet, gefunden ${klassen.length}`);
      continue;
    }
    const k = klassen[0];
    if (!k.id) {
      fehler.push(`${datei}: die Klasse braucht einen Namen (export class <Name>)`);
      continue;
    }
    if (!istKern) {
      if (teilKlassen.has(k.id.name)) fehler.push(`${datei}: die Klasse ${k.id.name} gibt es schon in ${teilKlassen.get(k.id.name)}; eine der beiden würde nicht angehängt`);
      else teilKlassen.set(k.id.name, datei);
      if (k.superClass) fehler.push(`${datei}: ${k.id.name} erbt (extends); ein Teil hat keine eigene Elternklasse`);
    }
    for (const m of k.body.body) {
      const zeile = m.loc.start.line;
      if (m.type === 'StaticBlock') {
        fehler.push(`${datei}:${zeile}: static-Block; der liefe am Teil, nicht an der Karte`);
        continue;
      }
      if (m.computed || !(m.key.type === 'Identifier' || m.key.type === 'Literal')) {
        fehler.push(`${datei}:${zeile}: berechneter oder privater Name, nicht prüfbar`);
        continue;
      }
      const name = String(m.key.name ?? m.key.value);
      if (m.type === 'PropertyDefinition') {
        if (!istKern) fehler.push(`${datei}:${zeile}: Klassenfeld ${name} in einem Teil; es würde nie angelegt (Felder gehören in den constructor in ${kern})`);
        else if (!m.static) felder.push({ name, datei, zeile });
        if (m.value && !m.static) {
          const gef = [];
          felderIn(m.value, gef);
          for (const f of gef) felder.push({ ...f, datei });
        }
        continue;
      }
      if (m.kind === 'constructor') {
        if (!istKern) fehler.push(`${datei}:${zeile}: constructor in einem Teil; er liefe nie`);
      } else {
        const key = (m.static ? 'static ' : '') + name;
        if (!mitglieder.has(key)) mitglieder.set(key, []);
        mitglieder.get(key).push({ art: m.kind, datei, zeile });
      }
      if (!istKern && hatSuper(m.value)) fehler.push(`${datei}:${zeile}: ${name} benutzt super; das gibt es in einem Teil nicht`);
      if (!m.static) {
        const gef = [];
        felderIn(m.value, gef);
        for (const f of gef) felder.push({ ...f, datei });
      }
    }
  }
  for (const [key, defs] of mitglieder) {
    const paar = defs.length === 2 && defs[0].datei === defs[1].datei && defs.map((d) => d.art).sort().join() === 'get,set';
    if (defs.length > 1 && !paar) fehler.push(`${key} ist ${defs.length}-mal definiert: ${defs.map((d) => `${d.datei}:${d.zeile}`).join(', ')}`);
  }
  const gemeldet = new Set();
  for (const f of felder) {
    const defs = mitglieder.get(f.name);
    if (!defs || defs.some((d) => d.art === 'set') || gemeldet.has(f.name) || gewollt[f.name] === f.datei) continue;
    gemeldet.add(f.name);
    fehler.push(`Feld this.${f.name} (${f.datei}:${f.zeile}) überdeckt die Methode ${f.name} (${defs[0].datei}:${defs[0].zeile})`);
  }
  if (!(kern in quellen)) fehler.push(`${kern} fehlt`);
  else if (!liste) fehler.push(`${kern}: die Liste TEILE fehlt`);
  else {
    for (const [name, datei] of teilKlassen) if (!liste.includes(name)) fehler.push(`${datei}: ${name} steht nicht in TEILE (${kern}) und würde nicht angehängt`);
    for (const name of liste) if (!teilKlassen.has(name)) fehler.push(`${kern}: TEILE nennt ${name}, dazu gibt es kein Modul unter karte/`);
    if (new Set(liste).size !== liste.length) fehler.push(`${kern}: TEILE nennt einen Teil doppelt`);
  }
  return fehler;
};

// Der Kopfkommentar von src/index.js steht unverändert am Anfang der gebauten Datei (esbuild ließe ihn sonst weg),
// samt der Leerzeile davor, mit der die Datei seit jeher beginnt
export const kopfVon = (index) => {
  const m = /^\s*\/\*[\s\S]*?\*\//.exec(index);
  if (!m) throw new Error('src/index.js beginnt nicht mit dem Kopfkommentar /* … */');
  return m[0];
};

// Baut das Bündel und gibt es als Text zurück, ohne etwas zu schreiben. Wirft bei doppelten Namen oder Baufehlern.
export const baue = async () => {
  const quellen = { [KERN]: lies(KERN) };
  for (const f of fs.readdirSync(path.join(ROOT, TEILE_DIR)).filter((f) => f.endsWith('.js')).sort()) quellen[`${TEILE_DIR}/${f}`] = lies(`${TEILE_DIR}/${f}`);
  const fehler = pruefeTeile(quellen, { gewollt: GEWOLLT });
  if (fehler.length) throw new Error(`Bau abgebrochen, die Teile der Klasse passen nicht zusammen:\n  ${fehler.join('\n  ')}`);
  const r = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'iife',
    target: 'esnext',
    charset: 'utf8',
    treeShaking: false,
    legalComments: 'none',
    banner: { js: kopfVon(lies('src/index.js')) },
    write: false,
    logLevel: 'silent',
  });
  if (r.warnings.length) {
    const texte = await esbuild.formatMessages(r.warnings, { kind: 'warning', color: false });
    throw new Error(`Bau abgebrochen, esbuild warnt:\n${texte.join('\n')}`);
  }
  return r.outputFiles[0].text;
};

// Baut und schreibt die Datei im Wurzelverzeichnis (nur wenn sie sich ändert). Gibt zurück, ob geschrieben wurde.
export const schreibe = async () => {
  const neu = await baue();
  const alt = fs.existsSync(ZIEL) ? lf(fs.readFileSync(ZIEL, 'utf8')) : null;
  if (alt === neu) return false;
  fs.writeFileSync(ZIEL, neu);
  return true;
};

// Direkt aufgerufen (node dev/build.mjs), nicht importiert? Über die echten Pfade verglichen, damit es auch stimmt,
// wenn das Repo über eine Verknüpfung erreicht wird.
const direkt = () => {
  try {
    return path.relative(fs.realpathSync.native(process.argv[1]), fs.realpathSync.native(fileURLToPath(import.meta.url))) === '';
  } catch {
    return false;
  }
};
if (direkt()) {
  try {
    if (process.argv.includes('--pruefen')) {
      const neu = await baue();
      const alt = fs.existsSync(ZIEL) ? lf(fs.readFileSync(ZIEL, 'utf8')) : null;
      if (alt !== neu) {
        console.error('pika-pet-card.js entspricht nicht dem Bau aus src/. Bitte "node dev/build.mjs" ausführen.');
        process.exit(1);
      }
      console.log('pika-pet-card.js ist aktuell.');
    } else {
      const geschrieben = await schreibe();
      const kb = Math.round(fs.statSync(ZIEL).size / 1000);
      console.log(geschrieben ? `pika-pet-card.js gebaut (${kb} kB)` : `pika-pet-card.js war schon aktuell (${kb} kB)`);
    }
  } catch (e) {
    console.error(e.errors ? (await esbuild.formatMessages(e.errors, { kind: 'error', color: false })).join('\n') : e.message);
    process.exit(1);
  }
}
