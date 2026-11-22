// Album 2: Stil des Planschbeckens (src/karte/album2-pool.js). Das hintere Stück ist ein .gt in .gifts, das vordere
// (.a2plf) ein eigenes Element daneben; Platz, Breite, Höhe über dem Boden und Ebene setzt das Skript. Die Tropfen sind
// .splash wie bei der Pfütze (STYLE_ACT), dazu .a2pldrip aus dem Fell.

import { LICHT_P } from '../logik/buehne.js';

const GOLD = '#f2c94c';

const STYLE_A2_POOL = `
  .gifts > .a2-pool, .gifts > .a2plf { position: absolute; transition: opacity .45s, filter 2.5s; }
  .gifts > .a2-pool.a2out, .gifts > .a2plf.a2out { opacity: 0; }
  .gifts > .a2plf.new { animation: grow .7s cubic-bezier(.3, 1.6, .5, 1); transform-origin: 50% 100%; }
  /* Safari schneidet ein Element mit Filter (Licht der Dämmerung) an der Box des <svg> ab (siehe 0.40.1): Der dicke
     Rand ragt seitlich knapp aus der viewBox 160 × 64. Rand als padding mit gleich großem negativem margin, die
     Zeichnung bleibt, wo sie war (gilt auch für die Ente) */
  .a2-pool svg, .a2plf svg { padding: 4% 3% 0; margin: -4% -3% 0; pointer-events: none; }
  /* Aufblasen (--a2plf von 0 bis 1): richtet sich von unten auf; Luft heraus (.deflate) langsamer */
  .a2-pool .a2plb, .a2plf .a2plb { transform-box: view-box; transform-origin: 80px 56px;
    transform: scale(calc(.94 + .06 * var(--a2plf, 1)), calc(.14 + .86 * var(--a2plf, 1)));
    transition: transform .45s cubic-bezier(.3, 1.5, .5, 1); }
  .a2-pool.deflate .a2plb, .a2plf.deflate .a2plb { transition: transform .9s ease-in; }
  /* Wasser: leer sinkt es zum Boden und blendet aus; beim Füllen steigt es langsam */
  .a2-pool .a2plwa, .a2plf .a2plwa { transform-box: view-box; transform-origin: 80px 40px; transition: transform 2.4s ease-in-out, opacity 1.4s; }
  .a2-pool.leer .a2plwa, .a2plf.leer .a2plwa { transform: translateY(8px) scale(.86, .5); opacity: 0; }
  /* Ringe auf dem Wasser (.rip, groß .rip2), hinten ganz, vorn ihre vordere Hälfte */
  .a2plrp > * { opacity: 0; transform-box: view-box; transform-origin: 80px 29px; }
  .rip .a2plr1 { animation: a2plrip .7s ease-out; }
  .rip2 .a2plr2 { animation: a2plrip2 .9s .12s ease-out backwards; }
  @keyframes a2plrip { from { opacity: .95; transform: scale(.25); } to { opacity: 0; transform: scale(1.45); } }
  @keyframes a2plrip2 { from { opacity: .9; transform: scale(.4); } to { opacity: 0; transform: scale(2); } }
  /* Arschbombe: das Wasser schwappt */
  .wave .a2plwa { animation: a2plwave .9s ease-out; }
  @keyframes a2plwave { 25% { transform: translateY(-1.5px) scale(1.02, 1.22); } 55% { transform: translateY(1px) scale(.99, .86); } }
  /* Golden: Rand und Tupfen in Gold, das Wasser bleibt blau (darum ohne den Goldfilter der Schätze) */
  .gifts > .gt.a2-pool.gilt { filter: none; }
  .shade .gifts > .gt.a2-pool.gilt { filter: ${LICHT_P}; }
  .a2-pool.gilt .a2plr, .a2plf.gilt .a2plr { stroke: ${GOLD}; }
  .a2plf.gilt .a2plst { fill: ${GOLD}; }
  /* Die goldene Gummiente: treibt vor ihm hin und her, schaukelt; hüpft bei jedem Spritzer (.bob) */
  .a2pld { position: absolute; left: 58%; top: 29%; width: 15%; opacity: 0; transition: opacity .8s; }
  .a2pld.on { opacity: 1; animation: a2pldrift 11s ease-in-out infinite alternate; }
  .a2pld svg { transform-origin: 50% 80%; animation: a2plsway 1.8s ease-in-out infinite alternate; }
  .a2pld.bob svg { animation: a2plbob .6s ease-out; }
  @keyframes a2pldrift { from { transform: translateX(0); } to { transform: translateX(-210%); } }
  @keyframes a2plsway { from { transform: rotate(-5deg); } to { transform: rotate(5deg) translateY(4%); } }
  @keyframes a2plbob { 35% { transform: translateY(-34%) rotate(-10deg); } 70% { transform: translateY(6%) rotate(4deg); } }
  .a2pld.still, .a2pld.still svg { animation: none; }
  /* Im Becken: Blatt weg (bei Regen); zusammengerollt im Sprung, Wackeln auf dem Rand, Schütteln danach */
  .pika.a2pl-in .brolly { display: none; }
  .pika.a2pl-ball .hop { transform: scale(.9, .8) rotate(-10deg); transition: transform .14s ease-out; }
  .pika.a2pl-wob .hop { animation: a2plwob .45s ease-in-out infinite alternate; }
  @keyframes a2plwob { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
  .pika.a2pl-shake .hop { animation: a2plshk .6s linear; }
  @keyframes a2plshk { 15% { transform: rotate(-7deg); } 30% { transform: rotate(7deg); } 45% { transform: rotate(-6deg); }
    60% { transform: rotate(5deg); } 75% { transform: rotate(-3deg); } }
  /* Tropfen aus dem Fell */
  .a2pldrip { position: absolute; width: calc(var(--ph) * .045); margin-left: calc(var(--ph) * -.022); pointer-events: none;
    animation: a2pldrip .85s ease-in forwards; }
  .a2pldrip svg { display: block; width: 100%; height: auto; }
  @keyframes a2pldrip { from { opacity: 0; transform: translateY(0) scale(.6); } 20% { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: translateY(calc(var(--ph) * .22)); } }
  @media (prefers-reduced-motion: reduce) {
    .a2pld, .a2pld svg, .wave .a2plwa, .pika.a2pl-wob .hop, .pika.a2pl-shake .hop { animation: none !important; }
    .a2-pool .a2plb, .a2plf .a2plb { transition: none; }
  }
`;

export { STYLE_A2_POOL };
