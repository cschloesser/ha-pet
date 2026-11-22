// Album 2: Stil der Kamera (src/karte/album2-camera.js). Die Kamera ist ein .gt in .gifts (Platz, Breite und Ebene
// setzt das Skript), das Sofortbild ein eigenes Element daneben in .gifts, der Blitz zwei Teilchen in .fx. Wer selbst
// einen Übergang hat, nennt filter darin mit (das Licht der Dämmerung, siehe STYLE_GIFT).

const STYLE_A2_CAMERA = `
  /* Kamera auf dem Stativ; spiegeln (.a2left) innen, damit das Aufploppen von unten bleibt */
  .gifts > .a2-camera { bottom: calc(var(--gb) - 2px); transition: opacity .4s, filter 2.5s; }
  .a2-camera.a2out { opacity: 0; }
  .a2-camera .a2cmw { transform-origin: 50% 100%; }
  .a2-camera.a2pop .a2cmw { animation: a2cmpop .6s cubic-bezier(.3, 1.6, .5, 1); }
  @keyframes a2cmpop { from { transform: scale(.3, .2); opacity: 0; } 40% { opacity: 1; } }
  .a2-camera .a2cmleg { transform-box: view-box; transform-origin: 18px 23px; }
  .a2-camera.a2pop .a2cmleg { animation: a2cmleg .5s .15s cubic-bezier(.3, 1.4, .5, 1) backwards; }
  @keyframes a2cmleg { from { transform: scaleY(.25); } }
  .a2-camera.a2left .a2cmf { transform: scaleX(-1); }
  /* Safari schneidet ein Element mit Filter (Licht der Dämmerung, golden) an der Box des <svg> ab (siehe 0.40.1): Der
     schräg gestellte Kopf ragt hinten bis 4 Einheiten links und 1 oben aus der viewBox 40 × 40, das Bild mit den
     Pfoten 2,6 seitlich aus 20. Rand als padding mit gleich großem negativem margin, die Zeichnung bleibt, wo sie war */
  .a2-camera svg { padding: 5% 12% 0; margin: -5% -12% 0; pointer-events: none; }
  .a2cmph svg { padding: 0 14%; margin: 0 -14%; }
  /* Kopf neigt sich zum Motiv (--a2cmt), Knopf, Lämpchen des Selbstauslösers, Blitzfenster */
  .a2-camera .a2cmh { transform-box: view-box; transform-origin: 18px 22px; transform: rotate(var(--a2cmt, 0deg)); transition: transform .7s ease-in-out; }
  .a2-camera .a2cmb { transform-box: view-box; transition: transform .08s; }
  .a2-camera.snap .a2cmb { transform: translateY(.9px); }
  .a2-camera .a2cmt { fill: #8a3a34; }
  .a2-camera.timer .a2cmt { animation: a2cmblink .75s steps(1) infinite; }
  @keyframes a2cmblink { 0% { fill: #ff6b5e; } 50% { fill: #8a3a34; } }
  .a2-camera .a2cmfw { transition: fill .12s; }
  .a2-camera.glow .a2cmfw { fill: #fff; }
  /* Bewegung reduzieren: kein Schwenk, das Lämpchen leuchtet still, das Blitzfenster glimmt langsam auf und ab */
  .a2-camera.still .a2cmh { transition: none; }
  .a2-camera.still.timer .a2cmt { animation: none; fill: #ff6b5e; }
  .a2-camera.still .a2cmfw { transition: fill .8s ease-in-out; }
  .a2-camera.still.glow .a2cmfw { fill: #fffbe6; }
  /* Blitz: ein einzelner Lichtpuls am Fenster und ein schwacher über der Szene (kein Flackern) */
  .a2cmbu { position: absolute; width: calc(var(--H) * .34); height: calc(var(--H) * .34); margin: calc(var(--H) * -.17);
    border-radius: 50%; pointer-events: none; opacity: 0;
    background: radial-gradient(circle, #fff 0, rgba(255, 252, 235, .9) 22%, rgba(255, 250, 225, 0) 68%); animation: a2cmbu .42s ease-out; }
  @keyframes a2cmbu { from { transform: scale(.25); opacity: 1; } to { transform: scale(1.25); opacity: 0; } }
  .a2cmov { position: absolute; inset: 0; background: #fffdf2; pointer-events: none; opacity: 0; animation: a2cmov .45s ease-out; }
  @keyframes a2cmov { from { opacity: .28; } to { opacity: 0; } }
  /* Sofortbild: aus dem Schlitz, in die Pfoten (Übergang von Platz und Größe), entwickelt sich, blendet aus */
  .gifts > .a2cmph { position: absolute; transform-origin: 50% 100%; pointer-events: none;
    transition: left .45s ease-out, top .45s ease-out, width .45s ease-out, transform .45s ease-out, opacity .5s, filter 2.5s; }
  .gifts > .a2cmph.still { transition: opacity .5s, filter 2.5s; }
  .a2cmph .a2cmpic { opacity: 0; transition: opacity 2.2s ease-in; }
  .a2cmph.dev .a2cmpic { opacity: 1; }
  .a2cmph .a2cmpw { display: none; }
  .a2cmph.a2cmheld .a2cmpw { display: inline; }
  .gifts > .a2cmph.away { opacity: 0; }
  .a2cmph .a2cmgl path { transform-box: fill-box; transform-origin: center; animation: a2cmgl 1.4s ease-in-out infinite; }
  .a2cmph .a2cmgl g:nth-child(2) path { animation-delay: -.5s; }
  .a2cmph .a2cmgl g:nth-child(3) path { animation-delay: -.9s; }
  .a2cmph .a2cmgl g:nth-child(4) path { animation-delay: -1.15s; }
  @keyframes a2cmgl { 0%, 100% { transform: scale(.35); opacity: .35; } 50% { transform: scale(1); opacity: 1; } }
  .a2cmph.still .a2cmgl path { animation: none; }
  /* Er hält das Bild mit beiden Pfoten (die zeichnet das Bild): Blatt-Schirm und Maul sind solange leer */
  .pika.a2cm-hold .brolly, .pika.a2cm-hold .mfood { display: none; }
  /* Am Riemen im Maul: der Stiel des Blatt-Schirms stünde mitten durch die Kamera */
  .pika.a2cm-carry .brolly { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .a2-camera.a2pop .a2cmw, .a2-camera.a2pop .a2cmleg, .a2cmbu, .a2cmov, .a2cmph .a2cmgl path { animation: none !important; }
    .a2cmbu, .a2cmov { display: none; }
    .a2-camera .a2cmh { transition: none; }
    .a2-camera.timer .a2cmt { animation: none; fill: #ff6b5e; }
  }
`;

export { STYLE_A2_CAMERA };
