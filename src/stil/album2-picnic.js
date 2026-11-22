// Album 2: Stil der Picknickdecke (src/karte/album2-picnic.js). Decke und Korb sind ein .gt in .gifts (Platz, Breite,
// Höhe und Ebene setzt das Skript; der Korb steht darin hinten auf der Decke), das Leckerli für später ein eigenes
// Element daneben in .gifts, Schmetterlinge, Krümel und das geworfene Stück Teilchen in .fx. Wer selbst einen Übergang
// hat, nennt filter darin mit (das Licht der Dämmerung, siehe STYLE_GIFT).

const STYLE_A2_PICNIC = `
  /* Decke: die Vorderkante liegt etwas unter der Bodenlinie (--a2pks, px), so steht er mitten darauf */
  .gifts > .a2-picnic { bottom: calc(var(--gb) - var(--a2pks, 4px)); transition: opacity .4s, filter 2.5s; }
  .a2-picnic.a2out { opacity: 0; }
  .a2-picnic .a2pkd { position: absolute; left: 0; bottom: 0; width: 100%; }
  .a2-picnic .a2pkk, .a2-picnic .a2pkr, .a2-picnic .a2pkbu { position: absolute; }
  .a2-picnic .a2pkr, .a2-picnic .a2pkbu { display: none; }
  .a2-picnic.a2roll .a2pkr { display: block; }
  /* Safari schneidet ein Element mit Filter (Licht der Dämmerung, golden) an der Box des <svg> ab (siehe 0.40.1): Der
     Schatten unter der Decke reicht 0,4 Einheiten unter die viewBox 100 × 18, der Korb wackelt beim Antippen um seinen
     Boden. Rand als padding mit gleich großem negativem margin, die Zeichnung bleibt, wo sie war */
  .a2-picnic .a2pkd svg { padding: 0 1% 2%; margin: 0 -1% -2%; }
  .a2-picnic .a2pkk svg, .a2-picnic .a2pkbu svg { padding: 10%; margin: -10%; pointer-events: none; }
  /* Der Korb öffnet sich zum Pika hin: links von ihm gespiegelt */
  .a2-picnic.a2left .a2pkk > div { transform: scaleX(-1); }
  .a2-picnic .a2pkk > div { transform-origin: 50% 100%; }
  .a2-picnic .a2pkk.pop > div { animation: a2pkpop .55s cubic-bezier(.3, 1.6, .5, 1); }
  .a2-picnic.a2left .a2pkk.pop > div { animation-name: a2pkpopl; }
  @keyframes a2pkpop { from { transform: scale(.3, .2); opacity: 0; } 40% { opacity: 1; } }
  @keyframes a2pkpopl { from { transform: scale(-.3, .2); opacity: 0; } 40% { opacity: 1; } }
  /* Deckel hebt sich am Scharnier (20,4/11,6 der viewBox), die Serviette schaut heraus */
  .a2-picnic .a2pkl { transform-box: view-box; transform-origin: 20.4px 11.6px; transition: transform .35s cubic-bezier(.3, 1.5, .5, 1); }
  .a2-picnic.open .a2pkl { transform: rotate(32deg); }
  .a2-picnic .a2pkn { opacity: 0; transition: opacity .2s; }
  .a2-picnic.open .a2pkn { opacity: 1; }
  /* Antippen: der Korb hüpft kurz */
  .a2-picnic.a2tap .a2pkk { animation: a2pkwob .5s ease-out; }
  @keyframes a2pkwob { 25% { transform: translateY(-14%) rotate(-5deg); } 55% { transform: rotate(3deg); } 80% { transform: rotate(-1deg); } }
  /* Das Bündel (vorzeigen, wenn kein Picknickwetter ist): nur Korb mit Rolle */
  .a2-picnic.rolled .a2pkd, .a2-picnic.rolled .a2pkk { display: none; }
  .a2-picnic.rolled .a2pkbu { display: block; left: 0; bottom: 0; width: 100%; }
  .a2-picnic.rolled.pop .a2pkbu { transform-origin: 50% 100%; animation: a2pkpop .55s cubic-bezier(.3, 1.6, .5, 1); }
  /* Er sitzt auf der Decke */
  .pika.a2pk-sit .hop { transform: scale(1.05, .93); }
  /* Leckerli für später, neben dem Korb */
  .gifts > .a2pkt { position: absolute; pointer-events: none; transition: opacity .5s, transform .5s ease-in, filter 2.5s; }
  .gifts > .a2pkt svg { padding: 6%; margin: -6%; }
  .gifts > .a2pkt.away { opacity: 0; transform: translateY(-40%) scale(.5); }
  .gifts > .a2pkt.still.away { transform: none; }
  /* Schmetterlinge (BFLY_SVG): fliegen per Web Animations heran, sitzen mit langsamem Flügelschlag */
  .a2pkb { position: absolute; width: calc(var(--H) * .075); pointer-events: none; }
  .a2pkb svg { display: block; width: 100%; height: auto; overflow: visible; }
  .a2pkb .bwl, .a2pkb .bwr { transform-box: view-box; transform-origin: 10px 8px; animation: a2pkbw .15s ease-in-out infinite alternate; }
  .a2pkb.rest .bwl, .a2pkb.rest .bwr { animation-duration: 1.3s; }
  .a2pkb.still .bwl, .a2pkb.still .bwr { animation: none; }
  @keyframes a2pkbw { to { transform: scaleX(.2); } }
  .a2pkb.off { transition: opacity .6s; opacity: 0; }
  /* Krümel und das geworfene Stück */
  .a2pkc { position: absolute; width: calc(var(--H) * .022); margin: calc(var(--H) * -.011); pointer-events: none; z-index: 1; }
  .a2pkc svg, .a2pkf svg { display: block; width: 100%; height: auto; }
  .a2pkc.still { animation: gfx-still 1.2s ease-in-out both; }
  .a2pkf { position: absolute; pointer-events: none; transition: opacity .6s; }
  .a2pkf.away { opacity: 0; }
  @media (prefers-reduced-motion: reduce) {
    .a2-picnic .a2pkk.pop > div, .a2-picnic.rolled.pop .a2pkbu, .a2-picnic.a2tap .a2pkk, .a2pkb .bwl, .a2pkb .bwr { animation: none !important; }
    .a2-picnic .a2pkl { transition: none; }
  }
`;

export { STYLE_A2_PICNIC };
