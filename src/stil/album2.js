// Stil von Album 2 (seit 0.46): Gemeinsames und die Stil-Bausteine der acht Schätze (je Schatz src/stil/album2-<key>.js).
// Die Elemente aus _a2El sind .gt in der Ebene .gifts: Ebene, Licht, .new (ploppt auf) und .gilt (golden) kommen aus
// STYLE_GIFT (src/stil/paeckchen.js).

import { STYLE_A2_FEEDER } from './album2-feeder.js';
import { STYLE_A2_LANTERN } from './album2-lantern.js';
import { STYLE_A2_SLED } from './album2-sled.js';
import { STYLE_A2_CAMERA } from './album2-camera.js';
import { STYLE_A2_RADIO } from './album2-radio.js';
import { STYLE_A2_TRAMP } from './album2-tramp.js';
import { STYLE_A2_PICNIC } from './album2-picnic.js';
import { STYLE_A2_POOL } from './album2-pool.js';

const STYLE_A2 = [STYLE_A2_FEEDER, STYLE_A2_LANTERN, STYLE_A2_SLED, STYLE_A2_CAMERA, STYLE_A2_RADIO, STYLE_A2_TRAMP, STYLE_A2_PICNIC, STYLE_A2_POOL].join('');

export { STYLE_A2 };
