// Album 2: Stil des Schlittens (src/karte/album2-sled.js). Der Schlitten ist ein .gt in .gifts: Breite, Höhe, Ebene
// und Stand (transform: Stelle, Höhe, Neigung) setzt das Skript in jedem Bild, darum ohne Transition. Innen wackelt
// .a2slw beim Antippen, .a2slf dreht ihn um (Spitze nach links: .left). Die Schneewehe ist ein Requisit (.aprop).

const STYLE_A2_SLED = `
  .a2-sled { left: 0; transform-origin: 50% 100%; transition: opacity .4s, filter 2.5s; }
  .a2-sled.a2out { opacity: 0; }
  .a2-sled .a2slw, .a2-sled .a2slf { width: 100%; height: 100%; transform-origin: 50% 100%; }
  .a2-sled .a2slf { transition: transform .4s ease-in-out; }
  .a2-sled .a2slf.left { transform: scaleX(-1); }
  .gifts .a2-sled svg { width: 100%; height: 100%; }
  /* (ploppt innen auf: .gt.new skalierte das transform des Elements, und das trägt hier den Stand) */
  .a2-sled .a2slw.pop { animation: grow .7s cubic-bezier(.3, 1.6, .5, 1); }
  .a2-sled .a2slw.a2tap { animation: a2slwob .6s ease-out; }
  @keyframes a2slwob { 20% { transform: rotate(-5deg) translateY(-6%); } 45% { transform: rotate(3.5deg); } 70% { transform: rotate(-1.5deg); } }
  /* Seil vom Haken zum Maul (Länge und Winkel setzt das Skript) */
  .a2slrope { position: absolute; height: 1.6px; margin-top: -.8px; transform-origin: 0 50%; border-radius: 1px;
    box-shadow: 0 0 0 .6px rgba(90, 64, 48, .55); pointer-events: none; transition: filter 2.5s; }
  .shade .a2slrope { filter: brightness(var(--lbp, 1)) saturate(var(--ls, 1)); }
  /* Auf dem Schlitten: Er sitzt (bzw. liegt) um --a2sly höher und neigt sich mit dem Hang (--a2sla, um die Füße);
     sein Schatten ist der des Schlittens */
  .pika.a2sl-sit .clipw, .pika.a2sl-belly .clipw { transform: rotate(var(--a2sla, 0deg)) translateY(calc(var(--a2sly, 0px) * -1)); }
  .pika.a2sl-sit .shadow, .pika.a2sl-belly .shadow { opacity: 0; }
  .pika.a2sl-sit .hop { transform: scale(1.05, .9); transition: transform .2s ease-out; }
  .pika.a2sl-belly .hop { transform: scale(1.16, .72); transition: transform .25s ease-out; }
  /* Schneefunken der goldenen Spur: blitzen auf und verglimmen an ihrer Stelle */
  .a2sls { position: absolute; width: calc(var(--H) * .046 * var(--sk, 1)); margin: calc(var(--H) * -.023 * var(--sk, 1));
    pointer-events: none; animation: a2sls 1.2s ease-out both; }
  .a2sls svg { display: block; width: 100%; height: auto; }
  .a2sls path { fill: #fff2a8; filter: drop-shadow(0 0 2.5px rgba(255, 214, 90, 1)); }
  @keyframes a2sls {
    0% { transform: scale(0) rotate(0deg); opacity: 0; }
    20% { transform: scale(1.15) rotate(30deg); opacity: 1; }
    100% { transform: translateY(calc(var(--H) * .015)) scale(.2) rotate(80deg); opacity: 0; }
  }
  .a2sls.still { animation: gfx-still 1.2s ease-in-out both; }
  @media (prefers-reduced-motion: reduce) { .a2-sled .a2slw.a2tap, .a2-sled .a2slw.pop, .a2-sled .a2slf { animation: none !important; transition: none !important; } }
`;

export { STYLE_A2_SLED };
