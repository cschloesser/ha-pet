// Minimaler statischer Server für die Vorschau: node serve.mjs <ordner> <port>
// Lauscht nur auf localhost und liefert nur Dateien innerhalb von <ordner> (ohne .git).
// Beim Start und vor jeder Auslieferung von pika-pet-card.js wird die Karte aus src/ neu gebaut, wenn sich dort
// etwas geändert hat (dev/build.mjs): Modul speichern, Vorschau neu laden, fertig.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8765);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };

// Ohne "npm install" (esbuild, acorn) gibt es keinen Bau: Dann liefert der Server die Dateien aus, wie sie sind.
let bau = null;
try {
  bau = await import('./build.mjs');
} catch (e) {
  console.error(`Kein Bau (${e.code || e.message}): pika-pet-card.js wird ausgeliefert, wie sie ist. Bitte einmal "npm install" ausführen.`);
}

// Bau: nur wenn eine Datei unter src/ jünger ist als der letzte Bau (wer Module löscht oder mit altem Datum
// hineinkopiert, baut mit "node dev/build.mjs"). Ein Baufehler landet im Terminal und, statt einer veralteten
// Karte, als Meldung in der Konsole der Vorschau.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
let gebaut = 0;
let fehler = null;
const neueste = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((t, e) => Math.max(t, e.isDirectory() ? neueste(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).mtimeMs), 0);
const bauenJetzt = async () => {
  if (!bau) return;
  try {
    // ein Editor, der gerade über eine Zwischendatei speichert, lässt hier kurz eine Datei verschwinden: wie ein Baufehler
    const stand = neueste(SRC);
    if (stand <= gebaut) return;
    const neu = await bau.schreibe();
    fehler = null;
    gebaut = stand;
    console.log(neu ? 'pika-pet-card.js neu gebaut' : 'pika-pet-card.js ist aktuell');
  } catch (e) {
    if (fehler !== e.message) console.error(e.message);
    fehler = e.message;
  }
};
// nacheinander, auch wenn zwei Seiten gleichzeitig laden (bauenJetzt wirft nicht, die Kette reißt also nie)
let lauf = Promise.resolve();
const bauen = () => (lauf = lauf.then(bauenJetzt));

const resolve = (url) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(url, 'http://x').pathname);
  } catch {
    return null;
  }
  let file = path.join(root, rel);
  const inside = path.relative(root, file);
  if (inside.startsWith('..') || path.isAbsolute(inside) || inside.split(path.sep)[0] === '.git') return null;
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'preview.html');
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
};

await bauen();
http.createServer(async (req, res) => {
  const file = resolve(req.url);
  if (!file) return res.writeHead(404).end('404');
  const head = { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' };
  if (bau && path.relative(file, bau.ZIEL) === '') {
    await bauen();
    if (fehler) return res.writeHead(200, head).end(`console.error(${JSON.stringify(`Pika Pet Card: Bau fehlgeschlagen\n${fehler}`)});`);
  }
  res.writeHead(200, head);
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}`));
