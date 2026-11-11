// Stil der Himmel-Extras: Sternschnuppen und Glühwürmchen

const STYLE_SKY = `
  .meteors { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  /* Sternschnuppe: Hülle steht am Startpunkt und ist in Flugrichtung gedreht, Kopf und Schweif laufen --len weit */
  .met { position: absolute; width: 0; height: 0; transform: rotate(var(--a)); }
  .met b { position: absolute; top: 0; right: 0; animation: var(--d) linear forwards; }
  .met .mt {
    width: var(--tail); height: 1.5px; margin-top: -.75px; border-radius: 1px; transform-origin: 100% 50%;
    background: linear-gradient(to right, rgba(190, 210, 255, 0), rgba(225, 235, 255, .75) 75%, rgba(255, 255, 255, .95));
    animation-name: met-tail;
  }
  .met .mh {
    width: 3px; height: 3px; margin: -1.5px -1.5px 0 0; border-radius: 50%; background: #fff;
    box-shadow: 0 0 4px 1px rgba(215, 228, 255, .9); animation-name: met-head;
  }
  .met.bolide .mt {
    height: 2.5px; margin-top: -1.25px;
    background: linear-gradient(to right, rgba(255, 230, 190, 0), rgba(255, 244, 220, .8) 70%, rgba(255, 255, 255, 1));
  }
  .met.bolide .mh {
    width: 5px; height: 5px; margin: -2.5px -2.5px 0 0; box-shadow: 0 0 8px 3px rgba(225, 255, 235, .95);
    animation-name: met-bolide;
  }
  @keyframes met-tail {
    0% { transform: translateX(0) scaleX(0); opacity: 0; }
    12% { opacity: 1; }
    45% { transform: translateX(calc(var(--len) * .45)) scaleX(1); }
    80% { opacity: .9; }
    100% { transform: translateX(var(--len)) scaleX(.45); opacity: 0; }
  }
  @keyframes met-head {
    0% { transform: translateX(0) scale(.4); opacity: 0; }
    12% { transform: translateX(calc(var(--len) * .12)) scale(1); opacity: 1; }
    85% { opacity: 1; }
    100% { transform: translateX(var(--len)) scale(.5); opacity: 0; }
  }
  /* Bolide: leuchtet kurz vor dem Verglühen hell auf */
  @keyframes met-bolide {
    0% { transform: translateX(0) scale(.5); opacity: 0; }
    10% { transform: translateX(calc(var(--len) * .1)) scale(1); opacity: 1; }
    68% { transform: translateX(calc(var(--len) * .68)) scale(1.2); }
    78% { transform: translateX(calc(var(--len) * .78)) scale(2.6); opacity: 1; }
    100% { transform: translateX(var(--len)) scale(.4); opacity: 0; }
  }
  .mflash { position: absolute; inset: 0; opacity: 0; animation: met-flash .7s ease-out forwards; }
  @keyframes met-flash { 30% { opacity: 1; } 100% { opacity: 0; } }

  /* Glühwürmchen: Ebene blendet sanft ein und aus (Sommernacht voll, späte Dämmerung schwach) */
  .ff { position: absolute; inset: 0; pointer-events: none; opacity: 0; visibility: hidden; transition: opacity 3s, visibility 0s linear 3s; }
  .ff.on, .ff.dim { visibility: visible; transition: opacity 3s, visibility 0s; }
  .ff.on { opacity: 1; }
  .ff.dim { opacity: .45; }
  .ff.rest { display: none; }
  .ff .fl {
    left: 0; top: 0; width: 3.5px; height: 3.5px; margin: -1.75px; opacity: .2; transition: none;
    background: #f3ffa6; box-shadow: 0 0 6px 2px rgba(214, 240, 92, .8);
    animation: ff-drift var(--fd) ease-in-out var(--fdl) infinite, ff-pulse var(--fp) linear var(--fpl) infinite;
  }
  .ff .fl.big { width: 5.5px; height: 5.5px; margin: -2.75px; background: #f8ffbe; box-shadow: 0 0 10px 4px rgba(222, 245, 100, .8); }
  @keyframes ff-drift {
    0%, 100% { transform: translate(var(--x0), var(--y0)); }
    25% { transform: translate(var(--x1), var(--y1)); }
    50% { transform: translate(var(--x2), var(--y2)); }
    75% { transform: translate(var(--x3), var(--y3)); }
  }
  /* unregelmäßig: zwei Aufleuchten verschiedener Stärke, dazwischen fast dunkel */
  @keyframes ff-pulse {
    0%, 100% { opacity: .15; }
    9% { opacity: 1; }
    20% { opacity: .3; }
    46% { opacity: .12; }
    56% { opacity: .7; }
    64% { opacity: .85; }
    78% { opacity: .15; }
  }
  /* Weniger Bewegung gewünscht: Glühwürmchen schweben nicht umher, sie glimmen nur langsam an ihrem Platz;
     Sternschnuppen ohne Aufleuchten des Himmels (und ohne Boliden, siehe _meteorMaybe) */
  @media (prefers-reduced-motion: reduce) {
    .ff .fl { animation: ff-pulse calc(var(--fp) * 3) linear var(--fpl) infinite; transform: translate(var(--x0), var(--y0)); }
    .mflash { display: none; }
  }
  `;

export { STYLE_SKY };
