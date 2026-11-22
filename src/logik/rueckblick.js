// Rückblick: die Chronik als Kalender im Tagebuch – Tage, Monatsraster, Serien, Summen, Sätze

import { hasKey } from './hilfen.js';
import { PET_CAP } from './tagesplan.js';
import { FRIENDS } from './besucher.js';
import { diaryPick } from './tagebuch.js';
import { chronikTag, chronikTage } from './chronik.js';

// Seit 0.34 schreibt die Karte mit chronicle_entity je Pika-Tag eine Zeile in eine To-do-Liste von HA (src/logik/
// chronik.js), gezeigt wurde sie nirgends. Der Rückblick ist die Seite dazu im Tagebuch: ein Monatskalender, der Tag
// zum Antippen und die Summen. Er liest nur. Hier steht der reine Teil: Alles rechnet mit dem Datum aus dem Titel
// ('JJJJ-MM-TT') und dem Tagesindex (wie pikaDay: Tage seit 1970 in UTC), nie mit der Uhr und nie in Ortszeit. So gibt
// es an den Tagen der Zeitumstellung nichts zu verrutschen, und alle Geräte zeigen dasselbe.
// frisch: so lange gilt die gelesene Liste, ohne dass der Reiter neu fragt; haengt: ein Lesen, das länger dauert, gilt
// als verloren (beim nächsten Aufschlagen wird neu gefragt)
const RUECK = { frisch: 5 * 6e4, haengt: 30000 };
const RUECK_MONAT = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
// Montag zuerst (getUTCDay: 0 = Sonntag)
const RUECK_WTAG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
// Besuch: wie er im Satz und bei den Summen heißt. Pino trägt den Namen aus friend_name, die drei anderen Freunde
// heißen fest (FRIENDS). Ein Kürzel, das diese Version nicht kennt (aus einer späteren), wird überlesen.
const RUECK_GAST = { vogel: ['ein Vögelchen', 'Vögelchen'], falter: ['ein Schmetterling', 'Schmetterling'] };
// Reihenfolge bei Gleichstand (wie die Chronik den Besuch schreibt)
const RUECK_REIHE = ['pino', 'kirby', 'rufus', 'katzumi', 'vogel', 'falter'];
const RUECK_TXT = {
  // {a}: erster aufgeschriebener Tag, {n}: „10 Tage stehen“ oder „ein Tag steht“, {g}: der Satz zu den guten Tagen
  fazit: ['Seit dem {a} schreibe ich jeden Tag auf. {g}', 'Mein Rückblick fängt am {a} an, {n} schon drin. {g}',
    'Am {a} hab ich angefangen aufzuschreiben. {g}'],
  gut0: ['Die guten Tage kommen bestimmt noch.', 'Ein guter Tag fehlt mir noch. Das wird schon!'],
  gut1: ['Ein guter Tag war schon dabei!', 'Einen guten Tag hab ich schon gezählt!'],
  gutN: ['{z} gute Tage waren schon dabei!', '{z} gute Tage hab ich schon gezählt!'],
  gutAlle: ['Und jeder war ein guter Tag!'],
  // statt des Kalenders, je Lage eine Zeile
  laden: 'Ich blättere zurück …',
  fehlt: 'Ich finde meine Chronik gerade nicht. Die Liste gibt es in Home Assistant nicht, oder sie ist nicht erreichbar.',
  getrennt: 'Ich komme gerade nicht an meine Chronik: Home Assistant ist nicht verbunden.',
  leer: 'Ich fange gerade erst an aufzuschreiben. Morgen steht hier der erste Tag.',
  fehler: 'Meine Chronik klemmt gerade. Schlag den Rückblick gleich noch einmal auf.',
};

const utc = (tag) => new Date(tag * 864e5);
// 'JJJJ-MM-TT' → „10. November“ (jahr: mit Jahreszahl), wt: „Dienstag, 10. November“
const rueckDatum = (d, { wt = false, jahr = false } = {}) => {
  const tag = chronikTag(d);
  if (tag == null) return '';
  const x = utc(tag);
  return `${wt ? `${RUECK_WTAG[(x.getUTCDay() + 6) % 7]}, ` : ''}${x.getUTCDate()}. ${RUECK_MONAT[x.getUTCMonth()]}${jahr ? ` ${x.getUTCFullYear()}` : ''}`;
};

// Einträge der Liste ({ summary, … }) → Tage, aufsteigend: { d, tag (Index), futter, streicheln, putzen, paeckchen
// (unbekannt zählt 0), besuch (Kürzel), gut, urlaub }. Gelesen wird mit dem Leser der Chronik (chronikTage): Was er
// nicht annimmt (Fremdes, von Hand umgeschriebene Tage), fehlt hier; Dopplungen sind zusammengeführt; Felder einer
// späteren Version stören nicht.
const rueckTage = (items) => [...chronikTage(items).values()].map((e) => ({
  d: e.d, tag: chronikTag(e.d), futter: e.futter || 0, streicheln: e.streicheln || 0, putzen: e.putzen || 0, paeckchen: e.paeckchen || 0,
  besuch: [...(e.besuch || [])], gut: e.x?.gut === '1', urlaub: e.x?.urlaub === '1',
})).sort((a, b) => a.tag - b.tag);

// Monatsraster, Montag zuerst: { j, m (1–12), name („November 2026“), tage (wie viele), vor (leere Felder vor dem
// Ersten), zellen: Datum oder null, auf volle Wochen aufgefüllt }. Aus Jahr, Monat und Tag in UTC gebaut, nie durch
// „plus 24 Stunden“ in Ortszeit: Der März hat sonst an der Zeitumstellung einen Tag doppelt, der Oktober einen zu wenig.
const rueckMonat = (j, m) => {
  const tage = new Date(Date.UTC(j, m, 0)).getUTCDate();
  const vor = (new Date(Date.UTC(j, m - 1, 1)).getUTCDay() + 6) % 7;
  const kopf = `${String(j).padStart(4, '0')}-${String(m).padStart(2, '0')}-`;
  const zellen = [...Array(vor).fill(null), ...Array.from({ length: tage }, (_, i) => `${kopf}${String(i + 1).padStart(2, '0')}`)];
  while (zellen.length % 7) zellen.push(null);
  return { j, m, name: `${RUECK_MONAT[m - 1]} ${j}`, tage, vor, zellen };
};
// 'JJJJ-MM-…' → [Jahr, Monat]; ein Monat weiter oder zurück; Vergleich
const rueckJm = (d) => [Number(String(d).slice(0, 4)), Number(String(d).slice(5, 7))];
const rueckJmPlus = ([j, m], n) => {
  const k = j * 12 + (m - 1) + n;
  return [Math.floor(k / 12), (k % 12 + 12) % 12 + 1];
};
const rueckJmVgl = (a, b) => a[0] * 12 + a[1] - (b[0] * 12 + b[1]);

// Serien guter Tage: { laengste, aktuell }. heute: Index des laufenden Pika-Tags.
// - Ein guter Tag (gut=1) verlängert die Serie.
// - Ein aufgeschriebener Tag, der kein guter war, beendet sie; ein Tag ganz ohne Eintrag auch (was kein Gerät gezeigt
//   hat, war auch kein guter Tag).
// - Ein Urlaubstag (urlaub=1, nicht gut) tut beides nicht: Solange er bei seinem Freund ist, ruhen Hunger, Glück und
//   die Päckchen-Serie, ein guter Tag ist dort gar nicht zu verdienen. Er soll die Serie weder kosten noch schenken.
//   (Ein guter Tag, an dem er abends abgereist ist, zählt als guter Tag.)
// - aktuell ist die Serie, die bis zum letzten aufgeschriebenen Tag reicht, solange der höchstens zwei Tage
//   zurückliegt: Heute läuft noch und steht nie in der Liste, und gestern wird erst beim ersten Blick auf die Karte
//   nach 4:10 Uhr nachgetragen. Fehlt gestern am Morgen noch, ist die Serie darum nicht gleich dahin; fehlt der Tag
//   wirklich, zeigt es sich einen Tag später.
const rueckSerien = (tage, heute = null) => {
  if (!tage.length) return { laengste: 0, aktuell: 0 };
  const M = new Map(tage.map((t) => [t.tag, t]));
  const a = tage[0].tag;
  const b = tage.at(-1).tag;
  let lauf = 0;
  let laengste = 0;
  for (let i = a; i <= b; i++) {
    const t = M.get(i);
    if (!t) lauf = 0;
    else if (t.gut) laengste = Math.max(laengste, ++lauf);
    else if (!t.urlaub) lauf = 0;
  }
  return { laengste, aktuell: heute == null || b >= heute - 2 ? lauf : 0 };
};

// Summen über alles Aufgeschriebene: { n (Tage), gut, urlaub, futter, streicheln, mehr (an mindestens einem Tag stand
// der Zähler am Anschlag PET_CAP: Die Summe ist dann eine Untergrenze), putzen, paeckchen, besuch ([Kürzel, wie oft],
// die häufigsten zuerst, bei Gleichstand in der Reihenfolge der Chronik), laengste, aktuell, erster, letzter (Datum) }
const rueckSummen = (tage, heute = null) => {
  const S = { n: tage.length, gut: 0, urlaub: 0, futter: 0, streicheln: 0, mehr: false, putzen: 0, paeckchen: 0, besuch: [],
    ...rueckSerien(tage, heute), erster: tage[0]?.d ?? null, letzter: tage.at(-1)?.d ?? null };
  const G = new Map();
  for (const t of tage) {
    if (t.gut) S.gut++;
    if (t.urlaub) S.urlaub++;
    for (const k of ['futter', 'streicheln', 'putzen', 'paeckchen']) S[k] += t[k];
    if (t.streicheln >= PET_CAP) S.mehr = true;
    for (const k of t.besuch) if (rueckGast(k)) G.set(k, (G.get(k) || 0) + 1);
  }
  S.besuch = [...G].sort((x, y) => y[1] - x[1] || RUECK_REIHE.indexOf(x[0]) - RUECK_REIHE.indexOf(y[0]));
  return S;
};

// Besuch → [im Satz, kurz] oder null (unbekanntes Kürzel). fr: Name des Freunds aus friend_name.
const rueckGast = (k, fr = 'Pino') => (k === 'pino' ? [fr, fr]
  : hasKey(FRIENDS, k) && FRIENDS[k].name ? [FRIENDS[k].name, FRIENDS[k].name]
    : hasKey(RUECK_GAST, k) ? RUECK_GAST[k] : null);

const reihe = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} und ${list.at(-1)}` : list[0] || '');
const gross = (s) => s.replace(/^./, (c) => c.toUpperCase());

// Ein Tag aus seiner Sicht: { kopf („Dienstag, 10. November“), text, gaeste (bekannte Kürzel, für die Bilder) }.
//   3-mal gefüttert, 12-mal gestreichelt, 2 Häufchen weggemacht, 1 Päckchen ausgepackt. Pino und ein Vögelchen waren da.
// streicheln=99 heißt „99-mal oder öfter“ (PET_CAP: Weiter zählt der Tagesplan nicht).
const rueckSatz = (t, fr = 'Pino') => {
  const z = [];
  if (t.futter) z.push(`${t.futter}-mal gefüttert`);
  if (t.streicheln) z.push(t.streicheln >= PET_CAP ? `${PET_CAP}-mal oder öfter gestreichelt` : `${t.streicheln}-mal gestreichelt`);
  if (t.putzen) z.push(`${t.putzen} Häufchen weggemacht`);
  if (t.paeckchen) z.push(`${t.paeckchen} Päckchen ausgepackt`);
  const gaeste = t.besuch.filter((k) => rueckGast(k));
  const s = [];
  if (z.length) s.push(`${z.join(', ')}.`);
  if (t.urlaub) s.push(z.length ? `Einen Teil des Tages war ich bei ${fr}.` : `Da war ich bei ${fr}.`);
  else if (!z.length) s.push('Da war es ganz ruhig bei mir.');
  if (gaeste.length) s.push(`${gross(reihe(gaeste.map((k) => rueckGast(k, fr)[0])))} ${gaeste.length > 1 ? 'waren' : 'war'} da.`);
  if (t.gut) s.push('Das war ein guter Tag!');
  return { kopf: rueckDatum(t.d, { wt: true }), text: s.join(' '), gaeste };
};

// Der Satz oben auf der Seite. Welche Fassung erscheint, hängt am ersten Tag und an der Zahl der Tage (wie die Sätze
// des Tagebuchs, diaryPick): Alle Geräte zeigen dieselbe, und mit jedem neuen Tag kann sie wechseln.
// heute: Index des laufenden Pika-Tags; liegt der erste Tag in einem anderen Jahr, steht die Jahreszahl dabei.
const rueckFazit = (S, heute = null) => {
  if (!S.n) return RUECK_TXT.leer;
  const t0 = chronikTag(S.erster);
  const jahr = heute != null && utc(t0).getUTCFullYear() !== utc(heute).getUTCFullYear();
  const g = !S.gut ? RUECK_TXT.gut0 : S.gut === S.n && S.n > 1 ? RUECK_TXT.gutAlle : S.gut === 1 ? RUECK_TXT.gut1 : RUECK_TXT.gutN;
  return diaryPick(RUECK_TXT.fazit, 'rb', t0, S.n)
    .replace('{a}', rueckDatum(S.erster, { jahr }))
    .replace('{n}', S.n === 1 ? 'ein Tag steht' : `${S.n} Tage stehen`)
    .replace('{g}', diaryPick(g, 'rbg', t0, S.n).replace('{z}', S.gut));
};

export {
  RUECK, RUECK_MONAT, RUECK_WTAG, RUECK_TXT, rueckDatum, rueckTage, rueckMonat, rueckJm, rueckJmPlus, rueckJmVgl, rueckSerien, rueckSummen,
  rueckGast, rueckSatz, rueckFazit,
};
