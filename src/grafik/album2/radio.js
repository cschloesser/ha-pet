// Album 2: Radio (noch nicht gebaut). Daten und Bilder; Felder siehe src/grafik/album2.js, Schnittstelle der
// Szene im Kopf von src/karte/album2.js.
// Idee (Spezifikation): Ab und zu, gutes Wetter: tanzt. Trick: Drehtanz. Gold: Noten fliegen.
// Zum Bauen: built auf true, icon und die Bilder der Szene hier, die Hooks in src/karte/album2-radio.js, der Stil in
// src/stil/album2-radio.js. Texte dürfen sich ändern; key und die Stelle in A2_KEYS (src/logik/album2.js) nicht.

import { A2_PLATZHALTER } from './platzhalter.js';

const A2_RADIO = {
  key: 'radio', name: 'Radio', say: 'ein Radio!', built: false, mo: null,
  icon: A2_PLATZHALTER,
  trick: 'Drehtanz', gilt: 'ein goldenes %', use: 'Musik zum Tanzen.', gold: 'Noten fliegen',
  find: null,
  dbg: [],
};

export { A2_RADIO };
