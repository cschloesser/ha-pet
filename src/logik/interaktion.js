// Interaktion: Streicheln, Kraulen, Mimik, kleine Momente, Tipp in die Welt (Konstanten und reine Funktionen)

import { clamp } from './hilfen.js';
import { GAIN } from './zustand.js';

// Neue kleine Momente. Leicht genug, dass der Beginn einer Beschäftigung aus dem Tagesplan sie abbricht.
const CUTE_SMALL = ['curious', 'yawn', 'sneeze', 'earClean', 'scratch', 'hiccup', 'nod', 'butterfly', 'zoomies', 'gift', 'comeHere'];
// Dabei darf Streicheln eine eigene Reaktion starten (sonst nur Herzchen und Hüpfer obendrauf)
// „kraul“ gehört dazu, damit er nach dem Loslassen nicht bis zum Ausklang taub ist; solange der Finger liegt,
// sperrt _petFree selbst (_kraulOn)
const PET_FREE = new Set(['idle', 'look', 'wander', 'groom', 'squeak', 'sniff', 'binky', 'hungry', 'watchBird', 'watchMouse',
  'watchFrog', 'watchSnail', 'watchPlane', 'curious', 'yawn', 'earClean', 'scratch', 'nod', 'hiccup', 'comeHere', 'petReact', 'stroke', 'gift',
  'kraul']);
// Reaktionen auf Berührung, die über _next laufen: verfallen nach TOUCH_TTL, wenn Wichtigeres vorging
const TOUCH_NEXT = new Set(['petReact', 'kraul', 'stroke', 'comeHere', 'worldReact']);
const TOUCH_TTL = 2000;
// Steht schon die nächste Streichel-Reaktion an, bleiben diese Klassen über das Aufräumen hinweg stehen und fallen
// erst im selben Atemzug mit den neuen (_step): Sonst blitzten zwischen zwei Tipps die Augen 40 ms lang auf.
const PET_NEXT = new Set(['petReact', 'kraul', 'stroke']);
const PET_HOLD = ['squint', 'content', 'flat', 'lean', 'tilt', 'melt', 'happy'];
// Glück fürs Streicheln hängt an der Zeit, nicht an der Zahl der Tipps: Ein Tipp zählt voll (GAIN.pet), wenn seit der
// letzten Berührung mindestens PET_CALM vergangen ist, sonst anteilig. Dauerfeuer bringt so in derselben Zeit nie mehr
// als ruhiges Tippen (höchstens GAIN.pet je PET_CALM), es wird aber auch nichts abgezogen. dt: ms seit der letzten
// Berührung (beim ersten Mal unendlich).
const PET_CALM = 1500;
const petGain = (dt) => GAIN.pet * clamp(dt / PET_CALM, 0, 1);
// Kraulen (Finger liegt): setzt nach hold ms ein, dann je Takt (beat) gain Glück, höchstens max ms lang; jeder
// count-te Takt zählt als einmal gestreichelt (Tagebuch, anhänglich). Je Sekunde bringt das mehr als jedes Tippen.
const KRAUL = { hold: 550, beat: 900, gain: 6, max: 20000, count: 5 };
// So weit (px) darf der Finger vor dem Einsetzen rutschen, ohne dass aus dem Kraulen nichts wird
const PRESS_SLOP = 16;
// Glück aus ms Kraulen nach dem Einsetzen (ohne den Einstieg, der wie ein Tipp zählt)
const kraulGain = (ms) => KRAUL.gain * Math.floor(clamp(ms, 0, KRAUL.max) / KRAUL.beat);
// Mimik: zwei Brauenstriche (.brow, per CSS gedreht und verschoben) und ein Mundpfad (.mim, d je Ausdruck) decken
// Trauer, Trotz, Stolz und Staunen ab. Der Mundpfad enthält die Kerbe unter der Nase mit, er ersetzt .mth.
const MIMIK = {
  sad: 'M91 54.1 v1.6 M88.3 58 q2.7 -2.6 5.4 0',
  defy: 'M91 54.1 v1.3 M88.8 57.1 q2 -2 4.4 -.7',
  proud: 'M91 54.1 v1.4 M87.3 55.8 q3.7 3.5 7.4 0',
  awe: 'M91 54.1 v1 M91 55.4 a1.5 1.9 0 1 0 .01 0z',
};
const MIMIK_CLS = Object.keys(MIMIK).map((k) => `mi-${k}`);
// Vorsatz fürs CSS: Mimik ist gesetzt und das Gesicht ist frei (nicht im Schlaf, beim Fressen, Gähnen, Pfeifen …)
const MIMIK_ON = '.mi:not(.sleeping):not(.eating):not(.yawning):not(.calling):not(.sip):not(.sneezing)';
// Zustandsklassen der neuen Momente, die _cleanup zurücksetzt (zeitgesteuerte wie blush, mlem, lnd gehen von selbst)
const CUTE_CLS = ['tilt', 'tilt-b', 'content', 'squint', 'flat', 'crosseye', 'lean', 'tickle', 'roll', 'melt', 'thump',
  'yawning', 'presneeze', 'sneezing', 'earwash', 'scratching', 'nodding', 'stumble', 'pant', 'trip', 'bighop'];
// Die Welt antwortet auf einen Tipp (Blume, Wolke, Stern, Tür, Windrad, Wollknäuel). Was liegt an der Stelle (x, y)?
// zones: Flächen { k, l, t, r, b } in Rangfolge der Arten (die Art des ersten Treffers gewinnt), schon um ihren
// Tipp-Rand vergrößert. Liegen mehrere derselben Art dort (zwei Sterne), gewinnt die mit der nächsten Mitte.
const worldPick = (x, y, zones) => {
  let best = null;
  let bd = Infinity;
  for (const z of zones) {
    if (best && z.k !== best.k) continue;
    if (x < z.l || x > z.r || y < z.t || y > z.b) continue;
    const d = Math.hypot(x - (z.l + z.r) / 2, y - (z.t + z.b) / 2);
    if (d < bd) {
      best = z;
      bd = d;
    }
  }
  return best;
};

export {
  CUTE_SMALL, PET_FREE, TOUCH_NEXT, TOUCH_TTL, PET_NEXT, PET_HOLD, PET_CALM, petGain, KRAUL, PRESS_SLOP, kraulGain,
  MIMIK, MIMIK_CLS, MIMIK_ON, CUTE_CLS, worldPick,
};
