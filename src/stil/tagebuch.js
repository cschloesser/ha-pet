// Stil des Tagebuchs (Buch und Knopf)

import { GILT_F } from '../grafik/paeckchen.js';

// Fenster über dem Dashboard (eigener Schattenbaum an document.body): Notizbuch mit Klebestreifen und Linien
const STYLE_DIARY = `
  :host { all: initial; }
  .bd {
    position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 14px;
    box-sizing: border-box; background: rgba(40, 28, 18, .5); animation: tbin .2s; -webkit-tap-highlight-color: transparent;
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, "Segoe UI", system-ui, sans-serif));
    --pp: #fbf5e6; --ink: #4a3a2c; --soft: #8a7461; --line: rgba(90, 64, 48, .2); --rand: rgba(232, 88, 78, .32); --tab: rgba(90, 64, 48, .08); --acc: #c9853a;
  }
  .bd.night { --pp: #262d4a; --ink: #ecebf7; --soft: #a9add0; --line: rgba(255, 255, 255, .16); --rand: rgba(255, 150, 150, .3); --tab: rgba(255, 255, 255, .09); --acc: #f2c56b; }
  .sheet {
    position: relative; display: flex; flex-direction: column; width: min(440px, 100%); height: min(640px, 100%);
    box-sizing: border-box; border-radius: 18px; background: var(--pp); color: var(--ink); outline: none;
    box-shadow: 0 14px 44px rgba(0, 0, 0, .4); animation: tbup .3s cubic-bezier(.3, 1.3, .5, 1);
  }
  .sheet::before {
    content: ''; position: absolute; left: 50%; top: -8px; width: 92px; height: 21px; margin-left: -46px; border-radius: 2px;
    background: repeating-linear-gradient(90deg, rgba(242, 143, 177, .85) 0 8px, rgba(246, 201, 69, .85) 8px 16px);
    transform: rotate(-2deg); box-shadow: 0 1px 2px rgba(0, 0, 0, .15);
  }
  .hd { display: flex; align-items: center; gap: 10px; padding: 18px 12px 6px 18px; }
  .hd .bk { flex: none; width: 34px; height: 34px; transform: rotate(-6deg); }
  .hd svg, .ic svg, .chips svg, .t i svg, .row > i svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .ht { flex: 1; min-width: 0; }
  .ht b { display: block; font-size: 19px; font-weight: 800; line-height: 1.2; }
  .ht span { display: block; font-size: 13px; color: var(--soft); margin-top: 1px; }
  button { font: inherit; color: inherit; border: none; background: none; cursor: pointer; padding: 0; }
  button:focus-visible, .page:focus-visible { outline: 2px solid var(--acc); outline-offset: 1px; }
  .x { flex: none; width: 40px; height: 40px; border-radius: 50%; font-size: 18px; color: var(--soft); }
  .x:hover { background: var(--tab); }
  .tabs { display: flex; gap: 6px; padding: 6px 16px 10px; }
  /* Vier Reiter mit verschieden langen Namen: Die Breite folgt dem Text, der Rest wird verteilt */
  .tabs button { flex: 1 1 auto; min-width: 0; height: 38px; padding: 0 6px; border-radius: 12px; font-size: 14px; font-weight: 700; white-space: nowrap; color: var(--soft); background: var(--tab); }
  .tabs button[aria-selected="true"] { background: var(--acc); color: #fff; }
  .night .tabs button[aria-selected="true"] { color: #2a2238; }
  .page {
    flex: 1; min-height: 120px; overflow-y: auto; overscroll-behavior: contain; padding: 4px 18px 16px; border-radius: 0 0 18px 18px;
    scrollbar-width: thin; scrollbar-color: var(--soft) transparent;
  }
  .fazit { margin: 6px 0 10px; font-size: 16px; line-height: 1.45; font-weight: 600; font-style: italic; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
  .chips span { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px 4px 7px; border-radius: 999px; font-size: 13px; font-weight: 700; background: var(--tab); }
  .chips i { display: block; width: 15px; height: 15px; }
  h3 { margin: 16px 0 2px; font-size: 13px; font-weight: 800; letter-spacing: .02em; color: var(--acc); }
  /* Heft-Linien: kein Raster hinter dem Inhalt (es passte beim Scrollen nie zu den Zeilen). Jeder Eintrag bringt seine
     Linie mit: unten gestrichelt, links die rote Randlinie, die über die Einträge einer Tageszeit durchläuft. */
  .e { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 6px; }
  .e > div { padding: 9px 0 9px 10px; border-left: 1.5px solid var(--rand); border-bottom: 1px dashed var(--line); }
  .e > .ic { margin-top: 7px; }
  .ic { display: block; width: 40px; height: 40px; box-sizing: border-box; padding: 7px; border-radius: 50%; background: rgba(255, 255, 255, .75);
    box-shadow: 0 1px 3px rgba(90, 64, 48, .22); transform: rotate(-4deg); color: var(--soft); }
  .e:nth-child(even) .ic { transform: rotate(3deg); }
  .night .ic { background: rgba(255, 255, 255, .14); box-shadow: none; }
  /* Besuch (Kirby, Rufus, Katzumi, FRIEND_ICON): Grundzustand der Figur wie in der Karte, Requisiten und Mimik-Varianten aus */
  .fri .band, .fri .arms, .fri .uke, .fri .brush, .fri .wand, .fri .rope, .fri .rgrip, .fri .bar, .fri .wpaw, .fri .nsm,
  .fri .hats > g, .fri .slg, .fri .gspy, .fri .gcan, .fri .shades, .fri .seye, .fri .heye, .fri .mfood, .fri .paws,
  .fri .cap, .fri .scarf, .fri .brolly, .fri .omouth, .fri .callfx, .fri .blines, .fri .wmouth, .fri .tongue, .fri .yawnm,
  .fri .estar, .fri .sleg, .fri .epaws, .fri .book, .fri .gb, .fri .tab, .fri .kpaw, .fri .bk, .fri .cup, .fri .cfoam,
  .fri .hoop, .fri .yo, .fri .pbl, .fri .jug, .fri .dchain, .fri .dcrown, .fri .pgl, .fri .peb, .fri .sboat, .fri .mim { display: none; }
  .tm { display: block; font-size: 12px; font-weight: 700; color: var(--soft); }
  .e p { margin: 1px 0 0; font-size: 15px; line-height: 1.45; }
  .e.dim p { color: var(--soft); }
  .e.sub p { font-size: 14px; color: var(--soft); }
  .pic { display: block; width: 84px; height: 88px; margin: 8px 0 2px 4px; padding: 5px 5px 14px; background: #fff; border-radius: 2px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, .25); transform: rotate(-3deg); box-sizing: border-box; }
  .wait, .none { margin: 26px 4px; text-align: center; font-size: 15px; line-height: 1.5; color: var(--soft); }
  /* Fuß: Version der Karte, bei Bedarf die letzten Fehler zum Aufklappen */
  .ft { flex: none; padding: 5px 18px 8px; border-top: 1px solid var(--line); font-size: 11px; line-height: 1.4; color: var(--soft); }
  .ft details { margin-top: 2px; }
  .ft summary { cursor: pointer; }
  .ft ul { margin: 4px 0 0; padding-left: 16px; max-height: 96px; overflow-y: auto; overflow-wrap: anywhere; }
  .note { margin: 14px 0 0; font-size: 12px; color: var(--soft); }
  .sign { display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; font-weight: 700; color: var(--soft); }
  .sign i { display: block; width: 18px; height: 18px; transform: rotate(14deg); }
  .sign svg { display: block; width: 100%; height: 100%; }
  .tre { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
  .t { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 9px; align-items: center; padding: 8px; border-radius: 12px; background: var(--tab); }
  .t i, .row > i { display: block; width: 38px; height: 38px; position: relative; }
  .t b, .row b { display: block; font-size: 14px; font-weight: 800; line-height: 1.25; }
  .t span, .row span { display: block; font-size: 12px; line-height: 1.3; color: var(--soft); }
  .t.miss i svg { filter: brightness(0); opacity: .16; }
  .night .t.miss i svg { filter: brightness(0) invert(1); opacity: .2; }
  .t.lv2 i::after { content: ''; position: absolute; right: -2px; bottom: -2px; width: 10px; height: 10px; border-radius: 50%; background: #5fb9de; box-shadow: 0 0 0 2px var(--pp); }
  .t.gilt i svg { filter: ${GILT_F} drop-shadow(0 0 2px rgba(255, 214, 90, .9)); }
  .t.gilt i::after { background: #f2b632; }
  .row { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 11px; align-items: center; padding: 10px 8px 0; }
  .row .w { color: #d9622b; font-weight: 800; }
  .dots { display: inline-flex; gap: 3px; margin-left: 6px; vertical-align: -1px; }
  .dots u { width: 9px; height: 9px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(90, 64, 48, .35); }
  /* Gute Tage: sieben Punkte bis zum goldenen Päckchen */
  .d7 { display: flex !important; gap: 4px; margin: 3px 0 2px; }
  .d7 u { width: 11px; height: 11px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--acc); }
  .d7 u.on { background: #f2b632; box-shadow: inset 0 0 0 1px rgba(90, 64, 48, .35); }
  /* Ferien bei Pino: Kasten mit Knöpfen (Heute) und die Postkarte im Eintrag der Rückkehr */
  .ur { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 10px; align-items: start; margin: 16px 0 6px; padding: 12px;
    border-radius: 14px; background: var(--tab); }
  .ur.on { margin-top: 6px; background: rgba(217, 168, 115, .24); }
  .ur > i { display: block; width: 46px; margin-top: 2px; }
  .ur > i svg { display: block; width: 100%; height: auto; }
  .ur b { display: block; font-size: 15px; font-weight: 800; line-height: 1.25; }
  .ur span { display: block; margin-top: 2px; font-size: 13px; line-height: 1.4; color: var(--soft); }
  .ur .bt { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 9px; }
  .ur button { min-height: 38px; padding: 0 14px; border-radius: 12px; background: var(--acc); color: #fff; font-size: 14px; font-weight: 800; }
  .night .ur button { color: #2a2238; }
  .ur button.no { background: none; color: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .ur button:disabled { opacity: .45; cursor: default; }
  .ur .nt { font-size: 12px; }
  .post { display: block; width: 150px; margin: 8px 0 2px 2px; transform: rotate(-3deg); filter: drop-shadow(0 2px 4px rgba(0, 0, 0, .25)); }
  .post svg { display: block; width: 100%; height: auto; }
  /* Entdeckungen: eine Zeile je Sache, davor ein leerer Kreis oder (schon ausprobiert) ein Pfotenabdruck */
  .fd { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
  .fd > i { display: block; width: 22px; height: 22px; margin-top: 1px; box-sizing: border-box; border-radius: 50%; border: 1.5px dashed var(--soft); opacity: .6; }
  .fd.ok > i { border: none; padding: 4px; background: var(--acc); color: #fff; opacity: 1; transform: rotate(-10deg); }
  .night .fd.ok > i { color: #2a2238; }
  .fd i svg { display: block; width: 100%; height: 100%; }
  .fd b { display: block; font-size: 14px; font-weight: 800; line-height: 1.25; }
  .fd span { display: block; margin-top: 1px; font-size: 13px; line-height: 1.4; color: var(--soft); }
  @keyframes tbin { from { opacity: 0; } }
  @keyframes tbup { from { transform: translateY(24px) scale(.96); opacity: 0; } }
  @media (max-width: 520px) {
    .bd { align-items: flex-end; padding: 0; }
    .sheet { width: 100%; height: min(640px, 90%); border-radius: 20px 20px 0 0; }
    .page { border-radius: 0; padding-bottom: 24px; }
    .tre { grid-template-columns: 1fr; }
  }
  /* Sehr schmale Handys: Die vier Reiter rücken zusammen, damit „Entdeckungen“ ausgeschrieben bleibt */
  @media (max-width: 340px) {
    .tabs { gap: 4px; padding-left: 10px; padding-right: 10px; }
    .tabs button { padding: 0 4px; font-size: 13px; }
  }
  @media (prefers-reduced-motion: reduce) { .bd, .sheet { animation: none; } }
  `;
// In der Karte: Die Statusleiste ist der Einstieg (Buch und Punkt für Neues), ohne Leiste ein kleiner Buch-Knopf
const STYLE_DIARY_BTN = `
  .stats .tb { display: none; position: relative; width: 16px; height: 16px; margin-right: -3px; }
  .stats .tb svg { display: block; width: 100%; height: 100%; }
  .stats.dia { cursor: pointer; }
  .stats.dia .tb { display: block; }
  .stats.dia:active { transform: scale(.97); }
  .stats:focus-visible, .tbbtn:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
  .stats.neu .tb::after, .tbbtn.neu::after {
    content: ''; position: absolute; right: -3px; top: -3px; width: 7px; height: 7px; border-radius: 50%; background: #e8584e;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, .9);
  }
  .tbbtn {
    position: absolute; left: 8px; top: 6px; z-index: var(--z-ui); width: 32px; height: 32px; padding: 6px; border: none; border-radius: 50%;
    cursor: pointer; background: rgba(255, 255, 255, .75); box-shadow: 0 2px 6px rgba(0, 0, 0, .18); transition: transform .15s, background 2.5s;
  }
  .tbbtn[hidden] { display: none; }
  .tbbtn:active { transform: scale(.88); }
  .tbbtn svg { display: block; width: 100%; height: 100%; }
  .night .tbbtn { background: rgba(15, 22, 45, .55); }
  `;

export { STYLE_DIARY, STYLE_DIARY_BTN };
