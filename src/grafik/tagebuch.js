// Tagebuch: Buch, Pfote, Symbole der Einträge, das gemalte Bild zum Einkleben

import { hasKey } from '../logik/hilfen.js';
import { OUT } from './pika.js';
import { FOOD, ICON_HEART, STAR, ICON_SPARK } from './szene.js';
import { COFFEE_THINK } from './momente.js';
import { EASEL_MOTIF } from './beschaeftigungen.js';
import { GIFT_ITEMS, GIFT_PARCEL } from './paeckchen.js';

const DI = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const DIARY_BOOK = DI(`<rect x="4.6" y="2.6" width="15" height="18.8" rx="2.2" fill="#e9a23b" stroke="${OUT}" stroke-width="1.1"/>
    <path d="M8.2 2.8 V21.2" stroke="${OUT}" stroke-width="1"/><rect x="10.4" y="6.4" width="6.6" height="4.4" rx=".8" fill="#fff3d6" stroke="${OUT}" stroke-width=".7"/>
    <path d="M14.6 21.2 v2 l1.3 -1 l1.3 1 v-2" fill="#e8584e" stroke="${OUT}" stroke-width=".6" stroke-linejoin="round"/>`);
const DIARY_PAW = DI(`<g fill="currentColor"><ellipse cx="12" cy="15.6" rx="5" ry="4.2"/><ellipse cx="5.6" cy="10.4" rx="2" ry="2.6"/>
    <ellipse cx="9.6" cy="6.8" rx="2" ry="2.7"/><ellipse cx="14.4" cy="6.8" rx="2" ry="2.7"/><ellipse cx="18.4" cy="10.4" rx="2" ry="2.6"/></g>`);
const DIARY_ICON = {
  wake: DI(`<path d="M12 3 v3 M4.6 7.6 l2 2 M19.4 7.6 l-2 2 M2.4 15.6 h2.6 M19 15.6 h2.6" stroke="#f0a02c" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M6 17 a6 6 0 0 1 12 0Z" fill="#f6c945" stroke="${OUT}" stroke-width="1"/><path d="M2 20 h20" stroke="#7cc35a" stroke-width="2.2" stroke-linecap="round"/>`),
  sleep: DI(`<path d="M15.5 3.5 a8.6 8.6 0 1 0 5 12.4 A7.2 7.2 0 0 1 15.5 3.5Z" fill="#f6e7a8" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M16.6 5.4 h3.6 l-3.6 3.8 h3.6" fill="none" stroke="#7c9be0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`),
  read: DI(`<path d="M3 5.4 q4.5 -2.2 9 0 v14 q-4.5 -2.2 -9 0Z" fill="#7cc4ee" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M21 5.4 q-4.5 -2.2 -9 0 v14 q4.5 -2.2 9 0Z" fill="#a8dcf5" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M5.4 8.6 q2 -.8 4.2 0 M5.4 11.6 q2 -.8 4.2 0 M14.4 8.6 q2.2 -.8 4.2 0 M14.4 11.6 q2.2 -.8 4.2 0" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round"/>`),
  game: DI(`<rect x="6" y="2.4" width="12" height="19.2" rx="2.2" fill="#c9cfd8" stroke="${OUT}" stroke-width="1"/>
      <rect x="8" y="4.8" width="8" height="6.4" rx=".9" fill="#9ccf6a" stroke="${OUT}" stroke-width=".7"/>
      <path d="M8.6 15.4 h3.2 M10.2 13.8 v3.2" stroke="${OUT}" stroke-width="1.3" stroke-linecap="round"/><circle cx="15" cy="15.4" r="1.2" fill="#e8584e"/>`),
  tablet: DI(`<rect x="2.4" y="5" width="19.2" height="14" rx="2.2" fill="#4a4f5c" stroke="${OUT}" stroke-width="1"/>
      <rect x="4.4" y="7" width="15.2" height="10" rx=".7" fill="#8fd0f2"/><path d="M6.6 14.6 l3 -3.2 l2.6 2.2 l2.2 -2.8 l3 3.8" stroke="#fff" stroke-width="1.1" fill="none" stroke-linejoin="round"/>`),
  kite: DI(`<path d="M12 1.8 L18.2 9 L12 17.4 L5.8 9Z" fill="#e8584e" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M12 1.8 V17.4 M5.8 9 H18.2" stroke="${OUT}" stroke-width=".7"/><path d="M12 17.4 q-2.4 1.8 0 3.2 q2 1.2 .4 2.6" stroke="#5fb9de" stroke-width="1.2" fill="none" stroke-linecap="round"/>`),
  tv: DI(`<path d="M8 2.6 l4 3.4 l4 -3.4" stroke="${OUT}" stroke-width="1" fill="none" stroke-linecap="round"/>
      <rect x="2.8" y="6" width="18.4" height="12.6" rx="2.2" fill="#a0703f" stroke="${OUT}" stroke-width="1"/>
      <rect x="4.8" y="8" width="11.4" height="8.6" rx="1.2" fill="#9fdcff" stroke="${OUT}" stroke-width=".6"/>
      <circle cx="18.6" cy="10.2" r=".9" fill="#f6c945"/><circle cx="18.6" cy="13.4" r=".9" fill="#f6c945"/><path d="M7 21 h10" stroke="${OUT}" stroke-width="1.2" stroke-linecap="round"/>`),
  music: DI(`<path d="M9.2 17.4 V5 L19.4 3 v12.4" fill="none" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
      <ellipse cx="6.6" cy="17.6" rx="3" ry="2.3" fill="#b99cf0" stroke="${OUT}" stroke-width="1"/><ellipse cx="16.8" cy="15.6" rx="3" ry="2.3" fill="#b99cf0" stroke="${OUT}" stroke-width="1"/>`),
  paint: DI(`<path d="M12 3 a9 9 0 1 0 0 18 c1.7 0 2.1 -1.2 1.4 -2.3 c-.8 -1.3 0 -2.7 1.6 -2.7 H17 a4 4 0 0 0 4 -4 c0 -5 -4 -9 -9 -9Z" fill="#f0e2cf" stroke="${OUT}" stroke-width="1"/>
      <circle cx="7.4" cy="11" r="1.5" fill="#e8584e"/><circle cx="10.6" cy="7" r="1.5" fill="#f6c945"/><circle cx="15.4" cy="7.6" r="1.5" fill="#5fb9de"/><circle cx="8.6" cy="15.4" r="1.5" fill="#7cc35a"/>`),
  bubbles: DI(`<circle cx="8.4" cy="14.4" r="5.6" fill="#d9f1fb" stroke="#5a9cc8" stroke-width="1"/><circle cx="16.8" cy="7.2" r="3.6" fill="#e6f6fd" stroke="#5a9cc8" stroke-width=".9"/>
      <circle cx="18.4" cy="17.4" r="2.2" fill="#e6f6fd" stroke="#5a9cc8" stroke-width=".8"/><path d="M5.4 12.6 q.8 -2 2.6 -2.4 M15 6.2 q.6 -1 1.6 -1.2" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>`),
  sport: DI(`<path d="M7 12 h10" stroke="${OUT}" stroke-width="2.2"/><rect x="3" y="7.4" width="4.2" height="9.2" rx="1.3" fill="#e8584e" stroke="${OUT}" stroke-width="1"/>
      <rect x="16.8" y="7.4" width="4.2" height="9.2" rx="1.3" fill="#e8584e" stroke="${OUT}" stroke-width="1"/>`),
  bird: DI(`<path d="M9 18.6 v2.8 M13 18.6 v2.8" stroke="${OUT}" stroke-width="1" stroke-linecap="round"/><circle cx="11" cy="12" r="7.2" fill="#b5895f" stroke="${OUT}" stroke-width="1"/>
      <path d="M6.8 13.4 q4.2 3.8 8.4 0 q-.6 4.4 -4.2 4.8 q-3.6 -.4 -4.2 -4.8Z" fill="#f08a4b"/><path d="M17.8 10.4 l3.4 1.3 l-3.3 1.4Z" fill="#f6c945" stroke="${OUT}" stroke-width=".7" stroke-linejoin="round"/>
      <circle cx="14" cy="9.6" r="1" fill="#2a1a12"/>`),
  plane: DI(`<path d="M12.2 9.8 L8.6 4.4 h2.2 l5.4 4.2" fill="#f4f6f8" stroke="#5a6470" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M2.4 13.6 L19.4 9 q2.6 -.4 2.2 1.2 q-.4 1.2 -2.2 1.7 l-5 1.5 l-4 5.2 h-2 l2 -4.4 l-4 1.2 l-1.6 1.8 H3.4 l1 -3.2Z" fill="#f4f6f8" stroke="#5a6470" stroke-width=".9" stroke-linejoin="round"/>`),
  bfly: DI(`<path d="M12 12 C9 3.6 1.8 5 3.8 11 c1 3 5.2 3 8.2 1Z M12 12 c3 -8.4 10.2 -7 8.2 -1 c-1 3 -5.2 3 -8.2 1Z" fill="#f28fb1" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M12 12 c-3 1 -6 4.2 -3.2 7 c2 1 3.2 -3 3.2 -7Z M12 12 c3 1 6 4.2 3.2 7 c-2 1 -3.2 -3 -3.2 -7Z" fill="#b99cf0" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M12 8 v10" stroke="${OUT}" stroke-width="1.5" stroke-linecap="round"/>`),
  secret: DI(`<path d="M3 10.6 q9 8 18 0" fill="none" stroke="${OUT}" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M5.6 14.4 l-1.5 2 M9.6 16.2 l-.7 2.4 M14.4 16.2 l.7 2.4 M18.4 14.4 l1.5 2" stroke="${OUT}" stroke-width="1.4" stroke-linecap="round"/>`),
  gather: DI(`<path d="M12 13 v9" stroke="#4f8a3a" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="15" cy="17.6" rx="2.6" ry="1.1" fill="#5fae4a" transform="rotate(-30 15 17.6)"/>
      <g transform="translate(12 9)">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="2.5" ry="3.7" transform="rotate(${a}) translate(0 -3.3)" fill="#f6c945" stroke="${OUT}" stroke-width=".7"/>`).join('')}
      <circle r="2.2" fill="#e0a032"/></g>`),
  washer: DI(`<rect x="4" y="2.8" width="16" height="18.4" rx="2.2" fill="#e9eef2" stroke="${OUT}" stroke-width="1"/><circle cx="12" cy="13.6" r="4.7" fill="#8fd0f2" stroke="${OUT}" stroke-width="1"/>
      <circle cx="7" cy="5.8" r=".9" fill="#5fb9de"/><path d="M9.4 14.2 q2.6 -2 5.2 0" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>`),
  dryer: DI(`<rect x="4" y="2.8" width="16" height="18.4" rx="2.2" fill="#f3e6d2" stroke="${OUT}" stroke-width="1"/><circle cx="12" cy="13.6" r="4.7" fill="#f6c08a" stroke="${OUT}" stroke-width="1"/>
      <circle cx="7" cy="5.8" r=".9" fill="#f0a04b"/><path d="M10 12.4 q1.2 1.2 0 2.6 M13.4 12.4 q1.2 1.2 0 2.6" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>`),
  dishwasher: DI(`<circle cx="11" cy="13" r="8.4" fill="#fff" stroke="${OUT}" stroke-width="1"/><circle cx="11" cy="13" r="5" fill="none" stroke="#c9d3da" stroke-width="1"/>
      <path fill="#5fb9de" transform="translate(13.4 -.6) scale(.42)" d="${STAR}"/>`),
  fest: DI(`<path d="${STAR}" fill="#f6c945" stroke="${OUT}" stroke-width=".8" stroke-linejoin="round"/>`),
  more: DI('<circle cx="5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="19" cy="12" r="1.9" fill="currentColor"/>'),
  coffee: COFFEE_THINK, heart: ICON_HEART, clean: ICON_SPARK, hungry: FOOD.lz.svg, parcel: GIFT_PARCEL,
  pino: GIFT_ITEMS[2].svg, flower: GIFT_ITEMS[11].svg,
};
// Das gemalte Bild zum Einkleben (Leinwand der Staffelei ohne Gestell)
const diaryPainting = (motif) => (!hasKey(EASEL_MOTIF, motif) ? '' : `<svg class="pic" viewBox="9 7 42 44" aria-hidden="true">
    <rect x="9" y="7" width="42" height="44" fill="#bfe3f7"/><circle cx="42" cy="16" r="4.6" fill="#f6c945"/>
    <path d="M9 38 Q21 30 33 36 T51 33 V51 H9Z" fill="#86c46b"/><path d="M9 45 Q26 40 51 45 V51 H9Z" fill="#5fae4a"/>${EASEL_MOTIF[motif][1]}</svg>`);

export { DIARY_BOOK, DIARY_PAW, DIARY_ICON, diaryPainting };
