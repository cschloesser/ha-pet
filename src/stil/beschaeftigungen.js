// Stil der Beschäftigungen (groß und klein)

import { PROPS, KRAM } from '../logik/beschaeftigungen.js';
import { PURZEL_ROLL } from '../logik/beschaeftigungen-klein.js';

const STYLE_ACT = `
  .acts { position: absolute; inset: 0; pointer-events: none; transition: filter 2.5s; }
  .shade .acts { filter: brightness(var(--lbp, 1)) saturate(var(--ls, 1)); }

  .band, .arms, .uke, .brush, .wand, .rope, .rgrip, .bar, .wpaw { display: none; }
  .music .uke, .painting .brush, .blowing .wand, .sport .band, .jjack .arms, .roping .rope, .roping .rgrip,
  .rope-hold .rope, .rope-hold .rgrip, .lifting .bar, .waving .wpaw { display: inline; }

  /* Hervorkramen und Wegräumen: Requisiten kommen aus dem Fell, statt hart zu erscheinen (in 240 ms, klein und etwas
     tiefer beginnend, leicht überschwingend), und verschwinden auf demselben Weg. Das Skript setzt dazu kurz .kram
     bzw. .stow an den Pika (_propOn, _propOff); die Staffelei neben ihm nimmt dieselben Bilder. translate und scale
     als eigene Eigenschaften: Die transform der Requisiten (Seil, Hantel, eingenicktes Buch) bleibt unberührt, und
     ein alter Browser, der sie nicht kennt, blendet einfach ein. */
  ${PROPS('.pika.kram')} { transform-box: fill-box; transform-origin: 50% 70%; animation: kram ${KRAM.in}ms ease-out both; }
  ${PROPS('.pika.stow')} { transform-box: fill-box; transform-origin: 50% 70%; animation: kramweg ${KRAM.out}ms ease-in both; }
  @keyframes kram {
    0% { opacity: 0; scale: .3; translate: 0 5px; }
    70% { opacity: 1; scale: 1.1; translate: 0 -1px; }
    100% { opacity: 1; scale: 1; translate: 0 0; }
  }
  @keyframes kramweg {
    0% { opacity: 1; scale: 1; translate: 0 0; }
    100% { opacity: 0; scale: .3; translate: 0 5px; }
  }
  @keyframes kramfade { from { opacity: 0; } }
  @keyframes kramfadeweg { to { opacity: 0; } }

  /* Winken (Begrüßung) */
  .wpaw { transform-box: view-box; transform-origin: 103px 52px; }
  .waving .wpaw { animation: wpaw .42s ease-in-out infinite alternate; }
  @keyframes wpaw { from { transform: rotate(-18deg); } to { transform: rotate(14deg); } }
  .waving .face { transform: translate(1px, -1px); }

  /* Musik: Ukulele, wiegt sich, Schlagpfote */
  .music .hop { animation: msway 1.7s ease-in-out infinite alternate; }
  @keyframes msway { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }
  .music .face { transform: translate(.6px, 1.4px); }
  .ustrum { transform-box: fill-box; }
  .music .ustrum { animation: strum .32s ease-in-out infinite alternate; }
  @keyframes strum { from { transform: translate(-.6px, -2.4px); } to { transform: translate(.6px, 2.2px); } }
  .sing .omouth { display: inline; }
  /* Verbeugung nach dem Ständchen: Pfoten vor dem Bauch, Oberkörper und Kopf tief, die Ohren fallen nach vorn */
  .bowing .paws { display: inline; transform: translateY(6px); }
  .bowing .hop { animation: bow 1.6s ease-in-out; }
  @keyframes bow { 28%, 64% { transform: translateY(-4%) rotate(10deg) scale(1.03, .95); } }
  .bowing .face { animation: bowf 1.6s ease-in-out; }
  @keyframes bowf { 28%, 64% { transform: translate(2.5px, 4.5px); } }
  .bowing .ear { animation: bowe 1.6s ease-in-out; }
  @keyframes bowe { 34%, 64% { transform: rotate(18deg); } 80% { transform: rotate(-5deg); } }

  /* Malen: Pinsel tupft, Blick auf die Palette */
  .painting .face { transform: translate(1.5px, -.6px); }
  .bstick { transform-box: view-box; transform-origin: 100px 65px; transition: transform .14s ease-out; }
  .dab .bstick { transform: translate(1.6px, -.9px) rotate(-7deg); }
  .mix .face { transform: translate(-1.6px, 2.6px); }
  .mix .bstick { transform: rotate(14deg); }
  /* Farbklecks auf der Nase (--nsm = die Farbe, mit der er gerade malte) */
  .nsm { display: none; }
  .smudge .nsm { display: inline; }
  /* Die Staffelei stellt er hin wie ein hervorgekramtes Requisit (von den Füßen aus) und räumt sie so auch weg */
  .easel { position: absolute; opacity: 0; transform-origin: 50% 100%; }
  .easel.on { opacity: 1; animation: kram ${KRAM.in}ms ease-out backwards; }
  .easel.off { animation: kramweg ${KRAM.out}ms ease-in forwards; }
  .easel svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .easel .cvl { opacity: 0; transition: opacity .6s; }
  .cv-sky { fill: #9fd6f7; }
  .day.overcast .cv-sky { fill: #bccbd8; }
  .dusk .cv-sky { fill: #f2a477; }
  .night .cv-sky { fill: #2c3a6e; }
  .cv-sun { fill: #ffd54a; }
  .dusk .cv-sun { fill: #ff9a4a; }
  .night .cv-sun { fill: #f4f1dc; }

  /* Seifenblasen */
  .wfilm { transform-box: fill-box; transform-origin: 0% 50%; transition: transform .5s; }
  .blow .wfilm { transform: scale(1.5, 1.2); }
  .blow .omouth { display: inline; }
  .blow .face { transform: translate(1.2px, 0); }
  .bub { position: absolute; left: 0; top: 0; width: 0; height: 0; }
  .bub i {
    position: absolute; left: calc(var(--bs) * -.5); top: calc(var(--bs) * -.5); width: var(--bs); height: var(--bs);
    border-radius: 50%; pointer-events: auto; cursor: pointer;
    background: radial-gradient(circle at 32% 30%, rgba(255, 255, 255, .95) 0 8%, rgba(255, 255, 255, 0) 21%),
      radial-gradient(circle, rgba(255, 255, 255, .08) 50%, rgba(140, 210, 255, .6) 70%, rgba(255, 150, 220, .7) 86%, rgba(160, 255, 210, .9) 100%);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, .9), 0 0 3px 1px rgba(50, 90, 130, .3); animation: wob 1.1s ease-in-out infinite alternate;
    will-change: transform; /* eigene Ebene: Verlauf und Schatten werden beim Wabern nicht jedes Bild neu gemalt */
  }
  .bub i::after { content: ''; position: absolute; inset: -8px; }
  @keyframes wob { to { transform: scale(1.07, .93); } }
  .bub.pop i { animation: bpop .2s ease-out forwards; pointer-events: none; }
  @keyframes bpop { to { transform: scale(1.45); opacity: 0; } }

  /* Frühsport: Stirnband, Hampelmann, Kniebeugen, Schweißtropfen */
  /* --jd (negativ): Steigt er mitten in der Übung ein, beginnen die Animationen im Takt der Planzeit. So landet jeder
     Sprung auf der gezählten Zahl, und die Übung endet am Boden. */
  .jjack .paws { display: inline; animation: jpaws var(--jj, .7s) steps(1) var(--jd, 0s) infinite; }
  .jjack .arms { animation: jarms var(--jj, .7s) steps(1) var(--jd, 0s) infinite; }
  @keyframes jarms { 0% { opacity: 1; } 50%, 100% { opacity: 0; } }
  @keyframes jpaws { 0% { opacity: 0; } 50%, 100% { opacity: 1; } }
  .jjack .jump { animation: jjump var(--jj, .7s) ease-in-out var(--jd, 0s) infinite; }
  .jjack .ear { transform: translateY(-1.5px); }
  .jjack .ear-l { animation: ejj var(--jj, .7s) ease-in-out var(--jd, 0s) infinite; }
  .jjack .ear-r { animation: ejj var(--jj, .7s) ease-in-out calc(var(--jd, 0s) + .04s) infinite; }
  @keyframes ejj {
    0%, 50%, 100% { transform: translateY(-1.5px) rotate(5deg); }
    22% { transform: translateY(-1.5px) rotate(-6deg); }
    75% { transform: translateY(-1.5px); }
  }
  @keyframes jjump {
    0%, 50%, 100% { transform: translateY(0) scale(1.04, .96); }
    25% { transform: translateY(-14%); }
    75% { transform: translateY(0); }
  }
  .knee .hop { animation: knee 1.4s ease-in-out var(--jd, 0s) infinite; }
  @keyframes knee { 50% { transform: scale(1.1, .8); } }
  .knee .paws { display: inline; transform: translate(5px, 1px); }
  .sweat { position: absolute; width: calc(var(--ph) * .07); animation: sweat 1.1s ease-in forwards; pointer-events: none; }
  .sweat svg, .seed svg { display: block; width: 100%; height: auto; }
  @keyframes sweat {
    0% { transform: translate(0, 0) scale(.4); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--dx), calc(var(--ph) * .25)) scale(1); opacity: 0; }
  }

  /* Seilspringen: dieselbe Schlaufe hinter (rope-b) und vor dem Körper (rope-f), gespiegelt um die Griffhöhe */
  .roping { --rr: var(--rp, .66s); }
  .rdbl { --rr: calc(var(--rp, .66s) / 2); }
  .rope { transform-box: view-box; transform-origin: 0 56px; }
  .roping .rope-f { animation: rope var(--rr) infinite, ropef var(--rr) steps(1) infinite; }
  .roping .rope-b { animation: rope var(--rr) infinite, ropeb var(--rr) steps(1) infinite; }
  @keyframes rope {
    0%, 100% { transform: scaleY(-1); animation-timing-function: ease-in; }
    25% { transform: scaleY(0); animation-timing-function: ease-out; }
    50% { transform: scaleY(1); animation-timing-function: ease-in; }
    75% { transform: scaleY(0); animation-timing-function: ease-out; }
  }
  @keyframes ropef { 0% { opacity: 1; } 50%, 100% { opacity: 0; } }
  @keyframes ropeb { 0% { opacity: 0; } 50%, 100% { opacity: 1; } }
  .roping .jump { animation: rjump var(--rp, .66s) linear infinite; }
  /* Absprung bremst nach oben ab, oben kurz gestreckt, abwärts beschleunigt er (das Seil ist bei 50 % unten) */
  @keyframes rjump {
    0%, 80%, 100% { transform: translateY(0); }
    22% { transform: translateY(0); animation-timing-function: ease-in; }
    32% { transform: scale(1.06, .93); animation-timing-function: cubic-bezier(.2, .65, .45, 1); }
    50% { transform: translateY(-16%) scale(.98, 1.03); animation-timing-function: cubic-bezier(.55, 0, .8, .35); }
    68% { transform: translateY(0) scale(1.06, .94); animation-timing-function: ease-out; }
  }
  .rdbl .jump { animation-name: rjump2; }
  @keyframes rjump2 {
    0%, 100% { transform: translateY(0); animation-timing-function: ease-in; }
    10% { transform: scale(1.07, .92); animation-timing-function: cubic-bezier(.2, .65, .45, 1); }
    50% { transform: translateY(-27%) scale(.97, 1.04); animation-timing-function: cubic-bezier(.55, 0, .8, .35); }
    90% { transform: translateY(0) scale(1.06, .94); animation-timing-function: ease-out; }
  }
  .roping .bfoot { animation: fb-rope var(--rp, .66s) ease-in-out infinite; }
  .roping .ffoot { animation: ff-rope var(--rp, .66s) ease-in-out infinite; }
  @keyframes fb-rope { 0%, 28%, 72%, 100% { transform: none; } 44%, 56% { transform: translate(3px, -1.5px) rotate(16deg); } }
  @keyframes ff-rope { 0%, 28%, 72%, 100% { transform: none; } 44%, 56% { transform: translate(-1px, -1.5px) rotate(14deg); } }
  .rdbl .bfoot { animation-name: fb-air; }
  .rdbl .ffoot { animation-name: ff-air; }
  .roping .shadow { animation: sh-rope var(--rp, .66s) linear infinite; }
  @keyframes sh-rope {
    0%, 68%, 100% { transform: none; opacity: 1; }
    32% { transform: none; opacity: 1; animation-timing-function: cubic-bezier(.2, .65, .45, 1); }
    50% { transform: scale(.8); opacity: .58; animation-timing-function: cubic-bezier(.55, 0, .8, .35); }
  }
  .rdbl .shadow { animation-name: sh-rope2; }
  @keyframes sh-rope2 {
    0%, 90%, 100% { transform: none; opacity: 1; }
    10% { transform: none; opacity: 1; animation-timing-function: cubic-bezier(.2, .65, .45, 1); }
    50% { transform: scale(.7); opacity: .45; animation-timing-function: cubic-bezier(.55, 0, .8, .35); }
  }
  .jjack .shadow { animation: sh-jj var(--jj, .7s) ease-in-out var(--jd, 0s) infinite; }
  @keyframes sh-jj { 0%, 50%, 100% { transform: none; opacity: 1; } 25% { transform: scale(.82); opacity: .6; } }
  /* Ohren wippen bei jedem Seilsprung mit: in der Luft bleiben sie zurück, bei der Landung klappen sie nach vorn */
  .roping .ear-l { animation: erope var(--rp, .66s) ease-in-out infinite; }
  .roping .ear-r { animation: erope var(--rp, .66s) .04s ease-in-out infinite; }
  @keyframes erope { 0%, 28%, 100% { transform: none; } 46% { transform: rotate(-7deg); } 72% { transform: rotate(7deg); } 88% { transform: rotate(-2deg); } }
  .rdbl .ear-l, .rdbl .ear-r { animation-name: erope2; }
  @keyframes erope2 { 0%, 100% { transform: none; } 8% { transform: rotate(3deg); } 40% { transform: rotate(-10deg); } 70% { transform: rotate(-3deg); } 93% { transform: rotate(8deg); } }
  /* Bewegung reduzieren: Requisiten blenden ein und aus, ohne Überschwingen; die Ohren schwingen nicht nach */
  @media (prefers-reduced-motion: reduce) {
    ${PROPS('.pika.kram')}, .easel.on { animation-name: kramfade; }
    ${PROPS('.pika.stow')}, .easel.off { animation-name: kramfadeweg; }
    .roping .ear-l, .roping .ear-r, .jjack .ear-l, .jjack .ear-r { animation: none; }
  }

  /* Gewichtheben: Pusteblumen-Hantel vom Boden über den Kopf */
  .barm { transform-box: view-box; transition: transform .5s cubic-bezier(.4, 0, .3, 1); }
  .lift-gnd .barm { transform: translateY(25px); }
  .lift-hi .barm { transform: translateY(-53px); transition-duration: .9s; }
  .bar { transform-box: view-box; }
  .strain .bar { animation: strain .09s linear infinite alternate; }
  @keyframes strain { from { transform: translateX(-.7px); } to { transform: translateX(.7px); } }
  .strain .eye { display: none; }
  .strain .seye { display: inline; }
  .lift-hi .face { transform: translate(1px, -1.6px); }
  .seed { position: absolute; width: calc(var(--ph) * .09); animation: seed 3.4s ease-out forwards; pointer-events: none; }
  @keyframes seed {
    0% { transform: translate(0, 0) rotate(0); opacity: 0; }
    10% { opacity: 1; }
    100% { transform: translate(var(--dx), calc(var(--ph) * -.8)) rotate(var(--rt)); opacity: 0; }
  }

  /* ---- Kleine Beschäftigungen ab 0.32: Hula-Hoop, Jo-Jo, Pusteblume, Purzelbaum, Steintürmchen, Jonglieren,
     Blumenkranz, Papierflieger; bei Regen Pfützenspringen und Papierschiffchen, bei Schnee der Schnee-Pika ---- */
  .hoop, .yo, .pbl, .jug, .dchain, .dcrown, .pgl, .peb, .sboat { display: none; }
  .hula .hoop, .hula .arms, .yoyo .yo, .puste .pbl, .juggle .jug, .juggle .arms, .plait .dchain, .crowned .dcrown,
  .gliding .pgl, .pebble .peb, .boating .sboat { display: inline; }

  /* Requisiten am Boden (_aprop): hinter dem Pika in .acts, die Pfütze vorn auf dem Wiesenstreifen in .actsf */
  .actsf { position: absolute; inset: 0; pointer-events: none; z-index: var(--z-stage); transition: filter 2.5s; }
  .shade .actsf { filter: brightness(var(--lbp, 1)) saturate(var(--ls, 1)); }
  .aprop { position: absolute; opacity: 0; transition: opacity .45s; }
  .aprop.on { opacity: 1; }
  .aprop > svg { display: block; width: 100%; height: 100%; overflow: visible; }

  /* Hula-Hoop: Der Reifen kreist (kippt und wandert im Kreis), die Hüfte schwingt gegenläufig, Pfoten oben */
  .hoop { transform-box: view-box; transform-origin: 62px 69px; }
  .hula-go .hoop { animation: hoop var(--hu, .74s) linear infinite; }
  @keyframes hoop {
    0%, 100% { transform: translate(-3.4px, 0) rotate(-6deg); }
    25% { transform: translate(0, 1.6px) rotate(0deg); }
    50% { transform: translate(3.4px, 0) rotate(6deg); }
    75% { transform: translate(0, -1.6px) rotate(0deg); }
  }
  .hula-go .hop { animation: hsway var(--hu, .74s) ease-in-out infinite; }
  @keyframes hsway { 0%, 100% { transform: translateX(1.6%) rotate(1.6deg); } 50% { transform: translateX(-1.6%) rotate(-1.6deg); } }
  .hula-x { --hu: .48s; }
  .hula .face { transform: translate(.6px, -1px); }
  /* heruntergerutscht: Der Reifen liegt um die Füße */
  .hula-dn .hoop { transform: translateY(21px) scaleY(.5); transition: transform .3s ease-in; }
  /* Wegräumen des heruntergerutschten Reifens: .stow stellte Bezugsrahmen und Ursprung um (fill-box, 50% 70%),
     während Verschieben und Stauchen noch gelten: Der Reifen sprang. Hier bleibt beides, wie es ist. */
  .pika.stow.hula-dn .hoop { transform-box: view-box; transform-origin: 62px 69px; }
  .hula-dn .arms { display: none; }
  .hula-dn .face { transform: translate(-.6px, 2.6px); }

  /* Jo-Jo: Scheibe und Schnur laufen über dieselbe Dauer --yo; unten dreht es kurz frei, dann kommt es zurück */
  .ystr { transform-box: view-box; transform-origin: 117px 50px; transform: scaleY(.1); transition: transform 1.1s ease-in-out; }
  .ydisc { transform-box: view-box; transition: transform 1.1s ease-in-out; }
  .yo-go .ydisc { animation: yod var(--yo, 1s) infinite; }
  .yo-go .ystr { animation: yos var(--yo, 1s) infinite; }
  @keyframes yod {
    0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(.5, 0, .9, .6); }
    42% { transform: translateY(27px); animation-timing-function: linear; }
    56% { transform: translateY(27px); animation-timing-function: cubic-bezier(.1, .5, .4, 1); }
  }
  @keyframes yos {
    0%, 100% { transform: scaleY(.1); animation-timing-function: cubic-bezier(.5, 0, .9, .6); }
    42% { transform: scaleY(1); animation-timing-function: linear; }
    56% { transform: scaleY(1); animation-timing-function: cubic-bezier(.1, .5, .4, 1); }
  }
  .yo-dead .ydisc { transform: translateY(27px); transition: none; }
  .yo-dead .ystr { transform: scaleY(1); transition: none; }
  .yoyo .face { transform: translate(2.2px, 1.4px); }

  /* Pusteblume: Luft holen (.pu-in), pusten (.blow, wie beim Seifenblasenring), die Kugel wird in drei Stufen kahl */
  .pu-in .hop { transform: scale(.97, 1.05); transition: transform .5s ease-out; }
  .pu-in .face { transform: translate(.6px, -1.6px); }
  .pu-2 .pb3, .pu-1 .pb2, .pu-0 .pb1 { display: none; }

  /* Purzelbaum: einmal vornüber um die Körpermitte, dabei trägt ihn das Skript ein Stück weiter (PURZEL_ROLL) */
  .purzel .hop { transform-origin: 50% 60%; animation: purzel ${PURZEL_ROLL}ms linear; }
  @keyframes purzel {
    0% { transform: rotate(0deg); animation-timing-function: ease-in; }
    14% { transform: translateY(-3%) rotate(38deg) scale(.96); animation-timing-function: linear; }
    50% { transform: translateY(-9%) rotate(180deg) scale(.93); }
    86% { transform: translateY(-3%) rotate(322deg) scale(.96); animation-timing-function: ease-out; }
    100% { transform: rotate(360deg); }
  }
  .purzel .shadow { animation: sh-purzel ${PURZEL_ROLL}ms ease-in-out; }
  @keyframes sh-purzel { 50% { transform: scale(.78); opacity: .55; } }

  /* Steintürmchen: Jeder Stein fällt ein kleines Stück und federt; ab dem dritten wackelt der Turm, manchmal fällt er */
  .stn { transform-box: fill-box; transform-origin: 50% 100%; opacity: 0; transform: translateY(-9px); transition: transform .28s cubic-bezier(.3, 1.6, .5, 1), opacity .12s; }
  .n1 .st1, .n2 .st2, .n3 .st3, .n4 .st4 { opacity: 1; transform: none; }
  .stonep > svg { transform-origin: 50% 100%; }
  .stonep.wob > svg { animation: stwob .7s ease-in-out; }
  @keyframes stwob { 25% { transform: rotate(3.4deg); } 60% { transform: rotate(-2.6deg); } 85% { transform: rotate(1deg); } }
  .stonep.fall .stn { transition: transform .5s cubic-bezier(.5, 0, .9, .6); }
  .stonep.fall .st4 { transform: translate(15px, 31px) rotate(74deg); }
  .stonep.fall .st3 { transform: translate(-14px, 22px) rotate(-52deg); }
  .stonep.fall .st2 { transform: translate(8px, 9px) rotate(16deg); }

  /* Jonglieren: drei Beeren im Bogen von Pfote zu Pfote über den Kopf. x läuft gleichmäßig hin und zurück (jbx),
     y steigt und fällt je Bogen (jby), jede Beere um ein Drittel versetzt. */
  .jb { transform-box: view-box; }
  .jb2 { transform: translate(47px, -2px); }
  .jb3 { transform: translate(2.4px, -5.4px); }
  .jug-go .jb { animation: jbx var(--jg, .62s) linear infinite alternate; }
  .jug-go .jb circle { animation: jby var(--jg, .62s) infinite; }
  .jug-go .jb2, .jug-go .jb2 circle { animation-delay: calc(var(--jg, .62s) * -.667); }
  .jug-go .jb3, .jug-go .jb3 circle { animation-delay: calc(var(--jg, .62s) * -1.333); }
  @keyframes jbx { from { transform: translateX(0); } to { transform: translateX(47px); } }
  @keyframes jby {
    0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(.1, .5, .5, 1); }
    50% { transform: translateY(-37px); animation-timing-function: cubic-bezier(.5, 0, .9, .5); }
  }
  .jug-go .arms ellipse { transform-box: fill-box; animation: jgpaw var(--jg, .62s) ease-in-out infinite; }
  .jug-go .arms ellipse + ellipse { animation-delay: calc(var(--jg, .62s) * -.5); }
  @keyframes jgpaw { 0%, 100% { transform: translateY(1.6px); } 30% { transform: translateY(-2px); } }

  /* Blumenkranz: flechten (Pfoten wechseln sich ab, Blick nach unten), dann sitzt er auf dem Kopf */
  .plait .dpl { transform-box: fill-box; animation: plait .5s ease-in-out infinite alternate; }
  .plait .dpr { transform-box: fill-box; animation: plait .5s -.5s ease-in-out infinite alternate-reverse; }
  @keyframes plait { from { transform: translate(0, 1px); } to { transform: translate(1.6px, -1.6px); } }
  .plait .face { transform: translate(.6px, 2.6px); }

  /* Papierflieger: in der Pfote (.gliding), geworfen fliegt er als eigenes Element (.glid, _glider) */
  .gliding .face { transform: translate(1.6px, -1px); }
  .glid { will-change: transform; transition-duration: .15s; }

  /* Pfütze: Ring bei jedem Platscher (.rip), dazu zwei kleine Tropfenringe vom Regen; Tropfen spritzen (.splash) */
  .puddle { transition-duration: .9s; }
  .pd-rip { opacity: 0; transform-box: fill-box; transform-origin: 50% 50%; }
  .puddle.rip .pd-rip { animation: pdrip .6s ease-out; }
  @keyframes pdrip { 0% { opacity: .95; transform: scale(.3); } 100% { opacity: 0; transform: scale(1.3); } }
  .pd-dot { opacity: 0; transform-box: fill-box; transform-origin: 50% 50%; animation: pddot 1.7s ease-out infinite; }
  .pd-d2 { animation-delay: -.8s; }
  @keyframes pddot { 0% { opacity: 0; transform: scale(.2); } 20% { opacity: .9; } 70%, 100% { opacity: 0; transform: scale(1.2); } }
  .splash { position: absolute; width: calc(var(--ph) * .075); margin-left: calc(var(--ph) * -.037); animation: splash .72s linear forwards; pointer-events: none; }
  .splash svg { display: block; width: 100%; height: auto; }
  @keyframes splash {
    0% { transform: translate(0, 0) scale(.5); opacity: 0; animation-timing-function: cubic-bezier(.2, .6, .4, 1); }
    12% { opacity: 1; }
    52% { transform: translate(calc(var(--dx) * .55), var(--dy)) scale(1); opacity: 1; animation-timing-function: cubic-bezier(.6, 0, .8, .4); }
    100% { transform: translate(var(--dx), 0) scale(.8); opacity: 0; }
  }
  /* Papierschiffchen auf der Pfütze: Das Skript schiebt es (transform), die Zeichnung darin schaukelt */
  .pboat { position: absolute; bottom: 38%; opacity: 0; will-change: transform; }
  .pboat.afloat { opacity: 1; }
  .pboat svg { display: block; width: 100%; height: auto; overflow: visible; transform-origin: 50% 85%; animation: pbob 1.5s ease-in-out infinite alternate; }
  @keyframes pbob { from { transform: rotate(-5deg) translateY(1px); } to { transform: rotate(5deg); } }

  /* Schnee-Pika: Schnee festklopfen (.spat), jede Schicht wächst über --sg von unten heran; .now: schon gebaut */
  .spat .paws { display: inline; transform-box: fill-box; animation: spat .34s ease-in-out infinite alternate; }
  @keyframes spat { from { transform: translate(12px, 4px); } to { transform: translate(15px, -1.5px); } }
  .spat .face { transform: translate(2.4px, 1.2px); }
  .spl { transform-box: fill-box; transform-origin: 50% 100%; transform: scale(0); transition: transform var(--sg, 1.2s) cubic-bezier(.3, 1.15, .5, 1); }
  .sp4 { transform-origin: 50% 35%; }
  .snowp.now .spl { transition: none; }
  .snowp.s1 .sp1, .snowp.s2 .sp2, .snowp.s3 .sp3, .snowp.s4 .sp4 { transform: none; }
  .snowp { transform-origin: 50% 100%; }
  .snowp.off { transform: scaleY(.35); transition: opacity .6s, transform .6s ease-in; }

  /* Bewegung reduzieren: Nichts kreist, pendelt oder schaukelt von selbst; man sieht trotzdem, was er tut (Reifen
     schräg um den Bauch, Jo-Jo an halber Schnur, drei Beeren im Bogen). Steine und Schnee erscheinen ohne Federn. */
  @media (prefers-reduced-motion: reduce) {
    .hula-go .hoop { animation: none; transform: rotate(-6deg); }
    .hula-go .hop, .plait .dpl, .plait .dpr, .pd-dot, .pboat svg, .jug-go .arms ellipse, .stonep.wob > svg, .spat .paws { animation: none; }
    .spat .paws { transform: translate(13px, 2px); }
    .yo-go .ydisc { animation: none; transform: translateY(15px); }
    .yo-go .ystr { animation: none; transform: scaleY(.56); }
    .jug-go .jb, .jug-go .jb circle { animation: none; }
    .jug-go .jb2 { transform: translate(23.5px, -37px); }
    .jug-go .jb3 { transform: translate(47px, -4px); }
    .stn, .stonep.fall .stn, .spl { transition-timing-function: ease-out; }
  }
  `;
// ==================== Ende Aktivitäten ====================

export { STYLE_ACT };
