// Beschäftigungen: Fenster des Tagesplans, Dauern, Listen, Häufchen dazwischen, Lauftempo, Hopser und Sprünge, Drachen, Einstieg, Frühsport, Requisiten hervorkramen

import { clamp, seedRnd } from './hilfen.js';
import { POOP } from './zustand.js';
import { CUTE_SMALL } from './interaktion.js';
import {
  MINI_ACTS, PUDDLE_MS, puddleJumps, BOAT_T, boatPuffs, YOYO_MS, YOYO_DEAD, yoyoThrows, yoyoDead, PUSTE_MS, PURZEL_MS,
  purzelRolls, STONE_MS, GLIDER_STEP,
} from './beschaeftigungen-klein.js';

// ==================== Aktivitäten: Konstanten, Grafiken und Stil ====================
// Tagesplan: Beschäftigungen kommen aus der Uhrzeit (seedRnd), damit alle Geräte zur selben Zeit dasselbe zeigen
// und ein neu geladenes Gerät mitten in die laufende einsteigt.
// - Groß (Lesen, Gameboy, Tablet, Drachen, TV, Musik, Malen, Seifenblasen, Frühsport; 1–2,5 Min): die Uhr ist in
//   Fenster von ACT_WIN.big geteilt, in jedem beginnt eine in den ersten ACT_WIN.spread. Abstand also 9–19 Min.
// - Klein (Seilspringen, Gewichtheben, Blüte für den Vorrat sammeln, Hula-Hoop, Jo-Jo, Pusteblume, Purzelbaum,
//   Steintürmchen, Jonglieren, Blumenkranz, Papierflieger; bei Regen Pfützenspringen und Papierschiffchen, bei
//   Schnee der Schnee-Pika; 10–30 s): Fenster ACT_WIN.mini, mit Wahrscheinlichkeit ACT_WIN.miniP, nie dicht an
//   einer großen. Auswahl und Gewichte: MINI_W, MINI_PROG, miniOk, miniChain.
// - Welche es wird, hängt am Wetter (auf allen Geräten dasselbe), an der Tagesform und am Verlauf: Die letzten
//   ACT_RECENT großen kommen nicht gleich wieder dran. Der Verlauf liegt im Helfer plan_entity; wer ein Fenster
//   zuerst beginnt, trägt es dort ein, die anderen übernehmen die Wahl (auch wenn sich das Wetter inzwischen änderte).
// - Tagesform: je Kalendertag zwei Lieblinge (× 2) und eine Unlust (× 0,2) aus ACT_MOOD, aus dem Datum gewürfelt.
// - Schaut keiner hin (Bildschirm aus), lässt das Gerät die Beschäftigungen aus; geht er an, steigt es ein.
const ACT_WIN = { big: 14 * 6e4, spread: 5 * 6e4, mini: 4 * 6e4, miniP: 0.8, miniRoom: 50000 };
// Rund um den Beginn einer großen keine kleine (davor / danach in ms)
const ACT_GAP = [45000, 200000];
const WEIGHT_REP = 9000; // eine Wiederholung Gewichtheben
// Dauer des Hauptteils in ms (ohne Hinlaufen ACT_WALK und Ausklang), aus den festen Zahlen r(1…) des Fensters
const ACT_WALK = 5000;
const ACT_LEN = {
  read: (r) => 50000 + r(1) * 50000,
  game: (r) => 35000 + r(1) * 35000,
  tablet: (r) => 45000 + r(1) * 45000,
  kite: (r) => 40000 + r(1) * 40000,
  tv: (r) => 60000 + r(1) * 70000,
  music: (r) => 60000 + r(1) * 50000,
  paint: (r) => 30000 + r(1) * 15000,
  bubbles: (r) => 45000 + r(1) * 35000,
  sport: (r) => sportPlan(r).len - ACT_WALK,
  rope: (r) => 600 + ropeJumps(r) * (620 + r(4) * 100),
  weights: (r) => 600 + (1 + Math.floor(r(1) * 3)) * WEIGHT_REP,
  gather: () => 9000,
  hula: (r) => 8000 + r(1) * 6000,
  yoyo: (r) => 600 + yoyoThrows(r) * YOYO_MS + (yoyoDead(r) > 0 ? YOYO_DEAD : 0),
  puste: () => 800 + 3 * PUSTE_MS,
  purzel: (r) => 600 + purzelRolls(r) * PURZEL_MS,
  stones: () => 400 + 4 * STONE_MS + 500,
  juggle: (r) => 7000 + r(1) * 5000,
  crown: (r) => 9000 + r(1) * 3000,
  glider: () => 700 + 2 * GLIDER_STEP,
  puddle: (r) => 800 + puddleJumps(r) * PUDDLE_MS,
  boat: (r) => BOAT_T.launch + boatPuffs(r) * BOAT_T.puff + BOAT_T.back,
  snowpika: (r) => 20000 + r(1) * 6000,
};
const ropeJumps = (r) => 12 + Math.floor(r(5) * 18);
// Einsteigen nach Neuladen oder Bildschirm an: bis so viele ms vor dem Ende des Hauptteils. Die kleinen nur gleich
// zu Beginn (sie sind schnell vorbei); Pfütze, Schiffchen und Schnee-Pika laufen nach der Planzeit und lassen
// sich mittendrin aufnehmen.
const ACT_JOIN_END = 4000;
const ACT_NOJOIN = new Set(['gather', 'rope', 'weights', 'hula', 'yoyo', 'puste', 'purzel', 'stones', 'juggle', 'crown', 'glider']);
// Beginn der großen im Fenster k bzw. der kleinen im Fenster m (Planzeit, ms)
const bigStart = (k) => k * ACT_WIN.big + Math.floor(seedRnd('big', k, 0) * ACT_WIN.spread);
const miniStart = (m) => m * ACT_WIN.mini + Math.floor(seedRnd('mini', m, 1) * (ACT_WIN.mini - ACT_WIN.miniRoom));
const miniHas = (m) => seedRnd('mini', m, 0) < ACT_WIN.miniP;
// Kalendertag (Ortszeit) als Zahl
const localDay = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 6e4) / 864e5);
// Kleinigkeiten, die der Beginn einer Beschäftigung aus dem Plan sofort abbricht
const ACT_SMALL = ['idle', 'look', 'wander', 'groom', 'squeak', 'sniff', 'binky', 'hungry', 'lookout', 'burrow', 'nibble',
  'haySnack', 'hideout', 'watchBird', 'watchMouse', 'watchFrog', 'watchSnail', 'watchPlane', ...CUTE_SMALL];
const ACT_BIG = ['read', 'game', 'tablet', 'kite', 'tv', 'music', 'paint', 'bubbles', 'sport'];
const ACT_MOOD = ['read', 'game', 'tablet', 'music', 'paint', 'bubbles'];
// Ein fälliges Häufchen und das, was er gerade tut: 'go' = eine Kleinigkeit (ACT_SMALL) abbrechen und es gleich
// machen; 'wait' = erst zu Ende bringen, was läuft (Beschäftigung, Fressen, Kaffee, Auspacken, Spiel mit Pino,
// eine schon anstehende Aktion: queued), es kommt danach; 'lay' = es liegt einfach da (älter als POOP.live Minuten,
// oder er geht gerade schlafen). Wo es liegt, steht im Zustand: Warten ändert nur den Augenblick.
const POOP_GO = new Set(ACT_SMALL);
// Sauberkeit 0–100 aus den liegenden Häufchen: jedes kostet 10, dazu 2 je Stunde, die es schon liegt (höchstens 20 h)
const poopClean = (piles, now) => clamp(100 - piles.reduce((d, p) => d + (10 + 2 * Math.min(20, (now - p.due) / 36e5)), 0), 0, 100);
const poopWhen = (age, action, queued = false) => (age >= POOP.live * 6e4 || action === 'goSleep' ? 'lay'
  : !queued && (action == null || POOP_GO.has(action)) ? 'go' : 'wait');
// Hinlaufen zu einer Beschäftigung: Tempo so, dass er nach ms am Platz ist (nie langsamer als base, höchstens max).
// Tempo 1 sind 0,85 Pika-Breiten je Sekunde (_walkTo). Auf breiten Karten käme er mit festem Tempo Sekunden zu
// spät, der Hampelmann zählte dann ab „6!“. Ist die Zeit knapp oder schon um (Wiedereinstieg nach dem Füttern, einer
// Aufgabe des Haus-Boten, einem Layout-Wechsel), bekommt der Weg WALK_LATE ms: Was er im Grundtempo in dieser Zeit
// schafft, geht er wie immer, nur für Weiteres eilt er. Läuft die Beschäftigung schon (ms ≤ 0), höchstens mit
// WALK_REJOIN: zügig, aber ohne die großen Hopser (ab 1,8, _walkTo), mit denen er sonst jedes Mal zurückrannte.
const WALK_MAX = 2.6;
const WALK_LATE = 2000;
const WALK_REJOIN = 1.6;
const walkSpeed = (dist, pW, ms, base = 0.8, max = WALK_MAX) =>
  clamp(dist / (pW * 0.85 * ((ms > WALK_LATE ? ms : WALK_LATE) / 1000)) || 0, base, Math.max(base, ms > 0 ? max : Math.min(max, WALK_REJOIN)));
// Ein Hopser dauert je Gangart so lange (ms, wie die Animationen hop, hops und hopb). Ein Weg dauert immer ganze
// Hopser: Sonst endete er mitten in der Luft, und der Pika schnappte auf den Boden.
const HOP_MS = { hop: 360, trip: 240, bighop: 420 };
// Drachen: So weit lehnt er sich gegen den Zug der Schnur (Grad; rest: die ganze Zeit, tug: ms lang bei einem Ruck,
// dabei leicht gestaucht sx/sy). Der Stil dreht dafür .hop um die Füße, kitePaw rechnet aus, wo die Pfote
// (viewBox 105/50 von 120 × 100) dann ist: [dx, dy] in px ab der Mitte der Unterkante der Pika-Grafik, Blick
// nach rechts. Daran hängt die Schnur, beim Ruck läuft sie mit (.kpull).
const KITE_LEAN = { rest: 2.5, tug: 8, sx: 1.02, sy: 0.98, ms: 650 };
const kitePaw = (pW, pH, deg, sx = 1, sy = 1) => {
  const a = (deg * Math.PI) / 180;
  const x = (105 / 120 - 0.5) * pW * sx;
  const y = -0.5 * pH * sy;
  return [x * Math.cos(a) + y * Math.sin(a), y * Math.cos(a) - x * Math.sin(a)];
};
const hopRound = (ms, cycle) => Math.max(1, Math.round(ms / cycle)) * cycle;
// Sprünge auf der Stelle (ms: Dauer, air: von wann bis wann er in der Luft ist). Ein neuer Sprung, während er
// noch in der Luft ist, finge am Boden an: Der laufende wird dann zu Ende gesprungen.
const JUMPS = { hop1: { ms: 600, air: [90, 450] }, binky: { ms: 900, air: [108, 738] } };
// Ohren bei einem Sprung auf der Stelle (auch Pino): Beim Absprung bleiben sie zurück, im Fallen stehen sie hoch,
// bei der Landung (hop1 nach 0,45 s, binky nach 0,74 s) klappen sie nach vorn und pendeln aus. ms: Dauer,
// k: [Anteil der Dauer, Grad], gedreht wird zusätzlich zur Haltung, die sie gerade haben (_earSwing).
const EAR_SWING = {
  hop1: { ms: 1050, k: [[0.09, 3], [0.24, -11], [0.36, -3], [0.46, 11], [0.62, -6], [0.78, 3], [0.9, -1]] },
  binky: { ms: 1150, k: [[0.09, 3], [0.28, -13], [0.5, -4], [0.66, 12], [0.78, -6], [0.88, 3], [0.95, -1]] },
};
const jumpBusy = (kind, since) => !!JUMPS[kind] && since >= JUMPS[kind].air[0] && since < JUMPS[kind].air[1];
// Darf er ohne Hinlaufen mitten in einer laufenden Beschäftigung stehen? Nur wenn ihn vorher niemand woanders
// sah: late = so lange läuft sie schon; since = ms, seit die Karte (wieder) zu sehen ist; first = frisch geladen
// (die Seite baut sich noch auf, der Helfer kommt gleich). Sonst hoppelt er hin.
const JUMP_IN = { late: 6000, first: 5000, again: 300 };
const jumpInOk = (late, since, first) => late > JUMP_IN.late && since >= 0 && since < (first ? JUMP_IN.first : JUMP_IN.again);
// Fangen: Läuft der Läufer (bei rx) nach rechts davon? Weg vom Fänger (cx); stehen beide gleich, zur Seite mit
// mehr Platz. Ist auf der Fluchtseite keine Pika-Breite Platz mehr, geht es an ihm vorbei auf die andere.
const chaseFar = (rx, cx, lo, hi, pW) => {
  const far = rx === cx ? cx < (lo + hi) / 2 : rx > cx;
  return Math.abs((far ? hi : lo) - rx) < pW ? !far : far;
};
// Beschäftigungen, die mit Wegen in Pixeln rechnen, ohne dass ein Requisit am Boden steht: Ändert sich die Größe
// der Karte, werden sie abgebrochen (_layout)
const ACT_PX = new Set(['glider', 'purzel']);

// Beschäftigungen, die ein Wetterwechsel abbricht, wenn sie beim neuen Wetter nicht gehen (_actOk): Regen oder
// Schnee beginnt (Seil, Tablet …), der Regen hört auf (Pfütze, Schiffchen), der Schnee ist getaut (Schnee-Pika)
const WX_STOP = [...ACT_BIG, ...MINI_ACTS];
const ACT_RECENT = 3;
// Wird die Karte sichtbar (Bildschirm an, App geöffnet, Ansicht gewechselt), winkt er; höchstens alle 5 Minuten.
const ACT_SHOW_COOL = 5 * 6e4;
const ACT_GREET = ['Hallo!', 'Hi!', 'Da bist du ja!', 'iiep!', 'Hallöchen!', 'Huhu!'];
const ACT_CLS = ['waving', 'music', 'sing', 'painting', 'dab', 'mix', 'blowing', 'blow', 'sport', 'jjack', 'knee',
  'roping', 'rope-hold', 'rdbl', 'lifting', 'lift-gnd', 'lift-lo', 'lift-hi', 'strain', 'stretch', 'bowing', 'smudge',
  'kram', 'stow', 'ktug', 'tvturn',
  'hula', 'hula-go', 'hula-x', 'hula-dn', 'yoyo', 'yo-go', 'yo-dead', 'puste', 'pu-in', 'pu-2', 'pu-1', 'pu-0', 'purzel',
  'pebble', 'juggle', 'jug-go', 'plait', 'crowned', 'gliding', 'boating', 'spat'];
// Frühsport nur morgens: 10–180 Minuten nach dem Aufwachen, einmal am Tag (im Helfer plan_entity vermerkt)
const SPORT_WIN = [10, 180];
const SPORT_INTRO = 1700;
const SPORT_PAUSE = 1700; // nach jeder Übung: verschnaufen, schwitzen
// Ablauf des Frühsports aus den festen Zahlen des Fensters: 3 oder 4 Übungen mit Beginn t (ms ab Fensterbeginn),
// Dauer und Wiederholungen. len reicht vom Beginn des Fensters (mit Hinlaufen) bis zum Ende der letzten Übung.
const sportPlan = (r) => {
  const all = ['jjack', 'knee', 'jog', 'stretch'];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(r(20 + i) * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const segs = all.slice(0, r(30) < 0.4 ? 4 : 3).map((ex, i) => {
    if (ex === 'jjack') {
      const rep = (0.62 + r(40 + i) * 0.18) * 1000;
      const reps = 10 + Math.floor(r(50 + i) * 7);
      return { ex, rep, reps, len: rep * reps };
    }
    if (ex === 'knee') {
      const reps = 6 + Math.floor(r(50 + i) * 5);
      return { ex, rep: 1400, reps, len: 1400 * reps };
    }
    if (ex === 'jog') return { ex, len: 8000 + r(50 + i) * 4000 };
    return { ex, len: 3200 };
  });
  let t = ACT_WALK + SPORT_INTRO;
  for (const s of segs) {
    s.t = t;
    t += s.len + SPORT_PAUSE;
  }
  return { segs, len: t };
};


// Requisiten der Beschäftigungen in der Pika-Grafik, die hervorgekramt und weggeräumt werden (_propOn, _propOff).
// Eine neue Beschäftigung trägt ihre Gruppe hier ein, mehr braucht der Stil nicht.
const PROP_SEL = ['.book', '.gb', '.tab', '.uke', '.brush', '.wand', '.band', '.rope', '.rgrip', '.bar',
  '.hoop', '.yo', '.pbl', '.jug', '.dchain', '.dcrown', '.pgl', '.peb', '.sboat'];
const PROPS = (pre) => PROP_SEL.map((s) => `${pre} ${s}`).join(', ');
const KRAM = { in: 240, out: 200 }; // ms, wie die Animationen kram und kramweg

export {
  ACT_WIN, ACT_GAP, ACT_WALK, ACT_LEN, ropeJumps, ACT_JOIN_END, ACT_NOJOIN, bigStart, miniStart, miniHas, localDay,
  ACT_SMALL, ACT_BIG, ACT_MOOD, poopClean, poopWhen, WALK_MAX, WALK_LATE, WALK_REJOIN, walkSpeed, HOP_MS, KITE_LEAN,
  kitePaw, hopRound, JUMPS, EAR_SWING, jumpBusy, JUMP_IN, jumpInOk, chaseFar, ACT_PX, WX_STOP, ACT_RECENT,
  ACT_SHOW_COOL, ACT_GREET, ACT_CLS, SPORT_WIN, SPORT_INTRO, SPORT_PAUSE, sportPlan, PROP_SEL, PROPS, KRAM,
};
