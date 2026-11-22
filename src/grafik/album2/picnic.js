// Album 2: Picknickdecke (noch nicht gebaut). Daten und Bilder; Felder siehe src/grafik/album2.js, Schnittstelle der
// Szene im Kopf von src/karte/album2.js.
// Idee (Spezifikation): Sonnig, ab 15 °C: Picknick (mit Freund, wenn da). Trick: teilt ein Leckerli. Gold: Schmetterlinge. Monate April bis September.
// Zum Bauen: built auf true, icon und die Bilder der Szene hier, die Hooks in src/karte/album2-picnic.js, der Stil in
// src/stil/album2-picnic.js. Texte dürfen sich ändern; key und die Stelle in A2_KEYS (src/logik/album2.js) nicht.

import { A2_PLATZHALTER } from './platzhalter.js';

const A2_PICNIC = {
  key: 'picnic', name: 'Picknickdecke', say: 'eine Picknickdecke!', built: false, mo: [3, 4, 5, 6, 7, 8],
  icon: A2_PLATZHALTER,
  trick: 'Teilen', gilt: 'eine goldene %', use: 'Für ein Picknick in der Sonne.', gold: 'Schmetterlinge kommen',
  find: null,
  dbg: [],
};

export { A2_PICNIC };
