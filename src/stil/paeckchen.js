// Stil der Päckchen und Schätze

import { GILT_F, GIFT_HAM_MS } from '../grafik/paeckchen.js';

// Zeiten von Aufstellen und Abbauen der Hängematte als Anteil (ms)
const HB = (k) => Math.round(GIFT_HAM_MS.build * k);
const HF = (k) => Math.round(GIFT_HAM_MS.fold * k);
import { BZ, LICHT_P } from '../logik/buehne.js';

const STYLE_GIFT = `
  /* Schätze, Päckchen, Ballon, Schild und Postkarte des Urlaubs, Garderobe: Ebene und Licht je Stück (Bühne). Wer
     selbst einen Übergang hat (.gt-can, .gpar.fade, .ursign.out, .urcard, .sig-wear), nennt filter darin mit. */
  .gifts { position: absolute; inset: 0; pointer-events: none; }
  .gifts > * { z-index: ${BZ.schatz}; transition: filter 2.5s; }
  .shade .gifts > * { filter: ${LICHT_P}; }
  .gifts svg { display: block; width: 100%; height: auto; overflow: visible; }
  .gold svg { filter: drop-shadow(0 0 3px rgba(255, 226, 120, .95)); }

  /* Ballon: .gbal schwebt herein (Web Animation), .gdrift treibt langsam, .gbob schaukelt am Band */
  .gbal { position: absolute; width: calc(var(--H) * .17); }
  .gdrift { animation: gdrift 15s ease-in-out infinite alternate; }
  @keyframes gdrift {
    0% { transform: translate(calc(var(--H) * -.035), 0); }
    45% { transform: translate(calc(var(--H) * .015), calc(var(--H) * -.02)); }
    100% { transform: translate(calc(var(--H) * .035), calc(var(--H) * .012)); }
  }
  .gbob { transform-origin: 50% 24%; animation: gbob 3.2s ease-in-out infinite alternate; }
  @keyframes gbob {
    from { transform: translateY(calc(var(--H) * -.012)) rotate(calc(var(--gsw, .5) * -8deg)); }
    to { transform: translateY(calc(var(--H) * .01)) rotate(calc(var(--gsw, .5) * 8deg)); }
  }
  .gconf { position: absolute; width: calc(var(--H) * .018); height: calc(var(--H) * .028); margin: calc(var(--H) * -.014);
    border-radius: 1px; animation: gconf 1s ease-out forwards; }
  @keyframes gconf { to { transform: translate(var(--dx), var(--dy)) rotate(var(--r)); opacity: 0; } }
  .gpeb { position: absolute; width: calc(var(--H) * .022); height: calc(var(--H) * .022); margin: calc(var(--H) * -.011);
    border-radius: 50%; background: #8e9196; box-shadow: inset -1px -1px 0 rgba(0, 0, 0, .25); }

  /* Päckchen am Boden, Auspacken */
  .gpar { position: absolute; width: calc(var(--H) * .09); margin-left: calc(var(--H) * -.045); bottom: calc(var(--gb) - 3px); transform-origin: 50% 100%; }
  .gpar .gp-bow, .gpar .gp-lid { transform-box: fill-box; transform-origin: 50% 100%; }
  .gpar .gp-bow.off { animation: gbowoff .6s ease-out forwards; }
  .gpar .gp-lid.off { animation: glidoff .7s ease-out forwards; }
  @keyframes gbowoff { to { transform: translate(-30%, -260%) rotate(-40deg); opacity: 0; } }
  @keyframes glidoff { 30% { transform: translate(10%, -120%) rotate(18deg); opacity: 1; } to { transform: translate(60%, -260%) rotate(50deg); opacity: 0; } }
  .gpar.fade { transition: opacity .8s, filter 2.5s; opacity: 0; }
  .gitem { position: absolute; width: calc(var(--H) * .11); margin-left: calc(var(--H) * -.055); }
  .gitem svg { display: block; width: 100%; height: auto; overflow: visible; }
  .night .gitem { filter: brightness(.7) saturate(.8); }
  .gitem.rise { animation: grise 1s cubic-bezier(.3, 1.4, .5, 1) forwards; }
  @keyframes grise { from { transform: translateY(40%) scale(.2); opacity: 0; } to { transform: translateY(-40%) scale(1.25); opacity: 1; } }
  .gitem.eat { animation: picked .4s forwards; }
  .gdrop { position: absolute; width: calc(var(--H) * .012); height: calc(var(--H) * .02); margin-left: calc(var(--H) * -.006);
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: #7cc4ee; animation: gdrop .55s ease-in forwards; }
  @keyframes gdrop { to { transform: translateY(calc(var(--H) * .1)); opacity: .2; } }

  /* Schätze in der Szene */
  .gt { position: absolute; }
  .held { position: absolute; inset: 0; pointer-events: none; }
  .held > * { z-index: ${BZ.arm}; }
  .gt.new { animation: grow .7s cubic-bezier(.3, 1.6, .5, 1); transform-origin: 50% 100%; }
  .gt-wheel { width: calc(var(--H) * .14); bottom: calc(var(--gb) - 2px); margin-left: calc(var(--H) * -.07); }
  .gt-wheel .gwhl { transform-box: view-box; transform-origin: 12px 12px; animation: gspin var(--gws, 3s) linear infinite; }
  .wind-w .gt-wheel .gwhl { animation-direction: reverse; }
  @keyframes gspin { to { transform: rotate(360deg); } }
  .gt-bell { width: calc(var(--H) * .05); margin-left: calc(var(--H) * -.025); transform-origin: 50% 8%; }
  .gt-bell.ring { animation: gring .22s ease-in-out 7 alternate; }
  @keyframes gring { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }
  .gt-yarn { width: calc(var(--H) * .075); margin-left: calc(var(--H) * -.0375); bottom: calc(var(--gb) - 3px); }
  .gt-yarn svg { transition: transform 1.2s ease-out; }
  .gt-can { width: calc(var(--H) * .085); margin-left: calc(var(--H) * -.0425); bottom: calc(var(--gb) - 3px); transition: opacity .3s, filter 2.5s; }
  .gt-can.away { opacity: 0; }
  .gt-ham { width: calc(var(--pw) * 1.25); margin-left: calc(var(--pw) * -.625); bottom: calc(var(--gb) - 2px); }
  .gt-ham .gnet { transform-box: view-box; transform-origin: 30px 3px; }
  .gt-ham.sway .gnet { animation: gham 2.8s ease-in-out infinite alternate; }
  @keyframes gham { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }
  /* Aufstellen (.build, GIFT_HAM_MS.build): linkes Gestell, rechtes, dann spannt er das Netz von links hinüber.
     Abbauen (.fold): Netz einholen, dann beide Gestelle umlegen. */
  .gt-ham .gpost { transform-box: fill-box; transform-origin: 50% 100%; }
  .gt-ham.build .gpl { animation: ghpost ${HB(0.24)}ms cubic-bezier(.3, 1.5, .5, 1) backwards; }
  .gt-ham.build .gpr { animation: ghpost ${HB(0.24)}ms ${HB(0.27)}ms cubic-bezier(.3, 1.5, .5, 1) backwards; }
  .gt-ham.build .gnet { transform-origin: 5px 3.4px; animation: ghnet ${HB(0.4)}ms ${HB(0.56)}ms cubic-bezier(.3, 1.3, .5, 1) backwards; }
  .gt-ham.fold .gnet { transform-origin: 5px 3.4px; animation: ghnet ${HF(0.4)}ms ease-in reverse forwards; }
  .gt-ham.fold .gpost { animation: ghpost ${HF(0.45)}ms ${HF(0.42)}ms ease-in reverse both; }
  @keyframes ghpost { from { transform: scaleY(0); opacity: 0; } 30% { opacity: 1; } to { transform: none; } }
  @keyframes ghnet { from { transform: scaleX(.06) scaleY(.4); opacity: 0; } 25% { opacity: 1; } to { transform: none; } }
  .gt-plush { width: calc(var(--H) * .085); margin-left: calc(var(--H) * -.0425); transform: rotate(-12deg); }
  .gt-plush svg { display: block; width: 100%; height: auto; }
  .gt-plush.out { width: calc(var(--H) * .13); margin-left: calc(var(--H) * -.065); transform: rotate(-5deg); }
  .night .gt-plush { filter: brightness(.72) saturate(.75); }
  /* Golden (Stufe 3): Farben nach Gold umgefärbt, leichter Schimmer */
  .gt.gilt, .gitem.gilt svg { filter: ${GILT_F} drop-shadow(0 0 2px rgba(255, 220, 110, .75)); }
  /* … und in der Dämmerung danach das Licht (seit 0.38 je Stück, siehe .gifts > *) */
  .shade .gifts > .gt.gilt { filter: ${GILT_F} drop-shadow(0 0 2px rgba(255, 220, 110, .75)) ${LICHT_P}; }
  .night .gt-plush.gilt { filter: ${GILT_F} brightness(.72); }
  /* Tricks: Schaukeln, Anpusten, Regenbogen */
  .gt-ham.swing .gnet { animation: gswing .9s ease-in-out infinite alternate; }
  @keyframes gswing { from { transform: rotate(-9deg); } to { transform: rotate(9deg); } }
  .hswing .depth { transform-origin: 50% -40%; animation: gswing-p .9s ease-in-out infinite alternate; }
  @keyframes gswing-p { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
  .gair { position: absolute; width: calc(var(--H) * .022); height: calc(var(--H) * .012); margin: calc(var(--H) * -.006);
    border-radius: 50%; border: 1.5px solid rgba(255, 255, 255, .85); border-left-color: transparent; opacity: 0;
    animation: gair .8s ease-out forwards; }
  @keyframes gair { 15% { opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.6); opacity: 0; } }
  .grbow { position: absolute; width: calc(var(--H) * .22); margin-left: calc(var(--H) * -.11); opacity: 0;
    animation: grbow 2.6s ease-in-out forwards; pointer-events: none; }
  .grbow svg { display: block; width: 100%; height: auto; }
  @keyframes grbow { 20%, 70% { opacity: .75; } to { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .gt-ham.swing .gnet, .hswing .depth { animation: none !important; } }
  .scene.night:not(.windy) .gwhl, .scene.night:not(.windy) .gbob, .scene.night:not(.windy) .gdrift { animation-play-state: paused; }
  /* Pika schläft: Windrad und Ballon halten still (wie .hb-still), das spart das Neuzeichnen unter dem Filter */
  .gifts.still .gwhl, .gifts.still .gbob, .gifts.still .gdrift { animation-play-state: paused; }
  /* Angetippt dreht es sich kurz, auch wo es sonst ruht (nachts ohne Wind, Pika schläft); nicht, wenn keiner hinsieht */
  .scene:not(.paused) .gifts .gt-wheel.tapspin .gwhl { animation-play-state: running; }
  @media (prefers-reduced-motion: reduce) { .gwhl, .gbob, .gdrift, .gt-ham .gnet { animation: none !important; } }
  /* Bewegung reduzieren: Aufstellen und Abbauen nur ein- und ausblenden */
  @media (prefers-reduced-motion: reduce) {
    .gt-ham .gpost { animation: none !important; }
    .gt-ham.build { animation: kramfade ${HB(0.5)}ms backwards; }
    .gt-ham.fold { opacity: 0; transition: opacity ${HF(0.5)}ms; }
  }

  /* Pika: Zwille, Fernrohr, Gießkanne, Sonnenbrille */
  .slg, .gspy, .gcan, .shades { display: none; }
  .sling .slg, .spy .gspy, .wcan .gcan, .cool .shades { display: inline; }
  .pika.sling .brolly, .pika.spy .brolly, .pika.wcan .brolly, .pika.sling .mfood { display: none; }
  .sleeping .shades, .inside .shades { display: none; }
  .slr { transform-box: view-box; transform-origin: 112px 62px; transform: rotate(32deg); transition: transform .35s; }
  .aim .slr { transform: none; }
  .slb-r { display: none; }
  .snap .slb-p, .snap .slp { display: none; }
  .snap .slb-r { display: inline; }
  .gcr { transform-box: view-box; transform-origin: 106px 62px; transition: transform .45s; }
  /* Tricks: Brille hochschieben und zwinkern, Backen aufblasen beim Pusten */
  .shades { transition: transform .35s ease-out; }
  .shup .shades { transform: translateY(-12px); }
  .wink .eye-r { display: none; }
  .wink .seye-r { display: inline; }
  .puffy .omouth { display: inline; }
  /* Goldene Sonnenbrille, goldenes Fernrohr, goldene Gießkanne */
  .g-shd .shades path:first-child { stroke: #e0a820; stroke-width: 1.6; }
  .g-shd .shades path:nth-child(2) { stroke: #c98a0c; stroke-width: 1.2; }
  .g-scp .gspy [fill="#b8862e"] { fill: #e8b52a; }
  .g-scp .gspy [fill="#d9a441"] { fill: #ffd75a; }
  .g-scp .gspy [fill="#8a5a32"] { fill: #c98a0c; }
  .g-scp .gspy [stroke="#f3cf7a"] { stroke: #fff4c2; }
  .g-can .gcan [fill="#5fae4a"] { fill: #f2c230; }
  .g-can .gcan [stroke="#8fd16f"] { stroke: #fff2b0; }
  .pour .gcr { transform: rotate(32deg); }

  /* Knopf (links neben dem Futterknopf, oben rechts) mit Fortschrittsring, Album */
  .gbtn {
    position: absolute; right: 52px; top: 6px; z-index: var(--z-ui); width: 36px; height: 36px; padding: 0;
    border: none; border-radius: 50%; cursor: pointer; background: rgba(255, 255, 255, .75); -webkit-touch-callout: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, .18); transition: transform .15s, background 2.5s; user-select: none;
  }
  .gbtn[hidden] { display: none; }
  .gbtn:active { transform: scale(.88); }
  .night .gbtn { background: rgba(15, 22, 45, .55); }
  .gbtn .gico { position: absolute; inset: 7px 7px 7.5px; transition: opacity .4s, filter .4s; }
  .gbtn .gico svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .gring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
  .gring circle { fill: none; stroke-width: 3.4; }
  .gr0 { stroke: rgba(0, 0, 0, .1); }
  .night .gr0 { stroke: rgba(255, 255, 255, .15); }
  .gr1 { stroke: #f2b632; stroke-linecap: round; stroke-dasharray: var(--gp, 0) 100; transition: stroke-dasharray .8s, opacity .3s; }
  /* Fortschritt noch nicht berechnet (gerade geladen): kein Punkt bei 0 %, danach füllt sich der Ring */
  .gbtn.wait .gr1 { opacity: 0; }
  /* Toleranz läuft: der Ring zeigt in Orange, wie viel davon übrig ist (wird kürzer), ohne zu pulsieren. Auch wenn
     schon alles wieder über 50 % ist (nur selbst geknabbert), schließt erst eine Pflege-Aktion die Lücke. */
  .gbtn.warn .gr1 { stroke: #e8892a; }
  .gbtn.warn.ok .gr1 { stroke: #eaa25a; }
  /* Im Urlaub: blass, der Ring steht */
  .gbtn.away .gico { opacity: .45; filter: grayscale(.8); }
  .gbtn.away .gr1 { stroke: #c9c3b8; }
  /* Was fehlt (Satt, Glück, Sauber): kleines Zeichen links unten am Knopf */
  .gcrit { position: absolute; left: -5px; bottom: -5px; width: 16px; height: 16px; padding: 2px; box-sizing: border-box;
    border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); }
  .gcrit:empty { display: none; }
  .gcrit svg { display: block; width: 100%; height: 100%; }
  .gbtn.broken .gr1 { stroke: #b8b2a8; }
  .gbtn.empty .gico { opacity: .45; filter: grayscale(.7); }
  .gnum { position: absolute; right: -4px; top: -3px; min-width: 15px; height: 15px; padding: 0 3px; box-sizing: border-box;
    border-radius: 8px; background: #e8584e; color: #fff; font: 700 10px/15px sans-serif; text-align: center; }
  .gnum:empty { display: none; }
  .gbtn.gold .gnum { background: #d99a12; }
  .gbtn.wig { animation: gwig .7s; }
  @keyframes gwig { 20% { transform: rotate(-12deg); } 40% { transform: rotate(10deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(3deg); } }
  .gbtn.new { animation: gnew .9s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes gnew { from { transform: scale(0) rotate(-40deg); } }
  .gbtn.no { animation: no .4s; }
  `;

export { STYLE_GIFT };
