// Album 2: Stil des Trampolins (src/karte/album2-tramp.js). Das Trampolin ist ein .gt in .gifts (hinterer Teil, unter
// dem Pika) und ein zweites .gt.a2-trampf (vorderer Bogen, vor ihm): Stelle, Größe und Ebene setzt das Skript. Innen
// klappt .a2trw auf und zu (.fold), bei reduzierter Bewegung blendet es nur ein und aus (.a2out). Tuch und Schatten auf
// dem Tuch stellt das Skript in jedem Bild, ebenso Höhe und Salto des Pikas (transform von .depth).

const STYLE_A2_TRAMP = `
  .a2-tramp, .a2-trampf { transition: opacity .4s, filter 2.5s; }
  .a2-tramp.a2out, .a2-trampf.a2out { opacity: 0; }
  .a2-tramp .a2trw, .a2-trampf .a2trw { transform-origin: 50% 97%; transition: transform .5s cubic-bezier(.3, 1.5, .5, 1); }
  .a2-tramp.fold .a2trw, .a2-trampf.fold .a2trw { transform: scaleY(.16); transition: transform .45s ease-in; }
  /* Auf dem Trampolin: Sein Schatten ist der auf dem Tuch. Im Tuch gestaucht, beim Absprung gestreckt, im Salto
     zusammengerollt (um die Füße wie .crouch) */
  .pika.a2tr .shadow { opacity: 0; transition: opacity .2s; }
  .pika.a2tr .hop { transition: transform .16s ease-out; }
  .pika.a2tr-sq .hop { transform: scale(1.1, .86); transition: transform .1s ease-out; }
  .pika.a2tr-up .hop { transform: scale(.93, 1.08); transition: transform .12s ease-out; }
  .pika.a2tr-tuck .hop { transform: scale(.92, .84); transition: transform .18s ease-out; }
  /* Goldene Sternchen beim höchsten Sprung: stieben auseinander und verglimmen (ruhig: am Platz ein und aus) */
  .gfx.a2trst { width: calc(var(--H) * .062); margin: calc(var(--H) * -.031); animation: a2trst 1.1s ease-out both; }
  .gfx.a2trst path { fill: #fff2a8; stroke: #e0a91c; }
  @keyframes a2trst {
    0% { transform: scale(.2) rotate(0deg); opacity: 0; }
    20% { transform: translate(calc(var(--dx, 0px) * .3), calc(var(--dy, 0px) * .3)) scale(1.15) rotate(35deg); opacity: 1; }
    100% { transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(.45) rotate(110deg); opacity: 0; }
  }
  .gfx.a2trst.still { animation: gfx-still 1.2s ease-in-out both; }
  @media (prefers-reduced-motion: reduce) { .a2-tramp .a2trw, .a2-trampf .a2trw { transition: none !important; } }
`;

export { STYLE_A2_TRAMP };
