// Album 2: Planschbecken (noch nicht gebaut). Daten und Bilder; Felder siehe src/grafik/album2.js, Schnittstelle der
// Szene im Kopf von src/karte/album2.js.
// Idee (Spezifikation): Ab 25 °C: planscht. Trick: Arschbombe. Gold: Gummiente. Monate Juni bis August.
// Zum Bauen: built auf true, icon und die Bilder der Szene hier, die Hooks in src/karte/album2-pool.js, der Stil in
// src/stil/album2-pool.js. Texte dürfen sich ändern; key und die Stelle in A2_KEYS (src/logik/album2.js) nicht.

import { A2_PLATZHALTER } from './platzhalter.js';

const A2_POOL = {
  key: 'pool', name: 'Planschbecken', say: 'ein Planschbecken!', built: false, mo: [5, 6, 7],
  icon: A2_PLATZHALTER,
  trick: 'Arschbombe', gilt: 'ein goldenes %', use: 'Für heiße Tage ab 25 Grad.', gold: 'eine Gummiente schwimmt',
  find: null,
  dbg: [],
};

export { A2_POOL };
