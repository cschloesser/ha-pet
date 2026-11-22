// Stil für Pino

import { BZ } from '../logik/buehne.js';
import { LANE_S } from '../logik/einstellungen.js';

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
  /* Schrift der Blase: --ph ist an .friends die Größe des Freunds (Katzumi 0,5 vom Pika), ohne Untergrenze spräche
     sie bei Standardhöhe in 5,4 px und Rufus in 7,6 px. Der Innenabstand ist in em und wächst mit, die Spitze
     (.say::after) ist in px und hängt nicht an der Schrift. Die Blase des Pikas (.bubble in STYLE) bleibt, wie sie ist. */
  .frsay .bubble { font-size: max(10px, calc(var(--ph) * .15)); }
  /* Auf der hinteren Spur (depth) ist .frsay samt Blase um LANE_S verkleinert (_frSetX setzt dort .lane1 auch an
     die Hülle der Blase): Die Untergrenze wächst um so viel, damit auch dort 10 px auf dem Bildschirm stehen. */
  .frsay.lane1 .bubble { font-size: max(${+(10 / LANE_S).toFixed(2)}px, calc(var(--ph) * .15)); }
  /* Kirbys Stummelärmchen (.karm, grafik/freunde.js) sind sonst immer zu sehen. Beim Putzen kommen die Pfoten ans
     Gesicht (.groom .paws in STYLE): Dann sind die Ärmchen dort, sonst hätte er vier. Putzen ist die einzige Haltung
     der Freunde (FRIEND_CLS), die Pfoten hervorholt. */
  .friend.groom .karm { display: none; }
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

  /* ---------- Eigene Spiele der Freunde (ab 0.44): Stöckchen, Jagd, Kullern ---------- */
  /* Spielzeug als eigenes Element in .fx (das Stöckchen im Flug und am Boden): Mitte bei left/top 0, Größe und Lage
     setzt das Skript (_frToy, _frToyAt). Was jemand im Maul trägt, steckt in .mf-item, .carry zeigt es (STYLE). */
  .ftoy { position: absolute; left: 0; top: 0; pointer-events: none; transition: opacity .4s; }
  .ftoy svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .ftoy.off { opacity: 0; }
  /* Die Feder (das Blatt) pendelt am Faden, aufgehängt an der Spitze des Halms im Maul des Pikas */
  .carry .fdangle { transform-box: fill-box; transform-origin: 50% 0%; animation: fdangle 1.3s ease-in-out infinite alternate; }
  @keyframes fdangle { from { transform: rotate(-11deg); } to { transform: rotate(11deg); } }
  /* Rufus rennt dem Stöckchen nach, die Schlappohren fliegen nach hinten (Angelpunkt oben, nicht unten wie bei
     Stehohren). In .flip gespiegelt zeigen sie auch nach links nach hinten. */
  .friend.fdash .ear { transform-origin: 50% 12%; }
  .friend.fdash .ear-l { animation: fflap .2s ease-in-out infinite alternate; }
  .friend.fdash .ear-r { animation: fflap .2s .1s ease-in-out infinite alternate; }
  @keyframes fflap { from { transform: rotate(14deg); } to { transform: rotate(46deg); } }
  /* Katzumi duckt sich und wackelt mit dem Hinterteil, bevor sie springt */
  .friend.kwig .hop { animation: kwig .17s ease-in-out infinite alternate; }
  @keyframes kwig { from { transform: scale(1.12, .82) rotate(-3.5deg); } to { transform: scale(1.12, .82) rotate(3.5deg); } }
  /* Kirby kullert: eingerollt (Füße und Ärmchen weg) dreht er sich um die Mitte seiner Kugel, um --kra (ganze
     Umdrehungen, auf die Länge des Wegs gerundet, mindestens eine: Er kommt aufrecht an) in --krd (so lange wie die
     Überblendung des Wegs, _frSetX). In .flip gespiegelt dreht er nach links andersherum, also immer vorwärts. */
  .friend.kroll .hop { transform-origin: 64.2% 56%; animation: kroll var(--krd, 1.6s) linear both; }
  @keyframes kroll { from { transform: rotate(0deg); } to { transform: rotate(var(--kra, 360deg)); } }
  .friend.kroll .feet, .friend.kroll .karm { display: none; }
  /* „Bewegung reduzieren“: Das Skript spielt dann die ruhigen Fassungen (calmMotion), hier ruht zur Sicherheit auch,
     was sich von selbst bewegt */
  @media (prefers-reduced-motion: reduce) {
    .carry .fdangle, .friend.fdash .ear-l, .friend.fdash .ear-r, .friend.kwig .hop, .friend.kroll .hop { animation: none; }
  }
  `;

export { STYLE_FRIEND };
