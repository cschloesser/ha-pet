// Stil der Haus-Signale: Mülltonne, Saugroboter, Garderobe an der Tür

const STYLE_SIG = `
  /* Tonne und Saugroboter stehen vorn wie die Haushaltsgeräte (vor dem Pika), die Garderobe hängt an der Tür */
  .sig-bin, .sig-vac { position: absolute; left: 0; top: 0; z-index: var(--z-front); }
  .sig-bin { pointer-events: auto; cursor: pointer; transition: left .6s ease, opacity .6s; }
  .sig-bin::after { content: ''; position: absolute; inset: -8px -6px -2px; }
  .sig-bin.in { animation: sig-in .6s cubic-bezier(.3, 1.5, .5, 1); }
  .sig-bin.out { opacity: 0; pointer-events: none; }
  .sig-bin.boop > svg { animation: hb-boop .45s ease-out; }
  .sig-vac { pointer-events: none; transition: opacity .6s; }
  .sig-vac.out { opacity: 0; }
  .sig-vac > i { display: block; transform-origin: 50% 100%; }
  .sig-vac.flip > i { transform: scaleX(-1); }
  .sig-vac.drive .sig-brush { animation: sig-brush .25s linear infinite; transform-box: fill-box; transform-origin: 100% 0; }
  .sig-vac.stuck .sig-led { fill: #e8584e; animation: sig-blink .8s steps(2) infinite; }
  .sig-vac.stop .sig-led { fill: #f2b632; }
  .sig-bin svg, .sig-vac svg, .sig-wear svg { display: block; width: 100%; height: auto; overflow: visible; }
  .sig-wear { position: absolute; left: 0; top: 0; pointer-events: none; transition: opacity .6s; }
  .sig-wear.in { animation: sig-in .6s cubic-bezier(.3, 1.5, .5, 1); }
  .sig-wear.out { opacity: 0; }
  .sig-wear.hang { transform-origin: 50% 0; animation: sig-sway 5s ease-in-out infinite; }
  .sig-hold { position: absolute; pointer-events: none; z-index: var(--z-front); }
  .sig-hold svg { display: block; width: 100%; height: auto; }
  @keyframes sig-in { from { transform: translateY(-25%) scale(.5); opacity: 0; } }
  @keyframes sig-sway { 50% { transform: rotate(2deg); } }
  @keyframes sig-brush { to { transform: rotate(360deg); } }
  @keyframes sig-blink { 50% { opacity: .2; } }
  .night .sig-bin svg, .night .sig-vac svg, .night .sig-wear svg { filter: brightness(.7) saturate(.8); }
  .paused .sig-vac, .paused .sig-vac * { animation-play-state: paused !important; }
  @media (prefers-reduced-motion: reduce) { .sig-wear.hang, .sig-vac.drive .sig-brush, .sig-bin.in, .sig-wear.in { animation: none; } }
  `;

export { STYLE_SIG };
