// Freunde, die statt Pino zu Besuch kommen (ab 0.41): Kirby, Rufus und Katzumi, nach Chris' Kuscheltieren.
// Alle drei entstehen wie Pino aus PIKA_SVG, so können sie alles, was er kann (Spiele, Mimik, Winterschal).
// Die Rückansicht (.bk) fehlt: Besucher schauen nicht fern, _friendBuild entfernt sie ohnehin.

import { OUT, PIKA_SVG } from './pika.js';

// Gleichbleibender Zufall, damit die Zotteln überall gleich liegen
const lcg = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const f = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

// Zotteliger Umriss einer Ellipse: n Strähnen, jede mit leicht schräger Spitze
const fluff = (cx, cy, rx, ry, n, t, seed) => {
  const r = lcg(seed);
  const P = (a, k) => [cx + (rx + k) * Math.cos(a), cy + (ry + k) * Math.sin(a)];
  const st = (2 * Math.PI) / n;
  let a0 = -Math.PI / 2;
  let d = `M${f(P(a0, 0))}`;
  for (let i = 0; i < n; i++) {
    const a1 = a0 + st;
    const k = t * (0.55 + 0.9 * r());
    const tip = P(a0 + st * (0.55 + 0.3 * r()), k);
    d += ` Q${f(P(a0 + st * 0.15, k * 0.85))} ${f(tip)} Q${f(P(a1 - st * 0.05, k * 0.3))} ${f(P(a1, 0))}`;
    a0 = a1;
  }
  return `${d}Z`;
};

// n Punkte in gleichen Abständen auf einem Pfad aus M, C und Z (absolut, wie BODY in pika.js)
const pathPoints = (d, n) => {
  const tk = d.match(/[MCZ]|-?(?:\d+\.?\d*|\.\d+)/g);
  const segs = [];
  let cur = [0, 0];
  let start = cur;
  for (let i = 0; i < tk.length;) {
    const c = tk[i++];
    if (c === 'M') start = cur = [+tk[i++], +tk[i++]];
    else if (c === 'C') {
      while (i < tk.length && !/[MCZ]/.test(tk[i])) {
        const q = tk.slice(i, i + 6).map(Number);
        i += 6;
        segs.push([cur, [q[0], q[1]], [q[2], q[3]], [q[4], q[5]]]);
        cur = [q[4], q[5]];
      }
    } else if (c === 'Z') {
      if (cur[0] !== start[0] || cur[1] !== start[1]) segs.push([cur, cur, start, start]);
      cur = start;
    }
  }
  const poly = [];
  for (const [a, b, c, e] of segs) {
    for (let k = 0; k < 48; k++) {
      const t = k / 48;
      const u = 1 - t;
      const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      poly.push([0, 1].map((j) => w[0] * a[j] + w[1] * b[j] + w[2] * c[j] + w[3] * e[j]));
    }
  }
  poly.push(poly[0]);
  const len = [0];
  for (let i = 1; i < poly.length; i++) len.push(len[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  const L = len.at(-1);
  const out = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = (L * i) / n;
    while (len[j] < s) j++;
    const u = (s - len[j - 1]) / (len[j] - len[j - 1] || 1);
    out.push([poly[j - 1][0] + (poly[j][0] - poly[j - 1][0]) * u, poly[j - 1][1] + (poly[j][1] - poly[j - 1][1]) * u]);
  }
  return out;
};

// Zotteliger Umriss entlang eines Pfads: jede Strähne zeigt entlang der Außennormalen
const fluffPath = (d, n, t, seed) => {
  const r = lcg(seed);
  const pts = pathPoints(d, n);
  const area = pts.reduce((a, p, i) => { const q = pts[(i + 1) % n]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  const sg = area > 0 ? 1 : -1;
  let out = `M${f(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const nx = (sg * (p1[1] - p0[1])) / len;
    const ny = (-sg * (p1[0] - p0[0])) / len;
    const k = t * (0.55 + 0.9 * r());
    const at = (u, kk) => [p0[0] + (p1[0] - p0[0]) * u + nx * kk, p0[1] + (p1[1] - p0[1]) * u + ny * kk];
    out += ` Q${f(at(0.15, k * 0.85))} ${f(at(0.55 + 0.3 * r(), k))} Q${f(at(0.95, k * 0.3))} ${f(p1)}`;
  }
  return `${out}Z`;
};

// Fellstrich: n Zeichen in der Ellipse (cx, cy, rx, ry), ohne die Stellen, für die skip(x, y) gilt. mark(x, y, u, v, r)
// liefert den Pfad (d) und ob er dunkel ist; die Farben setzt der Aufrufer.
const furMarks = (cx, cy, rx, ry, n, seed, edge, skip, mark, [dark, light], [od, ol], sw) => {
  const r = lcg(seed);
  let out = '';
  for (let i = 0; i < n;) {
    const u = r() * 2 - 1;
    const v = r() * 2 - 1;
    if (u * u + v * v > edge) continue;
    const x = cx + u * rx;
    const y = cy + v * ry;
    if (skip(x, y)) continue;
    i++;
    const dk = i % 3 !== 0;
    out += `<path d="${mark(x, y, u, v, r)}" stroke="${dk ? dark : light}" stroke-opacity="${dk ? od : ol}"/>`;
  }
  return `<g fill="none" stroke-width="${sw}" stroke-linecap="round">${out}</g>`;
};
// Kurze, nach außen und unten fallende Häkchen (Kirby)
const hook = (x, y, u, v, r) => {
  let dx = u;
  let dy = v + 0.9;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  const L = 1.8 + 1.6 * r();
  const b = (r() - 0.5) * 2.6;
  return `M${x.toFixed(1)} ${y.toFixed(1)} q${((dx * L) / 2 - dy * b).toFixed(1)} ${((dy * L) / 2 + dx * b).toFixed(1)} ${(dx * L).toFixed(1)} ${(dy * L).toFixed(1)}`;
};
// Kleine Wellen (Rufus' Locken)
const wave = (x, y, u, v, r) => {
  const a = r() * Math.PI * 2;
  const s = 0.9 + 0.5 * r();
  const c = Math.cos(a) * s;
  const sn = Math.sin(a) * s;
  return `M${x.toFixed(1)} ${y.toFixed(1)} q${(c - sn).toFixed(1)} ${(sn + c).toFixed(1)} ${(2 * c).toFixed(1)} ${(2 * sn).toFixed(1)} t${(2 * c).toFixed(1)} ${(2 * sn).toFixed(1)}`;
};

// Gemeinsamer Anfang: Vorderansicht des Pikas mit eigenen ids (fur3 …) und eigenen Fellfarben
const FRONT = PIKA_SVG.split('<g class="bk">')[0];
const derive = (n, c) => [
  ['id="fur"', `id="fur${n}"`], ['url(#fur)', `url(#fur${n})`],
  ['id="bodyclip"', `id="bodyclip${n}"`], ['url(#bodyclip)', `url(#bodyclip${n})`],
  ['#d0ad8d', c.fu1], ['#b08a68', c.fu2], ['#8a664b', c.fu3], ['#ecdcc6', c.paw],
].reduce((svg, [a, b]) => svg.split(a).join(b), FRONT);
// Körperumriss tauschen (Umriss und Clip), auf Wunsch mit anderer Strichstärke
const body = (svg, n, d, sw = '2.6') => svg
  .replace(/<clipPath id="bodyclip\d"><path d="[^"]+"\/>/, `<clipPath id="bodyclip${n}"><path d="${d}"/>`)
  .replace(/(<g class="body">\s*<path d=")[^"]+"([^>]*)stroke-width="2.6"/, `$1${d}"$2stroke-width="${sw}"`);
const BELLY = /<ellipse cx="82" cy="82"[^>]*\/>/;
const EARS = /<g class="ear ear-(\w)">[\s\S]*?<\/g>/g;
const FEET = /<g class="feet"[\s\S]*?<\/g>/;
const BROWS = /<path class="brow brow-l"[^>]*\/>\s*<path class="brow brow-r"[^>]*\/>/;
const WHISKERS = /<path class="wsk"[\s\S]*?\/>/;
const SNOUT = /<ellipse cx="91" cy="55" rx="7.5" ry="5.2"[^>]*\/>/;
const NOSE = /<path class="nose" d="[^"]+" fill="[^"]+"\/>/;
const END = '\n  </svg>';

// ---------- Kirby: goldbraune Zottelkugel, kleine helle Bärenohren, flache Schnauze, große dunkle Füße ----------
const K = {
  fu1: '#e2b673', fu2: '#c48c48', fu3: '#93602b', paw: '#c99350', snout: '#e4cda7', snoutRim: '#b8925e',
  nose: '#3b2218', foot: '#8e5726', ear: '#e4bf85', earIn: '#f2dcb4',
};
const K_BODY = fluff(77, 56, 39, 35.5, 42, 2.5, 7);
const K_ARM = (cx, cy, seed) => `<path class="karm" d="${fluff(cx, cy, 5, 6.2, 10, 1.5, seed)}"
        fill="url(#fur3)" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>`;
// Halbkreis-Ohr aus hellerem Fell; liegt hinter dem Körper, die untere Hälfte verschwindet darin
const K_EAR = (cx, cy, side, seed) => `
    <g class="ear ear-${side}">
      <path d="${fluff(cx, cy, 7.4, 10, 14, 1.6, seed)}" fill="${K.ear}" stroke="${OUT}" stroke-width="1.8" stroke-linejoin="round"/>
      <ellipse cx="${cx + 0.4}" cy="${cy - 0.6}" rx="3.8" ry="5.6" fill="${K.earIn}" opacity=".85"/>
      <path d="M${cx - 3.6} ${cy - 4} q1 2 .4 4 M${cx + 3.8} ${cy - 3.4} q-.6 2 0 3.8 M${cx - 1} ${cy - 7.4} q.8 1.6 .2 3"
        stroke="#b88a4c" stroke-width=".8" stroke-opacity=".45" fill="none" stroke-linecap="round"/>
    </g>`;
const KIRBY_SVG = body(derive(3, K), 3, K_BODY)
  .replace(BELLY, furMarks(77, 56, 38, 34, 130, 3, 0.92, (x, y) => ((x - 91) / 17) ** 2 + ((y - 50) / 11) ** 2 < 1, hook,
    ['#8a5a26', '#f6d49c'], [0.3, 0.42], '.85')
    + `<path d="M79 28 q2.6 4.4 .8 8 M85.6 27.4 q1.8 4.2 0 7.4 M92 28.4 q1.2 4 -.6 7 M98 30.6 q.6 3.6 -1.2 6" stroke="${K.fu3}" stroke-width="1.1"
        stroke-opacity=".5" fill="none" stroke-linecap="round"/>`)
  .replace(EARS, (m, s) => (s === 'l' ? K_EAR(72.5, 21, s, 41) : s === 'r' ? K_EAR(101.5, 27.5, s, 43) : `<g class="ear ear-${s}"></g>`))
  .replace(FEET, `<g class="feet" fill="${K.foot}" stroke="${OUT}" stroke-width="1.6">
        <ellipse class="bfoot" cx="60" cy="91" rx="0" ry="0"/>
        <ellipse class="ffoot" cx="81.5" cy="89.6" rx="10" ry="5.4"/>
        <ellipse class="ffoot" cx="103.5" cy="88.8" rx="10.2" ry="5.6"/>
      </g>
      ${K_ARM(39.5, 63, 21)}${K_ARM(114, 69, 23)}`)
  .replace(SNOUT, `<ellipse cx="91.3" cy="54.8" rx="8.4" ry="6.1" fill="${K.snout}" stroke="${K.snoutRim}" stroke-width=".7"/>`)
  .replace(NOSE, `<path class="nose" d="M87.6 50.9 q3.4 -1.7 6.8 0 q-.6 3 -3.4 3.6 q-2.8 -.6 -3.4 -3.6z" fill="${K.nose}"/>
          <ellipse cx="90" cy="51.4" rx="1.2" ry=".6" fill="#fff" opacity=".35"/>`)
  .replace(WHISKERS, '') + END;

// ---------- Rufus: cremeweißer Lockenhund, Schlappohren innen fast schwarz, glatte Schnauze, Fellbüschel-Brauen ----------
const R = {
  fu1: '#fffaf0', fu2: '#f1e5cd', fu3: '#d5c09c', paw: '#f4ead8', muzzle: '#fbf4e7', muzzleRim: '#cfb994',
  nose: '#b38f74', earIn: '#2b1c15', brow: '#c4a27a',
};
const R_BODY = fluffPath(PIKA_SVG.match(/<clipPath id="bodyclip"><path d="([^"]+)"/)[1], 84, 1.9, 51);
// Schlappohr: zottelige Lasche, oben nach außen gekippt; beide vor dem Kopf (in .fear)
const R_EAR = (cx, cy, rot, side) => `
    <g class="ear ear-${side}"><g transform="rotate(${rot} ${cx} ${cy})">
      <path d="${fluff(cx, cy, 6, 8.8, 14, 1.8, 61)}" fill="url(#fur4)" stroke="${OUT}" stroke-width="1.7" stroke-linejoin="round"/>
      <ellipse cx="${cx}" cy="${cy + 2.4}" rx="3.4" ry="4.6" fill="${R.earIn}"/>
    </g></g>`;
const R_FOOT = (cls, cx, cy, rx, ry, seed) => `<path class="${cls}" d="${fluff(cx, cy, rx, ry, 12, 1.3, seed)}"/>`;
const R_BROW = (side, d) => `<path class="brow brow-${side}" d="${d}" stroke="${R.brow}" stroke-width="1.2" fill="none"
          stroke-linecap="round" stroke-linejoin="round"/>`;
const RUFUS_SVG = body(derive(4, R), 4, R_BODY, '2.1')
  .replace(BELLY, furMarks(60, 62, 52, 33, 150, 9, 0.95, (x, y) => ((x - 91) / 14) ** 2 + ((y - 51) / 11) ** 2 < 1, wave,
    ['#c9ad84', '#ffffff'], [0.45, 0.7], '.8'))
  .replace(EARS, (m, s) => (s === 'f' ? R_EAR(70.5, 28.5, -24, 'l') + R_EAR(111.5, 29.5, 24, 'r') : '<g></g>'))
  .replace(FEET, `<g class="feet" fill="${R.paw}" stroke="${OUT}" stroke-width="1.5">
        ${R_FOOT('bfoot', 31, 90, 9.6, 3.8, 71)}${R_FOOT('ffoot', 83, 90.6, 7.6, 3.6, 73)}${R_FOOT('ffoot', 99, 90.2, 7.6, 3.6, 75)}
      </g>`)
  .replace(BROWS, R_BROW('l', 'M78.4 41 q.6 -2.6 2.4 -1 q1 -2.6 2.6 -.6 q1.2 -1.8 2 .8')
    + R_BROW('r', 'M95.6 41 q.8 -2.4 2 -.8 q1.6 -2 2.6 .6 q1.8 -1.6 2.4 1'))
  .replace(WHISKERS, '')
  // der ganze Mund sitzt auf der größeren Schnauze zwei Einheiten tiefer
  .replace(/(<g class="mouth-g">)([\s\S]*?)(<\/g>\s*<path class="cfoam")/, '$1<g transform="translate(0 2)">$2</g>$3')
  .replace(SNOUT, `<ellipse cx="91" cy="55.2" rx="11" ry="7.6" fill="${R.muzzle}" stroke="${R.muzzleRim}" stroke-width=".9"/>
          <path d="M83 58.6 q8 4 16 0" stroke="#efe2c8" stroke-width="1.4" fill="none" stroke-linecap="round"/>`)
  .replace(NOSE, `<path class="nose" d="M86.2 50 q4.8 -2.6 9.6 0 q-.4 3.8 -4.8 4.3 q-4.4 -.5 -4.8 -4.3z" fill="${R.nose}" stroke="#8f6e57" stroke-width=".6"/>
          <ellipse cx="89.4" cy="50" rx="1.6" ry=".7" fill="#fff" opacity=".35"/>`) + END;

// ---------- Katzumi: kleine Mochi-Katze in Apricot mit Stirnstreifen, Spitzohren, Augen mit gelbgrünem Rand ----------
const C = {
  fu1: '#ffdcab', fu2: '#f6c08a', fu3: '#d9975c', paw: '#fbd2a0', earIn: '#f2a6b4', stripe: '#a9592b',
  rim: '#c9d46c', nose: '#e9919c', whisk: '#3a2a22',
};
const C_BODY = fluffPath('M42 84 C35 70 38 46 54 36 C66 28 92 27 104 36 C119 46 121 70 114 84 C110 92 98 93 78 93 C58 93 46 92 42 84Z', 110, 0.8, 101);
// Spitzohr mit runder Spitze, Fuß bei (cx, by), um tilt Grad gekippt; hinter dem Körper
const C_EAR = (cx, by, tilt, side) => `
    <g class="ear ear-${side}"><g transform="translate(${cx} ${by}) rotate(${tilt})">
      <path d="M-8.5 2 L-2 -12.4 Q0 -15.6 2 -12.4 L8.5 2Z" fill="url(#fur5)" stroke="${OUT}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M-4.8 1 L-1.1 -8.6 Q0 -10.4 1.1 -8.6 L4.8 1Z" fill="${C.earIn}"/>
    </g></g>`;
// Stirnzeichnung: Mittelstreifen, der zur Nase hin spitz ausläuft, links und rechts je zwei kurze Balken
const C_MARK = `<g fill="${C.stripe}">
          <path d="M86.4 28.6 Q89.2 27.6 92 28.6 L90.1 42.4 Q89.2 44 88.3 42.4Z"/>
          <path d="M77.6 33.6 Q81.6 31.4 86 32.4 L85.8 34.6 Q81.4 34.2 78 35.6Z M79.4 38.2 Q82.6 36.6 86.2 37.2 L86 39.2 Q82.6 39.2 79.8 40.2Z"/>
          <path d="M92.4 32.4 Q96.8 31.4 100.6 33.8 L100.2 35.8 Q96.8 34.2 92.6 34.6Z M92.2 37.2 Q95.8 36.6 98.8 38.4 L98.4 40.4 Q95.6 39.2 92.4 39.2Z"/>
        </g>`;
// Augen etwas weiter auseinander als beim Pika (links −0,8, rechts +1,2); Freu- und Schlafaugen wandern mit
const cShift = (x) => (x < 90 ? -0.8 : 1.2);
const KATZUMI_SVG = body(derive(5, C), 5, C_BODY, '2.3')
  .replace(BELLY, `<ellipse cx="66" cy="46" rx="20" ry="12" fill="#fff" opacity=".22"/>${C_MARK}`)
  .replace(EARS, (m, s) => (s === 'l' ? C_EAR(66, 37, -16, s) : s === 'r' ? C_EAR(103, 36, 16, s) : `<g class="ear ear-${s}"></g>`))
  .replace(FEET, `<g class="feet" fill="${C.paw}" stroke="${OUT}" stroke-width="1.3">
        <ellipse class="bfoot" cx="50" cy="91" rx="0" ry="0"/>
        <ellipse class="ffoot" cx="83" cy="92" rx="4.6" ry="2.2"/>
        <ellipse class="ffoot" cx="99" cy="91.6" rx="4.6" ry="2.2"/>
      </g>`)
  .replace(/(<g class="eye eye-(l|r)">)([\s\S]*?)(<\/g>)/g, (m, a, s, inner, z) =>
    `${a}<g transform="translate(${s === 'l' ? cShift(0) : cShift(99)} 0)">${inner.replace('fill="#2a1a12"', `fill="#2a1a12" stroke="${C.rim}" stroke-width="1.3"`)}</g>${z}`)
  .replace(/d="M([\d.]+) (46\.6|47\.6) q/g, (m, x, y) => `d="M${(+x + cShift(+x)).toFixed(1)} ${y} q`)
  .replace(BROWS, '')
  .replace(WHISKERS, `<path class="wsk" d="M70.4 48.6 l3.8 1.1 M70 51.2 l4 .3 M70.4 53.8 l3.8 -.6 M106.6 49.7 l3.8 -1.1 M106.4 51.5 l4 -.3 M106.6 53.2 l3.8 .6"
              stroke="${C.whisk}" stroke-width="1" stroke-linecap="round"/>`)
  .replace(SNOUT, '')
  .replace(NOSE, `<path class="nose" d="M89.3 52.2 q1.7 -.9 3.4 0 q-.4 1.4 -1.7 1.8 q-1.3 -.4 -1.7 -1.8z" fill="${C.nose}" stroke="#b9646e" stroke-width=".5"/>`) + END;

// Fürs Tagebuch: dieselbe Grafik, auf Kopf bzw. Körper zugeschnitten
const cut = (svg, vb) => svg.replace('viewBox="0 0 120 100"', `viewBox="${vb}"`);
const FRIEND_ICON = { kirby: cut(KIRBY_SVG, '33 12 86 86'), rufus: cut(RUFUS_SVG, '60 14 62 62'), katzumi: cut(KATZUMI_SVG, '34 14 90 90') };

export { KIRBY_SVG, RUFUS_SVG, KATZUMI_SVG, FRIEND_ICON };
