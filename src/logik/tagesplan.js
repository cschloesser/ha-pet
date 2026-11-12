// Tagesplan (Helfer plan_entity): Felder, Grenzen, lesen, schreiben, Änderungen anwenden

import { clamp } from './hilfen.js';
import { GIFT, GIFT_TRE, giftLv } from './paeckchen.js';

// Was alle Geräte gemeinsam wissen müssen, ohne es aus der Uhr rechnen zu können:
// - hay: Vorrat (n Bündel, t letzte Änderung, c Blütenfarben als Ziffern der Areal-Palette, m letztes Sammel-Fenster)
// - sport: Frühsport heute schon (d Kalendertag, k Fenster)
// - rec: die letzten großen Beschäftigungen [Fenster, Name, Variante] (neueste zuerst)
// - cute: Pika-Tag d, wie oft er an dem Tag gestreichelt wurde (n, bis PET_CAP) und was er erlebt hat (m, ein Bit je
//   Eintrag in MEM_BITS, für die Träume). Stände bis 0.17 haben das Feld nicht und werden weiter gelesen.
// - gift: Päckchen (siehe GIFT): k Beginn der Pflege-Serie, a in der Serie schon verdiente, n Vorrat, u Album (ein Bit je
//   Schatz), z verschenkte (laufende Nummer), o ausgepackte, b seit wann ein Wert unter GIFT.min liegt (sonst leer),
//   x wann das letzte verschenkt wurde (Ballon), y goldenes im Vorrat, d schon belohnte Serien-Wochen, i Inhalt des
//   letzten (Index in GIFT_ITEMS, +16 = golden). Stände bis 0.18 haben das Feld nicht. Hinter a steht mit "_" noch p:
//   ab wann die Wachzeit fürs nächste Päckchen zählt (bis dahin sind die a verdient). Ältere Stände lesen nur a
//   (parseInt hört beim "_" auf) und schreiben es ohne p zurück, dann rechnet die Karte p einmal aus k und a nach.
//   Ebenso hinter u mit "_" noch v: die Stufen der Schätze (Bit t = Trick, Bit 8 + t = Gold, siehe giftLv). Geräte
//   bis 0.22 lesen nur u und schreiben es ohne v zurück; dann trägt die Karte das zuletzt bekannte v wieder ein.
// - fl: das Blumengeschenk im Gras (t wann er es hinlegte, c Blütenfarbe als Ziffer der Areal-Palette, x Stelle in % der
//   Breite, k angenommen). Steht mit "_" hinter m von hay: Geräte bis 0.23 lesen nur m und schreiben es ohne fl zurück.
// - fu: Pino ist vor der Zeit gegangen (Regen, Schlafenszeit) und kommt bis dahin nicht wieder, auch nicht auf einem
//   Gerät, das erst danach dazukommt. Steht mit "_" hinter cute.
// - fd: Futter auf der Wiese, höchstens 3 (t wann es fiel, x Stelle 0–99 zwischen Heu und Stein, k Sorte: 0 Löwenzahn,
//   1 Klee, e gefressen). So fällt es auf allen Geräten, er frisst überall, und nach dem Neuladen liegt es noch da.
//   Steht mit "_" je Futter hinter sport ("t-xxf"): Geräte bis 0.25 lesen nur d.k und schreiben es ohne fd zurück.
// Seit 0.35 (so gebaut, dass Geräte mit 0.34 nichts davon zerstören):
// - gift.f: Freundschaftstage (gute Tage, siehe _careGood in karte/paeckchen.js), stecken als f + 1 in den Bits ab 8
//   von u (0 = noch nicht aus dem alten Stand übernommen). Ältere Karten rechnen mit u nur über Bits (ODER, UND auf die
//   unteren acht) und schreiben die Zahl unverändert zurück.
// - gift.r: Kennung des Geräts, das zuletzt verschenkt hat (0–35), mit "_" hinter x. Nur sein Gerät belohnt; ältere
//   Karten lassen es weg, dann gilt die alte Prüfung (z, x, i).
// - cute.m Bit 9 ("gut"): heute ist ein guter Tag. Ältere Karten behalten unbekannte Bits.
// - ur: Urlaub bei Pino, als siebter Abschnitt "u<t0>" (seit t0) bzw. nach der Rückkehr noch URLAUB.keep lang
//   "u<t0>.<Minuten>". Ältere Karten halten einen siebten Abschnitt für das Format einer neueren und schreiben den Plan
//   dann gar nicht mehr: Während des Urlaubs kann ein vergessenes altes Gerät so weder die Serie reißen noch den Urlaub
//   herauslöschen. Fehlen Päckchen, steht davor "-".
// Text: "p1|n.t.c.m_t_cxxk|d.k_t-xxf…|k:name:v,…|d.n.m_fu|k.a_p.n.u_v.z.o.b.x_r.y.d.i|u<t0>.<min>" (Zahlen zur Basis
// 36), passt in die 255 Zeichen eines input_text.
const HAY_MAX = 12;
const PLAN_REC = 4;
// Kürzer als so darf der Helfer für den Tagesplan nicht sein: Ohne Verlauf (den kürzt _planFit) sind es mit
// Blumengeschenk, drei Futterstücken, Päckchen und dem Ende eines Urlaubs bis etwa 177 Zeichen, HA lehnte längere
// Werte sonst endlos ab. (Bis 0.34: 165.)
const PLAN_MIN = 180;
const planBlank = (now = Date.now()) => ({ hay: { n: 3, t: now, c: '', m: 0 }, sport: null, rec: [], cute: null, gift: null, fl: null, fd: [], ur: null });
const FOOD_MAX = 3;
const FOOD_KINDS = ['lz', 'klee'];
// Blumengeschenk: höchstens alle 90 Minuten (auf allen Geräten zusammen), welkt nach 12 Minuten
const FLGIFT = { gap: 90 * 6e4, life: 12 * 6e4 };
const GIFT_F = ['k', 'a', 'n', 'u', 'z', 'o', 'b', 'x', 'y', 'd', 'i'];
const GIFT_T = new Set(['k', 'b', 'x']); // Zeiten: im Text in Sekunden
// Streicheln: ab PET_CLING ist er anhänglich. Gezählt wird fürs Tagebuch weiter bis PET_CAP, danach wird der Helfer
// dafür nicht mehr geschrieben. (Geräte bis 0.26 zählen nur bis 10 und schreiben höchstens das zurück.)
const PET_CLING = 10;
const PET_CAP = 99;
// Erlebnisse für die Träume, je ein Bit
// (gut: kein Erlebnis, sondern „heute ist ein guter Tag“, siehe ggood; tonne: „die Tonne steht draußen“, siehe
// Haus-Signale. Geträumt wird von beiden nicht.)
const MEM_BITS = ['lz', 'klee', 'coffee', 'heart', 'pino', 'plane', 'bird', 'note', 'bfly', 'gut', 'tonne', 'tonne2'];
const MEM_GUT = 1 << 9;
const MEM_TONNE = 1 << 10;
const MEM_TONNE2 = 1 << 11; // vom Vortag übernommen (wird nicht noch einmal weitergegeben)
// Beginnt ein neuer Pika-Tag (4 Uhr), fängt das Gedächtnis bei null an. Nur „Tonne steht draußen“ gilt weiter bis zur
// Abholung am Morgen (der Tag danach): Sonst stünde die Tonne nach dem ersten Streicheln des Morgens wieder da.
const cuteNew = (c, d) => ({ d, n: 0, m: c && c.d === d - 1 && c.m & MEM_TONNE ? MEM_TONNE2 : 0 });
// Pika-Tag: wechselt um 4 Uhr nachts, so träumt er nach Mitternacht noch vom Vortag
const pikaDay = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 6e4 - 4 * 36e5) / 864e5);
// u im Text: Album (Bits 0–7) und darüber die Freundschaftstage + 1
const giftU = (G) => (G.u & 255) + (G.f != null ? (G.f + 1) * 256 : 0);
const planSer = (P) => {
  const h = P.hay;
  const f = P.fl;
  const fs = f ? `_${Math.round(f.t / 1000).toString(36)}_${f.c}${f.x.toString(36).padStart(2, '0')}${f.k ? 1 : 0}` : '';
  return ['p1', [h.n, Math.round(h.t / 1000).toString(36), h.c || '-', h.m.toString(36) + fs].join('.'),
    (P.sport ? `${P.sport.d.toString(36)}.${P.sport.k.toString(36)}` : '-')
      + (P.fd || []).map((f) => `_${Math.round(f.t / 1000).toString(36)}-${f.x.toString(36).padStart(2, '0')}${(f.k ? 1 : 0) + (f.e ? 2 : 0)}`).join(''),
    P.rec.map(([k, a, v]) => (v ? `${k.toString(36)}:${a}:${v}` : `${k.toString(36)}:${a}`)).join(',') || '-',
    (P.cute ? [P.cute.d, P.cute.n, P.cute.m].map((x) => x.toString(36)).join('.') : '-')
      + (P.fu ? `_${Math.round(P.fu / 1000).toString(36)}` : ''),
    ...(P.gift ? [GIFT_F.map((f) => (P.gift[f] == null ? '-' : (f === 'u' ? giftU(P.gift)
      : Math.round(GIFT_T.has(f) ? P.gift[f] / 1000 : P.gift[f])).toString(36)
      + (f === 'a' && P.gift.p != null ? `_${Math.round(P.gift.p / 1000).toString(36)}` : '')
      + (f === 'u' && P.gift.v != null ? `_${P.gift.v.toString(36)}` : '')
      + (f === 'x' && P.gift.r != null ? `_${P.gift.r.toString(36)}` : ''))).join('.')] : P.ur ? ['-'] : []),
    ...(P.ur ? [`u${Math.round(P.ur.t / 1000).toString(36)}${P.ur.d != null ? `.${Math.round(P.ur.d / 6e4).toString(36)}` : ''}`] : []),
  ].join('|');
};
const planParse = (str) => {
  const p = String(str ?? '').split('|');
  if (p.length < 4 || p.length > 7 || p[0] !== 'p1') return null;
  let ur = null;
  if (p.length === 7) {
    // Urlaub: "u<t0>" oder "u<t0>.<Minuten>". Etwas anderes an dieser Stelle kennt diese Version nicht.
    const m = /^u([0-9a-z]+)(?:\.([0-9a-z]+))?$/.exec(p[6]);
    if (!m) return null;
    ur = { t: parseInt(m[1], 36) * 1000, d: m[2] != null ? parseInt(m[2], 36) * 6e4 : null };
  }
  const h = p[1].split('.');
  const n = Number(h[0]);
  const t = parseInt(h[1], 36) * 1000;
  const m = parseInt(h[3], 36);
  if (h.length !== 4 || !Number.isFinite(n) || !Number.isFinite(t) || !Number.isFinite(m)) return null;
  const P = { hay: { n: clamp(n, 1, HAY_MAX), t, c: h[2] === '-' ? '' : h[2].replace(/\D/g, ''), m }, sport: null, rec: [], cute: null, gift: null, fl: null, fd: [], ur };
  const fq = h[3].split('_');
  if (fq.length === 3 && /^\d[0-9a-z]{2}[01]$/.test(fq[2])) {
    const ft = parseInt(fq[1], 36) * 1000;
    if (Number.isFinite(ft)) P.fl = { t: ft, c: Number(fq[2][0]), x: clamp(parseInt(fq[2].slice(1, 3), 36), 0, 100), k: fq[2][3] === '1' };
  }
  const gq = (p[5] || '').split('.');
  if (gq.length === GIFT_F.length) {
    const G = {};
    GIFT_F.forEach((f, i) => (G[f] = gq[i] === '-' ? null : parseInt(gq[i], 36) * (GIFT_T.has(f) ? 1000 : 1)));
    const gp = parseInt(gq[1].split('_')[1] ?? '', 36) * 1000;
    G.p = Number.isFinite(gp) ? gp : null;
    // Stufen: "u_v". Ohne Anhang (Stand bis 0.22, oder ein Gerät bis 0.22 hat sie weggelassen) 0 und nov: dann trägt
    // _planCompose die zuletzt bekannten wieder ein
    const gv = parseInt(gq[3].split('_')[1] ?? '', 36);
    G.v = Number.isFinite(gv) ? gv & 0xffff : 0;
    if (!Number.isFinite(gv)) G.nov = true;
    // Freundschaftstage in u (siehe oben), Kennung des Schenkers hinter x
    if (Number.isFinite(G.u)) {
      G.f = G.u >= 256 ? Math.floor(G.u / 256) - 1 : null;
      G.u &= 255;
    }
    const gr = parseInt(gq[7].split('_')[1] ?? '', 36);
    G.r = Number.isFinite(gr) ? gr : null;
    if (GIFT_F.every((f) => f === 'b' || Number.isFinite(G[f]))) P.gift = G;
  }
  const [cq, fuq] = (p[4] || '-').split('_');
  const fu = parseInt(fuq ?? '', 36) * 1000;
  P.fu = Number.isFinite(fu) ? fu : 0;
  const q = cq.split('.').map((x) => parseInt(x, 36));
  if (q.length === 3 && q.every(Number.isFinite)) P.cute = { d: q[0], n: clamp(q[1], 0, PET_CAP), m: q[2] };
  const [sp, ...fds] = p[2].split('_');
  const s = sp.split('.').map((x) => parseInt(x, 36));
  if (s.length === 2 && s.every(Number.isFinite)) P.sport = { d: s[0], k: s[1] };
  for (const e of fds.slice(0, FOOD_MAX)) {
    const m2 = /^([0-9a-z]+)-([0-9a-z]{2})([0-3])$/.exec(e);
    if (m2) P.fd.push({ t: parseInt(m2[1], 36) * 1000, x: clamp(parseInt(m2[2], 36), 0, 99), k: Number(m2[3]) & 1, e: Number(m2[3]) > 1 });
  }
  if (p[3] !== '-') {
    for (const e of p[3].split(',')) {
      const [k, a, v] = e.split(':');
      if (Number.isFinite(parseInt(k, 36)) && a) P.rec.push([parseInt(k, 36), a, v || '']);
    }
  }
  return P;
};
// Päckchen-Änderung auf den Plan legen (verändert out.gift). Wiederholbar wie alle Plan-Änderungen: jede gilt nur für die
// Serie k, in der sie entstand, und nur einmal (Zähler wachsen nur, verschenkt wird mit laufender Nummer z).
const GIFT_OPS = new Set(['gstart', 'gbad', 'gok', 'gearn', 'gmig', 'give', 'gopen', 'gdbg']);
// Urlaub läuft (seit ur.t, noch nicht zurück)
const urOn = (P) => !!P?.ur && P.ur.d == null;
const giftApply = (out, op) => {
  const G = out.gift;
  if (op.t === 'gstart') {
    if (!G) out.gift = { k: op.k, a: 0, n: 0, u: 0, v: 0, z: 0, o: 0, b: null, x: 0, y: 0, d: 0, i: 0, p: op.k, f: 0, r: null };
    return;
  }
  if (!G) return;
  // Im Urlaub ruht die Serie: Was ein Gerät noch ohne Wissen davon ausrechnete (es war offline), gilt nicht
  if (op.t === 'gbad') {
    if (G.k === op.k && G.b == null && !(urOn(out) && op.b >= out.ur.t)) G.b = op.b;
  } else if (op.t === 'gok') {
    // Wieder alles über GIFT.min. War es zu lange darunter (brk), beginnt eine neue Serie.
    if (G.k === op.k && G.b === op.b) Object.assign(G, op.brk ? { k: op.nk, a: 0, b: null, d: 0, p: op.nk } : { b: null });
  } else if (op.t === 'gearn') {
    // p: ab da zählt die Wachzeit fürs nächste. Mit e === a trägt ein Gerät nur p zu einem älteren Stand nach.
    if (urOn(out) && op.p != null && op.p > out.ur.t) return;
    if (G.k === op.k && (op.e > G.a || (op.e === G.a && G.p == null && op.p != null))) {
      G.n = Math.min(GIFT.max, G.n + op.e - G.a);
      G.a = op.e;
      if (op.p != null) G.p = op.p;
    }
  } else if (op.t === 'gmig') {
    // Stand bis 0.34: die Tage der laufenden Serie werden einmal zu Freundschaftstagen (so bleibt der Weg zu Gold)
    if (G.f == null && G.k === op.k) G.f = op.f;
  } else if (op.t === 'give') {
    if (op.z !== G.z + 1 || G.o < G.z || !(op.gold ? G.y > 0 : G.n > 0)) return;
    if (op.gold) G.y--;
    else G.n--;
    Object.assign(G, { z: op.z, x: op.x, i: op.i, r: op.r ?? null });
    // Schatz: fehlt er, kommt er ins Album, sonst eine Stufe höher (Gold nur aus goldenen Päckchen)
    const t = op.i & 15;
    if (t < GIFT_TRE) {
      const lv = giftLv(G, t);
      if (!lv) G.u |= 1 << t;
      else if (lv === 1) G.v = (G.v || 0) | (1 << t);
      else if (lv === 2 && op.gold) G.v = (G.v || 0) | (1 << (8 + t));
    }
  } else if (op.t === 'gopen') {
    G.o = Math.max(G.o, Math.min(op.z, G.z));
  } else if (op.t === 'gdbg') {
    Object.assign(G, op.f); // Vorschau
    if ('v' in op.f) delete G.nov;
  }
};
// Vorrat jetzt: 2 Bündel weniger je Tag seit der letzten Änderung, die ältesten Blüten fallen zuerst weg
const hayNow = (h, now) => {
  const n = clamp(h.n - Math.floor(Math.max(0, now - h.t) / 864e5) * 2, 1, HAY_MAX);
  return { n, c: h.c.slice(-n) };
};
// Änderung op auf den Plan P anwenden. Alle Änderungen sind wiederholbar (gleiches Ergebnis beim zweiten Mal), so
// dürfen sie auf jeden neu eintreffenden Stand eines anderen Geräts noch einmal gelegt werden.
const planApply = (P, op, now) => {
  const out = { hay: { ...P.hay }, sport: P.sport, rec: P.rec.map((e) => [...e]), cute: P.cute, gift: P.gift && { ...P.gift }, fl: P.fl, fd: P.fd || [], fu: P.fu || 0, ur: P.ur || null };
  if (GIFT_OPS.has(op.t)) {
    giftApply(out, op);
    return out;
  }
  if (op.t === 'ggood') {
    // Heute (Pika-Tag d) ist ein guter Tag: einmal je Tag ein Freundschaftstag mehr, jeder GIFT.goldDays-te bringt ein
    // goldenes Päckchen. Ob er schon gezählt ist, steht im Bit "gut" des Tages (cute.m).
    const c = out.cute;
    const G = out.gift;
    if (!G || G.f == null || (c && (c.d > op.d || (c.d === op.d && c.m & MEM_GUT)))) return out;
    out.cute = c?.d === op.d ? { ...c, m: c.m | MEM_GUT } : { ...cuteNew(c, op.d), m: cuteNew(c, op.d).m | MEM_GUT };
    G.f++;
    if (G.f % GIFT.goldDays === 0) G.y = Math.min(GIFT.goldMax, G.y + 1);
    return out;
  }
  if (op.t === 'von') {
    // Urlaub beginnt (t0). Läuft schon einer, gilt der.
    if (!out.ur || (out.ur.d != null && op.t0 >= out.ur.t + out.ur.d)) out.ur = { t: op.t0, d: null };
    return out;
  }
  if (op.t === 'voff') {
    // Zurück: Dauer d. Das Gerät, das zurückholt, hat ausgerechnet, wohin Fortschritt (gp) und Toleranz (gb) der Serie
    // und der Verfall des Vorrats (ht) rücken, damit die Urlaubszeit nicht mitzählt. Gilt nur für diesen Urlaub, einmal.
    if (out.ur?.t !== op.t0 || out.ur.d != null) return out;
    out.ur = { t: op.t0, d: op.d };
    if (out.gift && op.gp != null && out.gift.p != null) out.gift.p = op.gp;
    if (out.gift && op.gb != null && out.gift.b != null) out.gift.b = op.gb;
    if (op.ht != null) out.hay.t = op.ht;
    return out;
  }
  if (op.t === 'vclear') {
    // Ende des Urlaubs lange genug bekannt: Abschnitt weg (ältere Karten schreiben dann wieder mit)
    if (out.ur?.t === op.t0 && out.ur.d != null) out.ur = null;
    return out;
  }
  if (op.t === 'rec') {
    const e = out.rec.find((x) => x[0] === op.k);
    if (e) {
      if (op.v && !e[2]) e[2] = op.v;
    } else {
      out.rec.push([op.k, op.a, op.v || '']);
      out.rec.sort((a, b) => b[0] - a[0]);
      out.rec.length = Math.min(out.rec.length, PLAN_REC);
    }
  } else if (op.t === 'sport') {
    if (out.sport?.d !== op.d) out.sport = { d: op.d, k: op.k };
  } else if (op.t === 'gather') {
    // Dasselbe Sammel-Fenster zählt nur einmal, egal wie viele Geräte es gezeigt haben
    if (op.m != null && out.hay.m >= op.m) return out;
    const { n, c } = hayNow(out.hay, now);
    if (n >= HAY_MAX) return out;
    // t ist der Anker für den Verfall: nur um die schon verfallenen ganzen Tage weiterrücken. Mit t = now fiele bei
    // täglichem Sammeln nie etwas weg (der angebrochene Tag ginge jedes Mal verloren).
    const t = out.hay.t + Math.floor(Math.max(0, now - out.hay.t) / 864e5) * 864e5;
    out.hay = { n: n + 1, t, c: (c + op.c).slice(-(n + 1)), m: op.m ?? out.hay.m };
  } else if (op.t === 'fdrop') {
    // Hat ein anderes Gerät gerade eins hingelegt (weniger als FLGIFT.gap davor oder danach), gilt das: So zeigen alle
    // Geräte dasselbe, egal in welcher Reihenfolge die Stände ankommen
    const f = out.fl;
    if (!f || (f.t !== op.f.t && Math.abs(op.f.t - f.t) >= FLGIFT.gap)) out.fl = { ...op.f };
  } else if (op.t === 'frgone') {
    out.fu = Math.max(out.fu, op.u);
  } else if (op.t === 'feed') {
    // Jedes Futter einmal (t ist seine Kennung); mehr als FOOD_MAX liegen nie da, die ältesten fallen heraus
    if (!out.fd.some((f) => f.t === op.f.t)) out.fd = [...out.fd, { ...op.f }].sort((a, b) => a.t - b.t).slice(-FOOD_MAX);
  } else if (op.t === 'fate') {
    out.fd = out.fd.map((f) => (f.t === op.ft ? { ...f, e: true } : f));
  } else if (op.t === 'ftake') {
    if (out.fl?.t === op.ft) out.fl = { ...out.fl, k: true };
  } else if (op.t === 'pet' || op.t === 'mem') {
    // Ein neuer Pika-Tag fängt bei null an (cuteNew). Der höchste Zähler gewinnt, Erlebnisse werden zusammengelegt.
    // („Tonne steht draußen“ ist ein mem mit b = MEM_TONNE)
    const c = out.cute;
    if (c && c.d > op.d) return out;
    const b = c?.d === op.d ? c : cuteNew(c, op.d);
    out.cute = op.t === 'pet' ? { ...b, n: Math.max(b.n, Math.min(op.n, PET_CAP)) } : { ...b, m: b.m | op.b };
  }
  return out;
};

export {
  HAY_MAX, PLAN_MIN, planBlank, FOOD_KINDS, FLGIFT, PET_CLING, PET_CAP, MEM_BITS, MEM_GUT, pikaDay, planSer, planParse, hayNow,
  planApply, urOn, MEM_TONNE, MEM_TONNE2,
};
