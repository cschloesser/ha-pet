// Stil der Festtage

import { BZ } from '../logik/buehne.js';

const STYLE_FEST = `
  .fest-b, .fest-f, .fest-b > div, .fest-f > div { position: absolute; inset: 0; pointer-events: none; }
  /* Bühne: Jede Gruppe hat eine Ebene (ihre Stücke haben alle denselben Rang). Hinter dem Bau Himmel und Baum,
     am Bau Lichter und Girlanden (hinter dem Pika), vorn Kürbis, Stiefel, Kranz, Eier, Konfetti. */
  .fest-b > .fsky, .fest-b > .fback { z-index: ${BZ.festHinten}; }
  .fest-b > .fon { z-index: ${BZ.festBau}; }
  .fest-f > div { z-index: ${BZ.festVorn}; }
  .fi { position: absolute; }
  .fi > svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
  .fi .b { transition: filter 2.5s; }
  .shade .fi .b { filter: brightness(var(--lb, 1)) saturate(var(--ls, 1)); }
  .fi .nite { opacity: 0; transition: opacity 2.5s; }
  .dusk .fi .nite { opacity: .75; }
  .night .fi .nite { opacity: 1; }
  /* Flackern und Blinken nur in Dämmerung und Nacht: tags ist .nite unsichtbar, das Neuzeichnen spart sich das Tablet */
  .dusk .fflk, .night .fflk { animation: fflk 2.2s ease-in-out infinite alternate; }
  @keyframes fflk { 0% { opacity: 1; } 25% { opacity: .7; } 40% { opacity: .95; } 65% { opacity: .78; } 100% { opacity: 1; } }
  /* Flammen flackern in Stufen (ein Kerzenflackern ist ohnehin sprunghaft): Kranz und Kuchen stehen tage- und
     wochenlang, so wird ihr SVG nur etwa neunmal pro Sekunde neu gemalt */
  .flm { transform-box: fill-box; transform-origin: 50% 100%; animation: fflame .45s steps(4) infinite alternate; }
  @keyframes fflame { from { transform: scale(.88, 1.06) rotate(-5deg); } to { transform: scale(1.06, .9) rotate(4deg); } }
  /* Lämpchen in drei Gruppen, die im Wechsel blinken (Verzögerung je Gruppe), in Stufen: wenige Neuzeichnungen pro
     Sekunde statt jedes Bild für jedes Lämpchen einzeln */
  .dusk .fbl, .night .fbl { animation: fblink 2.8s steps(6) infinite alternate; }
  @keyframes fblink { 0%, 45% { opacity: 1; } 100% { opacity: .3; } }
  .lsw { transform-box: view-box; animation: flsw 2.6s ease-in-out infinite alternate; }
  .flan .lsw { transform-origin: 13.5px 2px; }
  .fest-carry .lsw { transform-origin: 128px 6px; animation-duration: 1.3s; }
  @keyframes flsw { from { transform: rotate(-6deg); } to { transform: rotate(6deg); } }
  /* Ostereier: antippen = wackeln */
  .fegg { pointer-events: auto; cursor: pointer; }
  .fegg > svg { left: 6px; top: 6px; width: calc(100% - 12px); height: calc(100% - 12px); transform-origin: 50% 100%; }
  .fegg.wob > svg { animation: fwob .8s ease-in-out; }
  @keyframes fwob { 15% { transform: rotate(-14deg); } 35% { transform: rotate(11deg); } 55% { transform: rotate(-7deg); } 75% { transform: rotate(4deg); } }
  /* Kuchen: ausgepustet */
  .fcake .smk { opacity: 0; stroke-dasharray: 22; stroke-dashoffset: 22; transform-box: fill-box; }
  .fcake.out .flm, .fcake.out .khalo { display: none; }
  .fcake.out .smk { animation: fsmk 2.6s ease-out forwards; }
  @keyframes fsmk { 0% { opacity: .9; stroke-dashoffset: 22; } 50% { opacity: .7; } 100% { opacity: 0; stroke-dashoffset: 0; transform: translate(1px, -4px); } }
  /* Maibaum: Bänder wehen in Windrichtung (--wd) */
  .fmai .rd { transform-box: view-box; transform-origin: 20px 46px; transform: scaleX(var(--wd, 1)); transition: transform 3s; }
  .fmai .rb { transform-box: view-box; transform-origin: 20px 46px; animation: frib 1.2s ease-in-out infinite alternate; }
  @keyframes frib { from { transform: rotate(-4deg) skewY(3deg); } to { transform: rotate(5deg) skewY(-4deg); } }
  .windy .fmai .rb { animation-duration: .55s; }
  /* Wimpel und Girlande: die Grafik ist kartengroß, darum ohne Filter (der müsste jedes Bild neu gerechnet
     werden); abgedunkelt wird über die Deckkraft, nachts hängen die Wimpel still */
  .scene .fi.fwim .b { filter: none; transition: none; }
  .fwim { transition: opacity 2.5s; }
  .dusk .fwim { opacity: .85; }
  .night .fwim { opacity: .6; }
  .fpn { transform-box: fill-box; transform-origin: 50% 0; animation: fpn 2.4s ease-in-out infinite alternate; }
  @keyframes fpn { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
  .windy .fpn { animation-duration: .9s; }
  .night .fpn { animation-play-state: paused; }
  /* Hüte am Pika: Weihnachtsmütze ersetzt beim Schlafen die Zipfelmütze, die anderen nur wach */
  .hats > g { display: none; }
  .fest-witch .hat-witch, .fest-party .hat-party, .fest-xmas .hat-xmas { display: inline; }
  .sleeping .hat-witch, .sleeping .hat-party { display: none; }
  .pika.sleeping.fest-xmas .cap { display: none; }
  /* St. Martin: Laterne am Stab */
  .fest-carry { position: absolute; inset: 0; display: none; pointer-events: none; }
  .fest-lantern .fest-carry { display: block; }
  .fest-carry svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .fest-carry .lgl { opacity: .45; transition: opacity 2.5s; }
  .dusk .fest-carry .lgl { opacity: .8; }
  .night .fest-carry .lgl { opacity: 1; }
  /* Zucken beim Knall */
  .pika.fest-zuck .hop { animation: fzuck .4s ease-out; }
  @keyframes fzuck { 25% { transform: translateY(-6%) scale(.96, 1.05); } 60% { transform: scale(1.04, .96); } }
  /* Fledermaus */
  .fbat { position: absolute; left: 0; top: 0; width: calc(var(--H) * .085); margin: calc(var(--H) * -.024) 0 0 calc(var(--H) * -.042); }
  .fbat svg { display: block; width: 100%; height: auto; overflow: visible; }
  .fbat .w { transform-box: view-box; transform-origin: 20px 11px; animation: fbflap .15s ease-in-out infinite alternate; }
  @keyframes fbflap { to { transform: scaleY(-.45); } }
  /* Feuerwerk: Rakete mit Schweif, Kugel aus Sternchen, Funken rieseln, Lichtschein auf der Wiese */
  .fwr {
    position: absolute; left: 0; top: 0; width: 2px; height: calc(var(--H) * .06); margin-left: -1px; border-radius: 1px;
    transform-origin: 50% 0; background: linear-gradient(#fff6d6, rgba(255, 190, 110, .7) 30%, rgba(255, 160, 90, 0));
    box-shadow: 0 0 4px rgba(255, 230, 160, .8);
  }
  .fwb { position: absolute; width: 0; height: 0; }
  .fwb i { position: absolute; left: 0; top: 0; display: block; border-radius: 50%; }
  /* Leuchten über einen Verlauf statt box-shadow: der Schatten müsste bei jedem Bild weichgezeichnet werden */
  .fwb .fwp {
    width: calc(var(--H) * .036); height: calc(var(--H) * .036); margin: calc(var(--H) * -.018);
    background: radial-gradient(closest-side, #fff 0, var(--c) 32%, transparent);
  }
  .fwb .fws { width: 6px; height: 6px; margin: -3px; background: radial-gradient(closest-side, #fffbe8 0, rgba(255, 240, 190, .8) 40%, transparent); }
  .fwb .fwc {
    width: calc(var(--H) * .07); height: calc(var(--H) * .07); margin: calc(var(--H) * -.035);
    background: radial-gradient(closest-side, #fff, var(--c) 45%, transparent); animation: fwc .5s ease-out forwards;
  }
  @keyframes fwc { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.7); opacity: 0; } }
  .fest-f > .fwl { opacity: 0; background: radial-gradient(ellipse 95% 85% at var(--fx, 50%) var(--fy, 20%), var(--fc, #fff), transparent 80%); }
  .fest-f > .fwl.go { animation: fwl 1.1s ease-out; }
  @keyframes fwl { 8% { opacity: .2; } 100% { opacity: 0; } }
  .fcf i { position: absolute; top: 0; display: block; }
  /* Weniger Bewegung gewünscht: Wimpel und Maibaum-Bänder hängen still (Teilchen spart das Skript, calmMotion) */
  @media (prefers-reduced-motion: reduce) {
    .fpn, .fmai .rb { animation: none !important; }
  }
  `;

export { STYLE_FEST };
