// Album 2 (seit 0.46): die acht Schätze in fester Reihenfolge (wie A2_KEYS in src/logik/album2.js). Jeder steht in
// seiner eigenen Datei unter src/grafik/album2/ und liefert:
// - key: Kennung (wie in A2_KEYS; zugleich Name der Entdeckung im Tagebuch und Teil der Hook-Namen, siehe
//   src/karte/album2.js), name, say (was er beim Auspacken sagt: „ein Vogelhäuschen!“)
// - built: gebaut (nur gebaute werden aus Päckchen gezogen), mo: Monate 0–11, in denen man ihn bekommt (Südhalbkugel
//   versetzt das schenkende Gerät; null = immer, siehe giftPickTre)
// - icon: Bild fürs Album, Auspacken und Tagebuch (24 × 24, wie GIFT_ITEMS; ohne id und class)
// - trick: Name des Tricks (Stufe 2), gilt: Stufe 3 im Nominativ, % = Name („ein goldenes %“)
// - use: Zeile im Album auf Stufe 1, gold: was der goldene zusätzlich kann (steht hinter „golden:“)
// - find: Eintrag in „Entdeckungen“ { t: Titel, h: wie es geht } oder null (nur, wenn es etwas anzutippen gibt)
// - dbg: Vorschau-Knöpfe [[Text, Aktion, Stufe], …] (preview.html baut daraus die Leiste Album 2)

import { A2_FEEDER } from './album2/feeder.js';
import { A2_LANTERN } from './album2/lantern.js';
import { A2_SLED } from './album2/sled.js';
import { A2_CAMERA } from './album2/camera.js';
import { A2_RADIO } from './album2/radio.js';
import { A2_TRAMP } from './album2/tramp.js';
import { A2_PICNIC } from './album2/picnic.js';
import { A2_POOL } from './album2/pool.js';

const A2_ITEMS = [A2_FEEDER, A2_LANTERN, A2_SLED, A2_CAMERA, A2_RADIO, A2_TRAMP, A2_PICNIC, A2_POOL];
// Was _giftPick über die Schätze wissen muss (gebaut, Monate)
const A2_INFO = A2_ITEMS.map((it) => ({ built: !!it.built, mo: it.mo || null }));

export { A2_ITEMS, A2_INFO };
