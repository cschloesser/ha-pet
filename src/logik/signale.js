// Haus-Signale: Mülltonne, Garderobe, Saugroboter, Haustür – reine Regeln (wann, was, wie lange)

// Eine Schicht neben dem Haus-Boten: Ein Zustand in HA löst beim Pika ein Requisit, eine Pose oder einen Spruch aus,
// und er erinnert nach festen Regeln daran. Alles folgt aus den Zuständen in HA (Kalender, Vorhersage, Sauger, Tür),
// darum zeigen alle Geräte dasselbe. Geteilt werden muss nur „Tonne steht draußen“: ein Bit im Tagesplan (MEM_TONNE).
// SIG: bin = ab so viel Uhr am Vortag steht die Tonne da; binNudge = so oft erinnert er wach an sie (min, max ms);
// ward = Garderobe von bis (Stunde), bewertet werden die Stunden wardFrom bis wardTo; doorGap = höchstens so oft
// reagiert er auf die Haustür; doorFresh = nur auf ein Öffnen, das höchstens so alt ist
const SIG = {
  bin: 14, binNudge: [8 * 6e4, 12 * 6e4], ward: [6, 10], wardFrom: 7, wardTo: 19,
  rain: 0.5, umbrella: 2, cold: 3, uv: 5, doorGap: 2 * 6e4, doorFresh: 30000, rideGap: 5 * 6e4,
};

// Datum aus dem Kalender ("2026-11-18 07:00:00" in Ortszeit, oder ISO) → ms
const sigTime = (v) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)(?::(\d\d))?$/.exec(String(v ?? '').trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)).getTime();
  const d = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(v ?? '').trim());
  if (d) return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3])).getTime();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

// Farbe der Tonne aus dem Namen der Abholung
const BIN_KINDS = [
  [/wert|gelb|verpack|plastik|leichtverp/i, 'gelb', '#f2c230'],
  [/bio|grün(?!glas)|kompost/i, 'bio', '#8a5a34'],
  [/papier|pappe|blau/i, 'papier', '#3f7fc4'],
  [/glas/i, 'glas', '#4f9a5a'],
  [/rest|grau|schwarz|haus/i, 'rest', '#5d6066'],
];
const binKind = (name) => {
  const k = BIN_KINDS.find(([re]) => re.test(String(name || '')));
  return k ? { kind: k[1], color: k[2] } : { kind: 'tonne', color: '#7d848c' };
};

// Mülltonne aus dem Kalender (state, attributes: start_time, message) → { at (Abholung), from (ab da steht sie da),
// name, kind, color } oder null. Läuft die Abholung (state "on") oder ist sie vorbei, steht keine da.
const binPlan = (st, now) => {
  if (!st || st.state === 'on') return null;
  const at = sigTime(st.attributes?.start_time);
  if (at == null || at <= now) return null;
  const d = new Date(at);
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, SIG.bin).getTime();
  const name = String(st.attributes?.message || st.attributes?.description || 'Tonne');
  return { at, from, name, ...binKind(name) };
};

// Tonne schon rausgestellt? Das Bit gilt an dem Pika-Tag, an dem sie dasteht (Vortag), und am Tag der Abholung
// (cute.d zwischen beiden; der Tag davor oder ein alter Tag zählen nicht)
const binDone = (cute, dFrom, dAt, bit) => !!cute && (cute.m & bit) !== 0 && cute.d >= dFrom && cute.d <= dAt;

// Garderobe: was man heute braucht, aus der stündlichen Vorhersage ([{ datetime, temperature, precipitation,
// uv_index }]) für die Stunden SIG.wardFrom bis SIG.wardTo des Tags day (ms, irgendwann an dem Tag). Reihenfolge:
// was an die Tür gehört, von unten nach oben. → ['boots', 'umbrella', 'hat', 'sunhat'] (Auswahl)
const wardrobePick = (fc, day) => {
  const d = new Date(day);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate(), SIG.wardFrom).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate(), SIG.wardTo).getTime();
  const hrs = (Array.isArray(fc) ? fc : []).filter((h) => {
    const t = Date.parse(h?.datetime);
    return t >= a && t < b;
  });
  if (!hrs.length) return [];
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const rain = hrs.reduce((s, h) => s + (num(h.precipitation) ?? 0), 0);
  const temps = hrs.map((h) => num(h.temperature)).filter((v) => v != null);
  const uv = Math.max(0, ...hrs.map((h) => num(h.uv_index) ?? 0));
  const out = [];
  if (rain >= SIG.rain) out.push('boots');
  if (rain >= SIG.umbrella) out.push('umbrella');
  if (temps.length && Math.min(...temps) <= SIG.cold) out.push('hat');
  if (uv >= SIG.uv) out.push('sunhat');
  return out;
};
// Was er dazu sagt
const WARD_SAY = {
  boots: ['Gummistiefel heute!', 'Pfützen-Wetter!'], umbrella: ['Schirm nicht vergessen!', 'Regen kommt!'],
  hat: ['Mütze auf!', 'Brr, kalt heute!'], sunhat: ['Sonnenhut!', 'Viel Sonne heute!'],
};

// Saugroboter: Zustand → was er tut. drive: fährt über die Wiese, home: fährt zur Station (aus dem Bild), stuck:
// steckt fest (Störung), stop: steht (angehalten), null: in der Station (nicht zu sehen)
const VAC = {
  cleaning: 'drive', returning: 'home', paused: 'stop', idle: 'stop', error: 'stuck',
};
const vacMode = (state) => VAC[String(state || '').toLowerCase()] ?? null;
// Läufe aus dem Verlauf ([{ t, s }] aufsteigend) → [{ t (Beginn), end, min }]: von „cleaning“ bis „docked“
// (Zwischenstopps und kurze Rückfahrten gehören dazu). Ein Lauf unter 2 Minuten (an- und gleich wieder aus) zählt nicht.
const vacRuns = (rows) => {
  const out = [];
  let run = null;
  for (const r of rows || []) {
    const s = String(r.s ?? '').toLowerCase();
    if (s === 'cleaning' && !run) run = { t: r.t };
    else if (s === 'docked' && run) {
      if (r.t - run.t >= 2 * 6e4) out.push({ t: run.t, end: r.t, min: Math.round((r.t - run.t) / 6e4) });
      run = null;
    }
  }
  // Läufe, die nur Minuten auseinander liegen (abgesetzt und neu gestartet), sind einer
  const merged = [];
  for (const x of out) {
    const last = merged.at(-1);
    if (last && x.t - last.end < 10 * 6e4) Object.assign(last, { end: x.end, min: Math.round((x.end - last.t) / 6e4) });
    else merged.push({ ...x });
  }
  return merged;
};

export { SIG, sigTime, BIN_KINDS, binKind, binPlan, binDone, wardrobePick, WARD_SAY, VAC, vacMode, vacRuns };
