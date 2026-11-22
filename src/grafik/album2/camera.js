// Album 2: Kamera (noch nicht gebaut). Daten und Bilder; Felder siehe src/grafik/album2.js, Schnittstelle der
// Szene im Kopf von src/karte/album2.js.
// Idee (Spezifikation): Tag: Blitz, ein Foto fällt heraus. Trick: Selfie mit dem Freund. Gold: goldene Zugabe nach Wahl.
// Zum Bauen: built auf true, icon und die Bilder der Szene hier, die Hooks in src/karte/album2-camera.js, der Stil in
// src/stil/album2-camera.js. Texte dürfen sich ändern; key und die Stelle in A2_KEYS (src/logik/album2.js) nicht.

import { A2_PLATZHALTER } from './platzhalter.js';

const A2_CAMERA = {
  key: 'camera', name: 'Kamera', say: 'eine Kamera!', built: false, mo: null,
  icon: A2_PLATZHALTER,
  trick: 'Selfie', gilt: 'eine goldene %', use: 'Klick! Ein Foto für dich.', gold: 'eine goldene Zugabe',
  find: null,
  dbg: [],
};

export { A2_CAMERA };
