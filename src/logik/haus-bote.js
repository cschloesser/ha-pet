// Haus-Bote: Maße, Fristen, Reihe der Requisiten, Zustände und Namen der Geräte

import { clamp } from './hilfen.js';

// Waschmaschine, Trockner und Spülmaschine (Home Connect) stehen als kleine Requisiten am Bau. Phasen je
// Gerät: run (läuft), done (fertig, noch nicht geöffnet), empty (ausgeräumt, 20 Minuten lang).
// Ihre Grafiken (BOTE_SVG in src/grafik/haus-bote.js) sind in Einheiten von BOTE_K × Kartenhöhe gezeichnet.
const BOTE_K = 0.004;
const BOTE_EMPTY_MS = 20 * 60000;
// Spüler mit AutoOpen öffnen die Tür am Programmende selbst einen Spalt: so lange zählt Tür auf nicht als ausgeräumt
const BOTE_AUTOOPEN_MS = 2 * 60000;
// Vorn auf dem Wiesenstreifen: so viel größer und so viel × Kartenhöhe tiefer als hinten
const BOTE_FRONT = 1.1;
const BOTE_FRONT_DY = 0.07; // ganz vorn am unteren Rand, der Fortschrittsbalken liegt auf dem Fuß des Requisits
const BOTE_TALL = 0.55; // die hohe Wäscheleine steht vorn kleiner
// Plätze der Requisiten vorn am unteren Rand, von links in der Reihenfolge von ws (Wunschbreiten in px).
// o: { gap, left, right, door: [a, b], deko: [[a, b] …], store: [a, b], meadow }. Gesperrt sind der Eingang (dort
// schläft der Pika), die Bodendeko der Festtage und der Vorrat (Nische oder Heuhaufen); ein Requisit, das eine
// Sperre träfe, rückt hinter sie. Der Reihe nach wird versucht, bis alles Platz hat: 1. links vom Vorrat bleiben
// (dafür bis 20 % kleiner), 2. höchstens bis meadow (ein Stück auf die Wiese, bis 25 % kleiner), 3. bis zum rechten
// Rand (so kurz wie möglich), 4. der Vorrat darf verdeckt werden, 5. auch die Deko, 6. alles dicht an dicht wie früher (schmale Karte).
// Alle Requisiten werden gemeinsam gleich stark kleiner (k). Ergebnis: { k, xs: linke Kanten, tier: 1–6 }.
const boteRow = (ws, o) => {
  const place = (k, blocks, end) => {
    let x = o.left;
    const xs = [];
    for (const w0 of ws) {
      const w = w0 * k;
      // hinter jede Sperre rücken, die das Requisit träfe (bis nichts mehr im Weg ist: x wächst nur)
      for (let moved = true; moved;) {
        moved = false;
        for (const [a, b] of blocks) {
          if (x < b && x + w > a) {
            x = b;
            moved = true;
          }
        }
      }
      if (x + w > end + 1e-6) return null;
      xs.push(x);
      x += w + o.gap;
    }
    return xs;
  };
  const tiers = [
    [[o.door, ...o.deko, o.store], Math.min(o.right, o.store[0]), 0.8],
    [[o.door, ...o.deko, o.store], Math.min(o.right, o.meadow), 0.75],
    [[o.door, ...o.deko, o.store], o.right, 0.75],
    [[o.door, ...o.deko], o.right, 0.6],
    [[o.door], o.right, 0.5],
  ];
  for (let t = 0; t < tiers.length; t++) {
    const [blocks, end, kMin] = tiers[t];
    // in Schritten von 5 %, größte passende Größe zuerst. Stufe 3 (weit auf die Wiese, die dem Pika gehört) nimmt
    // stattdessen die größte, mit der die Reihe höchstens ein halbes Gerät länger wird als die kürzeste.
    const fits = [];
    for (let i = 20; i >= Math.round(kMin * 20); i--) {
      const k = i / 20;
      const xs = place(k, blocks, end);
      if (!xs) continue;
      const r = { k, xs, tier: t + 1, end: xs[xs.length - 1] + ws[ws.length - 1] * k };
      if (t !== 2) return r;
      fits.push(r);
    }
    if (fits.length) {
      const short = Math.min(...fits.map((r) => r.end)) + Math.max(...ws) / 2;
      return fits.find((r) => r.end <= short);
    }
  }
  const sum = ws.reduce((t, w) => t + w, 0);
  const k = clamp((o.right - o.left - o.gap * (ws.length - 1)) / sum, 0.4, 1);
  let x = o.left;
  return { k, tier: 6, xs: ws.map((w) => { const l = x; x += w * k + o.gap; return l; }) };
};
const BOTE_RUN = new Set(['run', 'pause', 'delayedstart', 'actionrequired', 'error', 'aborting']);
const BOTE_HALT = new Set(['pause', 'delayedstart', 'actionrequired', 'error', 'aborting']);
const BOTE_IDLE = new Set(['ready', 'inactive', 'off', 'standby']);
// Kein echter Zustand (WLAN weg, Neustart): Gerät behält, was es zuletzt war
const BOTE_DEAD = new Set(['', 'unavailable', 'unknown', 'none', 'notconnected']);
const BOTE_WARNED = new Set(); // schon gemeldete Konfigurationsfehler (console.warn nur einmal)
// Zustandsnamen anderer Integrationen (Miele, LG ThinQ, SmartThings …) auf Home Connect abbilden.
// Schlüssel wie norm() in _boteRead: klein, ohne Leerzeichen, _ und -.
const BOTE_ALIAS = {
  running: 'run', inuse: 'run', washing: 'run', rinsing: 'run', spinning: 'run', drying: 'run', cooling: 'run',
  detecting: 'run', steam: 'run', rinse: 'run', spin: 'run', wash: 'run', dry: 'run', active: 'run',
  paused: 'pause', rinsehold: 'pause',
  waitingtostart: 'delayedstart', reservation: 'delayedstart', reserved: 'delayedstart', delayed: 'delayedstart', scheduled: 'delayedstart',
  failure: 'error', fault: 'error', programinterrupted: 'error', service: 'actionrequired',
  programended: 'finished', end: 'finished', finish: 'finished', done: 'finished', complete: 'finished', completed: 'finished',
  on: 'ready', idle: 'ready', programmed: 'ready', initial: 'ready', stop: 'ready', standby: 'ready',
  off: 'inactive', poweroff: 'inactive', sleep: 'inactive',
};
const BOTE_TYPE = {
  washer: 'washer', washingmachine: 'washer', waschmaschine: 'washer',
  dryer: 'dryer', tumbledryer: 'dryer', trockner: 'dryer',
  dishwasher: 'dishwasher', dish: 'dishwasher', geschirrspueler: 'dishwasher', geschirrspuler: 'dishwasher',
  'geschirrspüler': 'dishwasher', spuelmaschine: 'dishwasher', 'spülmaschine': 'dishwasher',
};
const BOTE_NAME = { washer: 'Waschmaschine', dryer: 'Trockner', dishwasher: 'Spülmaschine' };
const BOTE_COLOR = { washer: '#5fb9de', dryer: '#f0a04b', dishwasher: '#7cc35a' };
const BOTE_ACT = { washer: 'boteStir', dryer: 'boteWatchDrum', dishwasher: 'boteDip' };
const BOTE_SAY = { washer: ['Wäsche!', 'fertig!', 'Wäsche!'], dryer: ['fertig!', 'Trockner!'], dishwasher: ['Geschirr!', 'fertig!', 'Geschirr!'] };

export {
  BOTE_K, BOTE_EMPTY_MS, BOTE_AUTOOPEN_MS, BOTE_FRONT, BOTE_FRONT_DY, BOTE_TALL, boteRow, BOTE_RUN, BOTE_HALT,
  BOTE_IDLE, BOTE_DEAD, BOTE_WARNED, BOTE_ALIAS, BOTE_TYPE, BOTE_NAME, BOTE_COLOR, BOTE_ACT, BOTE_SAY,
};
