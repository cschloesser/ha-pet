// Stil des offenen Fensters (seit 0.40): Flügel, Vorhänge im Wind, Kopf im Fenster, Licht und Fähnchen

import { BZ, LICHT } from '../logik/buehne.js';
import { PK_DIM } from '../grafik/pika.js';

const STYLE_FEN = `
  /* Über dem Fensterlicht des Baus (Reihe bau, Rang fenster). Zu und fertig ist es nicht zu sehen: Dann zeigen Bau und
     Lichter das Fenster wie immer. Kein Lichtfilter: Was dämmert, hat seine warme Kopie (.lt) wie das Fensterlicht,
     das Fell des Kopfs dunkelt wie beim Pika im Bau (PK_DIM). */
  .fenster { position: absolute; left: 0; top: 0; z-index: ${BZ.fenster}; visibility: hidden; pointer-events: none; }
  .fenster.da { visibility: visible; }
  .fenster > div { position: absolute; inset: 0; pointer-events: none; }
  .fenster svg { display: block; width: 100%; height: 100%; overflow: visible; }
  /* Trefferfläche: nur das offene Fenster samt Rahmen (Kreis), nicht das ganze Kästchen */
  .fenster::after {
    content: ''; position: absolute; left: 25%; top: 25%; width: 50%; height: 50%; border-radius: 50%; pointer-events: none;
  }
  .fenster.da.auf::after { pointer-events: auto; cursor: pointer; }
  /* Bei Wolken und in der Dämmerung dämmert der Fensterflügel mit dem Bau (Licht wie .burrow); nachts nicht, da
     leuchtet das Zimmer, und Flügel und Vorhänge haben ihre warme Kopie (.lt) */
  .fen-in, .fen-fl { transition: filter 2.5s; }
  .shade:not(.night) .fenster > .fen-in, .shade:not(.night) .fenster > .fen-fl { filter: ${LICHT}; }

  /* Licht, das nachts aus dem offenen Fenster auf den Hügel fällt */
  .fen-spill { fill: url(#fen-schein); visibility: hidden; }
  .fenster.auf .fen-spill { visibility: visible; }

  /* Flügel: schwingt an der linken Kante nach außen auf */
  .fen-s { transform-box: fill-box; transform-origin: 0% 50%; transition: transform .7s cubic-bezier(.5, 0, .6, 1); }
  .fenster.auf .fen-s { transform: translateX(-3.2px) skewY(-16deg) scaleX(.3); transition: transform .9s cubic-bezier(.3, 1.35, .5, 1); }

  /* Vorhänge: wehen nach außen, links um --wl, rechts um --wr (der Seite, wohin der Wind weht, mehr), schneller bei
     mehr Wind (--ws) */
  .fen-v { opacity: 0; transition: opacity .4s; }
  .fenster.auf .fen-v { opacity: 1; transition: opacity .5s .35s; }
  .fen-v1, .fen-v2 { transform-box: fill-box; transform-origin: 50% 0; }
  .fenster.auf .fen-v1 { animation: fen-weh-l var(--ws, 1.8s) ease-in-out infinite alternate; }
  .fenster.auf .fen-v2 { animation: fen-weh-r var(--ws, 1.8s) ease-in-out calc(var(--ws, 1.8s) * -.45) infinite alternate; }
  @keyframes fen-weh-l { from { transform: rotate(calc(var(--wl, 24deg) * .35)); } to { transform: rotate(var(--wl, 24deg)) scaleY(1.06); } }
  @keyframes fen-weh-r { from { transform: rotate(calc(var(--wr, 8deg) * -.35)); } to { transform: rotate(calc(var(--wr, 8deg) * -1)) scaleY(1.06); } }

  /* Kopf: taucht von unten im Fenster auf (Lage in Einheiten des Bilds), schnuppert */
  .fen-k { transform: translateY(7.5px); transition: transform .4s ease-in; }
  .fenster.kopf .fen-k { transform: none; transition: transform .55s cubic-bezier(.3, 1.4, .5, 1); }
  .fen-nase { transform-box: fill-box; transform-origin: 50% 30%; }
  .fenster.schnupper .fen-nase { animation: fen-schnupp .2s ease-in-out 6 alternate; }
  @keyframes fen-schnupp { to { transform: translateY(-.2px) scale(1.2); } }
  .fenster .pk { ${PK_DIM(0.85, 1)} }
  .night .fenster .pk { ${PK_DIM(0.68, 0.85)} }

  /* Fähnchen (Aussehen wie bei den Geräten, .hb-tag) über allem */
  .fen-t { position: absolute; inset: 0; pointer-events: none; z-index: var(--z-tag); }

  /* Schnell wechselnde Lage nach dem Laden oder einem Größenwechsel: ohne Übergang */
  .fenster.still .fen-s, .fenster.still .fen-v, .fenster.still .fen-k { transition: none; }

  @media (prefers-reduced-motion: reduce) {
    .fenster.auf .fen-v1, .fenster.auf .fen-v2, .fenster.schnupper .fen-nase { animation: none !important; }
    .fenster.auf .fen-v1 { transform: rotate(calc(var(--wl, 24deg) * .6)); }
    .fenster.auf .fen-v2 { transform: rotate(calc(var(--wr, 8deg) * -.6)); }
  }
`;

export { STYLE_FEN };
