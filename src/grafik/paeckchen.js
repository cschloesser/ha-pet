// Päckchen: Hinweise, Inhalte mit Bild, Name und Trick, Papier- und Ballonfarben, Päckchen, Ballon, Hängematte, Windrad, Goldfilter

import { OUT } from './pika.js';
import { ICON_LEAF, ICON_HEART, ICON_SPARK } from './szene.js';

// Was die Serie gerade gefährdet (unter GIFT.min): Hinweis im Album und Zeichen am Knopf
const GIFT_LOW = { s: ['Hunger!', ICON_LEAF], g: ['Streicheln!', ICON_HEART], c: ['Putzen!', ICON_SPARK] };
const GIFT_ITEMS = [
  { key: 'yarn', name: 'Wollknäuel', say: 'ein Wollknäuel!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.4 17.6 q3.6 1.6 1.6 4 q-2 1.6 -4.4 .2" stroke="#f28fb1" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <circle cx="12" cy="13" r="8" fill="#f28fb1" stroke="${OUT}" stroke-width="1"/>
      <path d="M5.4 10 q6.6 2.4 12.6 -1.6 M4.8 13.8 q7.4 3 14.4 -1.4 M6.6 17.8 q6 1.6 11 -2.2 M10 5.4 q-3.4 7 .6 15.4 M14.6 5.6 q2.6 6 -.6 15"
            stroke="#d96a92" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M7.6 8.6 q1.6 -1.8 3.6 -2.4" stroke="#fff" stroke-width="1" fill="none" opacity=".6" stroke-linecap="round"/></svg>` },
  { key: 'wheel', name: 'Windrad', say: 'ein Windrad!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12 V23" stroke="#b5793e" stroke-width="1.8" stroke-linecap="round"/>
      <g class="gwhl">${['#e8584e', '#5fb9de', '#f6c945', '#7cc35a'].map((c, i) => `<path transform="rotate(${i * 90} 12 12)"
        d="M12 12 L12 2.6 Q18 4.4 12 12Z" fill="${c}" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/>`).join('')}
        <circle cx="12" cy="12" r="1.4" fill="#fff" stroke="${OUT}" stroke-width=".7"/></g></svg>` },
  { key: 'plush', name: 'Plüsch-Pino', say: 'ein Plüsch-Pino!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.8" cy="7.4" r="3.4" fill="#d98a4e" stroke="${OUT}" stroke-width=".9"/><circle cx="6.8" cy="7.6" r="1.6" fill="#efc7a0"/>
      <circle cx="17.2" cy="7.4" r="3.4" fill="#d98a4e" stroke="${OUT}" stroke-width=".9"/><circle cx="17.2" cy="7.6" r="1.6" fill="#efc7a0"/>
      <ellipse cx="12" cy="14.2" rx="8.2" ry="7.6" fill="#e09a5c" stroke="${OUT}" stroke-width="1"/>
      <ellipse cx="12" cy="10.2" rx="1.6" ry="1.1" fill="#f6e3c8"/>
      <circle cx="9" cy="13.4" r="1.1" fill="#2a1a12"/><circle cx="15" cy="13.4" r="1.1" fill="#2a1a12"/>
      <path d="M11 15.4 q1 .9 2 0" fill="#7a4438"/><path d="M12 16 v.8 M12 16.8 q-1 1 -1.8 .2 M12 16.8 q1 1 1.8 .2" stroke="${OUT}" stroke-width=".6" fill="none"/>
      <path d="M5.2 18.8 q6.8 3.2 13.6 0" stroke="#3cb6b0" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>` },
  { key: 'shades', name: 'Sonnenbrille', say: 'eine Sonnenbrille!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1.6 10.4 H22.4 M1.8 10.4 l-.6 3 M22.2 10.4 l.6 3" stroke="${OUT}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M2.8 10 h8 q0 6 -4 6 q-4 0 -4 -6z M13.2 10 h8 q0 6 -4 6 q-4 0 -4 -6z" fill="#2c2f3a" stroke="#15171d" stroke-width=".8"/>
      <path d="M4.4 11.4 l2.2 2.4 M14.8 11.4 l2.2 2.4" stroke="#fff" stroke-width=".9" opacity=".6" stroke-linecap="round"/></svg>` },
  { key: 'scope', name: 'Fernrohr', say: 'ein Fernrohr!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-30 12 12)">
      <rect x="1.6" y="9.6" width="9" height="4.8" rx="1" fill="#b8862e" stroke="${OUT}" stroke-width=".8"/>
      <rect x="10.2" y="8.6" width="8" height="6.8" rx="1.2" fill="#d9a441" stroke="${OUT}" stroke-width=".8"/>
      <rect x="17.8" y="7.8" width="4" height="8.4" rx="1" fill="#8a5a32" stroke="${OUT}" stroke-width=".8"/>
      <path d="M12.8 8.6 v6.8 M15.4 8.6 v6.8" stroke="#f3cf7a" stroke-width=".8"/></g></svg>` },
  { key: 'hammock', name: 'Hängematte', say: 'eine Hängematte!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.6 22 L5 5 L7.4 22 M16.6 22 L19 5 L21.4 22" stroke="#9a6a3c" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
      <path d="M5 7 Q12 21 19 7" stroke="${OUT}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
      <path d="M5 7 Q12 21 19 7" stroke="#f6efe0" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M5 7 Q12 21 19 7" stroke="#e8584e" stroke-width="3" fill="none" stroke-dasharray="1.8 2.2"/></svg>` },
  { key: 'can', name: 'Gießkanne', say: 'eine Gießkanne!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.4 9.6 h10.4 v9.6 q0 2 -2 2 h-6.4 q-2 0 -2 -2z" fill="#5fae4a" stroke="${OUT}" stroke-width="1"/>
      <path d="M14.8 13 L21 7.6 l1.4 1.6 -6.2 6.6" fill="#5fae4a" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M6.4 9.6 q3.2 -5.4 6.4 0" stroke="${OUT}" stroke-width="1.3" fill="none"/>
      <path d="M6 13 h7" stroke="#8fd16f" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M22.6 6.4 l1 -1 M23 9 l1.2 .2" stroke="#7cc4ee" stroke-width="1" stroke-linecap="round"/></svg>` },
  { key: 'bell', name: 'Glöckchen', say: 'ein Glöckchen!', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4.2 q3 -2.4 6 0 l-3 1.4z" fill="#e8584e" stroke="${OUT}" stroke-width=".6"/>
      <path d="M12 5 v1.4" stroke="${OUT}" stroke-width="1"/>
      <path d="M5.8 18 q0 -11.6 6.2 -11.6 q6.2 0 6.2 11.6 l1.6 1.6 h-15.6z" fill="#f2c230" stroke="${OUT}" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M8.6 10 q1 -2 3 -2.4" stroke="#fff3b0" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="12" cy="20.6" r="1.7" fill="#d9a441" stroke="${OUT}" stroke-width=".7"/></svg>` },
  // Leckerli: mo = Monate (0 = Januar, Südhalbkugel um ein halbes Jahr versetzt), ohne = immer
  { key: 'straw', name: 'Erdbeere', color: '#e8473f', mo: [4, 5, 6], svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21.6 C4.6 17.6 4.2 10 7.4 8 Q12 6.4 16.6 8 C19.8 10 19.4 17.6 12 21.6Z" fill="#e8473f" stroke="${OUT}" stroke-width=".9"/>
      <g fill="#ffe08a">${[[9, 11], [12, 10.4], [15, 11], [8.6, 14.4], [11.6, 13.6], [14.8, 14.4], [10.4, 17], [13.6, 17]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx=".5" ry=".8"/>`).join('')}</g>
      <path d="M6.8 8 l2.6 -2.6 l2.6 2 l2 -3 l1.8 3 l2.8 -.8 l-1.8 2.4z" fill="#5fae4a" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/></svg>` },
  { key: 'rasp', name: 'Himbeeren', color: '#d9406a', mo: [6, 7, 8], svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      ${[[9, 12], [12.6, 11], [15.6, 13.4], [8.4, 16], [12, 15], [15.2, 17.4], [11, 19.2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.7" fill="#d9406a" stroke="${OUT}" stroke-width=".7"/>
      <circle cx="${x - 0.8}" cy="${y - 0.9}" r=".6" fill="#fff" opacity=".5"/>`).join('')}
      <path d="M11 9 q-3 -4 -6 -3 q2 3 6 3z M12 9 q3 -5 7 -4 q-2 4 -7 4z" fill="#5fae4a" stroke="${OUT}" stroke-width=".7"/></svg>` },
  { key: 'apple', name: 'Apfelschnitz', color: '#f3e6c4', mo: [8, 9, 10], svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.6 11 a9.4 9.4 0 0 0 18.8 0z" fill="#f6ecd0" stroke="#d9483b" stroke-width="1.8"/>
      <path d="M2.6 11 a9.4 9.4 0 0 0 18.8 0z" fill="none" stroke="${OUT}" stroke-width=".6"/>
      <ellipse cx="10" cy="14" rx=".8" ry="1.3" fill="#5a3a22"/><ellipse cx="14" cy="14" rx=".8" ry="1.3" fill="#5a3a22"/>
      <path d="M12 11 V7.4 q2.4 -2.4 4.6 -1.6 q-1.2 2.8 -4.6 1.6" fill="#5fae4a" stroke="${OUT}" stroke-width=".7"/></svg>` },
  { key: 'posy', name: 'Blumensträußchen', color: '#f28fb1', svg: `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22 L7 9 M12 22 L12 7 M12 22 L17 9" stroke="#4f8a3a" stroke-width="1.2"/>
      ${[[7, 8, '#f28fb1'], [12, 6, '#f6c945'], [17, 8, '#b99cf0']].map(([x, y, c]) => `<g transform="translate(${x} ${y})">
        ${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="1.6" ry="2.4" transform="rotate(${a}) translate(0 -2)" fill="${c}" stroke="${OUT}" stroke-width=".5"/>`).join('')}
        <circle r="1.3" fill="#e0a032"/></g>`).join('')}
      <path d="M9.4 16.4 l2.6 1.4 2.6 -1.4 -.6 3 -2 -.8 -2 .8z" fill="#5fb9de" stroke="${OUT}" stroke-width=".6"/></svg>` },
];
// Papier und Band der Päckchen (je Nummer), Ballonfarben, golden
const GIFT_PAPER = [['#5fb9de', '#f6c945'], ['#f28fb1', '#ffffff'], ['#7cc35a', '#e8584e'], ['#b99cf0', '#f6c945'], ['#ff9f5a', '#5fb9de']];
const GIFT_BALLOONS = ['#e8584e', '#5fb9de', '#f6c945', '#b99cf0', '#7cc35a', '#f28fb1'];
const GIFT_GOLD = ['#f2c230', '#fff7d6'];
// Stufe 2 der Schätze: ein neuer Trick (je Schatz, Reihenfolge wie GIFT_ITEMS). Stufe 3 macht ihn golden.
const GIFT_TRICK = ['Kopfball', 'Anpusten', 'Kuscheln', 'Brille lupfen', 'Sterngucken', 'Schaukeln', 'Regenbogen', 'Glockenspiel'];
const GIFT_GILT = ['ein goldenes %', 'ein goldenes %', 'ein goldener %', 'eine goldene %', 'ein goldenes %', 'eine goldene %',
  'eine goldene %', 'ein goldenes %'];
const GIFT_PARCEL = `<svg viewBox="0 0 24 24" aria-hidden="true">
      <g class="gp-box">
        <rect x="3.6" y="11" width="16.8" height="11" rx="1.2" fill="var(--gpp, #5fb9de)" stroke="${OUT}" stroke-width="1"/>
        <rect x="10.6" y="11" width="2.8" height="11" fill="var(--gpr, #f6c945)"/>
        <path d="M5.4 13 v6.6" stroke="#fff" stroke-width="1" opacity=".45" stroke-linecap="round"/>
      </g>
      <g class="gp-lid">
        <rect x="2.6" y="8" width="18.8" height="4" rx="1" fill="var(--gpp, #5fb9de)" stroke="${OUT}" stroke-width="1"/>
        <rect x="10.6" y="8" width="2.8" height="4" fill="var(--gpr, #f6c945)"/>
      </g>
      <g class="gp-bow">
        <path d="M12 8 C8 2.6 4.2 5.2 7 8Z M12 8 C16 2.6 19.8 5.2 17 8Z" fill="var(--gpr, #f6c945)" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        <circle cx="12" cy="8" r="1.5" fill="var(--gpr, #f6c945)" stroke="${OUT}" stroke-width=".7"/>
      </g></svg>`;
// Ballon mit Päckchen: viewBox 40 × 80, die Mitte des Päckchens liegt bei y 66
const GIFT_BALLOON = `<svg viewBox="0 0 40 80" aria-hidden="true">
      <g class="gb-b">
        <path d="M20 36 C17 42 23 47 20 52 C18 55 20 58 20 61.6" stroke="#7d6a5a" stroke-width=".8" fill="none"/>
        <ellipse class="gb-ball" cx="20" cy="19" rx="13.4" ry="15.6" fill="var(--gbc, #e8584e)" stroke="${OUT}" stroke-width="1"/>
        <path d="M17.6 34.4 L20 37.2 L22.4 34.4Z" fill="var(--gbc, #e8584e)" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
        <ellipse cx="14.4" cy="12" rx="3.2" ry="5.4" transform="rotate(24 14.4 12)" fill="#fff" opacity=".45"/>
        <ellipse cx="13" cy="20.6" rx="1" ry="1.6" fill="#fff" opacity=".35"/>
      </g>
      <svg class="gb-p" x="8" y="54" width="24" height="24" viewBox="0 0 24 24" overflow="visible">${GIFT_PARCEL.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>
    </svg>`;
// Hängematte auf der Wiese: viewBox 60 × 20, tiefste Stelle des Netzes bei y 14 (darauf liegt er, GIFT_HAM_LIFT × Breite)
const GIFT_HAMMOCK = `<svg viewBox="0 0 60 20" aria-hidden="true">
      <path d="M1.8 20 L5 2 L8.2 20 M51.8 20 L55 2 L58.2 20" stroke="#9a6a3c" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
      <path d="M3 13 H7 M53 13 H57" stroke="#9a6a3c" stroke-width="1.1"/>
      <g class="gnet">
        <path d="M5 3.4 L10 5 M55 3.4 L50 5" stroke="#cdbb93" stroke-width=".9"/>
        <path d="M10 5 Q30 23 50 5" stroke="${OUT}" stroke-width="4.4" fill="none" stroke-linecap="round"/>
        <path d="M10 5 Q30 23 50 5" stroke="#f6efe0" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M10 5 Q30 23 50 5" stroke="#e8584e" stroke-width="3.2" fill="none" stroke-dasharray="2.4 3"/>
      </g></svg>`;
const GIFT_HAM_W = 1.25; // Breite in Pika-Breiten
const GIFT_HAM_LIFT = 0.1; // Höhe der Liegefläche in Breiten der Hängematte
// Windrad am Bau: viewBox 24 × 44, Nabe bei 12/12
const GIFT_WHEEL = `<svg viewBox="0 0 24 44" aria-hidden="true">
      <path d="M12 12 V44" stroke="#b5793e" stroke-width="1.6" stroke-linecap="round"/>
      ${GIFT_ITEMS[1].svg.replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/<path d="M12 12 V23"[^>]*\/>/, '')}</svg>`;
// Umfärben nach Gold (Stufe 3 der Schätze)
const GILT_F = 'sepia(1) saturate(2.6) hue-rotate(8deg) brightness(1.12)';

export {
  GIFT_LOW, GIFT_ITEMS, GIFT_PAPER, GIFT_BALLOONS, GIFT_GOLD, GIFT_TRICK, GIFT_GILT, GIFT_PARCEL, GIFT_BALLOON,
  GIFT_HAMMOCK, GIFT_HAM_W, GIFT_HAM_LIFT, GIFT_WHEEL, GILT_F,
};
