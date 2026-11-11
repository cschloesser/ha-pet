// Stil des Haus-Boten

const STYLE_BOTE = `
  .props { position: absolute; inset: 0; pointer-events: none; }
  /* Requisit: left/top/width setzt das Skript, Boden der Grafik knapp unter der Bodenlinie (im Gras) */
  .hb { position: absolute; left: 0; top: 0; pointer-events: auto; cursor: pointer; transition: opacity .5s; }
  .hb.hb-placed { transition: left .5s ease, top .5s ease, width .5s ease, opacity .5s; }
  .hb::after { content: ''; position: absolute; inset: -8px -4px 0; }
  /* Vorn auf dem Wiesenstreifen: näher am Betrachter, also vor Pika, Gras und Heu (unter Regen, Statusleiste, Futterknopf) */
  .hb.hb-fr, .hb-bar { z-index: var(--z-front); }
  .hb.hb-bye { opacity: 0; pointer-events: none; }
  /* Der Tageszeit-Filter liegt nur auf der Grafik: Das rote Ausrufezeichen (.hb-a) bleibt auch nachts rot */
  .hb-i { transform-origin: 50% 100%; transition: filter 2.5s; }
  .hb svg { display: block; width: 100%; height: auto; overflow: visible; }
  .shade .hb-i, .shade .hb-carry, .shade .hb-stick, .shade .hb-dipw { filter: brightness(var(--lb, 1)) saturate(var(--ls, 1)); }
  /* Fertig: hüpft alle paar Sekunden kurz (Aufmerksamkeit), Antippen durch den Pika wackelt. Einblenden und
     Antippen haben Vorrang (die Regel greift dann nicht), im Schlaf und nachts ruht es. */
  .hb.hb-done:not(.hb-live):not(.hb-boop):not(.hb-in):not(.hb-still) .hb-i { animation: hb-nudge 4s ease-in-out infinite; }
  .hb.hb-in .hb-i { animation: hb-pin .55s cubic-bezier(.3, 1.6, .5, 1) both; }
  .hb.hb-boop .hb-i { animation: hb-boop .45s ease-out; }
  @keyframes hb-pin { from { transform: scale(.4); opacity: 0; } }
  @keyframes hb-nudge {
    0%, 78%, 100% { transform: none; }
    84% { transform: scale(1.05, .94); }
    90% { transform: translateY(-5%) scale(.97, 1.04); }
    95% { transform: scale(1.02, .98); }
  }
  @keyframes hb-boop { 30% { transform: scale(1.06, .92) rotate(-2deg); } 65% { transform: scale(.97, 1.04) rotate(1.5deg); } }
  .hb.hb-pause *:not(.hb-a) { animation-play-state: paused !important; }
  /* Pika schläft (oder Nacht und das Gerät läuft nicht): Endlos-Animationen anhalten, spart dem Tablet das
     ständige Neuzeichnen unter dem Nachtfilter */
  .hb.hb-still .hb-i *, .hb.hb-still .hb-a, .hb-bar.hb-still b { animation-play-state: paused !important; }
  .hb .hb-gone { opacity: 0; transition: opacity .7s; }
  /* Störung oder Hilfe nötig: rotes Ausrufezeichen */
  .hb-a {
    position: absolute; right: -4%; top: -8%; display: none; width: calc(var(--H) * .07); height: calc(var(--H) * .07);
    border-radius: 50%; background: #e8584e; color: #fff; font-weight: 800; font-size: calc(var(--H) * .05);
    line-height: calc(var(--H) * .07); text-align: center; box-shadow: 0 1px 3px rgba(0, 0, 0, .25);
    animation: hb-alert .9s ease-in-out infinite alternate;
  }
  .hb.hb-alert .hb-a { display: block; }
  @keyframes hb-alert { to { transform: translateY(-15%) scale(1.08); } }
  /* Waschzuber: Schaum wogt, Blasen steigen, nasse Wäsche tropft */
  .hb-foam { transform-box: fill-box; transform-origin: 50% 100%; }
  .hb-run .hb-foam { animation: hb-foam 1.6s ease-in-out infinite alternate; }
  @keyframes hb-foam { to { transform: scale(1.04, 1.12); } }
  .hb-bubs circle {
    opacity: 0; fill: rgba(255, 255, 255, .55); stroke: #8fc0d8; stroke-width: .6;
    transform-box: fill-box; transform-origin: center; animation: hb-bub 2.6s ease-out infinite;
  }
  @keyframes hb-bub {
    0% { transform: translate(0, 0) scale(.4); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(2px, -13px) scale(1.15); opacity: 0; }
  }
  .hb-drip { fill: #8fd0f0; stroke: #5f9fc0; stroke-width: .4; opacity: 0; transform-box: fill-box; transform-origin: 50% 0; animation: hb-drip 1.6s ease-in infinite; }
  @keyframes hb-drip {
    0% { transform: scale(.2); opacity: 0; }
    25% { transform: scale(1); opacity: 1; }
    100% { transform: translateY(9px); opacity: 0; }
  }
  .hb-busy .hb-paddle, .hb-busy .hb-dip { display: none; }
  /* Wäscheleine: Stücke wehen mit dem Wind (--hbw Winkel samt Richtung, --hbs Tempo) */
  .hb-cs { transform-box: fill-box; transform-origin: 50% 0; animation: hb-sway var(--hbs, 2.4s) ease-in-out infinite alternate; }
  @keyframes hb-sway {
    from { transform: rotate(calc(var(--hbw, 5deg) * -.3)); }
    to { transform: rotate(var(--hbw, 5deg)); }
  }
  .hb-cl { transform-box: fill-box; transform-origin: 50% 0; transition: opacity .25s, transform .4s cubic-bezier(.3, 1.6, .5, 1); }
  .hb-hang .hb-cl:not(.on) { opacity: 0; transform: translateY(-3px) scale(.4); }
  .hb-empty:not(.hb-hang) .hb-lau { display: none; }
  .hb-lau { transition: opacity .7s; }
  .hb-emptied .hb-lau { opacity: 0; }
  /* Trockner: Trommel dreht sich, Socken purzeln, warme Luft steigt; fertig dampfen die Handtücher */
  .hb-rot, .hb-sock { transform-box: fill-box; transform-origin: 50% 50%; }
  .hb-run .hb-rot { animation: hb-spin 2.6s linear infinite; }
  .hb-run .hb-sock { animation: hb-spin 1.2s linear infinite; }
  @keyframes hb-spin { to { transform: rotate(360deg); } }
  .hb-heat > g, .hb-steam > g { opacity: 0; transform-box: fill-box; animation: hb-heat 2.2s ease-out infinite; }
  .hb-heat path { stroke: #f3a25a; stroke-width: 1.1; }
  .hb-steam > g { animation-duration: 2.8s; }
  .hb-steam path { stroke: #fff; stroke-width: 1.3; }
  .hb-steam path.hb-rim { stroke: rgba(90, 64, 48, .35); stroke-width: 2.3; }
  @keyframes hb-heat {
    0% { transform: translateY(2px); opacity: 0; }
    35% { opacity: .9; }
    100% { transform: translateY(-7px); opacity: 0; }
  }
  .hb-towels > g { transition: opacity .6s; }
  /* Spülschüssel: Teller taucht ein; fertig funkelt der Tellerstapel */
  .hb-dip { transform-box: fill-box; transform-origin: 50% 50%; }
  .hb-run .hb-dip { animation: hb-dip 2.8s ease-in-out infinite; }
  @keyframes hb-dip { 0%, 100% { transform: none; } 45% { transform: translateY(7px) rotate(-8deg); } 62% { transform: translateY(6px) rotate(6deg); } }
  .hb-tw { fill: #fff6b8; transform-box: fill-box; transform-origin: center; animation: hb-twk 1.8s ease-in-out infinite;
    stroke: rgba(240, 190, 70, .9); stroke-width: 2.4; stroke-linejoin: round; paint-order: stroke; }
  @keyframes hb-twk { 0%, 100% { transform: scale(0); opacity: 0; } 40% { transform: scale(1) rotate(35deg); opacity: 1; } 70% { transform: scale(.25); opacity: .3; } }
  .hb-plates > g { transition: opacity .6s; }

  /* Ebenen vor dem Pika: Werkzeug und Getragenes, Fähnchen über Statusleiste und Futterknopf.
     Der Fortschrittsbalken liegt wie sein Requisit: hinten unter dem Pika (über dem Gras), vorn davor. */
  .hb-f, .hb-t, .hb-bars { position: absolute; inset: 0; pointer-events: none; }
  .hb-f { z-index: var(--z-front); }
  .hb-t { z-index: var(--z-tag); }
  .hb-bar {
    position: absolute; left: 0; top: 0; height: clamp(3px, calc(var(--H) * .018), 6px); border-radius: 99px; pointer-events: none;
    background: rgba(255, 255, 255, .78); box-shadow: 0 0 0 1px rgba(90, 64, 48, .4); overflow: hidden;
    opacity: 0; transition: opacity .5s, left .5s, top .5s, width .5s;
  }
  .hb-bar.on { opacity: 1; }
  .hb-bar b { display: block; height: 100%; width: var(--p, 0%); border-radius: inherit; background: var(--bc, #5fb9de); transition: width .8s; }
  .hb-bar.ind b { width: 34%; animation: hb-ind 1.5s ease-in-out infinite alternate; }
  .hb-bar.pause b { opacity: .45; animation-play-state: paused; }
  @keyframes hb-ind { from { transform: translateX(-15%); } to { transform: translateX(210%); } }
  .night .hb-bar { background: rgba(190, 200, 225, .55); }
  .hb-stick {
    position: absolute; width: calc(var(--H) * .014); margin-left: calc(var(--H) * -.007); border-radius: 99px;
    background: linear-gradient(90deg, #a07a58, #d8b48e 45%, #a07a58); box-shadow: 0 0 0 1px #5a4030;
    transform-origin: 50% 100%; transform: rotate(var(--ba)); animation: hb-stick .8s ease-in-out infinite;
  }
  @keyframes hb-stick { 0%, 100% { transform: rotate(calc(var(--ba) - 8deg)); } 50% { transform: rotate(calc(var(--ba) + 8deg)); } }
  .hb-ring {
    position: absolute; width: calc(var(--H) * .065); height: calc(var(--H) * .026); margin: calc(var(--H) * -.014) 0 0 calc(var(--H) * -.0325);
    border-radius: 50%; background: radial-gradient(#fff 50%, #e6f2f8); box-shadow: 0 0 0 1px #c9dde8;
    animation: hb-foam .8s ease-in-out infinite alternate;
  }
  .hb-bbl {
    position: absolute; width: calc(var(--H) * .022); height: calc(var(--H) * .022); margin: calc(var(--H) * -.011);
    border-radius: 50%; border: 1px solid rgba(120, 175, 205, .9); background: rgba(255, 255, 255, .55);
    opacity: 0; animation: hb-bblup 1.1s ease-out forwards;
  }
  @keyframes hb-bblup {
    0% { transform: translate(0, 0) scale(.4); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--dx, 0px), calc(var(--H) * -.09)) scale(1.1); opacity: 0; }
  }
  /* Seifenblase, die auf der Nase landet (Unterkante auf dem Punkt) */
  .hb-soap { position: absolute; left: 0; top: 0; width: 0; height: 0; }
  .hb-soap i {
    position: absolute; display: block; width: calc(var(--H) * .055); height: calc(var(--H) * .055);
    left: calc(var(--H) * -.0275); top: calc(var(--H) * -.052); border-radius: 50%;
    background: radial-gradient(circle at 32% 30%, rgba(255, 255, 255, .95) 0 12%, rgba(255, 255, 255, .2) 30%, rgba(170, 220, 255, .25) 65%, rgba(255, 170, 230, .55) 100%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .8), 0 0 2px rgba(120, 170, 210, .6);
    animation: hb-wob 1.1s ease-in-out infinite alternate;
  }
  .hb-soap.pop i { animation: hb-pop .28s ease-out forwards; }
  @keyframes hb-wob { to { transform: scale(1.07, .94); } }
  @keyframes hb-pop { to { transform: scale(1.8); opacity: 0; } }
  /* Was der Pika trägt: folgt ihm (translate setzt das Skript), Mitte des Bilds auf dem Haltepunkt */
  .hb-carry { position: absolute; left: 0; top: 0; width: 0; height: 0; transition: opacity .35s; }
  .hb-carry > i { position: absolute; display: block; width: var(--cw); left: calc(var(--cw) * -.5); top: calc(var(--cw) * -.4); }
  .hb-carry svg { display: block; width: 100%; height: auto; overflow: visible; }
  .hb-carry.hb-gone { opacity: 0; }
  .hb-carry.hb-shine > i { animation: hb-plw .26s ease-in-out infinite alternate; }
  @keyframes hb-plw { from { transform: rotate(-14deg); } to { transform: rotate(14deg); } }
  /* Teller eintauchen: der Rahmen schneidet an der Wasserlinie ab */
  .hb-dipw { position: absolute; overflow: hidden; }
  .hb-dipw > i { position: absolute; display: block; }
  .hb-dipw svg { display: block; width: 100%; height: auto; }

  /* Haltungen des Pika bei der Arbeit */
  .pika.hb-hold .paws, .pika.hb-stir .paws, .pika.hb-polish .paws, .pika.hb-pat .paws { display: inline; }
  /* Bei Regen hält eine Pfote das Blatt (.brolly): dann arbeitet nur die andere, nie drei Pfoten.
     Gilt für jede Haltung, die .paws zeigt (Arbeit, Putzen, Fest-Aktionen) */
  .pika.wet:not(.inside) .paws ellipse + ellipse { display: none; }
  .pika.hb-stir .paws { transform-box: fill-box; animation: hb-stirp .8s linear infinite; }
  @keyframes hb-stirp { 0%, 100% { transform: translate(-1.6px, 0); } 25% { transform: translate(0, 1.2px); } 50% { transform: translate(1.6px, 0); } 75% { transform: translate(0, -1.2px); } }
  .pika.hb-stir .hop { animation: hb-stir .8s ease-in-out infinite; }
  @keyframes hb-stir { 50% { transform: translateX(1.5%) scale(1.03, .97); } }
  .pika.hb-polish .paws { transform-box: fill-box; animation: hb-pol .24s ease-in-out infinite alternate; }
  @keyframes hb-pol { from { transform: translateX(-2px); } to { transform: translateX(2px); } }
  .pika.hb-pat .hop { animation: hb-pat .45s ease-in-out; }
  @keyframes hb-pat { 40% { transform: translateX(4%) scale(1.04, .92); } }
  .pika.hb-drum .face { animation: hb-drumf 1.3s linear infinite; }
  @keyframes hb-drumf { 0%, 100% { transform: translate(2.2px, 0); } 25% { transform: translate(0, 2.2px); } 50% { transform: translate(-2.2px, 0); } 75% { transform: translate(0, -2.2px); } }
  /* Kopf zum Betrachter gedreht */
  .pika.hb-look .face { transform: translate(-3.5px, .5px); }

  /* Fähnchen wie beim Flugzeug: Gerätename und Stand */
  .hb-tag {
    position: absolute; left: 0; top: 0; padding: .12em .7em .18em; border-radius: .9em;
    font-size: clamp(10px, calc(var(--H) * .05), 14px); line-height: 1.35; white-space: nowrap;
    max-width: calc(100% - 8px); box-sizing: border-box;
    color: #4a3a2c; background: rgba(255, 255, 255, .86); box-shadow: 0 1px 3px rgba(0, 0, 0, .15);
    opacity: 0; transform: translateY(4px); pointer-events: none; cursor: pointer;
    transition: opacity .25s, transform .25s, background 2.5s, color 2.5s;
  }
  .hb-tag.open { opacity: 1; transform: none; pointer-events: auto; }
  .hb-tag b { font-weight: 700; letter-spacing: .02em; }
  /* zu lang für eine schmale Karte: Zeilen mit … kürzen statt links abschneiden */
  .hb-tag b, .hb-tag .more { display: block; overflow: hidden; text-overflow: ellipsis; }
  .hb-tag .more { font-size: .9em; opacity: .85; }
  .night .hb-tag { color: #e4e9f6; background: rgba(22, 32, 62, .78); }
  `;

export { STYLE_BOTE };
