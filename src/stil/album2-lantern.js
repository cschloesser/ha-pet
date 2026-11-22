// Album 2: Stil der Laterne (src/karte/album2-lantern.js). Die abgestellte Laterne ist ein .gt in .gifts (Ebene, Platz
// und Fuß setzt das Skript), ihr Schein (.a2lglow) liegt in der Effekt-Ebene .fx. Im Maul steckt sie in .mf-item des
// Pikas (LANTERN_CARRY): Gependelt wird die mittlere, klassenlose Gruppe (.mf-item > g > g), um den Scheitel des
// Henkels im Maul (oben in der Mitte ihres Kastens). .mf-item selbst nicht: Ein CSS-transform ersetzte dessen
// transform-Attribut.

import { LANTERN_W } from '../grafik/album2/lantern.js';

const STYLE_A2_LANTERN = `
  .a2-lantern { width: calc(var(--H) * ${LANTERN_W}); margin-left: calc(var(--H) * ${-LANTERN_W / 2}); transition: opacity .5s, filter 2.5s; }
  .a2-lantern svg { display: block; width: 100%; height: auto; overflow: visible; }
  .a2-lantern.a2out { opacity: 0; }
  /* Antippen: Die Flamme schießt hoch und duckt sich, die Laterne wackelt auf ihrem Fuß */
  .a2-lantern .a2lfl { transform-box: fill-box; transform-origin: 50% 100%; }
  .a2-lantern.a2ltap .a2lfl { animation: a2lflame .7s ease-out; }
  @keyframes a2lflame { 25% { transform: scale(1.35, 1.6); } 55% { transform: scale(.85, .75); } 80% { transform: scale(1.1, 1.15); } }
  .a2-lantern.a2ltap svg { transform-origin: 50% 100%; animation: a2lwob .6s ease-out; }
  @keyframes a2lwob { 25% { transform: rotate(-5deg); } 55% { transform: rotate(3.5deg); } 80% { transform: rotate(-1.5deg); } }

  /* Im Maul: beim Gehen pendelt sie leicht, beim Laternenlauf schwingt sie (.a2lsw), am Ende der Wiese weit (.a2lbig) */
  .pika.a2lc .mf-item > g > g { transform-box: fill-box; transform-origin: 50% 0%; }
  .pika.a2lc.walking .mf-item > g > g { animation: a2lsway .5s ease-in-out infinite alternate; }
  .pika.a2lc.a2lsw .mf-item > g > g { animation: a2lswing .8s ease-in-out infinite alternate; }
  .pika.a2lc.a2lbig .mf-item > g > g { animation: a2lswing-big .7s ease-in-out infinite alternate; }
  @keyframes a2lsway { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
  @keyframes a2lswing { from { transform: rotate(-16deg); } to { transform: rotate(16deg); } }
  @keyframes a2lswing-big { from { transform: rotate(-30deg); } to { transform: rotate(30deg); } }

  /* Lichtschein: ein warmer Hof um das Glas, ohne filter (Safari schneidet dessen Überstand ab). Bei Tag aus, in der
     Dämmerung schwach, sobald die Sonne unter dem Horizont ist und nachts voll. Flackern nur, solange er sie trägt. */
  .a2lglow { position: absolute; width: 0; height: 0; pointer-events: none; transition: opacity .6s; }
  .a2lglow.off { opacity: 0; }
  .a2lh { position: absolute; left: calc(var(--H) * -.28); top: calc(var(--H) * -.28); width: calc(var(--H) * .56); height: calc(var(--H) * .56);
    border-radius: 50%; opacity: 0; transition: opacity 1.2s, transform .25s;
    background: radial-gradient(circle, rgba(255, 248, 212, .95) 0, rgba(255, 226, 146, .7) 8%, rgba(255, 204, 110, .34) 30%, rgba(255, 196, 100, .12) 52%, rgba(255, 190, 90, 0) 70%); }
  .dusk .a2lh { opacity: .6; }
  .dusk.sun-down .a2lh { opacity: .9; }
  .night .a2lh { opacity: 1; }
  .a2lglow.mv .a2lh { animation: a2lflk 2.8s ease-in-out infinite alternate; }
  @keyframes a2lflk { 0% { transform: scale(1); } 35% { transform: scale(.95); } 60% { transform: scale(1.04); } 100% { transform: scale(.98); } }
  .a2lglow.flare .a2lh { transform: scale(1.3); }

  /* Glühwürmchen der goldenen Laterne (GOLD_FIREFLY, Aussehen von .gfx.hff): kreisen um das Glas, ohne den Anflug der
     Hängematte; .rev andersherum. Ruhig (.still) sitzen sie still (Platz setzt das Skript) und blenden ein. */
  .gfx.hff.a2lff { margin: calc(var(--H) * -.012); opacity: 1;
    animation: a2lffin 1s ease-out backwards, a2lorb var(--d, 3.4s) linear infinite, gfx-ffglow 1.9s ease-in-out infinite alternate; }
  .gfx.hff.a2lff.rev { animation-direction: normal, reverse, alternate; }
  @keyframes a2lffin { from { opacity: 0; } }
  @keyframes a2lorb {
    from { transform: rotate(var(--a0, 0deg)) translateX(var(--r, 16px)) translateY(0); }
    50% { transform: rotate(calc(var(--a0, 0deg) + 180deg)) translateX(var(--r, 16px)) translateY(calc(var(--H) * .015)); }
    to { transform: rotate(calc(var(--a0, 0deg) + 360deg)) translateX(var(--r, 16px)) translateY(0); }
  }
  .gfx.hff.a2lff.still { animation: gfx-in .9s ease-out both; }
  .gfx.hff.a2lff.off { transition: opacity .75s ease-in; opacity: 0; }
  @media (prefers-reduced-motion: reduce) {
    .a2-lantern.a2ltap .a2lfl, .a2-lantern.a2ltap svg, .pika.a2lc .mf-item > g > g, .a2lglow .a2lh { animation: none !important; }
    .a2lglow.flare .a2lh { transform: none; }
  }
`;

export { STYLE_A2_LANTERN };
