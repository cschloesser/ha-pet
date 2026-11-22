// Album 2: Trampolin (noch nicht gebaut). Daten und Bilder; Felder siehe src/grafik/album2.js, Schnittstelle der
// Szene im Kopf von src/karte/album2.js.
// Idee (Spezifikation): Trocken: springt. Trick: Salto. Gold: Sternchen beim Sprung.
// Zum Bauen: built auf true, icon und die Bilder der Szene hier, die Hooks in src/karte/album2-tramp.js, der Stil in
// src/stil/album2-tramp.js. Texte dürfen sich ändern; key und die Stelle in A2_KEYS (src/logik/album2.js) nicht.

import { A2_PLATZHALTER } from './platzhalter.js';

const A2_TRAMP = {
  key: 'tramp', name: 'Trampolin', say: 'ein Trampolin!', built: false, mo: null,
  icon: A2_PLATZHALTER,
  trick: 'Salto', gilt: 'ein goldenes %', use: 'Hüpf, hüpf!', gold: 'Sternchen beim Sprung',
  find: null,
  dbg: [],
};

export { A2_TRAMP };
