// Offenes Fenster (seit 0.40): Fenster- und Türkontakte aus HA → Lage (offen, seit wann, welche) – reine Regeln

// Ist im Haus ein Fenster offen, öffnet der Pika das runde Fenster an seinem Bau. Alles folgt aus Zustand und
// last_changed der Kontakte in HA, nicht aus dem Laden der Seite: So zeigen alle Geräte dasselbe.
// WIN.open: „offen“ erst, wenn ein Kontakt so lange offen ist (Stoßlüften ja, ein Türklappern nein).
// WIN.close: „zu“ erst, wenn seit so langer Zeit keiner mehr offen ist. Die Kammer flattert (im 7-Tage-Verlauf vom
// 2026-11-12 an einem Nachmittag 40 Wechsel in 10 Minuten, Pausen bis 11 s): Mit der Nachfrist bleibt das eine Lüften.
// WIN.list: so viele Namen im Fähnchen, der Rest als „+n“.
const WIN = { open: 30000, close: 20000, list: 3 };

// Option signals.window: ein Kontakt, eine Liste, Einträge auch als { entity, name } → [{ id, name }] (ohne doppelte)
const winIds = (v) => {
  const out = [];
  for (const x of Array.isArray(v) ? v : v ? [v] : []) {
    const id = typeof x === 'string' ? x.trim() : typeof x?.entity === 'string' ? x.entity.trim() : '';
    if (!id || out.some((o) => o.id === id)) continue;
    const name = typeof x === 'object' && x && typeof x.name === 'string' && x.name.trim() ? x.name.trim() : null;
    out.push({ id, name });
  }
  return out;
};

// Kurzer Name für das Fähnchen: eigener Name, sonst friendly_name ohne „Fenster“, „Fensterkontakt“, „Kontakt“ davor
// und ohne „Kontakt“, „Contact“ dahinter, sonst die ID ohne Domäne
const winName = (st, id, name) => {
  if (name) return name;
  const fn = String(st?.attributes?.friendly_name || '').trim();
  const kurz = fn.replace(/^(fenster|tür|tuer)?(kontakt|sensor)?\s+/i, '').replace(/\s+(kontakt|contact|sensor)$/i, '').trim();
  return kurz || fn || String(id).replace(/^[^.]*\./, '');
};

// Lage der Kontakte zum Zeitpunkt now. rows: [{ id, name, state, t (last_changed in ms) }] in der Reihenfolge der
// Option. was: die vorige Lage (oder null nach dem Laden).
// → { open, since (Beginn des Lüftens, ms), names (offene Kontakte), due (nächster Zeitpunkt, an dem sich die Lage
// von selbst ändern kann, oder null) }. In der Nachfrist ist names leer (alle zu).
// Nur „on“ ist offen; unavailable, unknown und leere Zustände (Neustart von HA, Funkloch) zählen als zu.
// Ist es zu, wird es offen, sobald ein Kontakt WIN.open lang offen ist. Ist es offen, bleibt es offen, solange einer
// offen ist (auch ein frisch wieder geöffneter), und noch WIN.close nach dem letzten Schließen.
// Nach dem Laden (was = null) fehlt die Vorgeschichte: Mitten im Flattern oder in der Nachfrist zeigt ein frisch
// geladenes Gerät kurz „zu“, die anderen „offen“ (im echten Verlauf bei 80 von 60 124 Ladezeitpunkten, alle 10 s
// über die Woche). „Schon offen, wenn einer offen ist“ wäre schlechter (97).
const winLage = (rows, now, was) => {
  const on = rows.filter((r) => r.state === 'on');
  const names = on.map((r) => r.name);
  const first = on.length ? Math.min(...on.map((r) => r.t)) : null;
  if (was?.open) {
    if (on.length) return { open: true, since: Math.min(was.since, first), names, due: null };
    const zu = Math.max(0, ...rows.map((r) => r.t).filter(Number.isFinite));
    if (now - zu < WIN.close) return { open: true, since: was.since, names: [], due: zu + WIN.close };
    return { open: false, since: null, names: [], due: null };
  }
  if (on.length && now - first >= WIN.open) return { open: true, since: first, names, due: null };
  return { open: false, since: null, names: [], due: on.length ? first + WIN.open : null };
};

// „seit 12 Min“, „seit 1 Std 20 Min“, „seit eben“
const winSeit = (ms) => {
  const m = Math.max(0, Math.floor(ms / 6e4));
  if (m < 1) return 'seit eben';
  if (m < 60) return `seit ${m} Min`;
  const h = Math.floor(m / 60);
  return `seit ${h} Std${m % 60 ? ` ${m % 60} Min` : ''}`;
};

// Text des Fähnchens: „offen: Küche, Bad unten · seit 12 Min“; in der Nachfrist (alle schon zu) „alle zu · gerade eben“
const winText = (lage, now) => {
  const n = lage.names;
  if (!n.length) return 'alle zu · gerade eben';
  const shown = n.slice(0, WIN.list).join(', ') + (n.length > WIN.list ? ` +${n.length - WIN.list}` : '');
  return `offen: ${shown} · ${winSeit(now - lage.since)}`;
};

export { WIN, winIds, winName, winLage, winSeit, winText };
