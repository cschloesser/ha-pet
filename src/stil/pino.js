// Stil für Pino

import { BZ } from '../logik/buehne.js';

// Die Zustandsklassen (walking, blink, twitch-l, happy, groom, calling, look-f, left …) wirken über allgemeine
// Regeln aus STYLE, die nicht an .pika hängen; Pino trägt sie an seinem eigenen .friend-Element. --ph/--pw
// setzt das Skript an .friends auf Pinos Größe, damit Sprechblase, Schatten usw. mitskalieren.
const STYLE_FRIEND = `
  .friends { position: absolute; inset: 0; pointer-events: none; }
  .friend {
    position: absolute; left: 0; top: calc(var(--gy) - var(--ph) * .945); width: var(--pw); height: var(--ph);
    z-index: ${BZ.pino}; cursor: pointer; pointer-events: auto; will-change: transform;
    transform-origin: 50% 94.5%; /* Füße: auf der hinteren Spur (depth) kleiner, er bleibt auf ihr stehen */
  }
  /* Pinos Sprechblase: gleiche Lage wie .friend, aber in der Sprech-Ebene über dem Wetter. Gleicher Ursprung, damit
     sie beim Verkleinern auf der hinteren Spur über seinem Kopf bleibt. */
  .frsay {
    position: absolute; left: 0; top: calc(var(--gy) - var(--ph) * .945); width: var(--pw); height: var(--ph);
    z-index: var(--z-talk); pointer-events: none; transform-origin: 50% 94.5%;
  }
  /* Hintere Spur: wie beim Pika Schatten etwas blasser, tagsüber ein Hauch Dunst. Die Ebene setzt _frZ (Bühne). */
  .friend.lane1 .shadow { opacity: .75; }
  .friend .br { transition: filter 1s; }
  .day:not(.overcast) .friend.lane1 .br { filter: saturate(.85) brightness(1.05); }
  /* Nasenstupsen und Heranrücken: kurz nach vorn zum anderen lehnen (Pika und Pino) */
  .pika.nuzzle .hop, .friend.nuzzle .hop { animation: nuzzle .8s ease-in-out; }
  @keyframes nuzzle { 35%, 60% { transform: translateX(8%) rotate(5deg) scale(1.03, .97); } }
  /* Ohrenwackeln beim Zusammensitzen */
  .pika.wiggle .ear-l, .friend.wiggle .ear-l { animation: fwiggle .3s ease-in-out 4 alternate; }
  .pika.wiggle .ear-r, .friend.wiggle .ear-r { animation: fwiggle .3s .12s ease-in-out 4 alternate-reverse; }
  @keyframes fwiggle { from { transform: rotate(-13deg); } to { transform: rotate(9deg); } }
  `;

export { STYLE_FRIEND };
