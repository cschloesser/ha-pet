// Tagebuch: Verlauf holen, Seiten bauen, Schätze, Entdeckungen, öffnen und schließen

import { VERSION } from '../version.js';
import { hasKey, esc } from '../logik/hilfen.js';
import { parseStats } from '../logik/zustand.js';
import { PLAN_MIN, FLGIFT, PET_CAP, pikaDay, planParse } from '../logik/tagesplan.js';
import { BOTE_RUN, BOTE_DEAD, boteState, boteMap } from '../logik/haus-bote.js';
import { coffeeBrews } from '../logik/kaffee.js';
import { vacRuns } from '../logik/signale.js';
import { SIG_BIN, SIG_VAC } from '../grafik/signale.js';
import { GIFT, GIFT_TRE, giftLvs } from '../logik/paeckchen.js';
import { urlaubEnd, urlaubDauer } from '../logik/urlaub.js';
import {
  DIARY, FIND_GROUPS, FINDS, FIND_IDS, findsParse, findsSer, DIARY_TXT, diaryPick, diaryTime, diaryDerive,
} from '../logik/tagebuch.js';
import { ICON_LEAF, ICON_HEART, ICON_SPARK } from '../grafik/szene.js';
import { GIFT_ITEMS, GIFT_TRICK, GIFT_GILT, GIFT_PARCEL } from '../grafik/paeckchen.js';
import { DIARY_BOOK, DIARY_PAW, DIARY_ICON, diaryPainting } from '../grafik/tagebuch.js';
import { STYLE_DIARY } from '../stil/tagebuch.js';
import { URLAUB_SIGN, URLAUB_CARD } from '../grafik/urlaub.js';
import { FRIEND_ICON } from '../grafik/freunde.js';
import { FRIENDS } from '../logik/besucher.js';

export class Tagebuch {
  // Entdeckungen (Seite im Tagebuch, FINDS): Was schon ausprobiert wurde, merkt sich nur dieses Gerät im Browser.
  // Ohne Speicher gilt es bis zum Neuladen. Mit diary: false gibt es die Seite nicht, dann wird auch nichts gemerkt.
  _finds() {
    const key = `pika-pet-finds:${this._cfg?.name}`;
    if (this._findsKey !== key) {
      this._findsKey = key;
      let raw = '';
      try {
        raw = localStorage.getItem(key) || '';
      } catch (e) { /* kein Speicher */ }
      this._findsSet = findsParse(raw);
    }
    return this._findsSet;
  }

  _found(k) {
    if (!FIND_IDS.has(k) || !this._diaryOn()) return;
    const S = this._finds();
    if (S.has(k)) return;
    S.add(k);
    try {
      // Eine zweite Karte gleichen Namens (andere Ansicht, anderer Tab) hat vielleicht inzwischen geschrieben: vereinigen
      for (const f of findsParse(localStorage.getItem(this._findsKey) || '')) S.add(f);
      localStorage.setItem(this._findsKey, findsSer(S));
    } catch (e) { /* kein Speicher: gilt bis zum Neuladen */ }
  }

  _diaryOn() {
    return this._cfg?.diary !== false;
  }

  _diaryLsKey() {
    return `pika-pet-diary:${this._cfg.name}`;
  }

  // Einstieg: Die Statusleiste wird zum Knopf (Buch davor); ist sie ausgeblendet, gibt es einen kleinen Buch-Knopf
  _diarySync() {
    const on = this._diaryOn();
    const { stats, tbbtn } = this._el;
    stats.classList.toggle('dia', on);
    for (const [k, v] of [['role', 'button'], ['tabindex', '0'], ['aria-label', `Tagebuch von ${this._cfg.name} öffnen`]]) {
      if (on) stats.setAttribute(k, v);
      else stats.removeAttribute(k);
    }
    tbbtn.hidden = !on || !!this._cfg.show_stats;
    if (this._W) this._btnFit(); // das Buch in der Leiste braucht Platz
    this._diaryDot();
  }

  // Punkt am Buch: ein neuer Tag oder ein ausgepacktes Päckchen seit dem letzten Aufschlagen (je Gerät gemerkt). Nur
  // o (ausgepackt): Album und Stufen ändern sich schon beim Verschenken, bis 0.34 leuchtete der Punkt darum je Schatz
  // zweimal (beim Verschenken und beim Auspacken).
  _diarySig() {
    const G = this._plan?.gift;
    return `${pikaDay(this._haNow())}.${G ? G.o : '-'}`;
  }

  _diaryDot() {
    if (!this._el || !this._planOk) return;
    let seen = null;
    try {
      seen = localStorage.getItem(`pika-pet-diary-seen:${this._cfg.name}`);
    } catch (e) { /* egal */ }
    const neu = this._diaryOn() && seen !== this._diarySig();
    this._el.stats.classList.toggle('neu', neu);
    this._el.tbbtn.classList.toggle('neu', neu);
  }

  // Ohne Helfer gibt es keinen Verlauf in HA: Dann schreibt das Gerät jeden gespeicherten Stand mit Uhrzeit im Browser
  // mit (k: 's' Zustand, 'p' Tagesplan), DIARY.keep lang und dazu den letzten Stand davor als Ausgangslage.
  _diaryLog(k, v) {
    try {
      const key = this._diaryLsKey();
      if (this._dlogKey !== key) {
        this._dlogKey = key;
        this._dlog = JSON.parse(localStorage.getItem(key) || 'null') || {};
      }
      const a = (this._dlog[k] ||= []);
      if (a.at(-1)?.[1] === v) return;
      const now = Math.round(this._haNow() / 1000);
      a.push([now, v]);
      const i = a.findIndex((e) => e[0] >= now - DIARY.keep / 1000);
      if (i > 1) a.splice(0, i - 1);
      if (a.length > DIARY.max) a.splice(0, a.length - DIARY.max);
      localStorage.setItem(key, JSON.stringify(this._dlog));
    } catch (e) { /* kein Speicher: dann ohne Tagebuch */ }
  }

  // Beginn des Pika-Tags (4 Uhr nachts, wie pikaDay), back Tage zurück
  _diaryDay(back = 0) {
    const d = new Date(this._haNow() - 4 * 36e5);
    d.setHours(4, 0, 0, 0);
    d.setDate(d.getDate() - back);
    return d.getTime();
  }

  // Liegen Zustand (haS) und Tagesplan (haP) in HA? Dann steht ihr Verlauf im Recorder, sonst schreibt das Gerät
  // selbst mit (_diaryLog).
  _diaryHa() {
    const c = this._cfg;
    return {
      haS: !!c.entity && !this._noEntity,
      haP: !!c.plan_entity && !!this._hass?.states[c.plan_entity] && this._planMax() >= PLAN_MIN,
    };
  }

  // Verlauf von Zustand und Tagesplan (und der Geräte des Haus-Boten) zwischen from und to. Mit Helfer aus HA,
  // ohne aus der Mitschrift im Browser. → { S, P (geparst, aufsteigend), bote (Ereignisse), fail, none, ha (beide
  // Helfer kamen aus HA) }. only: nur die beiden Helfer, ohne die Geräte des Haus-Boten, und ein Fehlschlag steht nur
  // leise in der Konsole (für die Chronik, die es von selbst später wieder versucht).
  async _diaryHist(from, to, only = false) {
    const c = this._cfg;
    const hass = this._hass;
    const { haS, haP } = this._diaryHa();
    const house = !only && c.diary_house !== false ? this._boteSync().list : [];
    // Kaffee: jeder Bezug aus dem Verlauf des aktiven Programms (das Tagebuch kennt sonst nur „heute Kaffee“, ein Bit
    // im Tagesplan, also nur den ersten)
    const cof = !only && c.diary_house !== false && typeof c.coffee?.active === 'string' ? c.coffee.active : null;
    // Saugroboter (Haus-Signale): jeder Lauf von „cleaning“ bis „docked“
    const vac = !only && c.diary_house !== false && typeof c.signals?.vacuum === 'string' ? c.signals.vacuum : null;
    const ids = [...new Set([...(haS ? [c.entity] : []), ...(haP ? [c.plan_entity] : []), ...house.map((a) => a.cfg.state), ...(cof ? [cof] : []), ...(vac ? [vac] : [])])];
    let res = {};
    let fail = false;
    if (ids.length) {
      try {
        res = (await hass.callWS({
          type: 'history/history_during_period', start_time: new Date(from).toISOString(), end_time: new Date(to).toISOString(),
          entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
        })) || {};
      } catch (e) {
        fail = true;
        if (only) console.debug('pika-pet-card: Verlauf für die Chronik nicht lesbar, später noch einmal', e);
        else console.warn('pika-pet-card: Verlauf für das Tagebuch nicht lesbar', e);
      }
    }
    // HA liefert je Helfer [{ s: Stand, lu: Sekunden }], ältere Versionen { state, last_updated }
    const rows = (id) => (Array.isArray(res[id]) ? res[id] : [])
      .map((r) => ({ t: Math.round((Number(r.lu ?? r.lc) || Date.parse(r.last_updated || r.last_changed) / 1000) * 1000), s: r.s ?? r.state }))
      .filter((r) => Number.isFinite(r.t))
      .sort((a, b) => a.t - b.t);
    let L = null;
    const local = (k) => {
      try {
        L ??= JSON.parse(localStorage.getItem(this._diaryLsKey()) || 'null') || {};
      } catch (e) {
        L = {};
      }
      return (L[k] || []).map(([t, s]) => ({ t: t * 1000, s }));
    };
    // (Zustände mit vier Feldern, bis 0.4, kennen keinen Großputz: auslassen)
    const S = (haS ? rows(c.entity) : local('s'))
      .map((r) => ({ t: r.t, v: String(r.s).split(',').length === 7 ? parseStats(r.s) : null })).filter((r) => r.v);
    const P = (haP ? rows(c.plan_entity) : local('p')).map((r) => ({ t: r.t, v: planParse(r.s) })).filter((r) => r.v);
    // Haus-Bote: ein Programm ging zu Ende (läuft → fertig)
    const bote = [];
    const norm = (v) => String(v ?? '').split('.').pop().toLowerCase().replace(/[\s_-]/g, '');
    for (const a of house) {
      let last = null;
      for (const r of rows(a.cfg.state)) {
        const raw = norm(r.s);
        const s = boteState(raw, a.map ?? boteMap(a.cfg.state_map));
        if (BOTE_DEAD.has(s)) continue;
        // Knitterschutz: Tür auf meldet beim Trockner manchmal „pause“, danach wieder „fertig“. Das ist kein zweites
        // Programmende (live gilt dasselbe, siehe _boteRead).
        if (s === 'pause' && last === 'finished') continue;
        if (s === 'finished' && BOTE_RUN.has(last) && r.t >= from) bote.push({ t: r.t, k: 'bote', type: a.type, name: a.name });
        last = s;
      }
    }
    // Kaffee: kam ein Verlauf, gilt er (auch leer: dann gab es keinen Bezug); sonst bleibt das Bit im Tagesplan
    const cr = cof && !fail ? rows(cof) : [];
    for (const b of coffeeBrews(cr)) if (b.t >= from) bote.push({ t: b.t, k: 'kaffee', label: b.label });
    if (vac && !fail) for (const v of vacRuns(rows(vac))) if (v.t >= from) bote.push({ t: v.t, k: 'sauger', min: v.min });
    // Helfer da, aber kein einziger Stand im Verlauf: Der Recorder zeichnet ihn nicht auf
    return { S, P, bote, fail, none: !fail && ((haS && !S.length) || (haP && !P.length)), ha: haS && haP, ...(cof ? { cof: cr.length > 0 } : {}) };
  }

  // Beide Seiten (heute, gestern) aus dem Verlauf. Vorschau: _dbgDiary liefert fertige Roh-Ereignisse.
  async _diaryBuild() {
    const now = this._haNow();
    const d0 = this._diaryDay(0);
    const d1 = this._diaryDay(1);
    let R;
    let H = { bote: [], fail: false, none: false, S: [], P: [] };
    if (this._dbgDiary) R = { stamps: [], pets: {}, ...this._dbgDiary(d0, d1, now), data: true };
    else {
      H = await this._diaryHist(d1, now + 60000);
      R = { ...diaryDerive(H.S, H.P, d1, { decayAt: (t, h) => this._decayAt(t, h), until: now }), data: H.S.length + H.P.length > 0 };
    }
    const page = (start, end, today) => this._diaryModel(start, end, R, H.bote, today, H.fail, !!H.cof);
    return { fail: H.fail, none: H.none, days: [page(d0, now + 1, true), page(d1, d0, false)] };
  }

  _diaryParcel(e, t) {
    const it = GIFT_ITEMS[e.it];
    const fr = this._frName();
    const lead = e.gold ? 'Ein goldenes Päckchen! Ich hab es mit der Zwille vom Himmel geholt.' : diaryPick(DIARY_TXT.parcel, 'parcel', Math.floor(t / 60000));
    if (!it) return lead;
    const nm = it.key === 'plush' ? `Plüsch-${fr}` : it.name;
    if (e.what === 'treat') return `${lead} Drin war ein Leckerli: ${nm}. Sofort aufgefuttert!`;
    if (e.what === 'trick') return `${lead} Jetzt kann ich einen neuen Trick: ${GIFT_TRICK[e.it]}!`;
    // GIFT_GILT steht im Nominativ („ein goldener Plüsch-Pino!“), hier braucht es den Akkusativ
    if (e.what === 'gilt') return `${lead} Jetzt hab ich ${GIFT_GILT[e.it].replace('%', nm).replace(/^ein goldener /, 'einen goldenen ')}.`;
    return `${lead} Drin war ${it.key === 'plush' ? `ein ${nm}!` : it.say}`;
  }

  // Eine Seite: Einträge { t, part, icon, text, … } in Reihenfolge, Zähler (chips) und der Satz oben. cof: Die Bezüge
  // des Kaffeeautomaten kommen aus seinem Verlauf (extra, k: 'kaffee'), das Bit „Kaffee“ im Tagesplan zählt dann nicht.
  _diaryModel(start, end, R, extra, today, fail, cof = false) {
    const now = this._haNow();
    const day = new Date(start);
    const [ws, we] = this._wakeDay(day);
    const fr = this._frName();
    const T = DIARY_TXT;
    const tx = (list, k, t) => diaryPick(list, k, Math.floor(t / 60000)).replace('{n}', fr);
    const hourPart = (t) => {
      const h = new Date(t).getHours();
      return h < 4 ? 'Nachts' : h < 11 ? 'Morgens' : h < 14 ? 'Mittags' : h < 18 ? 'Nachmittags' : 'Abends';
    };
    const partOf = (t) => (t < ws || t > we ? 'Nachts' : hourPart(t));
    const out = [];
    const put = (t, icon, text, x) => out.push({ t, icon, text, ...x });
    const house = this._cfg.diary_house !== false;
    const until = Math.min(end, now);
    // Urlaube (aus dem Verlauf, dazu der im Plan): Was hineinfällt, hat er nicht hier erlebt
    const U = [...(R.urlaub || [])];
    const pu = this._plan?.ur;
    if (pu && !U.some(([a]) => a === pu.t)) U.push([pu.t, urlaubEnd(pu)]);
    const inU = (t) => U.some(([a, b]) => t >= a && t < b);
    const away = U.some(([a, b]) => a < until && b > start);
    if (inU(Math.max(start, ws)) && !R.ev.some((e) => e.k === 'urlaub' && e.t >= start && e.t < end)) {
      put(Math.max(start, Math.min(ws, until)), 'urlaub', tx(T.urlaubTag, 'urt', start), { svg: URLAUB_SIGN(fr), dim: true });
    }

    if (ws >= start && ws <= until && !inU(ws)) {
      const favs = this._tagesform(ws).fav.map((a) => T.actNoun[a]).join(' und ');
      put(ws, 'wake', `${tx(T.wake, 'wake', ws)} Heute hab ich Lust auf ${favs}.`);
      // Festtage (wie sie mittags gelten)
      const f = this._festToday(start + 8 * 36e5);
      const fl = ['witch', 'martin', 'xmas', 'sticks', 'karneval', 'ostern', 'maibaum', 'sommer'].filter((k) => f[k]).map((k) => T.fest[k]);
      if (f.boot?.full) fl.push(T.fest.boot);
      if (f.advent && day.getDay() === 0) fl.push(`Der ${f.advent.candles}. Advent! Am Kranz brennt eine Kerze mehr.`);
      if (f.birthday) {
        const n = f.birthday.names;
        fl.push(`Alles Gute, ${n.length > 1 ? `${n.slice(0, -1).join(', ')} und ${n.at(-1)}` : n[0]}! Es gibt Kuchen.`);
      }
      fl.forEach((text, i) => put(ws + 1 + i, 'fest', text, { tm: 'Heute ist ein besonderer Tag' }));
    }

    const mine = [...R.ev, ...extra].filter((e) => e.t >= start && e.t < end).sort((a, b) => a.t - b.t);
    const one = new Set(); // manches steht nur einmal am Tag da
    const once = (k) => !one.has(k) && !!one.add(k);
    const acts = [];
    const cnt = { feed: 0, clean: 0, coffee: 0 };
    let gather = null;
    for (const e of mine) {
      const t = e.t;
      if (e.k === 'act') acts.push(e);
      else if (e.k === 'feed') cnt.feed++;
      else if (e.k === 'clean') {
        cnt.clean += e.n;
        if (e.all && once('clean')) put(t, 'clean', tx(T.clean, 'clean', t));
      } else if (e.k === 'gather') {
        if (gather) gather.c++;
        else out.push((gather = { t, icon: 'gather', c: 1 }));
      } else if (e.k === 'mem') {
        if (['pino', 'bird', 'plane', 'bfly', 'heart'].includes(e.b) || (e.b === 'coffee' && house && !cof)) put(t, e.b, tx(T[e.b], e.b, t));
        // die Freunde, die statt Pino kommen: dieselben Sätze, mit ihrem Namen und Bild
        else if (hasKey(FRIEND_ICON, e.b)) put(t, e.b, diaryPick(T.pino, e.b, Math.floor(t / 60000)).replace('{n}', FRIENDS[e.b].name), { svg: FRIEND_ICON[e.b] });
        else if (e.b === 'gut') put(t, 'gut', tx(T.gut, 'gut', t), { svg: ICON_HEART });
        else if (e.b === 'tonne' && house) put(t, 'tonne', tx(T.tonne, 'tonne', t), { svg: SIG_BIN('#7d848c') });
      } else if (e.k === 'parcel') {
        one.add('parcel');
        put(t, 'parcel', this._diaryParcel(e, t), { svg: GIFT_ITEMS[e.it]?.svg });
        if (e.all) put(t + 1, 'parcel', tx(T.allGold, 'allg', t), { svg: GIFT_ITEMS[e.it]?.svg });
        else if (e.mile) put(t + 1, 'parcel', tx(T.mile, 'mile', t).replace('{z}', e.o), { svg: GIFT_PARCEL });
      } else if (e.k === 'urlaub') {
        put(t, 'urlaub', tx(T.urlaub, 'ur', t), { svg: URLAUB_SIGN(fr) });
      } else if (e.k === 'heim') {
        const sea = this._urlaubSea({ t: e.id });
        put(t, 'heim', tx(T.heim, 'heim', t).replace('{d}', urlaubDauer(e.d).replace(/^./, (c) => c.toUpperCase())),
          { svg: URLAUB_CARD(sea), pic: `<span class="post">${URLAUB_CARD(sea)}</span>` });
      } else if (e.k === 'earn') {
        if (once('earn')) put(t, 'parcel', tx(T.earn, 'earn', t));
      } else if (e.k === 'earnGold') put(t, 'parcel', tx(T.earnGold, 'gold', t));
      else if (e.k === 'streak') {
        if (once('streak')) put(t, 'parcel', tx(T.streak, 'streak', t), { dim: true });
      } else if (e.k === 'flower') {
        // verwelkt steht nur einmal am Tag da
        const wilt = !e.taken && now > e.id + FLGIFT.life;
        if (!wilt || once('wilt')) put(t, 'flower', tx(e.taken ? T.flowerTaken : wilt ? T.flowerWilt : T.flowerWait, 'flower', t));
      } else if (e.k === 'hungry') {
        if (once('hungry')) put(t, 'hungry', tx(e.eaten ? T.hungry : T.hungryNow, 'hungry', t));
      } else if (e.k === 'bote' && house && T.bote[e.type]) put(t, e.type, tx(T.bote[e.type], 'bote', t), { tm: `${diaryTime(t)} · ${e.name}` });
      else if (e.k === 'sauger' && house) put(t, 'sauger', tx(T.sauger, 'sauger', t), { svg: SIG_VAC, tm: `${diaryTime(t)} · ${e.min} Min` });
      else if (e.k === 'kaffee' && house && !inU(t)) {
        // jeder Bezug mit Uhrzeit und Getränk; der erste des Tags wie bisher, danach „noch einer“
        const n = ++cnt.coffee;
        put(t, 'coffee', n === 1 ? tx(T.coffee, 'coffee', t) : tx(T.coffeeMore, 'coffee', t).replace('{z}', n), { tm: `${diaryTime(t)} · ${e.label}` });
      }
    }
    if (gather) gather.text = gather.c > 1 ? tx(T.gatherN, 'gather', gather.t).replace('{c}', gather.c) : T.gather1[0];

    // Beschäftigungen: je Tageszeit die wichtigsten ausführlich (gemaltes Bild, Frühsport, Lieblinge des Tages zuerst),
    // der Rest in einer Zeile. Ein Tablet, das den ganzen Tag an ist, sähe sonst drei Dutzend Einträge.
    const fav = this._tagesform(start + 8 * 36e5).fav;
    const rank = (a) => (a === 'paint' ? 0 : a === 'sport' ? 1 : fav.includes(a) ? 2 : 3);
    const parts = new Map();
    for (const e of acts) {
      if (!hasKey(T.act, e.a)) continue;
      const p = partOf(e.t);
      if (!parts.has(p)) parts.set(p, []);
      parts.get(p).push(e);
    }
    for (const list of parts.values()) {
      const names = [...new Set(list.map((e) => e.a))].sort((a, b) => rank(a) - rank(b));
      for (const a of names.slice(0, DIARY.acts)) {
        const all = list.filter((e) => e.a === a);
        const e = all.find((x) => x.v) || all[0];
        let text = tx(T.act[a], a, e.t);
        const motif = T.motif[e.v];
        if (a === 'paint') text = motif ? text.replace('{m}', motif.replace('{n}', fr)) : 'Ein Bild gemalt. Was drauf ist, verrate ich nicht.';
        put(all[0].t, a, text, { n: all.length, pic: a === 'paint' && motif ? diaryPainting(e.v) : '' });
      }
      const rest = names.slice(DIARY.acts).map((a) => T.actShort[a]);
      if (rest.length) {
        const text = `Außerdem: ${rest.length > 1 ? `${rest.slice(0, -1).join(', ')} und ${rest.at(-1)}` : rest[0]}.`;
        put(list.at(-1).t + 1, 'more', text, { sub: true, tm: '', last: true });
      }
    }

    // Lange nichts im Verlauf, obwohl er wach war: Dann hat ihn kein Gerät gezeigt (oder es gab nichts zu tun).
    // Die längste solche Lücke wird sein Geheimnis.
    const a0 = Math.max(ws, start);
    const b0 = Math.min(we, until);
    if (!fail && R.data && !away && b0 - a0 >= DIARY.gap) {
      const ts = [a0, ...R.stamps.filter((t) => t > a0 && t < b0), b0];
      let bi = 1;
      for (let i = 2; i < ts.length; i++) if (ts[i] - ts[i - 1] > ts[bi] - ts[bi - 1]) bi = i;
      if (ts[bi] - ts[bi - 1] >= DIARY.gap) {
        put(ts[bi - 1] + 2, 'secret', tx(T.secret, 'secret', ts[bi - 1]), { dim: true, tm: `${diaryTime(ts[bi - 1])} bis ${diaryTime(ts[bi])}` });
      }
    }
    if (we > start && we <= until && !inU(we)) put(we, 'sleep', tx(T.sleep, 'sleep', we), { part: hourPart(we) });

    for (const e of out) e.part ??= partOf(e.t);
    // „Außerdem: …“ steht am Ende seiner Tageszeit
    for (const m of out.filter((e) => e.last)) m.t = Math.max(...out.filter((e) => e.part === m.part && !e.last).map((e) => e.t), m.t) + 1;
    out.sort((a, b) => a.t - b.t);

    const pet = Math.max(R.pets[pikaDay(start + 36e5)] || 0, today ? this._cuteToday().n : 0);
    const chips = [];
    if (cnt.feed) chips.push([ICON_LEAF, `${cnt.feed}× gefüttert`]);
    if (pet) chips.push([ICON_HEART, `${pet >= PET_CAP ? `über ${PET_CAP - 1}` : pet}× gestreichelt`]);
    if (cnt.clean) chips.push([ICON_SPARK, `${cnt.clean}× geputzt`]);

    let fazit;
    if (today) {
      const s = this._get('s');
      const g = this._get('g');
      const c = this._poopsSeen().clean;
      fazit = this._urlaubOn() ? `Liebes Tagebuch, ich bin gerade bei ${fr}. Bis bald!`
        : this._sleepTime() ? 'Psst, ich schlafe gerade. Blättere ruhig leise.'
        : s < 30 ? 'Liebes Tagebuch, mein Bauch knurrt gerade ein bisschen.'
          : c < 30 ? 'Liebes Tagebuch, auf meiner Wiese müsste mal jemand sauber machen.'
            : g < 30 ? 'Liebes Tagebuch, ich hätte gern ein paar Streicheleinheiten.'
              : one.has('parcel') ? 'Liebes Tagebuch, heute ist ein aufregender Tag: Es gab ein Päckchen!'
                : Math.min(s, g, c) >= 70 ? 'Liebes Tagebuch, heute geht es mir richtig gut.'
                  : 'Liebes Tagebuch, heute ist ein gemütlicher Tag.';
    } else {
      fazit = inU(start) && inU(Math.min(end, now) - 1) ? `Liebes Tagebuch, gestern war ich bei ${fr}.`
        : !mine.length ? 'Liebes Tagebuch, über gestern weiß ich leider nichts mehr.'
        : one.has('parcel') ? 'Liebes Tagebuch, gestern war ein aufregender Tag: Es gab ein Päckchen!'
          : one.has('hungry') && pet >= 10 ? 'Liebes Tagebuch, gestern hat mein Bauch mal geknurrt. Aber gestreichelt wurde ich ganz viel.'
            : one.has('hungry') ? 'Liebes Tagebuch, gestern hat mein Bauch mal geknurrt. Sonst war es schön.'
              : pet >= 10 ? 'Liebes Tagebuch, gestern wurde ich ganz viel gestreichelt. Das war schön.'
                : 'Liebes Tagebuch, gestern war ein schöner Tag.';
    }
    return { start, entries: out, chips, fazit, early: today && ws > now };
  }

  _diaryPage(M, today, fail, none) {
    const box = today ? this._urlaubBox() : '';
    let h = this._urlaubOn() ? box : '';
    h += `<p class="fazit">${esc(M.fazit)}</p>`;
    if (M.chips.length) h += `<div class="chips">${M.chips.map(([i, t]) => `<span><i>${i}</i>${esc(t)}</span>`).join('')}</div>`;
    let part = null;
    for (const e of M.entries) {
      if (e.part !== part) {
        part = e.part;
        h += `<h3>${part}</h3>`;
      }
      const tm = e.tm ?? `${diaryTime(e.t)}${e.n > 1 ? ` · ${e.n}×` : ''}`;
      h += `<div class="e${e.dim ? ' dim' : ''}${e.sub ? ' sub' : ''}"><i class="ic">${e.svg || DIARY_ICON[e.icon] || ''}</i>`
        + `<div>${tm ? `<span class="tm">${esc(tm)}</span>` : ''}<p>${esc(e.text)}</p>${e.pic || ''}</div></div>`;
    }
    if (!M.entries.length) {
      h += `<p class="none">${M.early ? 'Der Tag hat noch nicht angefangen.' : today ? 'Hier steht noch nichts. Das kommt noch!' : 'Diese Seite ist leer geblieben.'}</p>`;
    } else h += `<div class="sign">${esc(this._cfg.name)}<i>${DIARY_PAW}</i></div>`;
    if (!this._urlaubOn()) h += box;
    if (fail) h += '<p class="note">Ich finde nicht alle Seiten: Der Verlauf von Home Assistant antwortet gerade nicht.</p>';
    else if (none) h += '<p class="note">Ich finde nicht alle Seiten: Home Assistant zeichnet für meine Helfer keinen Verlauf auf (Recorder).</p>';
    return h;
  }

  // Schalter „Ferien bei Pino“ (unten auf der Seite Heute; läuft der Urlaub, steht er oben). Mit vacation: false gibt
  // es keinen Knopf, ein laufender Urlaub steht trotzdem da.
  _urlaubBox() {
    const fr = esc(this._frName());
    const may = this._urlaubMay();
    if (this._urlaubOn()) {
      const t = new Date(this._plan.ur.t).toLocaleString('de-DE', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
      return `<div class="ur on"><i>${URLAUB_SIGN(this._frName())}</i><div><b>Ich bin bei ${fr}</b>`
        + `<span>seit ${esc(t)} Uhr. Hunger, Glück, Häufchen und meine Päckchen-Serie ruhen so lange, auf allen Geräten.</span>`
        + `${may ? '<div class="bt"><button data-ur="back">Zurückholen</button></div>' : ''}</div></div>`;
    }
    if (!may) return '';
    const busy = this._urlaubBusy();
    const ask = !!this._dia?.urAsk && !busy;
    return `<div class="ur"><i>${URLAUB_CARD(false)}</i><div><b>Ferien bei ${fr}</b>`
      + `<span>${ask ? 'Wirklich? Dann packe ich meine Sachen. Das gilt für alle Geräte.'
        : `Fahrt ihr weg? Dann besuche ich so lange ${fr}. Hunger, Glück, Häufchen und meine Päckchen-Serie ruhen, bis ihr mich zurückholt.`}</span>`
      + `<div class="bt">${ask ? '<button data-ur="go">Ja, los</button><button data-ur="no" class="no">Nein</button>'
        : `<button data-ur="ask"${busy ? ' disabled' : ''}>Zu ${fr} schicken</button>`}</div>`
      + `${busy ? '<span class="nt">Erst das Päckchen auspacken.</span>' : ''}</div></div>`;
  }

  // Reiter „Schätze“ (früher das Album am Päckchen-Knopf): alle acht mit Stufe, Päckchen, Serie, Vorrat
  _diaryTreasures() {
    const I = this._giftOn() ? this._giftInfo() : null;
    const fr = this._frName();
    const row = (svg, title, text, warn) => `<div class="row"><i>${svg}</i><div><b>${esc(title)}</b><span${warn ? ' class="w"' : ''}>${text}</span></div></div>`;
    let h = '';
    if (I) {
      const G = I.G;
      h += `<p class="fazit">${!I.have ? 'Noch hab ich keine Schätze. Sie stecken in den Päckchen.'
        : I.have === GIFT_TRE ? 'Das sind meine Schätze. Ich hab alle acht!' : `Das sind meine Schätze. ${I.have} von ${GIFT_TRE} hab ich schon.`}</p>`;
      h += `<div class="tre">${GIFT_ITEMS.slice(0, GIFT_TRE).map((it, t) => {
        const lv = I.lvs[t];
        const nm = it.key === 'plush' ? `Plüsch-${fr}` : it.name;
        const sub = !lv ? 'noch ein Geheimnis' : lv >= 3 ? `golden · Trick: ${GIFT_TRICK[t]}` : lv === 2 ? `Trick: ${GIFT_TRICK[t]}` : DIARY_TXT.treasure[t];
        return `<div class="t ${['miss', '', 'lv2', 'lv2 gilt'][lv]}"><i>${it.svg}</i><div><b>${esc(lv ? nm : '???')}</b><span>${esc(sub)}</span></div></div>`;
      }).join('')}</div>`;
      const n = G.n + G.y;
      h += row(GIFT_PARCEL, 'Päckchen', esc(`${n ? `${n} im Vorrat${G.y ? ` (${G.y === n ? 'golden' : `${G.y} golden`})` : ''}` : 'gerade keins da'} · ${I.next}`), I.warn);
      // Gute Tage: sieben Punkte bis zum nächsten goldenen, und was heute dafür fehlt
      const T = I.today;
      const ck = (ok, w) => `${w} ${ok ? '✓' : '–'}`;
      const left = GIFT.goldDays - I.dots;
      const dots = [...Array(GIFT.goldDays).keys()].map((i) => `<u${i < I.dots ? ' class="on"' : ''}></u>`).join('');
      h += row(ICON_HEART, 'Gute Tage', `<span class="d7">${dots}</span>${esc(`${I.away ? 'ruhen gerade' : left === 1 ? 'noch einer bis zum goldenen Päckchen' : `noch ${left} bis zum goldenen Päckchen`} · ${I.friends === 1 ? '1 Freundschaftstag' : `${I.friends} Freundschaftstage`}`)}`
        + `<span>${esc(I.away ? '' : T.good ? 'Heute ist ein guter Tag ✓' : `Heute: ${ck(T.fed, 'gefüttert')} · ${ck(T.pet, 'gestreichelt')} · ${ck(T.ok, 'alles über 50 %')}`)}</span>`);
      h += row(GIFT_PARCEL, 'Ausgepackt', esc(`${G.o === 1 ? '1 Päckchen' : `${G.o} Päckchen`}${I.allGold ? ' · alle Schätze golden!' : ` · nächster Meilenstein beim ${I.mile}.`}`));
    } else h += '<p class="fazit">Hier sammle ich, was mir gehört.</p>';
    const dots = this._blooms.map((b) => `<u style="background:${esc(b.color)}"></u>`).join('');
    const k = this._blooms.length;
    h += row(DIARY_ICON.gather, 'Mein Vorrat', `${k ? `${k} ${k === 1 ? 'Blüte' : 'Blüten'} gesammelt` : 'noch keine Blüten gesammelt'}${dots ? `<span class="dots">${dots}</span>` : ''}`);
    return h;
  }

  // Reiter „Entdeckungen“: was man mit ihm und seiner Welt tun kann (FINDS). Eine Pfote steht vor dem, was auf diesem
  // Gerät schon ausprobiert wurde (_found). Gezeigt wird nur, was es bei dieser Karte gibt.
  _diaryFinds() {
    const S = this._finds();
    const lv = this._giftOn() ? giftLvs(this._plan?.gift) : [];
    const have = {
      gift: this._giftOn(), friend: !!this._cfg.friend, flight: !!this._cfg.flight_entity,
      bote: Array.isArray(this._cfg.appliances) && this._cfg.appliances.length > 0, wheel: lv[1] > 0, yarn: lv[0] > 0,
    };
    const fr = this._frName();
    const list = FINDS.filter((f) => !f.need || have[f.need]);
    const n = list.filter((f) => S.has(f.k)).length;
    let h = `<p class="fazit">${!n ? 'Probier aus, was du mit mir und meiner Welt machen kannst!'
      : n >= list.length ? 'Du hast alles ausprobiert, was es bei mir gibt!'
        : `Das kannst du mit mir und meiner Welt machen. ${n} von ${list.length} hast du schon ausprobiert.`}</p>`;
    FIND_GROUPS.forEach((g, i) => {
      const part = list.filter((f) => f.g === i);
      if (!part.length) return;
      h += `<h3>${esc(g)}</h3>${part.map((f) => {
        const ok = S.has(f.k);
        return `<div class="fd${ok ? ' ok' : ''}"><i>${ok ? DIARY_PAW : ''}</i><div><b>${esc(f.t.replace('{n}', fr))}</b>`
          + `<span>${esc(f.h.replace('{n}', fr))}</span></div></div>`;
      }).join('')}`;
    });
    return `${h}<p class="note">Die Pfoten merkt sich nur dieses Gerät.</p>`;
  }

  // Fenster über dem Dashboard öffnen (tab: 'heute', 'gestern', 'schatz', 'entd'). Lang drücken auf den
  // Päckchen-Knopf schlägt gleich die Schätze auf.
  _diaryOpen(tab = 'heute') {
    if (!this._el) return;
    // diary: false: nur die Schätze (lang drücken auf den Päckchen-Knopf), ohne Heute/Gestern und ohne den Verlauf zu lesen
    const only = !this._diaryOn();
    if (only) tab = 'schatz';
    if (this._dia) return this._diaryTab(tab);
    const n = String(this._cfg.name || 'Pika');
    const title = `${/[sßxz]$/i.test(n) ? `${n}’` : `${n}s`} ${only ? 'Schätze' : 'Tagebuch'}`;
    const host = document.createElement('div');
    host.className = 'pika-pet-diary';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE_DIARY}</style>
        <div class="bd${this._el.scene.classList.contains('night') ? ' night' : ''}">
          <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
            <div class="hd"><span class="bk">${DIARY_BOOK}</span><div class="ht"><b>${esc(title)}</b><span class="dt"></span></div>
              <button class="x" aria-label="Schließen" title="Schließen">✕</button></div>
            ${only ? '' : `<div class="tabs" role="tablist">
              <button role="tab" data-tab="heute">Heute</button><button role="tab" data-tab="gestern">Gestern</button><button role="tab" data-tab="schatz">Schätze</button><button role="tab" data-tab="entd">Entdeckungen</button>
            </div>`}
            <div class="page" role="tabpanel" tabindex="0"></div>
            <div class="ft"></div>
          </div>
        </div>`;
    document.body.appendChild(host);
    const D = (this._dia = { host, root, tab, data: null, t: null });
    const bd = root.querySelector('.bd');
    bd.addEventListener('click', (e) => e.target === bd && this._diaryClose());
    root.querySelector('.x').addEventListener('click', () => this._diaryClose());
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this._diaryTab(b.dataset.tab)));
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this._diaryClose();
      } else if (e.key === 'Tab') {
        // der Fokus bleibt im Fenster
        const f = [...root.querySelectorAll('button, .page')];
        const i = f.indexOf(root.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    // Wand-Tablet: nach DIARY.close ohne Berührung von selbst wieder zu
    const poke = () => {
      clearTimeout(D.t);
      D.t = setTimeout(() => this._diaryClose(), DIARY.close);
    };
    for (const t of ['pointerdown', 'keydown', 'wheel', 'touchmove']) host.addEventListener(t, poke, { passive: true });
    root.querySelector('.page').addEventListener('scroll', poke, { passive: true });
    poke();
    // Schalter „Ferien bei Pino“ (Seite Heute)
    root.querySelector('.page').addEventListener('click', (e) => {
      const b = e.target.closest?.('[data-ur]');
      if (!b || b.disabled) return;
      const a = b.dataset.ur;
      if (a === 'ask') D.urAsk = true;
      else if (a === 'no') D.urAsk = false;
      else if (a === 'go') {
        D.urAsk = false;
        this._urlaubStart();
      } else if (a === 'back') this._urlaubEnde();
      this._diaryRender(true);
    });
    this._diaryRender();
    root.querySelector('.sheet').focus();
    if (only) return;
    this._urlaubCardSeen();
    try {
      localStorage.setItem(`pika-pet-diary-seen:${this._cfg.name}`, this._diarySig());
    } catch (e) { /* egal */ }
    this._diaryDot();
    this._diaryBuild().then((data) => {
      if (this._dia !== D) return;
      D.data = data;
      this._diaryRender();
    }).catch((e) => {
      this._err('Tagebuch', e);
      if (this._dia !== D) return;
      D.data = { fail: true, days: [] };
      this._diaryRender();
    });
  }

  _diaryTab(tab) {
    if (!this._dia) return;
    this._dia.tab = this._diaryOn() ? tab : 'schatz';
    this._diaryRender();
  }

  // keep: an der Stelle bleiben (Klick auf den Schalter), sonst nach oben
  _diaryRender(keep = false) {
    const D = this._dia;
    if (!D) return;
    const pg = D.root.querySelector('.page');
    const top = pg.scrollTop;
    D.root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === D.tab)));
    const dt = D.root.querySelector('.dt');
    const today = D.tab === 'heute';
    if (D.tab === 'schatz') {
      dt.textContent = 'Was mir gehört';
      pg.innerHTML = this._diaryTreasures();
    } else if (D.tab === 'entd') {
      dt.textContent = 'Was du bei mir ausprobieren kannst';
      pg.innerHTML = this._diaryFinds();
    } else {
      const M = D.data?.days[today ? 0 : 1];
      const raw = { ...(this._wxRaw || {}), ...(this._dbgWeather || {}) };
      const wx = today ? [DIARY_TXT.wx[raw.cond], raw.temp != null ? `${Math.round(raw.temp)} °C` : ''].filter(Boolean).join(', ') : '';
      const date = new Date(this._diaryDay(today ? 0 : 1)).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
      dt.textContent = `${date}${wx ? ` · ${wx}` : ''}`;
      pg.innerHTML = !D.data ? '<p class="wait">Ich blättere …</p>'
        : M ? this._diaryPage(M, today, D.data.fail, D.data.none) : '<p class="none">Mein Tagebuch klemmt gerade. Versuch es gleich noch einmal.</p>';
    }
    pg.scrollTop = keep ? top : 0;
    // Fuß: Version der Karte auf diesem Gerät (liefe hier noch eine alte, sähe man es) und, falls es welche gab, die
    // letzten Fehler. Auf dem Wand-Tablet ist das der einzige Ort, an dem man sie sieht.
    const errs = this._errs || [];
    D.root.querySelector('.ft').innerHTML = `<span>Pika Pet Card ${VERSION}</span>${errs.length ? `<details><summary>${errs.length === 1 ? '1 Fehler' : `${errs.length} Fehler`} seit dem Laden</summary><ul>${errs.map((e) =>
      `<li>${esc(new Date(e.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))} · ${esc(e.where)}${e.n > 1 ? ` (${e.n}×)` : ''}: ${esc(e.msg)}</li>`).join('')}</ul></details>` : ''}`;
  }

  _diaryClose() {
    const D = this._dia;
    if (!D) return;
    this._dia = null;
    clearTimeout(D.t);
    D.host.remove();
    const back = this._el?.stats.hidden ? this._el.tbbtn : this._el?.stats;
    if (back?.isConnected && !back.hidden) back.focus({ preventScroll: true });
  }
}
