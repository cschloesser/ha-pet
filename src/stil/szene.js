// Stil der Szene: Karte, Ebenen (Bühne, darüber --z-wx bis --z-tag), Himmel, Wetter, Land, Pika, Besucher, Leiste, Knöpfe

import { MIMIK_ON } from '../logik/interaktion.js';
import { KITE_LEAN } from '../logik/beschaeftigungen.js';
import { PK_DIM, PK_ACC } from '../grafik/pika.js';
import { BZ, BUEHNE_MAX, LICHT, LICHT_P } from '../logik/buehne.js';

const STYLE = `
  :host { display: block; height: 100%; }
  ha-card { display: block; height: 100%; overflow: hidden; background: none; border-radius: var(--ha-card-border-radius, 12px); }
  .scene {
    /* clip statt hidden, wo es das gibt: hidden bleibt per Skript scrollbar (Fokus, scrollIntoView auf ein Element, das
       über den Rand ragt), die ganze Szene stünde dann verschoben und käme nie zurück */
    position: relative; height: 100%; overflow: hidden; overflow: clip; border-radius: inherit;
    /* Größe kommt von außen, nichts ragt hinaus: Stil, Layout und Malen bleiben auf die Karte begrenzt */
    contain: strict;
    user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui, sans-serif));
    --h1: #a9d68f; --h2: #86c46b; --h3: #7ab960;
    --h0: #b4dcc2; /* ferne Hügelkette (depth): --h1 halb mit dem Himmel auf ihrer Höhe gemischt, deckend */
    /* Ebenen der Szene von hinten nach vorn, für alle Stilblöcke. Was keine Ebene hat (Himmel, Sonne, Wolken,
       Flugzeuge, Hügel), liegt in DOM-Reihenfolge ganz unten. Darüber die Bühne: Jede Figur am Boden hat ihre
       eigene Ebene aus ihrem Fußpunkt (buehneZ in src/logik/buehne.js, von 1 bis ${BUEHNE_MAX}; die Schichten
       .mice … .poops sind nur Behälter ohne Ebene). Darüber folgen diese. Zahlen ohne Variable gelten nur innerhalb
       ihres Elternteils. */
    --z-wx: ${BUEHNE_MAX + 1};    /* Regen, Schnee, Nebel, Blitz */
    --z-talk: ${BUEHNE_MAX + 2};  /* Sprech- und Denkblasen, zzz, Zeichen über dem Kopf; Tippflächen der Flugzeuge */
    --z-ui: ${BUEHNE_MAX + 3};    /* Statusleiste und Knöpfe */
    --z-fx: ${BUEHNE_MAX + 4};    /* Kurzlebiges: Herzchen, Funken, Noten, Staub, Geschenk */
    --z-tag: ${BUEHNE_MAX + 5};   /* Fähnchen von Flugzeugen und Geräten: die gefragte Auskunft liegt über allem */
  }
  /* --h0 bis --h3, --m1, --mcap, --mound, --mound-s (Hügel, Wiese, Halme, Berge, Kuppe) und --lb, --ls, --lbp (Licht auf dem Land) setzt
     _light am Element: nach Jahreszeit, Sonnenhöhe, Wetter und Schneedecke (landColors). Oben stehen nur die
     Startwerte (Tag im Mai). */

  /* Himmel in Schichten: Tag liegt unten, Abendrot und Nacht blenden stufenlos mit der Sonnenhöhe darüber (Deckkraft
     aus twilight, gesetzt in _light), darüber Grau bei bedecktem Himmel und ein dunkler Schleier bei Gewitter. */
  .sky { position: absolute; inset: 0; opacity: 0; transition: opacity 2.5s; }
  .sky-day { background: linear-gradient(#93cdf0, #dff1fa 78%); opacity: 1; }
  .sky-dusk { background: linear-gradient(#5f62ad, #d996b2 55%, #f7c48e 88%); }
  .sky-night { background: linear-gradient(#0d1734, #27386a 85%); }
  .sky-grey { background: linear-gradient(#8f9eab, #d3dbe1 80%); }
  .sky-grey::before, .sky-grey::after { content: ''; position: absolute; inset: 0; transition: opacity 2.5s; }
  .sky-grey::before { background: linear-gradient(#5d6079, #b1a3ad 80%); opacity: var(--gd, 0); }
  .sky-grey::after { background: linear-gradient(#141b2b, #2b3449 85%); opacity: var(--gn, 0); }
  .overcast .sky-grey { opacity: .9; }
  .sky-storm { background: linear-gradient(rgba(30, 38, 50, .7), rgba(62, 72, 86, .5)); }

  /* Sonne und Mond: left/top setzt das Skript nach dem echten Stand, Wechsel gleiten langsam */
  .sun, .moon {
    position: absolute; left: 80%; top: 20%; aspect-ratio: 1; border-radius: 50%; transform: translate(-50%, -50%);
    opacity: 0; transition: opacity 2.5s, left 90s linear, top 90s linear, background 2.5s;
  }
  .sun {
    width: calc(var(--H) * .15);
    background: radial-gradient(#fff8d2, #ffd75a 70%); box-shadow: 0 0 22px 8px rgba(255, 222, 110, .45);
  }
  .day .sun, .dusk .sun { opacity: 1; }
  .sun-low .sun { background: radial-gradient(#ffe0b0, #ff9a5c 70%); box-shadow: 0 0 22px 8px rgba(255, 150, 90, .4); }
  /* Dichte Wolken (auch Regen, Schnee) lassen nur einen Hauch der Scheibe durch, Gewitter und Nebel gar nichts */
  .overcast .sun { opacity: .07; }
  .storm .sun, .foggy .sun, .sun-down .sun { opacity: 0; }
  .moon { width: calc(var(--H) * .12); filter: drop-shadow(0 0 6px rgba(244, 239, 207, .55)); }
  .moon svg { display: block; width: 100%; height: 100%; }
  .moon-lit { fill: #f4efcf; }
  .moon-dark { fill: rgba(44, 56, 92, .55); }
  .day .moon-dark, .dusk .moon-dark { fill: rgba(255, 255, 255, .12); }
  .moon-up.night .moon, .moon-up.dusk .moon { opacity: 1; }
  .moon-up.day .moon { opacity: .5; filter: none; }
  .moon-up.overcast .moon { opacity: .2; }
  /* Dichte Wolken (ab 85 %, Regen, Schnee, Nebel, Gewitter): kein Mond, keine Sterne (--starop ist dann 0) */
  .moon-up.dense .moon { opacity: 0; }
  .stars i {
    position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff;
    opacity: 0; transition: opacity 3s;
  }
  .night .stars i { opacity: var(--starop, .85); }
  .dusk .stars i:nth-child(3n + 1) { opacity: calc(var(--starop, .85) * .6); }
  /* Stern hinter der Mondscheibe: Die dunkle Seite des Mondes ist durchscheinend gemalt, er schiene hindurch (_starOcc) */
  .scene .stars i.occ { opacity: 0; }
  /* Funkeln pro Ebene (je acht Sterne), mit eigenem Takt und Versatz, damit es nicht im Gleichschritt pulsiert */
  .stars b { position: absolute; inset: 0; }
  .night .stars b { animation: twinkle 3s ease-in-out infinite alternate; }
  .night .stars b:nth-child(2) { animation-duration: 2.6s; animation-delay: -1.9s; }
  .night .stars b:nth-child(3) { animation-duration: 3.4s; animation-delay: -4.1s; }
  /* hinter dichten Wolken sind sie unsichtbar (--starop 0): nicht weiterfunkeln */
  .dense .stars b { animation-play-state: paused; }
  @keyframes twinkle { to { opacity: .3; } }

  /* Wolken: das Skript schaltet so viele ein, wie es die Bedeckung verlangt; Wind macht sie schneller. Dauer und
     Versatz stehen fest: Tempo und Richtung stellt _cloudWind an der laufenden Animation (playbackRate, direction),
     so bleibt jede Wolke bei einem Windwechsel, wo sie ist. */
  .cloud {
    position: absolute; left: calc(var(--H) * -.6); width: calc(var(--H) * .42 * var(--s)); height: calc(var(--H) * .1 * var(--s));
    border-radius: 999px; background: var(--cloud, #fff); opacity: 0; transition: opacity 3s, background 3s;
    animation: drift var(--d) linear infinite; animation-delay: var(--dl);
  }
  .cloud::before, .cloud::after { content: ''; position: absolute; background: inherit; border-radius: 50%; }
  .cloud::before { width: 45%; aspect-ratio: 1; left: 15%; bottom: 30%; }
  .cloud::after { width: 32%; aspect-ratio: 1; left: 50%; bottom: 35%; }
  /* Ausgeblendete Wolken (und Nebel) stehen still: jede laufende Animation hält die Bildwiederholung in Gang */
  .cloud:not(.on), .scene:not(.foggy) .fog i { animation-play-state: paused; }
  .cloud.on { opacity: .92; }
  .dusk .cloud.on { opacity: .65; }
  .night .cloud.on { opacity: .5; }
  .scene.dusk { --cloud: #f1cfdd; }
  .scene.night { --cloud: #4a5674; }
  .scene.overcast { --cloud: #e1e6ea; }
  .scene.storm { --cloud: #8b959f; }
  .scene.dusk.overcast { --cloud: #b9aab8; }
  .scene.night.overcast { --cloud: #3a4560; }
  .scene.dusk.storm { --cloud: #7d7888; }
  .scene.night.storm { --cloud: #2f384d; }
  @keyframes drift { to { transform: translateX(calc(var(--W) + var(--H) * 1.2)); } }

  .hills, .mtns { position: absolute; inset: 0; width: 100%; height: 100%; }
  .hills .h1 { fill: var(--h1); transition: fill 2.5s; }
  .hills .h2 { fill: var(--h2); transition: fill 2.5s; }
  /* Berge (Areal alpin) in eigener Ebene hinter Regenbogen, Wolken und Flugzeugen: Ein tiefer Anflug verschwände
     sonst hinter dem Grat. Sonne, Mond und Sterne bleiben dahinter. Ihre Farben kommen wie die der Hügel fertig
     gerechnet aus _light (--m1, --mcap): Dämmerung, Wolkendecke und Gewitter gleiten mit Himmel und Land. */
  .snowcover .flower { opacity: 0; } /* je Blume: Deckkraft an der Schicht machte sie zu einem eigenen Stapel */

  /* ---- Prototyp Tiefe (depth: true) ----
     Kulisse in Ebenen: Je weiter weg, desto mehr wandert sie mit dem Pika mit (--plx -1 … 1, die Wiese
     mit Bau, Stein und Heu bleibt stehen). Ferne Hügelkette im Dunst nur hier, deckend im Dunstton (--h0),
     sonst schiene die tiefstehende Sonne durch. Einheiten der viewBox (100 breit), scaleX deckt die Ränder
     beim Verschieben ab. */
  .hills .h0 { display: none; fill: var(--h0); transition: fill 2.5s; }
  .tiefe .hills .h0 { display: inline; }
  .tiefe .mtns .mtn, .tiefe .hills .h0, .tiefe .hills .h1 { transform-box: view-box; transform-origin: 50% 100%; }
  .tiefe .mtns .mtn { transform: translateX(calc(var(--plx, 0) * 3.2px)) scaleX(1.08); transition: transform 4s ease-in-out; }
  .tiefe .hills .h0 { transform: translateX(calc(var(--plx, 0) * 2.4px)) scaleX(1.06); transition: fill 2.5s, transform 4s ease-in-out; }
  .tiefe .hills .h1 { transform: translateX(calc(var(--plx, 0) * 1.2px)) scaleX(1.03); transition: fill 2.5s, transform 4s ease-in-out; }
  /* Die Wolken-Ebene bekommt hier eine eigene Fläche: Mit transform ist sie der Bezugsrahmen ihrer Wolken, ohne Höhe
     stünden alle am oberen Rand (top in % von 0). */
  .tiefe .clouds {
    position: absolute; inset: 0; pointer-events: none;
    transform: translateX(calc(var(--plx, 0) * 2%)); transition: transform 4s ease-in-out;
  }
  /* Hintere Spur: Schatten etwas blasser, tagsüber ein Hauch Dunst (heller, weniger satt) */
  .pika.lane1 .shadow { opacity: .75; }
  .pika .br { transition: filter 1s; }
  .day:not(.overcast) .pika.lane1 .br { filter: saturate(.85) brightness(1.05); }
  /* Wer auf der hinteren Spur vor oder hinter ihm steht, folgt seit 0.38 aus dem Fußpunkt (Bühne, _pikaZ); den
     Wechsel der Ebene setzt _walkTo auf halbem Weg. */
  @media (prefers-reduced-motion: reduce) { .tiefe .hills *, .tiefe .mtns *, .tiefe .clouds { transition: none !important; } }

  /* Schichten der Bühne: nur Behälter, ohne Ebene und ohne Filter (beides machte sie zu einem eigenen Stapel, ihre
     Figuren könnten sich dann nicht mit denen anderer Schichten überlappen). Die Ebene hat jede Figur selbst. */
  .land, .flowers, .foods, .birds, .mice { position: absolute; inset: 0; }
  .birds, .mice { pointer-events: none; }
  /* Maus, Frosch und Schnecke (.mice) bekommen ihre Ebene seit 0.39 vom Skript (_critZ): hinter dem Stein BZ.maus,
     draußen auf der Wiese (.vorn) BZ.mausVorn, auf der hinteren Spur (.vorn.lane1) aus dem Fußpunkt */
  .birds > * { z-index: ${BZ.vogel}; } /* über der Festdeko am Bau, hinter Pika, Pino, Heu und Gras */
  /* Licht auf allem, was auf dem Land steht: Helligkeit und Sättigung stufenlos aus Sonnenhöhe und Wetter (--lb, --ls;
     --lbp für Requisiten, die nachts etwas heller bleiben). Bei vollem Tageslicht (ohne .shade) gar kein Filter.
     Hügel, Wiese und Halme haben ihre Farben fertig gerechnet (--h1 bis --h3), die Blumen auch (_flowerTint): Sie
     schaukeln ständig, ein Filter über ihnen müsste in jedem Bild neu gerechnet werden. Seit 0.38 liegt der Filter
     auf jeder Figur (Bau, Stein, Futter, Heu, Vogel, Maus, Frosch, Schnecke, Drachen, Häufchen, Schätze,
     Requisiten), nicht mehr auf ihrer Schicht; bei Vögeln und Besuchern auf der Grafik (.bw, .mw, .cw), die Hülle
     selbst ist 0 × 0 groß. */
  .burrow, .lookout, .food, .bw, .mw, .cw { transition: filter 2.5s; }
  /* Blumen und Futter fangen keine Tipps: Wer dahinter steht (Pika auf der hinteren Spur), bekommt sie. Die Welt-Tipps
     auf Blumen gehen über die Szene (_worldZones), wie bisher. */
  .flower, .food { pointer-events: none; }
  .shade .burrow, .shade .lookout, .shade .food, .shade .hay, .shade .bw, .shade .mw, .shade .cw, .shade .kite { filter: ${LICHT}; }
  .shade .poo { filter: ${LICHT_P}; }
  .burrow, .lights { position: absolute; }
  .burrow { z-index: ${BZ.bau}; }
  .lights { pointer-events: none; z-index: ${BZ.licht}; }
  .burrow svg, .lights svg { display: block; width: 100%; height: auto; overflow: visible; }
  .mound { fill: var(--mound, #94c873); stroke: var(--mound-s, #5f8f45); transition: fill 2.5s, stroke 2.5s; }
  .mound-t { stroke: var(--mound-s, #5f8f45); transition: stroke 2.5s; }
  .stump-top { fill: #d9b07c; transition: fill 2.5s; }
  .snowcover .stump-top { fill: #eef3f6; }
  .lt { opacity: 0; transition: opacity 2.5s; }
  .dusk .lt { opacity: .6; }
  .night .lt { opacity: 1; }
  .night .lt.flk { animation: flicker 2.8s ease-in-out infinite alternate; }
  @keyframes flicker { 40% { opacity: .75; } 55% { opacity: 1; } 100% { opacity: .85; } }
  .lookout { position: absolute; z-index: ${BZ.stein}; }
  .lookout svg { display: block; width: 100%; height: auto; overflow: visible; }
  .rock-snow { display: none; }
  .snowcover .rock-snow { display: inline; }
  .rtuft { fill: var(--h3); transition: fill 2.5s; }
  /* Fernsehen: flackerndes Licht im Eingang (der Fernseher steht drinnen), Bau-Fenster flackert mit */
  .tvl { position: absolute; pointer-events: none; overflow: hidden; opacity: 0; transition: opacity .8s; z-index: ${BZ.tv}; }
  .tv-on .tvl { opacity: 1; }
  .tvl i { position: absolute; display: block; }
  .tvl .tvg {
    inset: 0; background: radial-gradient(ellipse 85% 75% at 50% 45%, var(--tvc, #9fd0ff), transparent 80%);
  }
  .tv-on .tvl .tvg { animation: tvflk 1.3s linear infinite; }
  .tvl .scr {
    left: 30%; width: 40%; top: 15%; height: 22%; border-radius: 3px; background: var(--tvc, #9fd0ff);
    border: 2px solid #1d1d22; box-shadow: 0 0 10px 4px var(--tvc, #9fd0ff);
  }
  .tvw, .tvw-x { opacity: 0; transition: opacity .8s; }
  .tvw { fill: var(--tvc, #9fd0ff); }
  .tv-on .tvw { opacity: .8; animation: tvflk 1.3s linear infinite; }
  .tv-on .tvw-x { opacity: 1; }
  @keyframes tvflk { 0%, 100% { opacity: .55; } 20% { opacity: .75; } 35% { opacity: .45; } 60% { opacity: .7; } 80% { opacity: .5; } }
  /* Drachen: Schnur und Drachen hängen an der Pfote (Ursprung), steigen auf und schwanken im Wind */
  .kites { position: absolute; inset: 0; pointer-events: none; }
  .kite { position: absolute; width: 0; height: 0; z-index: ${BZ.drachen}; transition: opacity .6s, transform .35s ease-out, filter 2.5s; }
  /* Ruck: Die Pfote geht mit dem Pika nach hinten (.ktug), der Anfang der Schnur im selben Takt mit (--ktx, --kty) */
  .kite.kpull { transform: translate(var(--ktx, 0px), var(--kty, 0px)); transition: opacity .6s, transform .18s ease-out, filter 2.5s; }
  .kite.gone { opacity: 0; }
  .kite svg { position: absolute; left: 0; top: 0; overflow: visible; }
  .kite .kl { transform-box: view-box; transform-origin: 0 0; transform: rotate(var(--k0, 0deg)) scale(.25); transition: transform 3s ease-out; }
  .kite.up .kl { transform: none; }
  .kite .kr { transform-box: view-box; transform-origin: 0 0; animation: ksway var(--kd, 3s) ease-in-out infinite alternate; }
  .kite.tug .kr { animation: ktug .6s ease-out; }
  @keyframes ksway { from { transform: rotate(-3deg); } to { transform: rotate(4deg); } }
  @keyframes ktug { 40% { transform: rotate(6deg) scale(1.03); } }
  .kite .kb { transform-box: fill-box; transform-origin: 50% 30%; animation: kbob 1.2s ease-in-out infinite alternate; }
  @keyframes kbob { from { transform: rotate(-9deg); } to { transform: rotate(9deg); } }
  .kite .kt { transform-box: fill-box; transform-origin: 50% 0; animation: ktail .5s ease-in-out infinite alternate; }
  @keyframes ktail { from { transform: skewX(-14deg); } to { transform: skewX(14deg); } }
  .pane { fill: #cfe6f2; }
  /* Schornsteinrauch bei Kälte und abends, zieht mit dem Wind */
  .smoke circle { fill: #eef1f4; opacity: 0; transform-box: fill-box; transform-origin: center; }
  .chilly .smoke circle, .dusk .smoke circle, .night .smoke circle { animation: smoke 6s linear infinite; }
  .smoke circle:nth-child(2) { animation-delay: -2s; }
  .smoke circle:nth-child(3) { animation-delay: -4s; }
  .night .smoke circle { fill: #8f99ad; }
  @keyframes smoke {
    0% { transform: translate(0, 0) scale(.6); opacity: 0; }
    15% { opacity: .75; }
    100% { transform: translate(var(--smx, -6px), -16px) scale(2.3); opacity: 0; }
  }
  .mtns .mtn { display: none; }
  .areal-alpin .mtns .mtn { display: inline; }
  .m1 { fill: var(--m1, #8b9bb1); transition: fill 2.5s; }
  .mcap { fill: var(--mcap, #f4f7fa); transition: fill 2.5s; }
  .hay svg, .flower svg, .food svg { display: block; width: 100%; height: auto; overflow: visible; }
  /* Durchgehender Grasstreifen ganz vorn: Boden in Wiesenfarbe, davor Halme. Alles, was auf dem Boden
     steht, sinkt ein paar Pixel ein und verschwindet unten im Gras. */
  .grass {
    position: absolute; left: 0; right: 0; top: calc(var(--gy) - var(--H) * .045); bottom: 0;
    pointer-events: none; z-index: ${BZ.gras};
  }
  .grass svg { display: block; width: 100%; height: calc(var(--H) * .06); }
  .grass::after {
    content: ''; position: absolute; left: 0; right: 0; top: calc(var(--H) * .06 - 1px); bottom: 0;
    background: var(--h2); transition: background 2.5s;
  }
  .grass .blades { fill: var(--h3); transition: fill 2.5s; }
  .grass .soil { fill: var(--h2); transition: fill 2.5s; }
  /* Heuhaufen vor dem Pika, damit man sieht, wie er Blüten hineinlegt */
  .fore { position: absolute; inset: 0; pointer-events: none; }
  .hay {
    position: absolute; left: var(--hl); width: var(--hw); bottom: calc(var(--gb) - 4px); z-index: ${BZ.heu};
    transform-origin: 50% 100%; transform: scale(var(--hs, .6)); transition: transform .5s cubic-bezier(.3, 1.6, .5, 1), filter 2.5s;
  }
  .hay.boing { animation: boing .5s ease-out; }
  /* Areal mit Vorratsnische: kein Heuhaufen, die zuletzt abgelegte Blüte ploppt in der Nische auf */
  .stash .hay { display: none; }
  .stashb .new { transform-box: fill-box; transform-origin: 50% 50%; animation: stash-in .45s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes stash-in { from { transform: scale(0); } }
  @keyframes boing {
    35% { transform: scale(calc(var(--hs) * 1.1), calc(var(--hs) * .86)); }
    70% { transform: scale(calc(var(--hs) * .96), calc(var(--hs) * 1.06)); }
  }
  .toss { position: absolute; width: calc(var(--H) * .04); height: calc(var(--H) * .04); margin: calc(var(--H) * -.02); z-index: 1; /* innerhalb von .fx */ }
  .toss svg { display: block; width: 100%; height: 100%; }
  .puff {
    position: absolute; width: calc(var(--H) * .05); height: calc(var(--H) * .035); margin-left: calc(var(--H) * -.025);
    border-radius: 50%; background: rgba(240, 232, 215, .85); pointer-events: none;
    animation: puff .6s ease-out forwards;
  }
  .night .puff { background: rgba(150, 150, 170, .5); }
  @keyframes puff {
    from { transform: translate(0, 0) scale(.4); opacity: .9; }
    to { transform: translate(var(--px), calc(var(--H) * -.03)) scale(1.3); opacity: 0; }
  }
  .flower {
    position: absolute; left: calc(var(--xf) * var(--W) - var(--fw) / 2); bottom: calc(var(--gb) - 5px);
    width: var(--fw); transform-origin: 50% 100%; animation: sway 3.6s ease-in-out infinite alternate;
    z-index: ${BZ.blume}; transition: opacity 2s;
  }
  .flower svg * { transition: fill 2.5s, stroke 2.5s; }
  .flower.grow { animation: grow 1.4s ease-out, sway 3.6s 1.4s ease-in-out infinite alternate; }
  @keyframes sway { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
  .windy .flower { animation: sway-wind 1.1s ease-in-out infinite alternate; }
  /* Nach der Wind-Regel (gleiche Spezifität, die spätere gewinnt): Auch bei Wind wächst eine Blume und wird gepflückt */
  .windy .flower.grow { animation: grow 1.4s ease-out, sway-wind 1.1s 1.4s ease-in-out infinite alternate; }
  .flower.picked, .windy .flower.picked { animation: picked .35s forwards; }
  @keyframes sway-wind { from { transform: rotate(var(--sw1, -2deg)); } to { transform: rotate(var(--sw2, 14deg)); } }

  /* Regen, Schnee, Nebel, Blitz */
  .precip { position: absolute; inset: -10% -25%; pointer-events: none; z-index: var(--z-wx); transform: skewX(var(--slant, 0deg)); }
  /* Tropfen und Flocken fallen nicht einzeln, sondern in drei Ebenen (fern, mitte, nah) mit eigenem Tempo.
     Jede Ebene ist doppelt so hoch wie der Niederschlagsbereich und enthält ihr Muster zweimal übereinander.
     Sie rutscht genau eine Höhe nach unten und beginnt von vorn: nahtlos, ohne Wiederholung im Bild, und statt
     bis zu 55 Animationen laufen nur drei (Schnee: sechs, das Schaukeln liegt auf einer eigenen Hülle). */
  /* Regen und Schnee je in einem eigenen Satz: Ändert sich die Stärke, blendet der neue ein und der alte aus */
  .precip .pset { position: absolute; inset: 0; opacity: 0; transition: opacity 2.5s; }
  .precip .pset.on { opacity: 1; }
  .precip .pl { position: absolute; left: 0; right: 0; top: -100%; height: 200%; animation: pfall var(--pd) linear infinite; }
  @keyframes pfall { to { transform: translateY(50%); } }
  .precip .pw { position: absolute; inset: 0; animation: psway var(--pw) ease-in-out infinite; }
  @keyframes psway { 25% { transform: translateX(8px); } 50% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
  .precip i { position: absolute; }
  .precip .r {
    width: 1.5px; height: calc(var(--H) * .08); border-radius: 1px;
    background: linear-gradient(rgba(255, 255, 255, 0), rgba(215, 232, 255, .85));
  }
  .precip .s { border-radius: 50%; background: #fff; }
  /* Regenbogen nach dem Schauer: ein Ring um den Gegenpunkt der Sonne, hinter den Hügeln (die untere Hälfte liegt
     unter dem Horizont). Ort, Größe und Deckkraft setzt _bowSync alle 20 s, die Deckkraft gleitet dazwischen. */
  .rbow {
    position: absolute; border-radius: 50%; pointer-events: none; opacity: 0; transition: opacity 20s linear;
    background: radial-gradient(closest-side, transparent 80%, rgba(150, 110, 225, .8) 82.5%, rgba(80, 150, 240, .8) 85.5%,
      rgba(90, 205, 130, .8) 88.5%, rgba(248, 228, 95, .85) 91.5%, rgba(250, 165, 70, .85) 94.5%, rgba(238, 95, 85, .85) 97%, transparent 99.5%);
  }
  .fog { position: absolute; inset: 0; pointer-events: none; z-index: var(--z-wx); opacity: 0; transition: opacity 3s; }
  .foggy .fog { opacity: 1; }
  .fog i {
    position: absolute; left: -50%; width: 200%; height: 50%;
    background: radial-gradient(closest-side, rgba(236, 240, 244, .8), rgba(236, 240, 244, 0));
    animation: fogdrift 40s ease-in-out infinite alternate;
  }
  .fog i:nth-child(1) { top: 28%; }
  .fog i:nth-child(2) { top: 55%; animation-duration: 55s; animation-delay: -20s; }
  .night .fog i { background: radial-gradient(closest-side, rgba(120, 132, 155, .55), rgba(120, 132, 155, 0)); }
  @keyframes fogdrift { to { transform: translateX(22%); } }
  .flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: var(--z-wx); }
  .flash.go { animation: flash .7s; }
  @keyframes flash { 8% { opacity: .75; } 16% { opacity: .1; } 26% { opacity: .55; } }
  @keyframes grow { from { transform: scale(0); } }
  @keyframes picked { to { transform: translateY(-30%) scale(.2); opacity: 0; } }
  .food {
    position: absolute; left: calc(var(--xf) * var(--W) - var(--dw) / 2); bottom: calc(var(--gb) - 6px);
    width: var(--dw); transform-origin: 50% 100%; z-index: ${BZ.futter};
  }
  .food.drop { animation: drop .8s cubic-bezier(.45, 0, .7, 1) both; }
  .food.gone { animation: picked .3s forwards; }
  @keyframes drop {
    0% { transform: translateY(calc(var(--gy) * -1)) rotate(-40deg); }
    70% { transform: translateY(0) rotate(8deg) scale(1.05, .9); }
    85% { transform: translateY(-10%) rotate(-3deg); }
    100% { transform: none; }
  }

  .ff i {
    position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #fffbb0;
    box-shadow: 0 0 6px 2px rgba(247, 240, 138, .8); opacity: 0; transition: opacity 3s;
    animation: fly 9s ease-in-out infinite alternate, glow 1.8s ease-in-out infinite alternate;
  }
  .night.summer .ff i { opacity: 1; }
  @keyframes fly {
    33% { transform: translate(calc(var(--H) * .25), calc(var(--H) * -.12)); }
    66% { transform: translate(calc(var(--H) * -.1), calc(var(--H) * -.22)); }
    100% { transform: translate(calc(var(--H) * .15), calc(var(--H) * .05)); }
  }
  @keyframes glow { from { filter: brightness(.4); } }

  /* ---- Pika ---- */
  .pika {
    position: absolute; left: 0; top: calc(var(--gy) - var(--ph) * .945); width: var(--pw); height: var(--ph);
    z-index: ${BZ.pika}; cursor: pointer; will-change: transform; touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
    transform-origin: 50% 94.5%; /* Füße: auf dem Stein ist er etwas kleiner (weiter hinten) */
  }
  /* Unter den Füßen (y 90,5 von 100), 5 % über der Unterkante: Tiefer läge er zur Hälfte unter dem Boden des
     Grasstreifens, und man sähe kaum, wie er bei jedem Hopser schrumpft. */
  .shadow {
    position: absolute; left: 12%; right: 12%; bottom: 5%; height: 10%; border-radius: 50%;
    background: radial-gradient(closest-side, rgba(0, 0, 0, .22), transparent);
  }
  .flip, .jump, .hop, .clipw, .depth { position: absolute; inset: 0; transform-origin: 50% 100%; }
  /* Im Bau: Ausschnitt auf den Eingang (clip-path setzt das Skript), kleiner und dunkler (weiter hinten),
     --dy schiebt ihn hinter die Vorderkante. Der Kopf steht mittig im Eingang (--hc, --hh je Blickrichtung).
     Abgedunkelt wird über feste Fellfarben (PK_DIM), nicht per Filter. */
  .depth { --hd: 1; }
  .left .depth { --hd: -1; }
  .inside .depth {
    transform: translate(calc(var(--hc) - var(--hh) * var(--hd)), var(--dy)) scale(var(--ds));
  }
  .inside .shadow { opacity: 0; }
  /* Im Bau liegt er hinter Pino, der draußen vor dem Eingang vorbeihoppelt, und vor den Vögeln. Die Ebene setzt
     _pikaZ am Element (Rang pikaBau statt pika); diese Regel gilt nur, bis das Skript sie gesetzt hat. */
  .pika.inside { z-index: ${BZ.pikaBau}; }
  /* In der Luft schrumpft und verblasst der Schatten, im Takt von hop, hops, hopb, jump und binky (--shs, --sho = am Scheitel) */
  .walking .shadow { --shs: .86; --sho: .66; animation: sh-hop .36s linear infinite; }
  .walking.trip .shadow { --shs: .93; --sho: .84; animation: sh-trip .24s linear infinite; }
  .walking.bighop .shadow { --shs: .78; --sho: .52; animation-duration: .42s; }
  @keyframes sh-hop {
    0%, 100% { transform: scale(1.04); opacity: 1; animation-timing-function: ease-out; }
    11% { transform: none; opacity: 1; animation-timing-function: cubic-bezier(.3, .6, .5, 1); }
    50% { transform: scale(var(--shs)); opacity: var(--sho); animation-timing-function: cubic-bezier(.5, 0, .7, .4); }
    88% { transform: none; opacity: 1; animation-timing-function: ease-out; }
  }
  @keyframes sh-trip {
    0%, 100% { transform: none; opacity: 1; animation-timing-function: ease-out; }
    50% { transform: scale(var(--shs)); opacity: var(--sho); animation-timing-function: ease-in; }
  }
  .shadow.hop1 { animation: sh-jump .6s cubic-bezier(.3, .7, .4, 1); }
  @keyframes sh-jump {
    15% { transform: scale(1.05); opacity: 1; animation-timing-function: cubic-bezier(.25, .6, .45, 1); }
    45% { transform: scale(.7); opacity: .45; animation-timing-function: cubic-bezier(.5, 0, .75, .5); }
    75% { transform: scale(1.05); opacity: 1; animation-timing-function: ease-out; }
  }
  .shadow.binky { animation: sh-binky .9s ease-in-out; }
  @keyframes sh-binky {
    12% { transform: scale(1.06); opacity: 1; animation-timing-function: cubic-bezier(.25, .6, .45, 1); }
    40% { transform: scale(.62); opacity: .38; }
    60% { transform: scale(.72); opacity: .48; animation-timing-function: cubic-bezier(.5, 0, .75, .5); }
    82% { transform: scale(1.05); opacity: 1; animation-timing-function: ease-out; }
  }
  .pika.inside .brolly { display: none; }
  .flip { transition: transform .25s; }
  .left .flip { transform: scaleX(-1); }
  .pk { display: block; width: 100%; height: 100%; overflow: visible; }
  /* Nachts und im Bau dunklere Fellfarben statt filter (der atmende Pika müsste sonst jedes Bild neu gefiltert werden).
     Pino (aus PIKA_SVG, eigene Fellfarben als Rückfallwerte) behält vorerst den Nachtfilter. */
  .night .pika .pk { ${PK_DIM(0.8, 0.85)} }
  .pika.inside .pk { ${PK_DIM(0.85, 1)} }
  .night .pika.inside .pk { ${PK_DIM(0.68, 0.85)} }
  .pk stop, .pk [fill^="var(--pk-"], .pk [stroke^="var(--pk-"] { transition: fill 1s, stop-color 1s, stroke 1s; }
  /* Schal, Hüte und Tasse haben feste Farben: nachts und im Bau per Filter so gedimmt wie das Fell. Die Gruppen sind
     klein und stehen still; die Pfoten an der Tasse (.cps) und die Zipfelmütze laufen schon über die Fellfarben. */
  ${PK_ACC('.pika')} { transition: filter 1s; }
  ${PK_ACC('.night .pika')} { filter: brightness(.8) saturate(.85); }
  ${PK_ACC('.pika.inside')} { filter: brightness(.85); }
  ${PK_ACC('.night .pika.inside')} { filter: brightness(.68) saturate(.85); }
  .friend .pk { transition: filter 2.5s; }
  .night .friend .pk { filter: brightness(.8) saturate(.85); }

  /* Hoppeln: kurz am Boden (gestaucht), aufwärts abbremsen, abwärts beschleunigen */
  .walking .hop { animation: hop .36s linear infinite; }
  @keyframes hop {
    0%, 100% { transform: translateY(0) scale(1.05, .95); animation-timing-function: ease-out; }
    10% { transform: translateY(-1.5%) scale(.98, 1.03); animation-timing-function: cubic-bezier(.3, .6, .5, 1); }
    50% { transform: translateY(-10%) scale(.98, 1.02); animation-timing-function: cubic-bezier(.5, 0, .7, .4); }
    88% { transform: translateY(0) scale(1, 1); animation-timing-function: ease-out; }
  }
  .jump.hop1 { animation: jump .6s cubic-bezier(.3, .7, .4, 1); }
  @keyframes jump {
    15% { transform: scale(1.08, .9); animation-timing-function: cubic-bezier(.25, .6, .45, 1); }
    45% { transform: translateY(-30%) scale(.95, 1.06); animation-timing-function: cubic-bezier(.5, 0, .75, .5); }
    75% { transform: translateY(0) scale(1.07, .93); animation-timing-function: ease-out; }
  }
  .jump.binky { animation: binky .9s ease-in-out; }
  @keyframes binky {
    12% { transform: scale(1.1, .88); animation-timing-function: cubic-bezier(.25, .6, .45, 1); }
    40% { transform: translateY(-40%) rotate(-14deg); }
    60% { transform: translateY(-26%) rotate(10deg); animation-timing-function: cubic-bezier(.5, 0, .75, .5); }
    82% { transform: translateY(0) scale(1.07, .93); animation-timing-function: ease-out; }
  }
  .stretch .hop { animation: stretch 1.2s ease-in-out; }
  @keyframes stretch {
    30% { transform: scale(1.14, .84); }
    60% { transform: scale(.94, 1.08); }
  }

  /* Atmen auf der HTML-Hülle statt auf <g class="all">: so rechnet es die Grafikkarte, nicht jedes Bild der
     Hauptthread. Drehpunkt = Mitte unten der Pika-Figur (viewBox 120 × 100: x 64,7, Füße bei y 95). */
  .br { position: absolute; inset: 0; transform-origin: 54% 95%; animation: breathe 3.4s ease-in-out infinite; }
  @keyframes breathe { 50% { transform: scale(1.012, 1.025); } }
  .sleeping .br { animation: breathe-deep 4.6s ease-in-out infinite; }
  @keyframes breathe-deep { 0%, 100% { transform: scale(1.03, .94); } 50% { transform: scale(1.06, .97); } }

  .ear { transform-box: fill-box; transform-origin: 50% 95%; transition: transform .45s; }
  .look-up .ear { transform: translateY(-1.5px); }
  .sad .ear-l { transform: rotate(-14deg); }
  .sad .ear-r { transform: rotate(14deg); }
  .sleeping .ear-l { transform: rotate(-30deg); }
  .sleeping .ear-r { transform: rotate(28deg); }
  .twitch-l .ear-l { animation: twitch .5s; }
  .twitch-r .ear-r { animation: twitch .5s reverse; }
  @keyframes twitch { 30% { transform: rotate(-12deg); } 65% { transform: rotate(7deg); } }

  .face { transition: transform .35s ease; }
  .look-f .face { transform: translateX(3px); }
  .look-b .face { transform: translateX(-4px); }
  .look-up .face { transform: translate(1px, -2.5px); }

  .eye { transform-box: fill-box; transform-origin: 50% 50%; transition: transform .07s; }
  .blink .eye { transform: scaleY(.12); }
  .seye, .heye { display: none; fill: none; stroke: #2a1a12; stroke-width: 1.8; stroke-linecap: round; }
  .sleeping .eye, .groom .eye, .happy .eye { display: none; }
  .sleeping .seye, .groom .seye { display: inline; }
  /* .happy doppelt: schlägt die späteren Regeln, die .seye einblenden (.squat, .doze, .sip, .strain, .yawning …).
     Sonst lägen beim Streicheln in der Hocke, beim Kaffee oder Gewichtheben beide Augenpaare übereinander. */
  .happy.happy .seye { display: none; }
  .happy .heye { display: inline; }
  .sleeping.peek .eye-r { display: inline; }
  .sleeping.peek .seye-r { display: none; }

  .mfood, .paws, .cap, .scarf, .brolly, .omouth { display: none; }
  /* Pfiff vom Stein: aufrichten, Kopf hoch, Maul auf */
  .calling .omouth { display: inline; }
  .callfx { display: none; filter: drop-shadow(0 0 1px rgba(60, 40, 30, .55)); }
  .calling .callfx { display: inline; }
  .callfx path { opacity: 0; transform-box: fill-box; animation: wave .6s ease-out forwards; }
  .callfx path:nth-child(2) { animation-delay: .08s; }
  .callfx path:nth-child(3) { animation-delay: .16s; }
  @keyframes wave {
    from { opacity: 0; transform: translateX(-2px) scale(.8); }
    35% { opacity: 1; }
    to { opacity: 0; transform: translateX(3px) scale(1.1); }
  }
  /* Anlauf vor dem Sprung */
  .crouch .hop { transform: scale(1.1, .84); transition: transform .16s ease-out; }
  /* Geschäft: in die Hocke, Augen zu, Po wackelt */
  .squat .hop { animation: squat 1.3s ease-in-out; }
  @keyframes squat {
    15%, 85% { transform: scale(1.08, .88); }
    35% { transform: translateX(-2%) scale(1.08, .88); }
    50% { transform: translateX(2%) scale(1.08, .88); }
    65% { transform: translateX(-2%) scale(1.08, .88); }
  }
  .squat .eye { display: none; }
  .squat .seye { display: inline; }
  .squat .ear { transform: translateY(1.5px); }
  /* Schnuppern am Häufchen */
  .sniff .hop { transform: scale(1.06, .9); transition: transform .25s; }
  .sniff .face { transform: translate(3px, 2px); }
  /* Ohren wippen beim Hoppeln */
  .walking .ear-l { animation: earbob .36s ease-in-out infinite alternate; }
  .walking .ear-r { animation: earbob .36s .1s ease-in-out infinite alternate; }
  @keyframes earbob { from { transform: rotate(-7deg); } to { transform: rotate(5deg); } }
  .calling .hop { animation: call .6s ease-out; }
  .calling .face { transform: translate(1.5px, -3px); }
  .calling .ear { transform: translateY(-2px); }
  @keyframes call {
    30% { transform: scale(.94, 1.1); }
    70% { transform: scale(.97, 1.05); }
  }
  .cold .scarf, .wet .brolly { display: inline; }
  .sleeping .brolly { display: none; }
  .brolly { transform-box: fill-box; transform-origin: 70% 100%; }
  /* In Stufen: das Blatt dreht nur ±3°, stufenweise sieht man keinen Unterschied, das Pika-SVG wird aber nur
     etwa viermal pro Sekunde neu gemalt statt in jedem Bild (Regen dauert oft Stunden). Im Bau und im Schlaf ruht es. */
  .wet:not(.inside):not(.sleeping) .brolly { animation: brolly 2.6s steps(10) infinite alternate; }
  @keyframes brolly { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
  .carry .mfood, .eating .mfood { display: inline; }
  /* Anderes Futter als eine Blüte (Leckerli aus dem Päckchen, Heu): dessen Grafik statt der Blüte */
  .mf-item, .mfood.item .mf-bloom { display: none; }
  .mfood.item .mf-item { display: inline; }
  .mbloom { fill: var(--mf, #f6c945); stroke: rgba(0, 0, 0, .15); stroke-width: .5; }
  .mfood.shrink { transform-box: fill-box; transform-origin: 0% 30%; animation: shrink var(--eat, 3s) linear forwards; }
  @keyframes shrink { to { transform: scale(.1); opacity: .2; } }
  .mouth-g { transform-box: fill-box; transform-origin: 50% 0%; }
  .eating .mouth-g { animation: chew .26s ease-in-out infinite; }
  @keyframes chew { 50% { transform: translateY(.9px) scale(1.05, .88); } }
  .groom .paws { display: inline; transform-box: fill-box; animation: rub .3s ease-in-out infinite alternate; }
  @keyframes rub { from { transform: translateY(1px); } to { transform: translateY(-6px); } }
  .sleeping .cap { display: inline; }

  /* ---- Mimik, Streicheln, kleine Momente ----
     Fast alles läuft einmal über eine Zustandsklasse ab (keine Dauerschleifen), so bleibt es auf schwachen Tablets leicht.
     Kopf (Ohren, Gesicht, Mützen) dreht um die Kopfmitte, der Körperumriss bleibt: das reicht zum Schiefhalten. */
  .hd { transform-box: view-box; transform-origin: 90px 50px; transition: transform .4s cubic-bezier(.3, 1.5, .5, 1); }
  .tilt .hd { transform: rotate(11deg); }
  .tilt-b .hd { transform: rotate(-9deg); }
  /* Bäckchen werden rot, bei viel Streicheln mit Strichelchen */
  .chk { transform-box: fill-box; transform-origin: 50% 50%; transition: opacity .5s, transform .5s; }
  .blush .chk { opacity: .95; transform: scale(1.35, 1.3); }
  .blines { display: none; }
  .blush .blines { display: inline; }
  /* Nase wackelt, Schnurrhaare zittern mit */
  .nose { transform-box: fill-box; transform-origin: 50% 80%; }
  .wsk { transform-box: fill-box; transform-origin: 50% 50%; }
  .nosey .nose { animation: nwig .13s ease-in-out 6 alternate; }
  .nosey .wsk { animation: wskj .13s ease-in-out 6 alternate; }
  .sniff .nose, .presneeze .nose { animation: nwig .11s ease-in-out infinite alternate; }
  @keyframes nwig { to { transform: translateY(-.6px) scale(1.14, .84); } }
  @keyframes wskj { to { transform: translateY(-.6px); } }
  /* Münder: zufrieden (ω), Zungenspitze (mlem), Hecheln, Gähnen */
  .wmouth, .tongue, .yawnm, .estar, .sleg, .epaws { display: none; }
  .content .mth { display: none; }
  .content .wmouth { display: inline; }
  .tongue { transform-box: fill-box; transform-origin: 50% 0%; }
  .mlem .tongue { display: inline; animation: mlem .9s ease-in-out forwards; }
  @keyframes mlem { 0% { transform: scaleY(0); } 25%, 65% { transform: scaleY(1); } 45% { transform: translateX(.7px) scaleY(.75); } 100% { transform: scaleY(0); } }
  .pant .tongue { display: inline; animation: pant .28s ease-in-out infinite alternate; }
  @keyframes pant { from { transform: scaleY(.65); } }
  .yawnm { transform-box: fill-box; transform-origin: 50% 8%; }
  .yawning .yawnm { display: inline; animation: yawnm 2.2s ease-in-out forwards; }
  .yawning .mth, .yawning .wmouth { display: none; }
  @keyframes yawnm { 0% { transform: scale(.3, .1); } 30%, 72% { transform: scale(1); } 100% { transform: scale(.3, .05); } }
  .yawning .face { transform: translate(1px, -2.5px); }
  .yawning .ear-l { transform: rotate(-12deg); }
  .yawning .ear-r { transform: rotate(12deg); }
  .yawning .hop { animation: yawnb 2.2s ease-in-out; }
  @keyframes yawnb { 30%, 72% { transform: scale(.95, 1.07); } }
  /* Augen: zu und genießen, Glanzsterne, schielen */
  .bowing .eye, .squint .eye, .yawning .eye, .earwash .eye, .nodding .eye, .sneezing .eye { display: none; }
  .bowing .seye, .squint .seye, .yawning .seye, .earwash .seye, .nodding .seye, .sneezing .seye { display: inline; }
  .happy.squint .seye { display: none; }
  .estar { transform-box: fill-box; transform-origin: 50% 50%; }
  .sparkle .estar { display: inline; animation: estar .7s ease-in-out infinite alternate; }
  .sparkle .hl1 { display: none; }
  .sparkle:not(.blink) .eye { transform: scale(1.14); }
  @keyframes estar { from { transform: scale(.7) rotate(-12deg); } to { transform: scale(1.15) rotate(12deg); } }
  .crosseye .eye-l { transform: translate(2.2px, 1px) scale(.82); }
  .crosseye .eye-r { transform: translate(-2.4px, 1px) scale(.82); }
  .presneeze .eye { transform: scaleY(.4); }
  /* Sofort beim Aufsetzen des Fingers (.pressed, _pressFx): leicht gestaucht, die Augen wandern zum Finger (--ex, --ey),
     die Bäckchen kommen über .blush. Die Stauchung liegt auf .jump, wo sonst nur die Sprünge laufen (als Animation,
     die gewinnt): Haltung und Bewegung der laufenden Aktion (.hop, .face, .hd) bleiben unberührt. */
  .jump { transition: transform .24s cubic-bezier(.3, 1.7, .5, 1); }
  .pressed .jump { transform: scale(1.045, .94); transition: transform .07s ease-out; }
  .pressed:not(.blink):not(.crosseye):not(.presneeze):not(.sparkle) .eye { transform: translate(var(--ex, 0px), var(--ey, 0px)); }
  /* Mimik (_mimik): zwei Brauenstriche und ein Mundpfad für Trauer, Trotz, Stolz und Staunen. Sie liegen in .face,
     wandern also mit Blick, Kopfneigung und Spiegelung mit und fehlen in der Rückansicht (.tv blendet .all aus). Wo
     das Gesicht schon belegt ist (Schlaf, Fressen, Gähnen, Pfiff, Schluck, Niesen), bleiben sie weg. */
  .brow, .mim { display: none; }
  .brow { transform-box: fill-box; transform-origin: 50% 50%; }
  ${MIMIK_ON} .brow, ${MIMIK_ON} .mim { display: inline; }
  ${MIMIK_ON} .mth, ${MIMIK_ON} .wmouth { display: none; }
  .mi-sad .brow-l { transform: translateY(-.3px) rotate(-21deg); }
  .mi-sad .brow-r { transform: translateY(-.3px) rotate(21deg); }
  .mi-defy .brow-l { transform: translateY(1.5px) rotate(24deg); }
  .mi-defy .brow-r { transform: translateY(1.5px) rotate(-24deg); }
  .mi-defy .chk { transform: scale(1.25, 1.2); }
  .mi-proud .brow-l { transform: translateY(-1.6px) rotate(4deg); }
  .mi-proud .brow-r { transform: translateY(-1.6px) rotate(-4deg); }
  .mi-awe .brow { transform: translateY(-2.6px); }
  .mi-awe .mim { fill: #7a3a30; }
  ${MIMIK_ON}.mi-awe:not(.blink):not(.pressed) .eye { transform: scale(1.1); }
  /* Ohren: flach angelegt, Nachschwingen, angetippt flappen */
  .flat .ear-l { transform: rotate(-36deg); }
  .flat .ear-r { transform: rotate(32deg); }
  .eflap-l .ear-l, .eflap-r .ear-r { animation: eflap .9s ease-out; }
  @keyframes eflap { 12% { transform: rotate(-28deg); } 30% { transform: rotate(20deg); } 48% { transform: rotate(-12deg); } 66% { transform: rotate(7deg); } 84% { transform: rotate(-3deg); } }
  .lnd:not(.walking) .ear-l { animation: eswing .55s ease-out; }
  .lnd:not(.walking) .ear-r { animation: eswing .55s .06s ease-out; }
  @keyframes eswing { 25% { transform: rotate(10deg); } 55% { transform: rotate(-5deg); } 80% { transform: rotate(2deg); } }
  /* Das Nachschwingen bei einem Sprung auf der Stelle steht nicht hier: Es läuft als eigene Animation von rotate
     (EAR_SWING, _earSwing) und kommt so zu Haltung und Bewegung der Ohren dazu, statt deren Regeln zu verdrängen. */
  /* Im Schlaf zucken (Ohren bleiben dabei angelegt) */
  .sleeping.stw .hop { animation: stw .45s ease-out; }
  @keyframes stw { 30% { transform: scale(1.03, .96) translateY(1%); } }
  .sleeping.stw .ear-l { animation: stwear .5s ease-out; }
  @keyframes stwear { 0%, 100% { transform: rotate(-30deg); } 35% { transform: rotate(-40deg); } 70% { transform: rotate(-25deg); } }
  /* Bewegung: Landen mit Nachwippen, Trippeln, große Hopser, Stolpern */
  .lnd:not(.walking) .hop { animation: lnd .36s ease-out; }
  @keyframes lnd { 25% { transform: scale(1.07, .93); } 60% { transform: scale(.98, 1.02); } }
  .walking.trip .hop { animation: hops .24s linear infinite; }
  @keyframes hops {
    0%, 100% { transform: translateY(0) scale(1.03, .97); animation-timing-function: ease-out; }
    50% { transform: translateY(-4.5%) scale(.99, 1.01); animation-timing-function: ease-in; }
  }
  .walking.bighop .hop { animation: hopb .42s linear infinite; }
  @keyframes hopb {
    0%, 100% { transform: translateY(0) scale(1.08, .92); animation-timing-function: ease-out; }
    12% { transform: translateY(-2%) scale(.96, 1.05); animation-timing-function: cubic-bezier(.3, .6, .5, 1); }
    50% { transform: translateY(-17%) scale(.97, 1.03); animation-timing-function: cubic-bezier(.5, 0, .7, .4); }
    88% { transform: translateY(0) scale(1, 1); animation-timing-function: ease-out; }
  }
  .walking.bighop .ear-l, .walking.bighop .ear-r { animation-duration: .21s; }
  .stumble .hop { animation: stumble .75s ease-out; }
  @keyframes stumble { 18% { transform: rotate(17deg) translateY(2%) scale(1.06, .9); } 45% { transform: rotate(-6deg); } 70% { transform: rotate(3deg); } }
  /* Streicheln: reinlehnen, kichern, auf den Rücken kippen, dahinschmelzen, Fell plustern, Klopfbein */
  .hop { transition: transform .35s ease-out; }
  .lean .hop { transform: rotate(4deg) scale(1.02, .98); }
  .tickle .hop { animation: tickle .15s ease-in-out 6 alternate; }
  @keyframes tickle { from { transform: rotate(-3.5deg); } to { transform: rotate(3.5deg) scale(1.02, .98); } }
  .roll .hop { transform: rotate(-26deg) translateY(-3%); }
  .melt .hop { transform: scale(1.16, .8); transition: transform .7s ease-out; }
  .body { transform-box: fill-box; transform-origin: 50% 100%; }
  .fluffy .body { animation: fluffy .8s ease-out; }
  @keyframes fluffy { 30% { transform: scale(1.07, 1.06); } 55% { transform: scale(1.04, 1.03) skewX(-2deg); } }
  .bfoot { transform-box: fill-box; transform-origin: 20% 50%; }
  .ffoot { transform-box: fill-box; transform-origin: 50% 50%; }
  /* Hoppeln: Der Hinterlauf stößt ab und streckt sich nach hinten, die Vorderpfoten greifen nach vorn und setzen zuerst auf */
  .walking .bfoot { animation: fb-hop .36s linear infinite; }
  .walking .ffoot { animation: ff-hop .36s linear infinite; }
  .walking.trip .bfoot, .walking.trip .ffoot { animation-duration: .24s; }
  .walking.bighop .bfoot, .walking.bighop .ffoot { animation-duration: .42s; }
  @keyframes fb-hop {
    0%, 88%, 100% { transform: none; }
    10% { transform: rotate(12deg); }
    45% { transform: translate(-3.5px, -.5px) rotate(28deg); }
    74% { transform: translate(1px, 0) rotate(-10deg); }
  }
  @keyframes ff-hop {
    0%, 88%, 100% { transform: none; }
    10% { transform: translate(1px, -1.5px) rotate(-14deg); }
    45% { transform: translate(3px, -1px) rotate(-8deg); }
    74% { transform: translate(2.5px, .5px) rotate(8deg); }
  }
  /* Sprünge auf der Stelle: Füße in der Luft angezogen */
  .jump.hop1 .bfoot { animation: fb-air .6s ease-in-out; }
  .jump.hop1 .ffoot { animation: ff-air .6s ease-in-out; }
  .jump.binky .bfoot { animation: fb-air .9s ease-in-out; }
  .jump.binky .ffoot { animation: ff-air .9s ease-in-out; }
  @keyframes fb-air { 0%, 12%, 84%, 100% { transform: none; } 32%, 62% { transform: translate(3px, -1.5px) rotate(16deg); } }
  @keyframes ff-air { 0%, 12%, 84%, 100% { transform: none; } 32%, 62% { transform: translate(-1px, -1.5px) rotate(14deg); } }
  .thump .bfoot { animation: thump .13s ease-in-out infinite alternate; }
  @keyframes thump { to { transform: translateY(-3.5px) rotate(-14deg); } }
  /* Hinterpfote kratzt am Ohr */
  .scratching .sleg { display: inline; animation: scr .12s ease-in-out infinite alternate; }
  @keyframes scr { from { transform: translate(-1px, 2px); } to { transform: translate(1.5px, -2.5px); } }
  .scratching .hd { transform: rotate(-12deg); }
  .scratching .hop { transform: rotate(-5deg); }
  .scratching .ear-l { animation: twitch .3s infinite; }
  /* Ohr putzen: das vordere Ohr mit beiden Pfoten herunterziehen */
  .fear { display: none; }
  .earwash .fear { display: inline; }
  .earwash .ear-r { opacity: 0; }
  .earwash .ear-f { transform: rotate(68deg); }
  .earwash .epaws { display: inline; transform-box: fill-box; animation: rub .32s ease-in-out infinite alternate; }
  .earwash .hd { transform: rotate(8deg); }
  /* Schluckauf, Einnicken, Niesen */
  .hic .hop { animation: hic .34s ease-out; }
  @keyframes hic { 30% { transform: translateY(-6%) scale(.95, 1.06); } }
  .nodding .hd { transform: translateY(3px) rotate(13deg); transition: transform 1.8s ease-in; }
  .pika.nodding ~ .psay .zzz { display: block; }
  .presneeze .hd { transform: rotate(-11deg) translateY(-1px); transition: transform .5s; }
  .sneezing .hop { animation: sneeze .45s ease-out; }
  @keyframes sneeze { 20% { transform: rotate(9deg) scale(1.06, .92); } 55% { transform: rotate(-2deg); } }
  /* Atmen nach Stimmung: aufgeregt schneller, satt und zufrieden ruhiger */
  .excited .br { animation-duration: 1.5s; }
  .calm:not(.excited):not(.sleeping) .br { animation: breathe-calm 4.8s ease-in-out infinite; }
  @keyframes breathe-calm { 50% { transform: scale(1.016, 1.03); } }
  .sleeping .br { animation: breathe-deep 4.6s ease-in-out infinite; }

  /* Kleine Zeichen über dem Kopf: ?, !, Schweißtropfen, Funkeln, Grummelwolke */
  .emo {
    position: absolute; left: 0; bottom: 0; pointer-events: none; font-weight: 900; color: #fff; line-height: 1;
    font-size: calc(var(--ph) * .22); text-shadow: 0 1px 3px rgba(0, 0, 0, .5);
    animation: emo var(--emt, 1.4s) ease-out forwards;
  }
  .emo svg { display: block; width: calc(var(--ph) * .17); height: auto; overflow: visible; filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, .35)); }
  .emo-drop { left: calc(var(--ph) * -.2); bottom: calc(var(--ph) * -.1); }
  .emo-drop svg { width: calc(var(--ph) * .09); }
  .emo-grump svg { width: calc(var(--ph) * .22); }
  @keyframes emo {
    0% { transform: translate(-50%, 0) scale(.2); opacity: 0; }
    15% { transform: translate(-50%, -30%) scale(1.15); opacity: 1; }
    25% { transform: translate(-50%, -25%) scale(1); }
    80% { opacity: 1; }
    100% { transform: translate(-50%, -45%) scale(1); opacity: 0; }
  }
  .emo-drop { animation-name: emodrop; }
  @keyframes emodrop { 0% { transform: translateY(-20%) scale(.3); opacity: 0; } 20% { transform: none; opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(60%); opacity: 0; } }
  /* Traumblase: etwas bläulicher als die Denkblase */
  .think.dream, .think.dream::before, .think.dream::after { background: #e9ecff; }
  /* Nieser, Pollen */
  .snz, .pol { position: absolute; border-radius: 50%; pointer-events: none; }
  .snz { width: calc(var(--ph) * .035); height: calc(var(--ph) * .035); background: rgba(255, 255, 255, .9); animation: snz .55s ease-out forwards; }
  @keyframes snz { from { transform: scale(.4); opacity: 1; } to { transform: translate(var(--px), var(--py)) scale(1); opacity: 0; } }
  .pol { width: calc(var(--ph) * .025); height: calc(var(--ph) * .025); background: #ffe066; box-shadow: 0 0 3px #fff3a6; animation: pol 1.6s ease-in-out forwards; }
  @keyframes pol { 0% { opacity: 0; } 25%, 70% { opacity: 1; } 100% { transform: translate(var(--px), var(--py)); opacity: 0; } }
  /* Schmetterling (fliegt per Web Animations, die Flügel schlagen per CSS) */
  .bfly { position: absolute; left: 0; top: 0; width: calc(var(--ph) * .14); margin: calc(var(--ph) * -.1) 0 0 calc(var(--ph) * -.07); pointer-events: none; }
  .bfly svg { display: block; width: 100%; height: auto; overflow: visible; }
  .bfly .bwl, .bfly .bwr { transform-box: view-box; transform-origin: 10px 8px; animation: bfw .15s ease-in-out infinite alternate; }
  .bfly.rest .bwl, .bfly.rest .bwr { animation-duration: 1.3s; }
  @keyframes bfw { to { transform: scaleX(.2); } }
  /* Geschenk: eine Blüte mit großer Schleife ganz vorn im Gras, antippen nimmt sie an. Damit sie neben den Wiesenblumen
     auffällt: warmer Lichthof, der pulsiert, drei Funken und ab und zu ein Wackeln. Nachts weniger gedimmt als die Wiese. */
  .pgift {
    position: absolute; width: calc(var(--ph) * .68); margin-left: calc(var(--ph) * -.34); pointer-events: auto; cursor: pointer;
    transform-origin: 50% 100%; animation: giftin .5s ease-out; isolation: isolate;
  }
  .pgift::before {
    content: ''; position: absolute; left: -30%; right: -30%; top: -55%; bottom: -35%; z-index: -1; border-radius: 50%;
    background: radial-gradient(closest-side, #fffbe0, rgba(255, 212, 84, .85) 40%, rgba(255, 170, 60, .35) 70%, rgba(255, 170, 60, 0));
    animation: pglow 2.2s ease-in-out infinite;
  }
  .pgift svg {
    display: block; width: 100%; height: auto; overflow: visible; transform-origin: 50% 90%;
    filter: drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff) drop-shadow(0 1px 2px rgba(0, 0, 0, .35));
    animation: pwig 4.5s ease-in-out 1s infinite;
  }
  .pspk {
    position: absolute; width: 22%; aspect-ratio: 1; pointer-events: none; background: #ffd23a;
    clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
    animation: pspk 1.8s ease-in-out infinite;
  }
  .pspk:nth-of-type(1) { left: -6%; top: -45%; }
  .pspk:nth-of-type(2) { left: 70%; top: -70%; width: 16%; animation-delay: .6s; }
  .pspk:nth-of-type(3) { left: 92%; top: 10%; width: 13%; animation-delay: 1.2s; }
  .pgift.take { animation: gifttake .9s ease-in forwards; pointer-events: none; }
  .pgift.take::before, .pgift.take .pspk, .pgift.wilt::before, .pgift.wilt .pspk { display: none; }
  .pgift.wilt { transition: opacity 4s; opacity: 0; pointer-events: none; }
  .night .pgift svg { filter: brightness(.8) saturate(.8) drop-shadow(0 0 1.5px rgba(255, 246, 196, .8)); }
  .night .pgift::before { opacity: .6; }
  @keyframes giftin { from { transform: translateY(-50%) rotate(-25deg); opacity: 0; } }
  @keyframes gifttake { 30% { transform: translateY(-20%) scale(1.15); } to { transform: translateY(-160%) scale(1.3) rotate(12deg); opacity: 0; } }
  @keyframes pglow { 50% { transform: scale(1.12); opacity: .7; } }
  @keyframes pwig { 0%, 76%, 100% { transform: none; } 80% { transform: rotate(-7deg) scale(1.06); } 85% { transform: rotate(6deg) scale(1.06); } 90% { transform: rotate(-3deg); } }
  @keyframes pspk { 0%, 100% { transform: scale(.2) rotate(0); opacity: 0; } 50% { transform: scale(1) rotate(45deg); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .pgift::before, .pgift svg { animation: none; }
    .pspk { animation: none; transform: scale(.7); }
  }

  /* Beschäftigungen: Buch, Gameboy, Tablet (auf dem Bauch), Drachenschnur, Fernsehen (Rückansicht im Bau) */
  .book, .gb, .tab, .kpaw, .bk { display: none; }
  .reading .book, .gaming .gb, .tablet .tab, .kiting .kpaw { display: inline; }
  .reading .face { animation: read 3.4s ease-in-out infinite; }
  @keyframes read { 0%, 100% { transform: translate(0, 2px); } 70% { transform: translate(2.6px, 2.6px); } 82% { transform: translate(-.4px, 2px); } }
  .book .bflip { opacity: 0; transform-box: view-box; transform-origin: 91px 61px; }
  .book .bflip.go { animation: flip .65s ease-in-out; }
  @keyframes flip { 0% { opacity: 1; transform: scaleX(1); } 100% { opacity: 1; transform: scaleX(-1); } }
  .doze .face { animation: none; transform: translate(1px, 4px); }
  .doze .eye { display: none; }
  .doze .seye { display: inline; }
  .pika.doze ~ .psay .zzz { display: block; }
  .doze .book { transform-box: fill-box; transform-origin: 50% 100%; transform: translateY(3px) rotate(5deg); transition: transform 1.5s; }
  .gaming .face { transform: translate(1.5px, 2.2px); }
  .gaming .th1 { animation: tap .22s ease-in-out infinite alternate; }
  .gaming .th2 { animation: tap .3s .1s ease-in-out infinite alternate; }
  @keyframes tap { to { transform: translateY(-1.3px); } }
  /* nur beim Spielen: Chrome animiert SVG-Teile in ausgeblendeten (display: none) Gruppen sonst weiter */
  .gaming .gbs rect:first-child { animation: gbj .9s steps(1) infinite; }
  .gaming .gbs rect:last-child { animation: gbc 1.6s steps(1) infinite; }
  @keyframes gbj { 50% { transform: translateY(-2.6px); } }
  @keyframes gbc { 50% { opacity: 0; } }
  .meh .ear-l { transform: rotate(-26deg); }
  .meh .ear-r { transform: rotate(24deg); }
  .lying .hop { transform: scale(1.12, .8); transition: transform .4s ease-out; }
  .tablet .face { transform: translate(2px, 2.6px); }
  .tablet.look-up .face { transform: translate(1px, -2.5px); }
  .tab .tglow { opacity: .16; }
  .dusk .tab .tglow, .night .tab .tglow { opacity: .35; }
  .tab .tscr-p, .tplane .tab .tscr-f { display: none; }
  .tplane .tab .tscr-p { display: inline; }
  .tab .tpaw { transform-box: fill-box; }
  .swipe .tab .tpaw { animation: swipe .6s ease-in-out; }
  @keyframes swipe { 50% { transform: translateX(-9px); } }
  .kiting .face { transform: translate(1px, -2.5px); }
  .kiting .ear { transform: translateY(-1.5px); }
  .tv .all { display: none; }
  .tv .bk { display: inline; }
  /* Umdrehen im Bau (_tvFace): schmal werden, in der Mitte tauscht das Skript Vorder- und Rückansicht */
  .pika.tvturn .br { animation: tvturn .28s ease-in-out !important; }
  @keyframes tvturn { 0%, 100% { transform: scaleX(1); } 46%, 54% { transform: scaleX(.06); } }
  /* Drachen: Er lehnt sich leicht gegen den Zug der Schnur, bei einem Ruck deutlich (er schaut zum Drachen). Die
     Schnur beginnt an der mitgedrehten Pfote (KITE_LEAN, kitePaw). */
  .kiting .hop { transform: rotate(-${KITE_LEAN.rest}deg) scale(1, 1); }
  .kiting.ktug .hop { transform: rotate(-${KITE_LEAN.tug}deg) scale(${KITE_LEAN.sx}, ${KITE_LEAN.sy}); transition: transform .18s ease-out; }
  .tv .bk .rim { animation: tvflk 1.3s linear infinite; }

  /* Sprech-Ebene: Blasen, zzz und Zeichen über dem Kopf hängen nicht am Pika selbst (seine Ebene liegt unter Regen
     und Nebel), sondern an einer Hülle gleicher Lage über dem Wetter. _setX gibt ihr dieselbe Bewegung; die Zustände
     (left, inside, sleeping …) liest das CSS vom Pika, der im DOM davor steht (.pika.x ~ .psay). Pino: .frsay. */
  .psay {
    position: absolute; left: 0; top: calc(var(--gy) - var(--ph) * .945); width: var(--pw); height: var(--ph);
    z-index: var(--z-talk); pointer-events: none; will-change: transform; transform-origin: 50% 94.5%;
  }
  .anchor { position: absolute; left: 75%; top: 20%; width: 0; height: 0; }
  .left .anchor, .pika.left ~ .psay .anchor { left: 25%; }
  .pika.inside ~ .psay .anchor { left: var(--ax); top: var(--ay); }
  .zzz { display: none; }
  .pika.sleeping ~ .psay .zzz { display: block; }
  .zzz span {
    position: absolute; left: 0; bottom: 0; font-weight: 800; color: #fff; opacity: 0;
    font-size: calc(var(--ph) * .17); text-shadow: 0 1px 3px rgba(0, 0, 0, .45);
    animation: zz 3.6s linear infinite;
  }
  .zzz span:nth-child(2) { animation-delay: 1.2s; }
  .zzz span:nth-child(3) { animation-delay: 2.4s; }
  @keyframes zz {
    0% { transform: translate(0, 0) scale(.5); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(calc(var(--ph) * .35), calc(var(--ph) * -.6)) scale(1.2); opacity: 0; }
  }
  /* Sprechblase: --bx (px, aus _bubbleFit) schiebt sie am Kartenrand ins Bild, die Spitze bleibt am Anker. Ist der
     Text länger, als die Karte breit ist, bricht er um. --bf: Anteil der Blase links vom Anker. */
  .bubble {
    position: absolute; left: 0; bottom: 4px; --bf: 35%;
    transform: translateX(calc(var(--bx, 0px) - var(--bf))) scale(.3); transform-origin: calc(var(--bf) - var(--bx, 0px)) 100%;
    opacity: 0; transition: transform .28s cubic-bezier(.3, 1.6, .5, 1), opacity .2s;
    background: #fff; color: #4a3a2c; border-radius: 999px; padding: .15em .6em;
    width: max-content; max-width: calc(var(--W, 300px) - 8px); box-sizing: border-box; text-align: center;
    font-size: calc(var(--ph) * .15); font-weight: 800; box-shadow: 0 2px 6px rgba(0, 0, 0, .18); pointer-events: none;
  }
  .bubble.on { opacity: 1; transform: translateX(calc(var(--bx, 0px) - var(--bf))) scale(1); }
  .say::after {
    content: ''; position: absolute; left: clamp(6px, calc(30% - var(--bx, 0px)), calc(100% - 16px)); bottom: -5px;
    border: 5px solid transparent; border-top-color: #fff; border-bottom: 0;
  }
  .think { padding: .3em .45em; bottom: 14px; }
  .think svg { display: block; width: calc(var(--ph) * .2); height: calc(var(--ph) * .2); }
  .think::before, .think::after { content: ''; position: absolute; background: #fff; border-radius: 50%; }
  .think::before { width: 8px; height: 8px; left: clamp(2px, calc(28% - var(--bx, 0px)), calc(100% - 10px)); bottom: -8px; }
  .think::after { width: 4px; height: 4px; left: clamp(2px, calc(22% - var(--bx, 0px)), calc(100% - 6px)); bottom: -14px; }
  /* Im Bau steht die Blase rechts neben dem Eingang (Anker --ax), damit das Schild darüber frei bleibt */
  .pika.inside ~ .psay .bubble { --bf: 6%; }
  .pika.inside ~ .psay .say::after { left: clamp(6px, calc(6% - var(--bx, 0px)), calc(100% - 16px)); }
  .pika.inside ~ .psay .think::before { left: clamp(2px, calc(8% - var(--bx, 0px)), calc(100% - 10px)); }
  .pika.inside ~ .psay .think::after { left: clamp(2px, calc(2% - var(--bx, 0px)), calc(100% - 6px)); }

  /* Über Statusleiste und Knöpfen: Herzchen vom Stein steigen sonst darunter weg. Nichts darin fängt Tipps ab
     (nur das Geschenk im Gras). */
  .fx { position: absolute; inset: 0; pointer-events: none; z-index: var(--z-fx); }
  /* Ansagen für Bildschirmleser (nur Begrüßung, Wiedersehen, Geschenk, Hunger) */
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .pika:focus { outline: none; }
  .pika:focus-visible { outline: 2px dashed rgba(255, 255, 255, .9); outline-offset: -2px; border-radius: 14px; }
  /* Alles andere Antippbare (Häufchen, Geschenk, Pino, Besucher, Geräte, Flugzeuge) mit der Tastatur angewählt */
  .ktap:focus { outline: none; }
  .ktap:focus-visible { outline: 2px dashed rgba(255, 255, 255, .9); outline-offset: 1px; border-radius: 10px; }
  .heart {
    position: absolute; width: calc(var(--ph) * .2); margin-left: calc(var(--ph) * -.1);
    animation: heart 1.5s ease-out forwards;
  }
  .heart svg { display: block; width: 100%; height: auto; }
  @keyframes heart {
    0% { transform: translate(0, 0) scale(.3); opacity: 0; }
    15% { transform: translate(calc(var(--dx) * .2), calc(var(--ph) * -.08)) scale(1.1); opacity: 1; }
    100% { transform: translate(var(--dx), calc(var(--ph) * -.75)) scale(.8); opacity: 0; }
  }

  .stats {
    position: absolute; left: 10px; top: 10px; z-index: var(--z-ui); display: flex; align-items: center; gap: 10px;
    padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 700;
    /* Nie unter den Futterknopf (rechts 8 + 36 px, dazu 8 px Abstand): Der Name gibt nach und endet mit … */
    max-width: calc(100% - 62px); box-sizing: border-box;
    /* Ohne Weichzeichner: Dahinter ziehen ständig Wolken und Regen, das Tablet müsste jedes Bild neu rechnen */
    background: rgba(255, 255, 255, .78); color: #4a3a2c;
    transition: background 2.5s, color 2.5s;
  }
  .stats[hidden] { display: none; }
  .night .stats { background: rgba(15, 22, 45, .7); color: #e8e6f5; }
  .nm { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st, .stats .tb { flex: none; }
  /* Kompaktstufen auf schmalen Karten (_btnFit): erst kürzere Balken und engere Abstände, dann ohne Namen */
  .slim .stats { gap: 7px; padding: 4px 8px; }
  .slim .st i { width: 24px; }
  .tiny .nm { display: none; }
  /* Tippziele mindestens 44 px: unsichtbarer Rand um Leiste und Knöpfe */
  .stats.dia::after { content: ''; position: absolute; inset: -10px 0; }
  .feed::after, .gbtn::after { content: ''; position: absolute; inset: -4px; }
  .tbbtn::after { content: ''; position: absolute; inset: -6px; }
  .st { display: flex; align-items: center; gap: 4px; }
  .st svg { width: 14px; height: 14px; }
  .st i { display: block; width: 34px; height: 6px; border-radius: 3px; background: rgba(0, 0, 0, .14); overflow: hidden; }
  .night .st i { background: rgba(255, 255, 255, .18); }
  .st b { display: block; height: 100%; border-radius: 3px; transition: width .6s; }
  .bar-s { background: #7cc35a; }
  .bar-g { background: #f07a95; }
  .st.low b { background: #e8a33a; }

  /* Futter- und Päckchen-Knopf oben rechts nebeneinander (unten rechts verdeckten sie Pika, Pino und Wiese). Ist die
     Karte so schmal, dass sie an die Statusleiste stoßen, stehen sie untereinander (.btncol). */
  .feed {
    position: absolute; right: 8px; top: 6px; z-index: var(--z-ui); width: 36px; height: 36px; padding: 5px;
    border: none; border-radius: 50%; cursor: pointer; background: rgba(255, 255, 255, .75);
    box-shadow: 0 2px 6px rgba(0, 0, 0, .18); transition: transform .15s, background 2.5s;
  }
  .feed:active { transform: scale(.88); }
  .feed svg { display: block; width: 100%; height: 100%; }
  .night .feed { background: rgba(15, 22, 45, .55); }
  .feed.no { animation: no .4s; }
  .btncol .gbtn { right: 8px; top: 50px; }
  @keyframes no { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .bar-c { background: #5fb9de; }

  /* Vögelchen: .bird steht mit den Füßen auf dem Sitzplatz (left/top), Flug per Web Animation */
  .bird { position: absolute; width: 0; height: 0; --bw: calc(var(--H) * .1); }
  .bird .bw {
    position: absolute; left: calc(var(--bw) * -.5 - 8px); bottom: -4px; width: var(--bw); padding: 8px 8px 4px;
    pointer-events: auto; cursor: pointer;
  }
  .bird.flying .bw { pointer-events: none; }
  .bf, .bb { transform-origin: 50% 100%; }
  .bf { transition: transform .15s; }
  .bird.left .bf { transform: scaleX(-1); }
  .bird svg { display: block; width: 100%; height: auto; overflow: visible; }
  .bird .wu { display: none; transform-box: fill-box; transform-origin: 60% 100%; }
  .bird.flying .wu { display: inline; animation: flap .14s ease-in-out infinite alternate; }
  .bird.flying .wf { display: none; }
  .bird.flying .legs { opacity: 0; }
  @keyframes flap { to { transform: scaleY(-.75); } }
  .bh { transform-box: view-box; transform-origin: 18px 14px; transition: transform .18s ease-out; }
  .bird.tilt .bh { transform: rotate(-16deg); }
  .bird.peck .bh { animation: peck .45s ease-in-out; }
  @keyframes peck { 45% { transform: rotate(38deg) translateY(1px); } }
  .bird.hop .bb { animation: bhop .32s ease-out; }
  @keyframes bhop { 40% { transform: translateY(-35%) scale(.95, 1.06); } 80% { transform: scale(1.06, .92); } }
  .bird.fluff .bb { animation: fluff .7s ease-in-out; }
  @keyframes fluff { 30%, 60% { transform: scale(1.14, .94); } }
  .bird.land .bb { animation: bland .3s ease-out; }
  @keyframes bland { 30% { transform: scale(1.12, .84); } }
  .note {
    position: absolute; font-size: calc(var(--H) * .07); font-weight: 800; color: #fff; line-height: 1; pointer-events: none;
    text-shadow: 0 1px 2px rgba(60, 40, 30, .6); animation: note 1.3s ease-out forwards;
  }
  @keyframes note {
    0% { transform: translate(0, 0) scale(.4) rotate(-10deg); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--dx, 8px), calc(var(--H) * -.12)) scale(1) rotate(12deg); opacity: 0; }
  }

  /* Maus: läuft hinter Stein und Bau (Ebene davor); translate (auf der hinteren Spur auch scale) und Ebene setzt das Skript */
  .mouse { position: absolute; left: 0; top: 0; width: 0; height: 0; --mw: calc(var(--H) * .15); }
  .mouse .mw {
    position: absolute; left: calc(var(--mw) * -.5 - 8px); bottom: -6px; width: var(--mw); padding: 10px 8px 6px;
    pointer-events: auto; cursor: pointer;
  }
  .mf, .mb { transform-origin: 50% 100%; }
  .mouse.left .mf { transform: scaleX(-1); }
  /* Hintere Spur (depth): ein Hauch Dunst wie bei Pika und Pino (heller, weniger satt), auf der inneren Hülle, das
     Licht der Dämmerung liegt außen auf .mw bzw. .cw */
  .mf, .cf { transition: filter 1s; }
  .day:not(.overcast) .lane1 .mf, .day:not(.overcast) .lane1 .cf { filter: saturate(.85) brightness(1.05); }
  .mouse svg { display: block; width: 100%; height: auto; overflow: visible; }
  .mouse.run .mb { animation: scurry .12s linear infinite alternate; }
  @keyframes scurry { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-9%) rotate(2deg); } }
  .mouse.run .mtail { animation: tailw .24s ease-in-out infinite alternate; }
  .mtail { transform-box: view-box; transform-origin: 5px 14px; }
  @keyframes tailw { to { transform: rotate(10deg); } }
  .mouse.stand .mb { transform: scale(.88, 1.16); transition: transform .2s; }
  .mouse .mhead { transform-box: view-box; transform-origin: 17px 10px; transition: transform .2s; }
  .mouse.look .mhead { transform: rotate(-12deg); }
  .mouse .mnose, .mouse .whisk { transform-box: fill-box; transform-origin: 0% 50%; }
  .mouse.sniff .mnose { animation: mnose .18s ease-in-out infinite alternate; }
  .mouse.sniff .whisk { animation: whisk .18s ease-in-out infinite alternate; }
  @keyframes mnose { to { transform: translate(.4px, -.3px) scale(1.15); } }
  @keyframes whisk { to { transform: rotate(-8deg); } }
  .mear { transform-box: fill-box; transform-origin: 50% 90%; }
  .mouse.twitch .mear { animation: twitch .45s; }
  /* Regen-Besucher Frosch und Schnecke: kommen hinter dem Stein hervor wie die Maus, translate setzt das Skript */
  .frog, .snail { position: absolute; left: 0; top: 0; width: 0; height: 0; --cw: calc(var(--H) * .13); }
  .snail { --cw: calc(var(--H) * .12); }
  .cw {
    position: absolute; left: calc(var(--cw) * -.5 - 8px); bottom: -6px; width: var(--cw); padding: 10px 8px 6px;
    pointer-events: auto; cursor: pointer;
  }
  .cf, .cb { transform-origin: 50% 100%; }
  .frog.left .cf, .snail.left .cf { transform: scaleX(-1); }
  .cw svg { display: block; width: 100%; height: auto; overflow: visible; transform-origin: 50% 100%; }
  .fxl, .frog.leap .fhl { display: none; }
  .frog.leap .fxl { display: inline; }
  /* Ein Satz (.leap, nicht .hop: das ist eine Ebene des Pikas): --hd Dauer, --fh Höhe (in Froschhöhen); die Strecke läuft als transition am .frog */
  .frog.leap .cb { animation: fhop var(--hd, .4s) both; }
  @keyframes fhop {
    0% { transform: scale(1.1, .86); animation-timing-function: cubic-bezier(.2, .6, .5, 1); }
    50% { transform: translateY(var(--fh, -100%)) rotate(-9deg) scale(.94, 1.08); animation-timing-function: cubic-bezier(.5, 0, .8, .4); }
    100% { transform: rotate(7deg) scale(1.06, .92); }
  }
  .fsac { transform-box: fill-box; transform-origin: 40% 15%; transform: scale(0); }
  .frog.croak .fsac { animation: fsac .9s ease-in-out; }
  @keyframes fsac {
    18%, 42% { transform: scale(1); } 30% { transform: scale(.7); }
    58%, 82% { transform: scale(1.08); } 70% { transform: scale(.75); } 100% { transform: scale(0); }
  }
  .frog.croak svg { animation: fpuff .9s ease-in-out; }
  @keyframes fpuff { 18%, 58% { transform: scale(1.04, .96); } 42%, 82% { transform: scale(.98, 1.03); } }
  /* nicht "fblink": so heißt schon das Blinken der Lichterkette (STYLE_FEST), das spätere gewönne */
  .flid { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); animation: froglid 4.6s infinite; }
  @keyframes froglid { 0%, 93%, 100% { transform: scaleY(0); } 96% { transform: scaleY(1); } }
  .ftng { transform-box: fill-box; transform-origin: 0 100%; transform: scale(0); }
  .frog.zap .ftng { animation: fzap .38s ease-out; }
  @keyframes fzap { 40%, 55% { transform: scale(1); } 100% { transform: scale(0); } }
  .sbody { transform-box: view-box; transform-origin: 13px 19px; transition: transform .9s ease-out; }
  .sshell { transform-box: view-box; transform-origin: 12.6px 18px; transition: transform .3s; }
  .sfeel { transform-box: view-box; transform-origin: 26px 10.5px; }
  .snail.crawl .sbody { animation: scrawl 1.4s ease-in-out infinite; }
  @keyframes scrawl { 50% { transform: scaleX(1.07); } }
  .snail.crawl .sshell { animation: sbob 1.4s ease-in-out infinite; }
  @keyframes sbob { 50% { transform: translateX(.5px) rotate(2deg); } }
  .snail.crawl .sfeel { animation: sfeel 1.9s ease-in-out infinite alternate; }
  @keyframes sfeel { from { transform: rotate(-5deg); } to { transform: rotate(6deg); } }
  .snail.peer .sfeel { animation: speer 2.6s ease-in-out infinite alternate; }
  @keyframes speer {
    from { transform: rotate(-12deg) scaleY(1.2); } 50% { transform: rotate(4deg) scaleY(1.3); } to { transform: rotate(12deg) scaleY(1.15); }
  }
  .snail.hide .sbody { transform: scale(.3, .45); transition: transform .22s ease-in; }
  .snail.hide .sshell { transform: translateY(1.6px) rotate(-6deg); }
  .snail.hide.wob .sshell { animation: swob .5s ease-in-out; }
  @keyframes swob {
    0%, 100% { transform: translateY(1.6px) rotate(-6deg); } 30% { transform: translateY(1.6px) rotate(-14deg); }
    65% { transform: translateY(1.6px) rotate(2deg); }
  }
  .squeak {
    position: absolute; padding: .1em .45em; border-radius: 999px; background: #fff; color: #4a3a2c; pointer-events: none;
    font-size: calc(var(--H) * .05); font-weight: 800; white-space: nowrap; box-shadow: 0 1px 4px rgba(0, 0, 0, .2);
    transform: translate(-50%, -100%); animation: squeak 1s ease-out forwards;
  }
  @keyframes squeak { 0% { opacity: 0; scale: .4; } 15% { opacity: 1; scale: 1; } 75% { opacity: 1; } 100% { opacity: 0; translate: 0 -6px; } }

  /* Häufchen liegen vorn auf dem Boden (vor dem Gras). Die Tippfläche ist größer als die Köttelchen. */
  .poops { position: absolute; inset: 0; pointer-events: none; }
  .poo {
    z-index: ${BZ.haeufchen}; transition: filter 2.5s;
    position: absolute; left: calc(var(--px) - 22px); bottom: calc(var(--gb) - var(--H) * .022 - 10px);
    width: 44px; padding: 14px 0 10px; display: flex; justify-content: center;
    pointer-events: auto; cursor: pointer;
  }
  .poo svg {
    display: block; width: calc(var(--H) * .11 * var(--ps, 1)); height: auto; overflow: visible;
    transform-origin: 50% 100%; filter: drop-shadow(0 1px 0 rgba(0, 0, 0, .18));
  }
  .poo.plop svg { animation: plop .5s cubic-bezier(.3, 1.6, .5, 1) both; }
  @keyframes plop {
    from { transform: translateY(-60%) scale(.3); opacity: 0; }
    55% { transform: scale(1.18, .8); opacity: 1; }
  }
  .poo.scooped { pointer-events: none; }
  .poo.scooped svg { animation: scooped .5s .2s ease-in forwards; }
  @keyframes scooped {
    30% { transform: translateX(-2px) scale(1.06, .88); }
    to { transform: translate(calc(var(--H) * .05), calc(var(--H) * -.12)) scale(.35); opacity: 0; }
  }
  .poo.gone { pointer-events: none; opacity: 0; transition: opacity .8s, filter 2.5s; }
  /* Alte Häufchen: eine kleine Fliege kreist darüber (nur bei Tag) */
  .fly { display: none; position: absolute; left: 50%; top: 6px; width: 0; height: 0; animation: buzz 2.6s linear infinite; }
  .poo.old .fly { display: block; }
  .night .poo .fly { display: none; }
  .fly::before {
    content: ''; position: absolute; left: -1.5px; top: -1.5px; width: 3.5px; height: 3px; border-radius: 50%; background: #2b2622;
  }
  .fly::after {
    content: ''; position: absolute; left: -1px; top: -4px; width: 3px; height: 2.6px; border-radius: 50%;
    background: rgba(255, 255, 255, .85); box-shadow: 0 0 0 .5px rgba(0, 0, 0, .25); animation: wing .09s linear infinite alternate;
  }
  @keyframes wing { to { transform: scaleY(.3) translateY(1px); } }
  @keyframes buzz {
    0% { transform: translate(0, 0); }
    20% { transform: translate(9px, -6px); }
    40% { transform: translate(3px, -12px); }
    55% { transform: translate(-8px, -7px); }
    75% { transform: translate(-5px, 1px); }
    90% { transform: translate(4px, -2px); }
    100% { transform: translate(0, 0); }
  }
  .scoop {
    position: absolute; width: calc(var(--H) * .14); margin-left: calc(var(--H) * -.045);
    pointer-events: none; animation: scoop .85s ease-in-out forwards;
  }
  .scoop svg { display: block; width: 100%; height: auto; transform-origin: 30% 90%; }
  @keyframes scoop {
    0% { transform: translateX(60%); opacity: 0; }
    20% { transform: translateX(20%); opacity: 1; }
    42% { transform: translateX(-12%); }
    70% { transform: translate(5%, -35%) rotate(-22deg); opacity: 1; }
    100% { transform: translate(35%, -80%) rotate(-30deg); opacity: 0; }
  }
  .spark {
    position: absolute; width: calc(var(--H) * .05); margin: calc(var(--H) * -.025); pointer-events: none;
    animation: spark .9s ease-out both;
  }
  .spark svg { display: block; width: 100%; height: auto; }
  .spark path { fill: #fff6b8; filter: drop-shadow(0 0 2px rgba(255, 236, 140, .9)); }
  @keyframes spark {
    0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 0; }
    30% { transform: translate(0, calc(var(--H) * -.03)) scale(1.1) rotate(25deg); opacity: 1; }
    100% { transform: translate(var(--dx, 0px), calc(var(--H) * -.1)) scale(.3) rotate(70deg); opacity: 0; }
  }

  /* Flugzeuge: Position und Größe setzt das Skript jede Sekunde (gleitet 1 s linear). Sie fliegen hinter den
     Hügeln, die Fähnchen liegen in einer eigenen Ebene darüber und sind antippbar. */
  .planes, .ptags, .phits { position: absolute; inset: 0; pointer-events: none; }
  /* Ein offenes Fähnchen ist die gefragte Auskunft: Es liegt vor Statusleiste und Knöpfen. Geschlossene sind
     unsichtbar und fangen keine Tipps. Die Tippflächen liegen in einer eigenen Ebene unter den Knöpfen. */
  .ptags { z-index: var(--z-tag); }
  .phits { z-index: var(--z-talk); }
  /* Übergänge 5 s = PLANE_STEP; Randausblendung (--pa) auf .pl-f, damit sie mitgleitet statt zu springen */
  .plane { position: absolute; left: 0; top: 0; opacity: 0; transition: transform 5s linear, opacity 2s; will-change: transform; }
  .plane.on { opacity: 1; }
  /* Unsichtbare Tippfläche über dem Flugzeug (die Flugzeuge selbst liegen hinter den Hügeln) */
  .phit { position: absolute; left: 0; top: 0; display: none; pointer-events: auto; cursor: pointer; touch-action: pan-y; transition: transform 5s linear; }
  .phit.on { display: block; }
  .plane .pl-s {
    position: absolute; width: calc(var(--H) * .3); left: calc(var(--H) * -.15); top: calc(var(--H) * -.06);
    transition: transform 5s linear, opacity 3s;
  }
  .plane .pl-f { position: relative; opacity: var(--pa, 1); transition: transform 1.2s ease-in-out, opacity 5s linear; }
  .plane.left .pl-f { transform: scaleX(-1); }
  .plane svg { position: relative; display: block; width: 100%; height: auto; overflow: visible; }
  .plane .pl-body { transition: filter 2.5s; }
  .dusk .plane .pl-body { filter: brightness(.8) saturate(.9); }
  .night .plane .pl-body { filter: brightness(.28) saturate(.5); }
  .plane .win { fill: #6c8db3; transition: fill 2.5s; }
  .dusk .plane .win, .night .plane .win { fill: #ffe7a0; }
  .plane .bcn { fill: #ff3b30; animation: bcn 1.3s linear infinite; }
  .plane .strobe { fill: #fff; opacity: 0; }
  .dusk .plane .strobe, .night .plane .strobe { animation: strobe 1.7s linear infinite; filter: drop-shadow(0 0 2px #fff); }
  @keyframes bcn { 0%, 12% { opacity: 1; } 18%, 100% { opacity: .15; } }
  @keyframes strobe { 0%, 5% { opacity: 1; } 8%, 100% { opacity: 0; } }
  .plane .rotor { transform-box: fill-box; transform-origin: center; animation: rotor .14s linear infinite alternate; }
  .plane .prop, .plane .trotor { transform-box: fill-box; transform-origin: center; animation: prop .09s linear infinite alternate; }
  @keyframes rotor { to { transform: scaleX(.15); } }
  @keyframes prop { to { transform: scaleY(.2); } }
  /* Kondensstreifen in Reiseflughöhe, zieht hinter dem Heck her */
  .plane .trail {
    position: absolute; right: 93%; top: 46%; width: 520%; height: 6%; border-radius: 999px;
    background: linear-gradient(to left, rgba(255, 255, 255, .9), rgba(255, 255, 255, 0)); opacity: 0; transition: opacity 4s;
  }
  .plane.contrail .trail { opacity: 1; }
  .dusk .plane .trail { background: linear-gradient(to left, rgba(255, 226, 214, .8), rgba(255, 226, 214, 0)); }
  .night .plane .trail { background: linear-gradient(to left, rgba(180, 192, 228, .3), rgba(180, 192, 228, 0)); }
  .overcast .plane.hi .pl-s { opacity: .3; }
  .foggy .plane .pl-s { opacity: .25; }
  /* Nie breiter als die Karte (Handy): zu lange Zeilen enden mit … */
  .ptag {
    position: absolute; left: 0; top: 0; padding: .1em .65em .15em; border-radius: .9em;
    box-sizing: border-box; max-width: calc(100% - 8px); overflow: hidden; text-overflow: ellipsis;
    font-size: clamp(10px, calc(var(--H) * .05), 14px); line-height: 1.35; white-space: nowrap;
    color: #2f4256; background: rgba(255, 255, 255, .8); box-shadow: 0 1px 3px rgba(0, 0, 0, .15);
    pointer-events: none; cursor: pointer; opacity: 0; transition: transform 5s linear, opacity .3s, background 2.5s, color 2.5s;
  }
  .ptag.on.open { opacity: 1; pointer-events: auto; z-index: 1; }
  .ptag b { font-weight: 700; letter-spacing: .02em; }
  .ptag .more { font-size: .9em; opacity: .85; overflow: hidden; text-overflow: ellipsis; }
  .dusk .ptag { background: rgba(255, 255, 255, .72); }
  .night .ptag { color: #e4e9f6; background: rgba(22, 32, 62, .72); }

  /* ---- Sparen ---- */
  /* Niemand sieht hin (Tab versteckt, Karte aus dem Bild): alle Animationen anhalten, sie laufen danach weiter */
  .scene.paused, .scene.paused *, .scene.paused *::before, .scene.paused *::after { animation-play-state: paused !important; }
  /* Nachts ohne Wind stehen die Blumen still (man sieht es kaum, und das Tablet darf ruhen);
     eine nachwachsende wächst trotzdem fertig */
  .scene.night:not(.windy) .flower { animation-play-state: paused; }
  .scene.night:not(.windy) .flower.grow { animation-play-state: running, paused; }
  .scene.night:not(.windy) .flower.picked { animation-play-state: running; }
  /* Weniger Bewegung gewünscht (Systemeinstellung): Wolken, Sterne, Blumen, Rauch, Niederschlag und Blinklichter ruhen */
  @media (prefers-reduced-motion: reduce) {
    .stars b, .flower, .smoke circle, .precip .pl, .precip .pw, .fog i, .lt.flk, .br, .brolly,
    .plane .bcn, .plane .strobe, .fbl, .flm, .fflk, .lsw, .hb-i, .hb-tw, .hb-heat > g, .hb-steam > g {
      animation: none !important;
    }
    /* Wolken stehen still, bleiben aber am Himmel: Ohne Animation lägen alle links außerhalb des Bildes (sie kommen
       nur über drift herein), angehalten stehen sie dank des negativen Versatzes --dl verteilt */
    .cloud { animation-play-state: paused !important; }
    .precip { opacity: .6; }
    /* Ebenso ruhen: das Flackern des Fernsehers (er leuchtet ruhig, die Farbe wechselt seltener, _tvOn), der Drachen
       (steht still im Wind), was an den Geräten des Haus-Boten von selbst läuft (Schaum, Blasen, Tropfen, Trommel,
       Wäsche im Wind, Ausrufezeichen, wandernder Balken, Rührstock, Tellerpolieren), Rotoren und Propeller, die Fliege
       am Häufchen und die aufsteigenden zzz (sie stehen als drei feste Zeichen da). */
    .tv-on .tvl .tvg, .tv-on .tvw, .tv .bk .rim, .kite .kr, .kite .kb, .kite .kt,
    .hb-a, .hb-run .hb-foam, .hb-bubs circle, .hb-drip, .hb-cs, .hb-run .hb-rot, .hb-run .hb-sock, .hb-run .hb-dip,
    .hb-bar.ind b, .hb-stick, .hb-ring, .hb-bbl, .hb-soap:not(.pop) i, .hb-carry.hb-shine > i,
    .plane .rotor, .plane .prop, .plane .trotor, .fly, .fly::after, .zzz span {
      animation: none !important;
    }
    .tv-on .tvl .tvg, .tv .bk .rim { opacity: .6; }
    .zzz span { opacity: .9; }
    .zzz span:nth-child(1) { transform: translate(calc(var(--ph) * .05), calc(var(--ph) * -.1)) scale(.7); }
    .zzz span:nth-child(2) { transform: translate(calc(var(--ph) * .16), calc(var(--ph) * -.28)) scale(.9); }
    .zzz span:nth-child(3) { transform: translate(calc(var(--ph) * .28), calc(var(--ph) * -.47)) scale(1.1); }
    /* Die Ohren schwingen nach der Landung nicht nach (nach einem Sprung lässt es das Skript, _earSwing) */
    .lnd:not(.walking) .ear-l, .lnd:not(.walking) .ear-r { animation: none; }
    /* Finger setzt auf: Bäckchen und Blick reichen als Antwort, er wird nicht gestaucht */
    .pressed .jump { transform: none; }
    /* Blitz: nur ein sanftes, einmaliges Aufhellen statt Flackern über die ganze Karte */
    .flash.go { animation: flash-soft 1.2s ease-out; }
    @keyframes flash-soft { 15% { opacity: .18; } }
  }
  `;

export { STYLE };
