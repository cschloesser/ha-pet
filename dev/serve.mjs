// Minimaler statischer Server für die Vorschau: node serve.mjs <ordner> <port>
// Lauscht nur auf localhost und liefert nur Dateien innerhalb von <ordner> (ohne .git).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8765);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };

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

http.createServer((req, res) => {
  const file = resolve(req.url);
  if (!file) return res.writeHead(404).end('404');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}`));
