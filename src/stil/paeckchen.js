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

  /* ---- Gold mit Wirkung (Stufe 3, seit 0.44): Teilchen der Zugaben in der Effekt-Ebene (_goldFx). Ohne filter (Safari
     schneidet dessen Überstand ab): Der Lichthof ist ein eigener Verlauf hinter dem Stern. Jedes Teilchen hat eine
     ruhige Fassung (.still, „Bewegung reduzieren“): Es blendet am Platz ein und aus, nichts treibt, dreht oder wächst. */
  .gfx { position: absolute; width: calc(var(--H) * .058); margin: calc(var(--H) * -.029); pointer-events: none; opacity: 0;
    font-style: normal; animation: gfx-still 1.2s ease-in-out both; }
  .gfx::before { content: ''; position: absolute; inset: -40%; border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 232, 130, .8), rgba(255, 226, 120, 0) 68%); }
  .gfx svg { position: relative; display: block; width: 100%; height: auto; overflow: visible; }
  .gfx:not(.hbfly) path { fill: #ffe066; stroke: #d6920f; stroke-width: 1.5; stroke-linejoin: round; }
  @keyframes gfx-still { 0%, 100% { opacity: 0; } 30%, 70% { opacity: 1; } }
  /* Funkenspur des Wollknäuels, Funken über den gegossenen Blumen: ploppt auf, sinkt ein wenig und verglimmt */
  .gfx.trail { animation: gfx-trail .9s ease-out both; }
  @keyframes gfx-trail {
    0% { transform: scale(0) rotate(-30deg); opacity: 0; }
    30% { transform: scale(1.15) rotate(10deg); opacity: 1; }
    100% { transform: translateY(calc(var(--H) * .025)) scale(.35) rotate(60deg); opacity: 0; }
  }
  /* Lichtfunken des Windrads: treiben mit dem Wind über die Wiese und blinken dabei */
  .gfx.glint { width: calc(var(--H) * .064); margin: calc(var(--H) * -.032); animation: gfx-drift 2.4s ease-out both; }
  @keyframes gfx-drift {
    0% { transform: scale(0); opacity: 0; }
    12% { transform: translate(calc(var(--dx) * .1), calc(var(--dy) * .1)) scale(1.2); opacity: 1; }
    40% { transform: translate(calc(var(--dx) * .45), calc(var(--dy) * .45)) scale(.7); opacity: .9; }
    62% { transform: translate(calc(var(--dx) * .68), calc(var(--dy) * .68)) scale(1.1); opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) scale(.4); opacity: 0; }
  }
  /* Herzchen des Plüsch-Pinos: winzig, steigt auf */
  .gfx.heart { width: calc(var(--H) * .054); margin: calc(var(--H) * -.027); animation: gfx-heart 1.7s ease-out both; }
  .gfx.heart path { fill: #ffcf3a; stroke-width: 1.8; }
  .gfx.heart .gl { fill: none; stroke: #fffbe0; stroke-width: 1.6; stroke-linecap: round; }
  @keyframes gfx-heart {
    0% { transform: scale(.3); opacity: 0; }
    18% { transform: translateY(calc(var(--H) * -.02)) scale(1.1); opacity: 1; }
    100% { transform: translate(var(--dx, 0px), calc(var(--H) * -.15)) scale(.85); opacity: 0; }
  }
  /* „bling“ am Rand der Sonnenbrille: ein heller Stern blitzt auf */
  .gfx.bling { width: calc(var(--H) * .075); margin: calc(var(--H) * -.0375); animation: gfx-bling .75s ease-out both; }
  .gfx.bling path { fill: #fffbe0; stroke: #f2c230; }
  @keyframes gfx-bling {
    0% { transform: scale(0) rotate(0deg); opacity: 0; }
    35% { transform: scale(1.25) rotate(40deg); opacity: 1; }
    100% { transform: scale(.2) rotate(90deg); opacity: 0; }
  }
  /* Fernrohr: Stern, der dreimal aufblinkt, bzw. ein winziges Flugzeug in der Ferne, das ein Stück weiterzieht */
  .gfx.star { width: calc(var(--H) * .05); margin: calc(var(--H) * -.025); animation: gfx-twinkle 2.3s ease-in-out both; }
  .gfx.star path { fill: #fffbe0; stroke: #f2c230; }
  @keyframes gfx-twinkle {
    0%, 100% { transform: scale(.2); opacity: 0; }
    15%, 50%, 85% { transform: scale(1.15); opacity: 1; }
    33%, 68% { transform: scale(.55); opacity: .6; }
  }
  .gfx.plane { width: calc(var(--H) * .09); margin: calc(var(--H) * -.0206) calc(var(--H) * -.045); animation: gfx-plane 2.3s linear both; }
  .gfx.plane::before { inset: -10% -5%; background: radial-gradient(ellipse, rgba(255, 236, 150, .7), rgba(255, 236, 150, 0) 70%); }
  .gfx.plane svg { transform: scaleX(var(--fl, 1)); }
  .gfx.plane path { fill: #5d6f88; stroke: none; }
  .night .gfx.plane path, .dusk .gfx.plane path { fill: #c9d3e6; }
  @keyframes gfx-plane {
    0% { opacity: 0; }
    20%, 75% { opacity: .85; }
    100% { transform: translateX(var(--dx, 0px)); opacity: 0; }
  }
  /* Antwort des Vogels auf das Glöckchen, vom Bildrand: eine Note wie beim Zwitschern (.note) */
  .gfx.tweet { width: auto; margin: 0; font-size: calc(var(--H) * .075); font-weight: 800; line-height: 1; color: #fff3b8;
    text-shadow: 0 1px 2px rgba(60, 40, 30, .75), 0 0 1px rgba(60, 40, 30, .9); transform: translate(-50%, -50%); animation: gfx-tweet 1.4s ease-out both; }
  .gfx.tweet::before { display: none; }
  @keyframes gfx-tweet {
    0% { transform: translate(-50%, -50%) scale(.4) rotate(-10deg); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(calc(-50% + var(--dx, 8px)), calc(-50% - var(--H) * .12)) scale(1) rotate(12deg); opacity: 0; }
  }
  /* Ruhig: nach den Arten, damit es deren Animation ersetzt (gleiche Spezifität, die spätere Regel gewinnt) */
  .gfx.still { animation: gfx-still 1.4s ease-in-out both; }
  /* Besuch auf dem Gestell der Hängematte: Schmetterling (BFLY_SVG, Füße unten in der Mitte) und Glühwürmchen. Sie
     bleiben, solange er döst; .off: Er ist aufgewacht, sie fliegen davon. */
  .gfx.hbfly { width: calc(var(--ph) * .13); margin: calc(var(--ph) * -.1) 0 0 calc(var(--ph) * -.065); opacity: 1; animation: none; }
  .gfx.hbfly::before, .gfx.hff::before { display: none; }
  .gfx.hbfly .bwl, .gfx.hbfly .bwr { transform-box: view-box; transform-origin: 10px 8px;
    animation: bfw .16s ease-in-out 34 alternate, bfw 1.4s ease-in-out 5.5s infinite alternate; }
  .gfx.hff { width: calc(var(--H) * .024); height: calc(var(--H) * .024); margin: calc(var(--H) * -.024) 0 0 calc(var(--H) * -.012);
    border-radius: 50%; background: radial-gradient(circle, #fffde0 30%, #e6f56a 75%); opacity: 1;
    box-shadow: 0 0 calc(var(--H) * .03) calc(var(--H) * .012) rgba(226, 250, 120, .75);
    animation: gfx-ffin 2.4s 2.5s ease-out backwards, gfx-ffglow 1.9s 4.9s ease-in-out infinite alternate; }
  @keyframes gfx-ffin {
    0% { transform: translate(calc(var(--H) * .12), calc(var(--H) * -.2)); opacity: 0; }
    50% { transform: translate(calc(var(--H) * -.03), calc(var(--H) * -.07)); opacity: 1; }
    100% { transform: none; opacity: 1; }
  }
  @keyframes gfx-ffglow { to { opacity: .45; box-shadow: 0 0 calc(var(--H) * .015) calc(var(--H) * .004) rgba(226, 250, 120, .5); } }
  .gfx.hbfly.still, .gfx.hff.still { animation: gfx-in .9s 2.5s ease-out both; }
  @keyframes gfx-in { from { opacity: 0; } to { opacity: 1; } }
  .gfx.hbfly.off, .gfx.hff.off { transition: transform .75s ease-in, opacity .75s ease-in; opacity: 0;
    transform: translate(calc(var(--H) * .14), calc(var(--H) * -.32)); }
  /* Goldene Hängematte ohne Besuch: Ein Schimmer läuft langsam von Seil zu Seil übers Netz (.gshim), ruhig liegt er
     still darauf (.gglow). Wo er darin liegt, verdeckt er das Netz: Zu sehen ist der Schimmer an den Seilen und am
     unteren Rand. */
  .gt-ham .gshm { opacity: 0; stroke-dasharray: 16 200; stroke-dashoffset: 16; }
  .gt-ham.gshim .gshm { animation: gshm 5.5s ease-in-out infinite; }
  @keyframes gshm {
    0% { stroke-dashoffset: 16; opacity: 0; }
    8% { opacity: 1; }
    42% { stroke-dashoffset: -100; opacity: 1; }
    50%, 100% { stroke-dashoffset: -100; opacity: 0; }
  }
  .gt-ham.gglow .gshm { opacity: .55; stroke-dasharray: none; transition: opacity 1.2s; }
  /* Goldene Blume der Gießkanne (GOLD_FLOWER): etwas größer als die Wiesenblumen, vom Boden aus. Am Bild in der
     Blume, nicht an einer Klasse: Malt ein Wechsel der Jahreszeit sie neu, ist sie eine gewöhnliche. */
  .flower svg.gsun { scale: 1.22; transform-origin: 50% 100%; }
  @media (prefers-reduced-motion: reduce) {
    .gfx:not(.hbfly):not(.hff) { animation-name: gfx-still !important; }
    .gfx.hbfly, .gfx.hff { animation: gfx-in .9s 2.5s ease-out both !important; }
    .gfx.hbfly .bwl, .gfx.hbfly .bwr, .gt-ham .gshm { animation: none !important; }
    .gfx.off { transition: opacity .5s !important; transform: none !important; }
  }
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
  /* Goldene Sonnenbrille bei Sonne: Der Lichtreflex auf den Gläsern (dritter Pfad der Brille) wandert einmal hinüber
     und zurück (.gsheen); ruhig glimmt er nur auf (.gglow, _goldSheen) */
  .gsheen .shades path:nth-child(3) { animation: gsheen 1.4s ease-in-out; }
  @keyframes gsheen { 50% { transform: translateX(5.4px); opacity: 1; stroke: #fff6c2; stroke-width: 1.5; } }
  .gglow .shades path:nth-child(3) { animation: gglow 1.4s ease-in-out; }
  @keyframes gglow { 50% { opacity: 1; stroke: #fff6c2; stroke-width: 1.5; } }
  @media (prefers-reduced-motion: reduce) { .gsheen .shades path:nth-child(3) { animation-name: gglow !important; } }

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
    border-radius: 8px; background: #cf4037; color: #fff; font: 700 10px/15px sans-serif; text-align: center; }
  .gnum:empty { display: none; }
  /* Die Zahl ist 10 px klein: Weiß auf dem Rot hat 4,7 : 1 (bis 0.43.0 #e8584e: 3,5), auf Gold steht sie dunkel
     (5,4 : 1; weiß waren es 2,5) */
  .gbtn.gold .gnum { background: #d99a12; color: #3b2d22; }
  .gbtn.wig { animation: gwig .7s; }
  @keyframes gwig { 20% { transform: rotate(-12deg); } 40% { transform: rotate(10deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(3deg); } }
  .gbtn.new { animation: gnew .9s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes gnew { from { transform: scale(0) rotate(-40deg); } }
  .gbtn.no { animation: no .4s; }
  `;

export { STYLE_GIFT };
