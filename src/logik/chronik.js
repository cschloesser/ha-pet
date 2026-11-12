// Chronik: Tagesbilanz in einer To-do-Liste von HA: Format, lesen, zusammenführen, Bilanz ableiten, Schritte planen

import { hasKey } from './hilfen.js';
import { PET_CAP } from './tagesplan.js';

// Die beiden Helfer fassen 100 und 255 Zeichen: Was länger zurückliegt, fällt dort heraus, und der Recorder vergisst
// es nach ein paar Tagen. Die Chronik (chronicle_entity, eine To-do-Liste von HA) ist das kalte, geteilte Gedächtnis
// daneben: ein Eintrag je Pika-Tag, alles im Titel, unbegrenzt viele.
//   Pika-Tag 2026-11-10 · futter=3 streicheln=12 putzen=2 paeckchen=1 besuch=pino,vogel
// Kopf, Datum (der Kalendertag, an dem der Pika-Tag um 4 Uhr beginnt), danach Felder schlüssel=wert. Beschreibung,
// Fälligkeit und Status gehören nicht dazu: Ein Mensch darf einen Tag abhaken oder eine Notiz dazuschreiben.
// HA kennt keine Eindeutigkeit und vergibt die Kennung (uid) selbst: Legen zwei Geräte denselben Tag gleichzeitig an,
// stehen zwei Einträge da. Darum ist alles hier so gebaut, dass jedes Gerät aus derselben Liste dieselben Schritte
// ableitet (chronikPlan) und Zusammenführen in jeder Reihenfolge dasselbe ergibt (chronikMisch).
// back: so viele Tage zurück wird nachgetragen, wait: so lange nach Tagesbeginn (4 Uhr) wird frühestens geprüft,
// jitter: dazu ein Versatz je Gerät, check + checkJit: Wartezeit nach eigenem Schreiben bis zum Nachprüfen,
// retry: Pause nach einem Fehlschlag (mit jedem weiteren in Folge das Doppelte, höchstens retryMax), rounds: höchstens
// so viele Runden Nachprüfen, hang: ein Lauf, der länger dauert, hängt (und wird aufgegeben), frisch: geändert und
// gelöscht wird nur aus einem Lesestand, der höchstens so alt ist
const CHRONIK = {
  kopf: 'Pika-Tag ', back: 7, wait: 10 * 6e4, jitter: 10 * 6e4, check: 30000, checkJit: 30000, retry: 36e5, retryMax: 24 * 36e5,
  rounds: 3, hang: 10 * 6e4, frisch: 10000,
};
// Bekannte Felder in der Reihenfolge, in der sie geschrieben werden: vier Zähler, dann der Besuch
const CHRONIK_NUM = ['futter', 'streicheln', 'putzen', 'paeckchen'];
// Besuch: Kürzel in fester Reihenfolge (unbekannte einer späteren Version dahinter, nach dem Alphabet) und aus
// welchem Erlebnis (MEM_BITS) sie kommen
// (kirby, rufus, katzumi seit 0.41: die Freunde, die statt Pino kommen)
const CHRONIK_GAST = ['pino', 'kirby', 'rufus', 'katzumi', 'vogel', 'falter'];
const CHRONIK_MEM = { pino: 'pino', kirby: 'kirby', rufus: 'rufus', katzumi: 'katzumi', bird: 'vogel', bfly: 'falter' };

// Tagesindex (pikaDay) ↔ 'JJJJ-MM-TT'. Zurück nur für Daten, die es gibt (kein 30. Februar): Hin- und Rückweg müssen
// übereinstimmen.
// (nur Jahre mit vier Ziffern: grob 0053 bis 9909)
const chronikDatum = (tag) => (Number.isInteger(tag) && tag > -7e5 && tag < 2.9e6 ? new Date(tag * 864e5).toISOString().slice(0, 10) : null);
const chronikTag = (datum) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum ?? ''));
  if (!m) return null;
  const tag = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 864e5;
  return chronikDatum(tag) === m[0] ? tag : null;
};
// Beginn des Pika-Tags: 4 Uhr Ortszeit an diesem Datum (wie _diaryDay)
const chronikStart = (tag) => {
  const d = new Date(tag * 864e5);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4).getTime();
};

// Pika-Tag und Tagesbeginn rechnet die Karte in der Zeitzone des Geräts. Steht es in einer anderen als HA (ein Handy
// auf Reisen), beginnt sein „heute“ zu einer anderen Stunde: In Tokio wäre der Tag von zu Hause schon am Abend
// „abgeschlossen“, und der halbe Eintrag bliebe stehen. Darum schreibt nur, wessen Ortszeit zur Zone von HA passt.
// chronikVersatz: Minuten östlich von UTC, die in der Zone zum Zeitpunkt t gelten; null, wenn der Browser die Zone
// nicht kennt (oder keine genannt ist).
const chronikVersatz = (zone, t) => {
  if (typeof zone !== 'string' || !zone) return null;
  try {
    const p = {};
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    for (const x of fmt.formatToParts(new Date(t))) p[x.type] = Number(x.value);
    const v = (Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000) / 6e4;
    return Number.isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
};
// Gilt in der Zone von HA zu jedem der Zeitpunkte derselbe Versatz wie auf diesem Gerät (lokal(t), Minuten östlich
// von UTC)? Mehrere Zeitpunkte, weil zwei Zonen heute gleich gehen können und vor einer Woche (vor der Zeitumstellung
// der einen) nicht. Nicht prüfbar (keine Zone genannt, der Browser kennt sie nicht): gilt als passend, wie bisher.
const chronikZoneOk = (zone, zeiten, lokal = (t) => -new Date(t).getTimezoneOffset()) => {
  for (const t of zeiten) {
    const v = chronikVersatz(zone, t);
    if (v == null) return true;
    if (v !== lokal(t)) return false;
  }
  return true;
};

const gastSort = (list) => [...new Set(list)].sort((a, b) => {
  const i = CHRONIK_GAST.indexOf(a);
  const j = CHRONIK_GAST.indexOf(b);
  return i >= 0 && j >= 0 ? i - j : i >= 0 ? -1 : j >= 0 ? 1 : a < b ? -1 : a > b ? 1 : 0;
});

// Eintrag { d: 'JJJJ-MM-TT', futter, streicheln, putzen, paeckchen (Zahl oder null = unbekannt), besuch (Liste der
// Kürzel oder null), x: { unbekannte Felder } } → Titel. Unbekanntes wird nicht geschrieben; ein Eintrag ohne Felder
// ist nur Kopf und Datum.
const chronikKod = (e) => {
  const f = [];
  for (const k of CHRONIK_NUM) if (e[k] != null) f.push(`${k}=${e[k]}`);
  if (e.besuch) f.push(`besuch=${gastSort(e.besuch).join(',') || '-'}`);
  for (const k of Object.keys(e.x || {}).sort()) f.push(`${k}=${e.x[k]}`);
  return `${CHRONIK.kopf}${e.d}${f.length ? ` · ${f.join(' ')}` : ''}`;
};

// Titel → null (fremder Eintrag: ein Mensch, etwas ganz anderes; wird nie angefasst und zählt für keinen Tag)
//       | { d, fremd: true } (Kopf und Datum stimmen, der Rest ist nicht sauber lesbar: Der Tag gilt als belegt, der
//         Eintrag wird nie geändert, gelöscht oder zusammengeführt)
//       | Eintrag wie bei chronikKod (fehlende bekannte Felder null).
// Großzügig beim Lesen (beliebige Leerzeichen, „·“ auch ohne Leerzeichen oder gar nicht), streng beim Inhalt: Ein
// halb verstandener Eintrag würde beim Zusammenführen überschrieben, und was ein Mensch dazugeschrieben hat, wäre weg.
const chronikLies = (titel) => {
  if (typeof titel !== 'string' || !titel.startsWith(CHRONIK.kopf)) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?!\d)([\s\S]*)$/.exec(titel.slice(CHRONIK.kopf.length));
  if (!m || chronikTag(m[1]) == null) return null;
  const d = m[1];
  const fremd = { d, fremd: true };
  const e = { d, futter: null, streicheln: null, putzen: null, paeckchen: null, besuch: null, x: {} };
  if (!m[2].trim()) return e;
  const r = /^(?:\s*·\s*|\s+)([\s\S]*)$/.exec(m[2]);
  if (!r) return fremd;
  const seen = new Set();
  for (const tok of r[1].split(/\s+/).filter(Boolean)) {
    const q = /^([a-z][a-z0-9_]*)=(\S+)$/.exec(tok);
    if (!q || seen.has(q[1])) return fremd;
    const [, k, v] = q;
    seen.add(k);
    if (CHRONIK_NUM.includes(k)) {
      if (!/^\d{1,9}$/.test(v)) return fremd;
      e[k] = Number(v);
    } else if (k === 'besuch') {
      if (v !== '-' && !/^[a-z][a-z0-9_]*(,[a-z][a-z0-9_]*)*$/.test(v)) return fremd;
      e.besuch = v === '-' ? [] : gastSort(v.split(','));
    } else e.x[k] = v;
  }
  return e;
};

// Zwei lesbare Einträge desselben Tags zusammenführen: Zahlen das Größere (unbekannt weicht der Zahl), Besuch und
// unbekannte Felder vereinigt (derselbe Schlüssel mit zwei Werten: der als Text größere). Die Geräte leiten die
// Bilanz aus demselben Verlauf ab, das Größere ist das Vollständigere. Die Reihenfolge ist egal, und zweimal
// dasselbe ändert nichts: So kommen alle Geräte auf denselben Titel, wer auch zuerst schreibt.
const chronikMisch = (a, b) => {
  const e = { d: (a || b).d, futter: null, streicheln: null, putzen: null, paeckchen: null, besuch: null, x: {} };
  for (const o of [a, b]) {
    if (!o) continue;
    for (const k of CHRONIK_NUM) if (o[k] != null) e[k] = e[k] == null ? o[k] : Math.max(e[k], o[k]);
    if (o.besuch) e.besuch = [...(e.besuch || []), ...o.besuch];
    for (const k of Object.keys(o.x || {})) if (!hasKey(e.x, k) || o.x[k] > e.x[k]) e.x[k] = o.x[k];
  }
  if (e.besuch) e.besuch = gastSort(e.besuch);
  e.x = Object.fromEntries(Object.keys(e.x).sort().map((k) => [k, e.x[k]]));
  return e;
};

// Bilanz eines Pika-Tags (Index tag, von start bis end) aus dem Ergebnis von diaryDerive. Seit 0.35 dazu (als Felder,
// die 0.34 nicht kennt und beim Zusammenführen erhält): gut=1 an einem guten Tag (Freundschaftstag), urlaub=1, wenn er
// an dem Tag (auch nur zeitweise) bei seinem Freund war. urlaub: [[Beginn, Ende]] aus diaryDerive.
const chronikBilanz = (ev, pets, start, end, tag, urlaub = []) => {
  const e = { d: chronikDatum(tag), futter: 0, streicheln: Math.min(Math.max(0, Math.floor(Number(pets?.[tag]) || 0)), PET_CAP), putzen: 0, paeckchen: 0, besuch: [], x: {} };
  for (const v of ev) {
    if (!(v.t >= start && v.t < end)) continue;
    if (v.k === 'feed') e.futter++;
    else if (v.k === 'clean') e.putzen += v.n || 0;
    else if (v.k === 'parcel') e.paeckchen++;
    else if (v.k === 'mem' && hasKey(CHRONIK_MEM, v.b)) e.besuch.push(CHRONIK_MEM[v.b]);
    else if (v.k === 'mem' && v.b === 'gut') e.x.gut = '1';
  }
  if (chronikUrlaub(urlaub, start, end)) e.x.urlaub = '1';
  e.besuch = gastSort(e.besuch);
  return e;
};

// Fällt [start, end) zum Teil in einen Urlaub?
const chronikUrlaub = (urlaub, start, end) => (urlaub || []).some(([a, b]) => a < end && b > start);

// Einträge der Liste ({ summary, uid, … }) nach Datum: lesbare (les: [{ uid, e }]) und ob ein „fremd für diesen
// Tag“ dabei ist. Gelesen wird jeder Status, auch Abgehaktes.
const chronikGruppen = (items) => {
  const G = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    const e = chronikLies(it?.summary);
    if (!e) continue;
    if (!G.has(e.d)) G.set(e.d, { les: [], fremd: false });
    if (e.fremd) G.get(e.d).fremd = true;
    else G.get(e.d).les.push({ uid: it.uid, e });
  }
  return G;
};

// Liste → Map Datum → lesbarer Eintrag (Dopplungen zusammengeführt). Zum Lesen: So gilt derselbe Stand, ob die
// Dopplungen schon aufgeräumt sind oder nicht.
const chronikTage = (items) => {
  const T = new Map();
  for (const [d, g] of chronikGruppen(items)) if (g.les.length) T.set(d, g.les.reduce((m, x) => chronikMisch(m, x.e), null));
  return T;
};

// Tagesindizes aus heute − back … heute − 1, für die nichts in der Liste steht (weder lesbar noch „fremd für diesen
// Tag“), aufsteigend
const chronikFehlt = (items, heute, back) => {
  const G = chronikGruppen(items);
  const out = [];
  for (let tag = heute - back; tag < heute; tag++) if (!G.has(chronikDatum(tag))) out.push(tag);
  return out;
};

// Liste und soll (Datum → Eintrag: Map, Liste von Paaren oder Objekt; darf fehlen) → Schritte in der Reihenfolge,
// in der sie auszuführen sind, aufsteigend nach Datum (d):
//   { op: 'add', d, summary } | { op: 'update', d, uid, summary } | { op: 'remove', d, uid }
// Stehen für einen Tag mehrere lesbare Einträge da, bleibt der mit der (als Text) kleinsten uid, bekommt bei Bedarf
// den zusammengeführten Titel, die anderen werden gelöscht (erst ändern, dann löschen). Alle Geräte treffen so
// dieselbe Wahl und schreiben denselben Titel. Verglichen wird kodiert gegen kodiert: Ein Eintrag, der nur anders
// formatiert ist, wird nicht umgeschrieben. Gibt es den Tag noch nicht, wird er angelegt; steht für ihn nur ein
// „fremd für diesen Tag“ da (oder ein lesbarer Eintrag ohne uid, den niemand ändern könnte), passiert nichts.
// Wendet man die Schritte an und plant erneut, ist der Plan leer.
const chronikPlan = (items, soll) => {
  const G = chronikGruppen(items);
  const S = new Map(!soll ? [] : typeof soll[Symbol.iterator] === 'function' ? [...soll] : Object.entries(soll));
  const out = [];
  for (const d of [...new Set([...G.keys(), ...S.keys()])].sort()) {
    const g = G.get(d);
    const neu = S.get(d);
    if (!g) {
      if (neu && chronikTag(d) != null) out.push({ op: 'add', d, summary: chronikKod({ ...neu, d }) });
      continue;
    }
    if (!g.les.length || g.les.some((x) => typeof x.uid !== 'string' || !x.uid)) continue;
    const les = [...g.les].sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    const alle = les.reduce((m, x) => chronikMisch(m, x.e), neu ? { ...neu, d } : null);
    const summary = chronikKod(alle);
    if (summary !== chronikKod(les[0].e)) out.push({ op: 'update', d, uid: les[0].uid, summary });
    for (const x of les.slice(1)) out.push({ op: 'remove', d, uid: x.uid });
  }
  return out;
};

export {
  CHRONIK, chronikDatum, chronikTag, chronikStart, chronikVersatz, chronikZoneOk, chronikKod, chronikLies, chronikMisch, chronikBilanz, chronikUrlaub,
  chronikTage, chronikFehlt, chronikPlan,
};
