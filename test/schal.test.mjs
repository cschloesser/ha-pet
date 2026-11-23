// Winterschal (0.45.2): Er liegt hinter allem, was der Pika in den Pfoten hält. Bis 0.45.1 stand er in der Grafik
// danach und lag über Buch, Spielkonsole und Tablet. Gilt auch für die Freunde, deren Grafik aus PIKA_SVG entsteht.
// Seit 0.48.1 auch hinter dem, was er im Maul trägt (.mfood: Futter, Radio, Laterne, Kamera, Bündel, Becken, Seil);
// bis 0.48.0 lief der Schal bei Kälte quer darüber. Pinos Halstuch liegt weiter unter dem Schal.
// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIKA_SVG } from '../src/grafik/pika.js';
import { KIRBY_SVG, RUFUS_SVG, KATZUMI_SVG } from '../src/grafik/freunde.js';
import { FRIEND_SVG } from '../src/grafik/besucher.js';

const pos = (svg, k) => {
  const i = svg.indexOf(`<g class="${k}"`);
  assert.ok(i >= 0, `${k} fehlt`);
  return i;
};

for (const [name, svg] of [['Pika', PIKA_SVG], ['Pino', FRIEND_SVG], ['Kirby', KIRBY_SVG], ['Rufus', RUFUS_SVG], ['Katzumi', KATZUMI_SVG]]) {
  test(`Schal (${name}): vor dem Gesicht gezeichnet, hinter Pfoten, Maul, Buch, Spielkonsole und Tablet`, () => {
    const s = pos(svg, 'scarf');
    assert.equal(svg.split('<g class="scarf"').length, 2, 'genau ein Schal');
    assert.ok(pos(svg, 'face') < s, 'das Gesicht liegt darunter (der Schal sitzt am Hals davor)');
    for (const k of ['mfood', 'paws', 'book', 'gb', 'tab']) assert.ok(s < pos(svg, k), `${k} liegt über dem Schal`);
  });
}

test('Schal (Pino): das Halstuch liegt unter dem Schal und unter dem, was er im Maul trägt', () => {
  const b = pos(FRIEND_SVG, 'bandana');
  assert.ok(b < pos(FRIEND_SVG, 'scarf') && b < pos(FRIEND_SVG, 'mfood'));
});
