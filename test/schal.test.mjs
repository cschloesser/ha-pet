// Winterschal (0.45.2): Er liegt hinter allem, was der Pika in den Pfoten hält. Bis 0.45.1 stand er in der Grafik
// danach und lag über Buch, Spielkonsole und Tablet. Gilt auch für die Freunde, deren Grafik aus PIKA_SVG entsteht.
// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIKA_SVG } from '../src/grafik/pika.js';
import { KIRBY_SVG, RUFUS_SVG, KATZUMI_SVG } from '../src/grafik/freunde.js';

const pos = (svg, k) => {
  const i = svg.indexOf(`<g class="${k}"`);
  assert.ok(i >= 0, `${k} fehlt`);
  return i;
};

for (const [name, svg] of [['Pika', PIKA_SVG], ['Kirby', KIRBY_SVG], ['Rufus', RUFUS_SVG], ['Katzumi', KATZUMI_SVG]]) {
  test(`Schal (${name}): vor dem Gesicht gezeichnet, hinter Pfoten, Buch, Spielkonsole und Tablet`, () => {
    const s = pos(svg, 'scarf');
    assert.equal(svg.split('<g class="scarf"').length, 2, 'genau ein Schal');
    assert.ok(pos(svg, 'face') < s, 'das Gesicht liegt darunter (der Schal sitzt am Hals davor)');
    for (const k of ['paws', 'book', 'gb', 'tab']) assert.ok(s < pos(svg, k), `${k} liegt über dem Schal`);
  });
}
