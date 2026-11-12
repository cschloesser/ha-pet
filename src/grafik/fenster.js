// Offenes Fenster (seit 0.40): das runde Fenster am Erdhügel, aufgeschwungen, mit Vorhängen und Pika-Kopf

// Gezeichnet in Bau-Einheiten um die Fenstermitte (80 | 33 im Bau des Areals huegel, Glas r 4,3, Rahmen r 6,6).
// Drei Lagen übereinander, jede ein eigenes SVG mit derselben viewBox:
// FEN_INNEN: der Raum hinter dem Fenster (dunkel; nachts warmes Licht .lt, beim Fernsehen flackert .tvw), das
//   Licht, das nachts aus dem offenen Fenster auf den Hügel fällt, und die Vorhänge, die nach außen wehen.
// FEN_KOPF: der Pika-Kopf, der herausschaut (Fellfarben über --pk-*, wie der Pika im Bau), mit Pfoten auf dem Sims.
// FEN_FLUEGEL: der Fensterflügel, der an der linken Kante aufschwingt.
// Kein Lichtfilter: Was in der Dämmerung warm leuchtet, hat eine Kopie mit .lt (wie das Fensterlicht im Bau).
const FEN = { cx: 80, cy: 33, r: 4.3, box: 14 };
const VB = `${-FEN.box} ${-FEN.box} ${FEN.box * 2} ${FEN.box * 2}`;
const OUT = '#5a4030';
const pk = (k, hex) => `var(--pk-${k}, ${hex})`;

// Vorhänge: oben im Fenster festgemacht, sie wehen über den Rahmen hinaus (Richtung: --wd am Fenster)
const VORHANG = 'M-.7 0 C-.3 1.2 -.9 2.6 -.5 4 C-.2 5 -.7 5.8 -.3 6.6 L-1.9 6.3 C-2.2 5.2 -1.6 4 -2 2.6 C-2.3 1.4 -1.9 .6 -2 0Z';
// Tagsüber rosa; in Dämmerung und Nacht liegt eine warme Kopie darüber (.lt, wie das Fensterlicht im Bau)
const VORHANG_P = `<path d="${VORHANG}" fill="#e58a7a" stroke="#b5604f" stroke-width=".2"/><path class="lt" d="${VORHANG}" fill="#d9705f"/>`;
const FEN_INNEN = `<svg viewBox="${VB}" aria-hidden="true">
    <defs>
      <radialGradient id="fen-raum" cx=".5" cy=".75" r=".8"><stop offset="0" stop-color="#3a2a1e"/><stop offset="1" stop-color="#120c08"/></radialGradient>
      <radialGradient id="fen-schein"><stop offset="0" stop-color="#ffb347" stop-opacity=".7"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse class="lt fen-spill" cx="1.5" cy="7.5" rx="11" ry="7"/>
    <circle cx="0" cy="0" r="${FEN.r}" fill="url(#fen-raum)"/>
    <circle class="lt" cx="0" cy="0" r="${FEN.r}" fill="#ffcf70" fill-opacity=".9"/>
    <circle class="tvw" cx="0" cy="0" r="${FEN.r}"/>
    <g class="fen-v">
      <g transform="translate(-1.4 -3.7)"><g class="fen-v1">${VORHANG_P}</g></g>
      <g transform="translate(3.9 -3.2)"><g class="fen-v2">${VORHANG_P}</g></g>
    </g>
  </svg>`;

const FEN_KOPF = `<svg viewBox="${VB}" aria-hidden="true">
    <defs><clipPath id="fen-rund"><circle cx="0" cy="0" r="${FEN.r}"/></clipPath></defs>
    <g clip-path="url(#fen-rund)"><g class="fen-k pk">
      <g stroke="${OUT}" stroke-width=".35">
        <circle cx="-2.25" cy="-1.5" r="1.4" fill="${pk('ear', '#efe3d3')}"/><circle cx="2.25" cy="-1.5" r="1.4" fill="${pk('ear', '#efe3d3')}"/>
      </g>
      <g fill="${pk('ein', '#e3a990')}"><ellipse cx="-2.25" cy="-1.35" rx=".65" ry=".75"/><ellipse cx="2.25" cy="-1.35" rx=".65" ry=".75"/></g>
      <ellipse cx="0" cy="1" rx="3.25" ry="2.75" fill="${pk('fu1', '#d0ad8d')}" stroke="${OUT}" stroke-width=".4"/>
      <ellipse cx="0" cy="2.15" rx="1.6" ry="1.05" fill="${pk('mou', '#f4e8d8')}"/>
      <g class="fen-aug" fill="#2a1a12"><ellipse cx="-1.2" cy=".55" rx=".42" ry=".5"/><ellipse cx="1.2" cy=".55" rx=".42" ry=".5"/></g>
      <g fill="#fff"><circle cx="-1.05" cy=".38" r=".15"/><circle cx="1.35" cy=".38" r=".15"/></g>
      <g class="fen-nase">
        <ellipse cx="0" cy="1.62" rx=".42" ry=".3" fill="${OUT}"/>
        <path d="M-.6 2 l-1.9 -.35 M-.6 2.2 l-1.9 .3 M.6 2 l1.9 -.35 M.6 2.2 l1.9 .3" stroke="${OUT}" stroke-width=".14" stroke-linecap="round" opacity=".7"/>
      </g>
      <g fill="${pk('paw', '#ecdcc6')}" stroke="${OUT}" stroke-width=".3">
        <ellipse cx="-1.7" cy="3.85" rx=".95" ry=".62"/><ellipse cx="1.7" cy="3.85" rx=".95" ry=".62"/>
      </g>
    </g></g>
  </svg>`;

const SCHEIBE = (glas, vh, sp) => `<circle cx="0" cy="0" r="${FEN.r}" fill="${glas}"/>
      <path d="M-3.7 -2.6 Q-1.4 -2 -.6 2.6 L-3.6 2.6Z M3.7 -2.6 Q1.4 -2 .6 2.6 L3.6 2.6Z" fill="${vh}" opacity=".85"/>
      <path d="M0 -${FEN.r} V${FEN.r} M-${FEN.r} 0 H${FEN.r}" stroke="${sp}" stroke-width="1"/>`;
const FEN_FLUEGEL = `<svg viewBox="${VB}" aria-hidden="true">
    <g class="fen-s">
      ${SCHEIBE('#cfe6f2', '#e58a7a', '#9a6a45')}
      <g class="lt">${SCHEIBE('#ffcf70', '#d9705f', '#7a5236')}</g>
      <circle cx="0" cy="0" r="${FEN.r}" fill="none" stroke="#5e3d26" stroke-width=".5"/>
    </g>
  </svg>`;

export { FEN, FEN_INNEN, FEN_KOPF, FEN_FLUEGEL };
