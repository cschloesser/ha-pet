// Album 2: Stil des Radios (src/karte/album2-radio.js). Das Radio ist ein .gt in .gifts (Stelle und Ebene setzt das
// Skript), innen ploppt .a2rw auf und pumpt im Takt, wenn Musik läuft (.on). Klassen am Radio: .ant Antenne
// ausgezogen, .knob Knopf gedreht, .a2rtune es rauscht (Bild über der Front, der Zeiger zittert). Der Takt kommt als
// --a2rbt (zwei Schläge) vom Skript, am Radio, am Pika (.a2r-bop) und am Vögelchen (.bird.a2rb). Die Noten (.a2rn)
// liegen in der Effekt-Ebene .fx; ihre Farbe ist currentColor.

import { RADIO_W } from '../grafik/album2/radio.js';

const STYLE_A2_RADIO = `
  .a2-radio { width: calc(var(--pw) * ${RADIO_W}); margin-left: calc(var(--pw) * ${-RADIO_W / 2}); bottom: calc(var(--gb) - 1px);
    transition: opacity .4s, filter 2.5s; }
  .a2-radio.a2out { opacity: 0; }
  .a2-radio .a2rw { transform-origin: 50% 100%; }
  /* (ploppt innen auf: so bleibt left/transform des Elements frei) */
  .a2-radio .a2rw.pop { animation: grow .7s cubic-bezier(.3, 1.6, .5, 1); }
  .a2-radio.on .a2rw { animation: a2rthump calc(var(--a2rbt, 1040ms) / 2) ease-out infinite; }
  @keyframes a2rthump { 0% { transform: scale(1.045, .955); } 45%, 100% { transform: none; } }
  .a2-radio .a2rsp { transform-box: view-box; transform-origin: 13px 29.9px; }
  .a2-radio.on .a2rsp { animation: a2rsp calc(var(--a2rbt, 1040ms) / 2) ease-out infinite; }
  @keyframes a2rsp { 0% { transform: scale(1.14); } 50%, 100% { transform: none; } }
  /* Antenne: eingeschoben, ausgezogen (.ant), bei Musik wippt sie leicht */
  .a2-radio .a2rant { transform-box: view-box; transform-origin: 31px 17px; transform: scale(.32);
    transition: transform .45s cubic-bezier(.3, 1.4, .5, 1); }
  .a2-radio.ant .a2rant { transform: none; }
  .a2-radio.ant.on .a2rant { animation: a2rant var(--a2rbt, 1040ms) ease-in-out infinite alternate; }
  @keyframes a2rant { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
  .a2-radio .a2rkn { transform-box: view-box; transform-origin: 25.2px 34.2px; transition: transform .6s ease-out; }
  .a2-radio.knob .a2rkn { transform: rotate(140deg); }
  /* Zeiger auf dem Sender (--a2rn, Einheiten des Bilds); beim Rauschen zittert er */
  .a2-radio .a2rnd { transform: translateX(var(--a2rn, 0px)); transition: transform .5s cubic-bezier(.3, 1.5, .5, 1); }
  .a2-radio.a2rtune .a2rnd { animation: a2rjit .18s steps(2) infinite; }
  @keyframes a2rjit { from { transform: translateX(calc(var(--a2rn, 0px) - 1.6px)); } to { transform: translateX(calc(var(--a2rn, 0px) + 1.8px)); } }
  /* Rauschen: graue Flocken auf der Front und Zickzack daneben, flimmernd */
  .a2-radio .a2rst { opacity: 0; transition: opacity .15s; }
  .a2-radio.a2rtune .a2rst { opacity: 1; animation: a2rst .14s steps(2) infinite; }
  @keyframes a2rst { from { opacity: 1; transform: translateX(-.5px); } to { opacity: .45; transform: translateX(.6px); } }

  /* Noten: steigen aus dem Lautsprecher, schwingen und verblassen (--dx, --dy, --nr setzt das Skript) */
  .a2rn { position: absolute; width: calc(var(--H) * .075); margin: calc(var(--H) * -.0375); pointer-events: none;
    animation: a2rnote 1.8s ease-out forwards; }
  .a2rn svg { display: block; width: 100%; height: auto; overflow: visible; }
  @keyframes a2rnote {
    0% { transform: translate(0, 0) scale(.3); opacity: 0; }
    15% { transform: translate(calc(var(--dx, 0px) * .1), calc(var(--dy, -30px) * .15)) scale(1); opacity: 1; }
    50% { transform: translate(calc(var(--dx, 0px) * .55 + 4px), calc(var(--dy, -30px) * .55)) rotate(var(--nr, 10deg)); opacity: 1; }
    100% { transform: translate(var(--dx, 0px), var(--dy, -30px)) rotate(calc(var(--nr, 10deg) * -.6)) scale(.9); opacity: 0; }
  }
  .a2rn.gold { color: #ffd34d; width: calc(var(--H) * .085); margin: calc(var(--H) * -.0425); animation-duration: 2.3s; }
  .a2rn.gold svg { filter: drop-shadow(0 0 2.5px rgba(255, 214, 90, 1)); }
  .a2rn.still { animation: gfx-still 1.8s ease-in-out both; }

  /* Er tanzt: ein Wippen je Schlag, abwechselnd nach hinten und vorn geneigt, unten kurz gestaucht */
  .pika.a2r-bop .hop { animation: a2rbop var(--a2rbt, 1040ms) ease-in-out infinite; }
  @keyframes a2rbop {
    0%, 50%, 100% { transform: scale(1.04, .96); }
    25% { transform: translateY(-5%) rotate(-5deg); }
    75% { transform: translateY(-5%) rotate(5deg); }
  }
  /* Drehtanz: Pirouette um die eigene Achse (von der Seite gesehen: schmal, gespiegelt, schmal, zurück), in der Luft */
  .pika.a2r-spin .hop { animation: a2rspin var(--a2rsp, 900ms) cubic-bezier(.45, 0, .35, 1); }
  @keyframes a2rspin {
    0%, 100% { transform: none; }
    12% { transform: scale(1.06, .92); }
    30% { transform: translateY(-14%) scale(.25, 1.04); }
    50% { transform: translateY(-18%) scale(-1, 1.02); }
    70% { transform: translateY(-14%) scale(-.25, 1.04); }
    88% { transform: scale(1.06, .93); }
  }
  .pika.a2r-spin .shadow { animation: a2rspsh var(--a2rsp, 900ms) ease-in-out; }
  @keyframes a2rspsh { 50% { transform: scale(.7); opacity: .5; } }

  /* Das Vögelchen auf dem Henkel (golden): kleiner als der Besuch, wippt im Takt mit */
  .bird.a2rb { --bw: calc(var(--H) * .06); }
  .bird.a2rb.bob .bb { animation: a2rbb var(--a2rbt, 1040ms) ease-in-out infinite; }
  @keyframes a2rbb { 0%, 50%, 100% { transform: none; } 25% { transform: translateY(-14%) rotate(-7deg); } 75% { transform: translateY(-14%) rotate(7deg); } }

  @media (prefers-reduced-motion: reduce) {
    .a2-radio .a2rw.pop, .a2-radio.on .a2rw, .a2-radio.on .a2rsp, .a2-radio.ant.on .a2rant, .a2-radio.a2rtune .a2rnd,
    .a2-radio.a2rtune .a2rst, .pika.a2r-bop .hop, .pika.a2r-spin .hop, .pika.a2r-spin .shadow, .bird.a2rb.bob .bb { animation: none !important; }
    .a2-radio .a2rant, .a2-radio .a2rkn, .a2-radio .a2rnd { transition: none !important; }
  }
`;

export { STYLE_A2_RADIO };
