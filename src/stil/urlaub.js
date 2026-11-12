// Stil des Urlaubs: Schild an der Tür, Postkarte, der verreiste Pika

const STYLE_URLAUB = `
  /* Verreist: nicht zu sehen (Tippen geht durch, er ist ja nicht da) */
  .pika.fort { visibility: hidden; }
  .ursign, .urcard { position: absolute; pointer-events: none; }
  .ursign { transform-origin: 50% 4%; animation: ursw 5s ease-in-out infinite; }
  .ursign.in { animation: urin .7s cubic-bezier(.3, 1.5, .5, 1), ursw 5s ease-in-out .7s infinite; }
  .ursign.out { animation: none; transition: opacity .8s, transform .8s; opacity: 0; transform: translateY(-30%) rotate(-8deg); }
  .ursign svg, .urcard svg { display: block; width: 100%; height: auto; overflow: visible; }
  .urcard { transform: rotate(-9deg); filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, .3)); transition: opacity .8s; }
  .urcard.in { animation: urcin .8s cubic-bezier(.3, 1.4, .5, 1); }
  .urcard.out { opacity: 0; }
  .ursign.wig { animation: urwig .6s; }
  @keyframes ursw { 50% { transform: rotate(2.5deg); } }
  @keyframes urin { from { transform: translateY(-40%) rotate(-12deg); opacity: 0; } }
  @keyframes urcin { from { transform: translateY(-30%) rotate(-30deg) scale(.6); opacity: 0; } }
  @keyframes urwig { 25% { transform: rotate(-7deg); } 60% { transform: rotate(5deg); } }
  .night .ursign, .night .urcard { filter: brightness(.7) saturate(.8); }
  @media (prefers-reduced-motion: reduce) { .ursign, .ursign.in, .urcard.in, .ursign.wig { animation: none; } }
  `;

export { STYLE_URLAUB };
