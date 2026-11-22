// Album 2: Stil des Vogelhäuschens (src/karte/album2-feeder.js). Das Häuschen ist ein .gt in .gifts (Ebene setzt das
// Skript), die Vögel daran sind .bird in .birds wie der Besuch, nur kleiner.

import { LANE_DY } from '../logik/einstellungen.js';
import { FEEDER_W } from '../grafik/album2/feeder.js';

const STYLE_A2_FEEDER = `
  /* Häuschen auf dem Pfahl, Fuß auf der hinteren Reihe (LANE_DY über der Bodenlinie) */
  .a2-feeder { width: calc(var(--H) * ${FEEDER_W}); margin-left: calc(var(--H) * ${-FEEDER_W / 2}); bottom: calc(var(--gb) + var(--H) * ${LANE_DY});
    transition: opacity .4s, filter 2.5s; }
  .a2-feeder.a2out { opacity: 0; }
  .a2-feeder .a2fh { transform-box: view-box; transform-origin: 16px 30px; }
  .a2-feeder.a2tap .a2fh { animation: a2fwob .6s ease-out; }
  @keyframes a2fwob { 20% { transform: rotate(-6deg); } 45% { transform: rotate(4.5deg); } 70% { transform: rotate(-2deg); } }
  /* Körner: leer, solange er nachfüllt; frisch gefüllt ploppen sie auf */
  .a2-feeder .a2fs { transform-box: view-box; transform-origin: 16px 28px; transition: opacity .3s; }
  .a2-feeder.leer .a2fs { opacity: 0; }
  .a2-feeder.fill .a2fs { animation: a2ffill .5s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes a2ffill { from { transform: scale(.4, .2); } }
  .bird.a2b { --bw: calc(var(--H) * .065); }
  .a2seed { position: absolute; width: calc(var(--H) * .022); margin: calc(var(--H) * -.011); pointer-events: none; z-index: 1; }
  .a2seed svg { display: block; width: 100%; height: auto; }
  .a2seed.still { animation: gfx-still 1.2s ease-in-out both; }
  @media (prefers-reduced-motion: reduce) { .a2-feeder.a2tap .a2fh, .a2-feeder.fill .a2fs { animation: none !important; } }
`;

export { STYLE_A2_FEEDER };
