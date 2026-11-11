// Editor: Formular (getConfigForm) und Startkonfiguration (getStubConfig)

import { EDITOR_LABEL, EDITOR_HELP } from '../logik/einstellungen.js';

export class Editor {
  // Karten-Editor (HA-Formular): die häufigen Optionen mit Auswahlfeldern, Geräte, Kaffee und Geburtstage als YAML-Felder.
  // Ältere HA-Versionen ohne getConfigForm zeigen einfach weiter den YAML-Editor.
  static getConfigForm() {
    const ent = (domain) => ({ entity: { filter: { domain } } });
    const num = (min, max, step = 1, unit) => ({ number: { min, max, step, mode: 'box', ...(unit ? { unit_of_measurement: unit } : {}) } });
    const bool = { boolean: {} };
    const text = { text: {} };
    const group = (title, icon, schema) => ({ type: 'expandable', name: '', flatten: true, title, icon, schema });
    return {
      schema: [
        { type: 'grid', name: '', schema: [
          { name: 'name', selector: text },
          { name: 'areal', default: 'huegel', selector: { select: { mode: 'dropdown', options: [
            { value: 'huegel', label: 'Erdhügel' }, { value: 'fels', label: 'Felsen' },
            { value: 'stumpf', label: 'Baumstumpf' }, { value: 'alpin', label: 'Alpin' },
          ] } } },
        ] },
        { name: 'entity', selector: ent('input_text') },
        { name: 'plan_entity', selector: ent('input_text') },
        { name: 'chronicle_entity', selector: ent('todo') },
        { type: 'grid', name: '', schema: [
          { name: 'show_stats', selector: bool, default: true },
          { name: 'gifts', selector: bool, default: true },
          { name: 'friend', selector: bool, default: true },
          { name: 'festive', selector: bool, default: true },
          { name: 'diary', selector: bool, default: true },
          { name: 'diary_house', selector: bool, default: true },
        ] },
        group('Schlaf, Wetter und Himmel', 'mdi:weather-night', [
          { type: 'grid', name: '', schema: [
            { name: 'sleep_start', selector: text },
            { name: 'sleep_end', selector: text },
          ] },
          { name: 'sun_entity', selector: ent('sun') },
          { name: 'weather_entity', selector: ent('weather') },
          { type: 'grid', name: '', schema: [
            { name: 'precip_entity', selector: ent('sensor') },
            { name: 'rain_min', selector: num(0, 5, 0.1, 'mm/h') },
          ] },
          { type: 'grid', name: '', schema: [
            { name: 'shooting_stars', selector: bool, default: true },
            { name: 'fireflies', selector: bool, default: true },
          ] },
        ]),
        group('Flugzeuge', 'mdi:airplane', [
          { name: 'flight_entity', selector: ent('sensor') },
          { type: 'grid', name: '', schema: [
            { name: 'flight_radius', selector: num(1, 200, 1, 'km') },
            { name: 'max_flights', selector: num(0, 6) },
          ] },
        ]),
        group('Pino, Tablet und Größe', 'mdi:tablet', [
          { name: 'friend_name', selector: text },
          { name: 'screen_entity', selector: ent(['switch', 'light', 'input_boolean', 'binary_sensor']) },
          { name: 'height', selector: num(120, 800, 10, 'px') },
        ]),
        group('Geburtstage, Haushaltsgeräte, Kaffee (YAML)', 'mdi:code-braces', [
          { name: 'birthdays', selector: { object: {} } },
          { name: 'appliances', selector: { object: {} } },
          { name: 'coffee', selector: { object: {} } },
        ]),
      ],
      computeLabel: (s) => EDITOR_LABEL[s.name],
      computeHelper: (s) => EDITOR_HELP[s.name],
    };
  }

  static getStubConfig() {
    return { name: 'Pika' };
  }
}
