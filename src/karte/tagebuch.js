// Tagebuch: Verlauf holen, Seiten bauen, Schätze, Entdeckungen, öffnen und schließen

import { VERSION } from '../version.js';
import { hasKey, esc } from '../logik/hilfen.js';
import { parseStats } from '../logik/zustand.js';
import { PLAN_MIN, FLGIFT, PET_CAP, pikaDay, planParse } from '../logik/tagesplan.js';
import { BOTE_RUN, BOTE_DEAD, BOTE_ALIAS } from '../logik/haus-bote.js';
import { GIFT_TRE, giftLvs } from '../logik/paeckchen.js';
import {
  DIARY, FIND_GROUPS, FINDS, FIND_IDS, findsParse, findsSer, DIARY_TXT, diaryPick, diaryTime, diaryDerive,
} from '../logik/tagebuch.js';
import { ICON_LEAF, ICON_HEART, ICON_SPARK } from '../grafik/szene.js';
import { GIFT_ITEMS, GIFT_TRICK, GIFT_GILT, GIFT_PARCEL } from '../grafik/paeckchen.js';
import { DIARY_BOOK, DIARY_PAW, DIARY_ICON, diaryPainting } from '../grafik/tagebuch.js';
import { STYLE_DIARY } from '../stil/tagebuch.js';

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

  // Punkt am Buch: ein neuer Tag oder ein ausgepacktes Päckchen seit dem letzten Aufschlagen (je Gerät gemerkt)
  _diarySig() {
    const G = this._plan?.gift;
    return `${pikaDay(this._haNow())}.${G ? `${G.o}.${G.u}.${G.v || 0}` : '-'}`;
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

  // Verlauf von Zustand und Tagesplan (und der Geräte des Haus-Boten) zwischen from und to. Mit Helfer aus HA,
  // ohne aus der Mitschrift im Browser. → { S, P (geparst, aufsteigend), bote (Ereignisse), fail }
  async _diaryHist(from, to) {
    const c = this._cfg;
    const hass = this._hass;
    const haS = !!c.entity && !this._noEntity;
    const haP = !!c.plan_entity && !!hass?.states[c.plan_entity] && this._planMax() >= PLAN_MIN;
    const house = c.diary_house !== false ? this._boteSync().list : [];
    const ids = [...new Set([...(haS ? [c.entity] : []), ...(haP ? [c.plan_entity] : []), ...house.map((a) => a.cfg.state)])];
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
        console.warn('pika-pet-card: Verlauf für das Tagebuch nicht lesbar', e);
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
        const s = BOTE_ALIAS[raw] || raw;
        if (BOTE_DEAD.has(s)) continue;
        if (s === 'finished' && BOTE_RUN.has(last) && r.t >= from) bote.push({ t: r.t, k: 'bote', type: a.type, name: a.name });
        last = s;
      }
    }
    // Helfer da, aber kein einziger Stand im Verlauf: Der Recorder zeichnet ihn nicht auf
    return { S, P, bote, fail, none: !fail && ((haS && !S.length) || (haP && !P.length)) };
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
    const page = (start, end, today) => this._diaryModel(start, end, R, H.bote, today, H.fail);
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

  // Eine Seite: Einträge { t, part, icon, text, … } in Reihenfolge, Zähler (chips) und der Satz oben
  _diaryModel(start, end, R, extra, today, fail) {
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

    if (ws >= start && ws <= until) {
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
    const cnt = { feed: 0, clean: 0 };
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
        if (['pino', 'bird', 'plane', 'bfly', 'heart'].includes(e.b) || (e.b === 'coffee' && house)) put(t, e.b, tx(T[e.b], e.b, t));
      } else if (e.k === 'parcel') {
        one.add('parcel');
        put(t, 'parcel', this._diaryParcel(e, t), { svg: GIFT_ITEMS[e.it]?.svg });
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
    if (!fail && R.data && b0 - a0 >= DIARY.gap) {
      const ts = [a0, ...R.stamps.filter((t) => t > a0 && t < b0), b0];
      let bi = 1;
      for (let i = 2; i < ts.length; i++) if (ts[i] - ts[i - 1] > ts[bi] - ts[bi - 1]) bi = i;
      if (ts[bi] - ts[bi - 1] >= DIARY.gap) {
        put(ts[bi - 1] + 2, 'secret', tx(T.secret, 'secret', ts[bi - 1]), { dim: true, tm: `${diaryTime(ts[bi - 1])} bis ${diaryTime(ts[bi])}` });
      }
    }
    if (we > start && we <= until) put(we, 'sleep', tx(T.sleep, 'sleep', we), { part: hourPart(we) });

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
      fazit = this._sleepTime() ? 'Psst, ich schlafe gerade. Blättere ruhig leise.'
        : s < 30 ? 'Liebes Tagebuch, mein Bauch knurrt gerade ein bisschen.'
          : c < 30 ? 'Liebes Tagebuch, auf meiner Wiese müsste mal jemand sauber machen.'
            : g < 30 ? 'Liebes Tagebuch, ich hätte gern ein paar Streicheleinheiten.'
              : one.has('parcel') ? 'Liebes Tagebuch, heute ist ein aufregender Tag: Es gab ein Päckchen!'
                : Math.min(s, g, c) >= 70 ? 'Liebes Tagebuch, heute geht es mir richtig gut.'
                  : 'Liebes Tagebuch, heute ist ein gemütlicher Tag.';
    } else {
      fazit = !mine.length ? 'Liebes Tagebuch, über gestern weiß ich leider nichts mehr.'
        : one.has('parcel') ? 'Liebes Tagebuch, gestern war ein aufregender Tag: Es gab ein Päckchen!'
          : one.has('hungry') && pet >= 10 ? 'Liebes Tagebuch, gestern hat mein Bauch mal geknurrt. Aber gestreichelt wurde ich ganz viel.'
            : one.has('hungry') ? 'Liebes Tagebuch, gestern hat mein Bauch mal geknurrt. Sonst war es schön.'
              : pet >= 10 ? 'Liebes Tagebuch, gestern wurde ich ganz viel gestreichelt. Das war schön.'
                : 'Liebes Tagebuch, gestern war ein schöner Tag.';
    }
    return { start, entries: out, chips, fazit, early: today && ws > now };
  }

  _diaryPage(M, today, fail, none) {
    let h = `<p class="fazit">${esc(M.fazit)}</p>`;
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
    if (fail) h += '<p class="note">Ich finde nicht alle Seiten: Der Verlauf von Home Assistant antwortet gerade nicht.</p>';
    else if (none) h += '<p class="note">Ich finde nicht alle Seiten: Home Assistant zeichnet für meine Helfer keinen Verlauf auf (Recorder).</p>';
    return h;
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
      h += row(ICON_HEART, 'Pflege-Serie', esc(I.days === 1 ? '1 Tag am Stück' : `${I.days} Tage am Stück`));
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
    this._diaryRender();
    root.querySelector('.sheet').focus();
    if (only) return;
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

  _diaryRender() {
    const D = this._dia;
    if (!D) return;
    const pg = D.root.querySelector('.page');
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
    pg.scrollTop = 0;
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
