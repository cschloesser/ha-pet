// Stil für den Kaffee

const STYLE_COFFEE = `
  .cup, .cfoam, .cup > g > g, .cup .ttag, .cup .cst { display: none; }
  .coffee .cup { display: inline; }
  .ck-glass .cup .k-glass, .ck-capp .cup .k-capp, .ck-esp .cup .k-esp, .ck-mug .cup .k-mug, .ck-tea .cup .ttag { display: inline; }
  .ck-milk .cup .cof { fill: #f7efe2; }
  .ck-tea .cup .lqs { fill: #c98a3a; }
  /* Glas sinkt (Inhalt kleiner), Tassen: Schaum/Crema verschwindet und gibt den dunklen Rest frei */
  .cup .lq { transform-box: fill-box; transform-origin: 50% 100%; transform: scaleY(var(--lv, 1)); transition: transform 1.2s ease; }
  .cup .lqs { opacity: var(--lv, 1); transition: opacity 1.2s; }
  /* Schluck: Gefäß samt Pfoten an den Mund, Augen zu */
  .cup { transform-box: view-box; transform-origin: 92px 74px; transition: transform .45s cubic-bezier(.45, 0, .4, 1); }
  .pika.ck-glass { --cupy: -8px; }
  .pika.ck-capp { --cupy: -14px; }
  .pika.ck-esp { --cupy: -18px; }
  .pika.ck-mug, .pika.ck-tea { --cupy: -10.5px; }
  .sip .cup { transform: translate(-1px, var(--cupy, -9px)) rotate(-14deg); }
  .sip .eye { display: none; }
  .sip .seye { display: inline; }
  .coffee:not(.sip) .face { transform: translate(.6px, 1.4px); }
  .foam .cfoam { display: inline; }
  .lick .omouth { display: inline; }
  /* Dampf nur, solange es heiß ist (und nur dann animiert) */
  .coffee.hot .cup .cst { display: inline; }
  .coffee.hot .cup .cst path { opacity: 0; transform-box: fill-box; animation: cst 2.6s ease-out infinite; }
  .coffee.hot .cup .cst path + path { animation-delay: 1.3s; }
  @keyframes cst {
    from { opacity: 0; transform: translateY(1.5px) scaleY(.8); }
    35% { opacity: .75; }
    to { opacity: 0; transform: translateY(-6px) scaleY(1.15); }
  }
  /* Bei Regen hält die rechte Pfote den Blattschirm */
  .pika.wet:not(.inside) .cup .cpr { display: none; }
  `;

export { STYLE_COFFEE };
