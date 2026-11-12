// Haus-Bote: Geräte lesen, Requisiten am Bau, Fähnchen, Aktionen an den Geräten

import { rnd, pick, clamp, esc } from '../logik/hilfen.js';
import {
  BOTE_K, BOTE_EMPTY_MS, BOTE_AUTOOPEN_MS, BOTE_FRONT, BOTE_FRONT_DY, BOTE_TALL, boteRow, BOTE_RUN, BOTE_HALT,
  BOTE_IDLE, BOTE_DEAD, BOTE_WARNED, BOTE_TYPE, BOTE_NAME, BOTE_COLOR, BOTE_ACT, BOTE_SAY, BOTE_OPEN, BOTE_LIVE_MS,
  BOTE_WAIT_MS, BOTE_HIST_MS, boteState, boteMap, boteEmptyOn, boteLabel, boteLabelMode, boteSmell,
} from '../logik/haus-bote.js';
import { BOTE_LINE, BOTE_PLATE_SVG, BOTE_TOWEL_SVG, BOTE_SVG } from '../grafik/haus-bote.js';

export class HausBote {
  // Waschmaschine, Trockner, Spülmaschine aus `appliances`. Jedes Gerät hat ein Requisit am Bau (.hb in .props),
  // das seine Phase zeigt: run (läuft), done (fertig, noch zu), empty (ausgeräumt, 20 Minuten).
  // "Ausgeräumt" nur nach einem echten Programmende: live (fertig → ready/inactive, oder Tür bei "fertig" auf;
  // der Pika räumt sichtbar auf), läuft → aus kurz vor Schluss, und nach dem Neuladen nur, wenn last_changed und
  // Fortschritt/Endzeit plausibel ein Programmende zeigen. Einschalten, Abbruch und Ausfälle zählen nicht.

  _hassBote(hass) {
    const B = this._boteSync();
    if (!B.list.length) return;
    const S = hass.states;
    const now = this._haNow();
    for (const a of B.list) {
      const c = a.cfg;
      const o = [S[c.state], c.progress && S[c.progress], c.end && S[c.end], c.door && S[c.door]];
      if (a.seen && o.every((v, i) => v === a.objs[i])) continue;
      a.objs = o;
      this._boteRead(a, o, now);
    }
    this._boteHist();
  }

  _attachBote() {
    if (this._boteSync().list.length) this._boteRefresh();
  }

  _detachBote() {
    if (!this._bote) return;
    this._boteFxClear();
    for (const a of this._bote.list) this._boteTag(a, false);
  }

  _hiddenBote(hidden) {
    if (!hidden && this._bote?.list.length) this._boteRefresh();
  }

  _layoutBote(first) {
    const B = this._boteSync();
    if (!B.list.length || !this._g) return;
    for (const a of B.list) this._boteRender(a, true);
    this._boteLayout();
  }

  _tickBote() {
    const B = this._boteSync();
    if (!B.list.length) return;
    // Live-Aufräumen, das der Pika nicht innerhalb von 3 Minuten geschafft hat: einfach ausgeräumt zeigen
    const now = this._haNow();
    for (const a of B.queue) if (now - a.liveAt > 180000) a.live = false;
    B.queue = B.queue.filter((a) => a.live);
    this._boteRefresh();
  }

  _boteActs(ctx) {
    const B = this._bote;
    if (!B?.list.length || !this._g) return [];
    B.queue = B.queue.filter((a) => a.live && a.phase === 'empty');
    if (B.queue.length) return [[1000, 'boteEmpty']];
    const now = this._haNow();
    const acts = [];
    // Fertig und noch zu: alle 3–6 Minuten hinhoppeln und Bescheid sagen
    if (B.list.some((a) => a.phase === 'done' && a.el && !a.live && now >= a.nudgeAt)) acts.push([8, 'boteNudge']);
    // Läuft: ab und zu damit beschäftigen, höchstens alle 2 Minuten
    if (now - B.runAt > 120000) {
      for (const a of B.list) if (a.phase === 'run' && a.el && !BOTE_HALT.has(a.st)) acts.push([0.6, BOTE_ACT[a.type]]);
    }
    return acts;
  }

  // ---------- Haus-Bote: Zustand ----------

  // Geräteliste aus der Konfiguration; ändert sie sich, fängt alles neu an. Ohne Geräte entsteht kein Element.
  _boteSync() {
    const cfg = this._cfg?.appliances;
    const B0 = this._bote;
    if (B0 && B0.ref === cfg) return B0;
    const key = Array.isArray(cfg) && cfg.length ? JSON.stringify(cfg) : '';
    if (B0 && B0.key === key) {
      B0.ref = cfg;
      return B0;
    }
    if (B0) this._boteDrop(B0);
    const list = [];
    if (key) {
      cfg.forEach((c, i) => {
        const type = BOTE_TYPE[String(c?.type || '').toLowerCase().replace(/[\s_-]/g, '')];
        if (!type || !c.state) {
          const m = !type ? `unbekannter Gerätetyp "${c?.type}" (washer, dryer, dishwasher)` : `Gerät ${i + 1} ohne state`;
          if (!BOTE_WARNED.has(m)) {
            BOTE_WARNED.add(m);
            console.warn(`pika-pet-card Haus-Bote: ${m}`);
          }
          return;
        }
        const emptyOn = boteEmptyOn(c);
        if (c.empty_on != null && emptyOn !== c.empty_on) {
          const m = `Gerät ${i + 1}: empty_on "${c.empty_on}" geht nicht${c.empty_on === 'door' ? ' ohne door' : ' (door oder idle)'}, nehme ${emptyOn}`;
          if (!BOTE_WARNED.has(m)) {
            BOTE_WARNED.add(m);
            console.warn(`pika-pet-card Haus-Bote: ${m}`);
          }
        }
        list.push({
          idx: i, type, cfg: c, name: String(c.name || BOTE_NAME[type]), phase: null, view: null, nudgeAt: 0, objs: [],
          emptyOn, map: boteMap(c.state_map),
        });
      });
      // Zwei Geräte gleichen Typs ohne eigenen Namen: durchnummerieren, damit die Fähnchen eindeutig sind
      for (const t of Object.keys(BOTE_NAME)) {
        const same = list.filter((a) => a.type === t && !a.cfg.name);
        if (same.length > 1) same.forEach((a, n) => (a.name = `${BOTE_NAME[t]} ${n + 1}`));
      }
    }
    this._bote = { ref: cfg, key, list, queue: [], runAt: 0, f: null, t: null };
    return this._bote;
  }

  _boteDrop(B) {
    // Eine laufende Bote-Aktion hängt an den alten Geräten und Ebenen: abbrechen
    if (this._action?.startsWith('bote')) this._interrupt();
    cancelAnimationFrame(this._boteRaf);
    for (const a of B.list) {
      clearTimeout(a.tagT);
      clearTimeout(a.inT);
      a.el?.remove();
      a.bar?.remove();
      a.tag?.remove();
    }
    B.bars?.remove();
    B.f?.remove();
    B.t?.remove();
  }

  // Neue Zustände eines Geräts lesen. Home Connect bleibt nach Programmende auf "finished", bis die Tür
  // aufgeht, dann "ready", später "inactive"; andere Hersteller über BOTE_ALIAS bzw. state_map. "Ausgeräumt" gilt nur
  // nach einem echten Programmende, nicht beim Einschalten, Abbrechen oder Löschen der Startvorwahl. Wann, sagt
  // empty_on (boteEmptyOn): "idle" (fertig → aus, oder läuft → aus kurz vor Schluss) oder, Standard mit Tür, "door":
  // erst wenn die Tür nach Programmende aufgeht, auch wenn das Gerät inzwischen "ready" meldet (Spülmaschinen von
  // Home Connect tun das nach einer Minute von selbst; bis 0.35 galt das als ausgeräumt). Ohne echten Zustand
  // (unavailable, unknown) bleibt das Gerät, wie es war. Alle Fristen laufen ab dem Zeitpunkt des Ereignisses in HA,
  // nicht ab dem Eintreffen (ein Handy-Tab, der Stunden später aufwacht, räumt nicht mehr sichtbar auf).
  // replay: Stand aus dem Verlauf nachspielen (_boteHist): nichts zeigen, nicht melden, nicht unterbrechen.
  _boteRead(a, [st, pr, en, dr], now, replay = false) {
    const norm = (v) => String(v ?? '').split('.').pop().toLowerCase().replace(/[\s_-]/g, '');
    const lc = (o) => Math.min(now, Date.parse(o?.last_changed) || Date.parse(o?.last_updated) || now);
    const raw = norm(st?.state);
    let s = boteState(raw, a.map);
    const dead = BOTE_DEAD.has(s);
    // Lange nicht erreichbar (> 15 Min): wie nach dem Neuladen lesen, sonst käme das Aufräumen zur falschen Zeit
    const longDead = !dead && a.deadAt != null && now - a.deadAt > 15 * 60000;
    a.deadAt = dead ? a.deadAt ?? now : null;
    const first = !a.seen || longDead;
    a.seen = true;
    // Trockner im Knitterschutz: Tür auf meldet manchmal "pause" – er bleibt fertig
    if (a.st === 'finished' && s === 'pause' && !first) s = 'finished';
    if (!replay) this._boteWarn(a, st, s, dead, [pr, en, dr]);
    const pct = this._botePct(pr, a);
    const end = this._boteEnd(en, now);
    const doorDead = !dr || BOTE_DEAD.has(norm(dr.state));
    const door = doorDead ? !!a.door : BOTE_OPEN.has(norm(dr.state));
    const doorAt = doorDead ? now : lc(dr);
    const prevSt = a.st;
    const prevPct = a.pct;
    const prevEnd = a.end;
    const prevDoor = !!a.door;
    const prevOpened = !!a.opened;
    // Ausfall: alter Zustand gilt weiter (keine neue Phase, kein neues Stupsen), gültige Werte kommen trotzdem an
    const cur = dead && !first ? prevSt : s;
    const stChanged = first || cur !== prevSt;
    Object.assign(a, {
      st: cur, door,
      changed: stChanged && !dead ? lc(st) : a.changed ?? now,
      pct: pct ?? (dead ? prevPct : null),
      end: end ?? (dead ? prevEnd : null),
    });
    if (cur !== 'finished' && !a.wait) a.opened = false;
    else if (cur === 'finished' && stChanged) {
      a.finAt = a.changed;
      a.opened = false;
      a.wait = false;
    }
    // Programmlauf merken: seit wann, und die letzten gültigen Werte (gehen am Ende oft vor dem Zustand auf
    // unavailable). Daran erkennt "läuft → aus", ob es ein Programmende oder ein Abbruch war. Nur Werte, die nach dem
    // Start kamen: Ein Fortschritt von 100 vom letzten Lauf hieße sonst bei einem Abbruch gleich danach „fertig“.
    if (BOTE_RUN.has(cur)) {
      if (!BOTE_RUN.has(prevSt) || first) a.run = { at: a.changed, pct: null, end: null };
      if (pct != null && (!pr || lc(pr) >= a.run.at - 5000)) a.run.pct = pct;
      if (end != null && (!en || lc(en) >= a.run.at - 5000)) a.run.end = end;
      a.wait = false;
    }
    // Ausgeräumt zur Zeit t: Frist ab t; sichtbar mit aufräumen nur, wenn es eben erst geschah
    let live = false;
    const emptied = (t) => {
      a.emptyUntil = t + BOTE_EMPTY_MS;
      a.wait = false;
      live = !replay && now - t < BOTE_LIVE_MS;
    };
    // Frist für "ausgeräumt" (emptyUntil): 0 = keine, null = läuft/fertig
    const idle = BOTE_IDLE.has(cur);
    const byDoor = a.emptyOn === 'door';
    // Tür nach Programmende geöffnet (nicht der AutoOpen-Spalt in den ersten 2 Minuten): ausgeräumt. Wieder zu zählt
    // immer: Den AutoOpen-Spalt schließt kein Gerät von selbst, und wer gleich nach dem Ende ausräumt und zumacht,
    // bliebe sonst „fertig“.
    const doorEvent = !doorDead && !a.opened && (a.wait || cur === 'finished') && doorAt >= a.finAt
      && ((door && !prevDoor && doorAt - a.finAt > BOTE_AUTOOPEN_MS) || (!door && prevDoor));
    if (first) {
      if (BOTE_RUN.has(cur)) a.emptyUntil = null;
      else if (cur === 'finished') {
        // Tür jetzt offen und später als 2 Minuten nach Programmende geöffnet: ausgeräumt. Ein „zu“ sagt nach dem
        // Neuladen nichts (auch ein kurzes unavailable → closed setzt last_changed neu): Ob sie dazwischen offen war,
        // weiß erst der Verlauf (_boteHist).
        a.opened = !!dr && !doorDead && door && doorAt - a.finAt > BOTE_AUTOOPEN_MS;
        a.emptyUntil = a.opened ? doorAt + BOTE_EMPTY_MS : null;
      } else if (idle) {
        // Nach dem Neuladen nur, wenn es plausibel ein Programmende war: Fortschritt steht noch auf (fast) 100,
        // oder (ohne Fortschritt) eine gültige Endzeit hat sich um dieselbe Zeit geändert. Im Zweifel nicht (auch
        // nicht nach einem HA-Neustart, der alle last_changed gleichsetzt).
        // Kein Neustart: der setzt alle last_changed auf dieselbe Zeit (_haBoot). Der Fortschritt muss außerdem in
        // der Stunde vor dem Ausschalten so weit gekommen sein (nicht ein alter Stand vom Vortag beim Einschalten).
        // Mit Tür (empty_on: door) weiß das erst der Verlauf: bis dahin nichts zeigen.
        const near = [pr, en].some((o) => o && !BOTE_DEAD.has(norm(o.state)) && Math.abs(lc(o) - a.changed) <= 5 * 60000);
        const pAge = pr ? a.changed - lc(pr) : NaN;
        const ok = pct != null ? pct >= 95 && pAge >= 30000 && pAge <= 60 * 60000 : near;
        a.emptyUntil = ok && !byDoor && !this._haBoot(a.changed) ? a.changed + BOTE_EMPTY_MS : 0;
      } else a.emptyUntil = 0;
    } else if (BOTE_RUN.has(cur)) a.emptyUntil = null;
    else if (doorEvent) {
      a.opened = true;
      emptied(doorAt);
    } else if (cur === 'finished') {
      if (stChanged) a.emptyUntil = null;
    } else if (stChanged && !a.wait) {
      // Programmende oder Abbruch? Nach den letzten gültigen Werten des Laufs; ohne Werte erst ab 10 Minuten
      // Laufzeit (ein Abbruch gleich nach dem Start, bevor Fortschritt oder Endzeit kamen, zählt nicht)
      const R = a.run || {};
      const ended = R.pct == null && R.end == null ? a.changed - (R.at ?? a.changed) >= 10 * 60000
        : (R.pct != null && R.pct >= 95) || (R.end != null && Math.abs(R.end - a.changed) < 10 * 60000);
      if (idle && prevSt === 'finished') {
        // schon beim Türöffnen gewertet: die Frist läuft weiter. Wartet es auf die Tür: weiter „fertig“.
        if (prevOpened) a.emptyUntil ||= 0;
        else if (byDoor) a.wait = true;
        else emptied(a.changed);
      } else if (idle && BOTE_RUN.has(prevSt) && ended) {
        // direkt aus (ohne "fertig"): auch dann räumt er sichtbar mit auf; mit Tür ist es erst jetzt fertig
        if (byDoor) Object.assign(a, { wait: true, finAt: a.changed, opened: false });
        else emptied(a.changed);
      } else if (a.emptyUntil == null) {
        // Abbruch, Einschalten, ready → inactive …: keine neue Frist, eine laufende behält ihr Ende
        a.emptyUntil = 0;
      }
    }
    const ph = this._botePhase(a, now);
    const from = a.phase;
    if (ph !== from) {
      a.phase = ph;
      if (ph !== 'empty') a.live = false;
      if (!replay) {
        if (ph === 'done') a.nudgeAt = now + (first ? rnd(20000, 60000) : rnd(5000, 12000));
        // Programm vorbei, während er gerade damit spielt: aufhören
        if (from === 'run' && this._action === BOTE_ACT[a.type]) this._interrupt();
        if (live && (from === 'done' || from === 'run') && ph === 'empty') this._boteLive(a);
      }
    }
    if (!replay) this._boteRender(a);
  }

  _botePhase(a, now) {
    // Seit über 30 Minuten nicht erreichbar: lieber nichts zeigen als ewig "fertig"
    if (a.deadAt != null && now - a.deadAt > 30 * 60000) return null;
    if (BOTE_RUN.has(a.st)) return 'run';
    if (a.st === 'finished' && !a.opened) return 'done';
    // wartet auf die Tür (empty_on: door): fertig, aber nach einem Tag ohne Tür nicht mehr
    if (a.wait && !a.opened) return now - (a.finAt ?? now) < BOTE_WAIT_MS ? 'done' : null;
    return a.emptyUntil && now < a.emptyUntil ? 'empty' : null;
  }

  // Beim Laden: Zustand und Tür der letzten 24 Stunden aus dem Recorder nachspielen. Erst damit weiß ein frisch
  // geladenes Gerät, ob ein „ready“ ein Programmende war und ob die Tür danach wirklich aufging (ein kurzes
  // unavailable → closed ist kein Öffnen). Einmal je Konfiguration; scheitert es, bleibt die Schätzung aus dem
  // jetzigen Stand.
  _boteHist() {
    const B = this._bote;
    const hass = this._hass;
    if (!B?.list.length || B.hist || !hass?.callWS) return;
    B.hist = 'läuft';
    const ids = [...new Set(B.list.flatMap((a) => [a.cfg.state, ...(a.cfg.door ? [a.cfg.door] : [])]))];
    const to = this._haNow();
    Promise.resolve(hass.callWS({
      type: 'history/history_during_period', start_time: new Date(to - BOTE_HIST_MS).toISOString(), end_time: new Date(to + 60000).toISOString(),
      entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
    })).then((res) => {
      if (this._bote !== B) return;
      B.hist = 'fertig';
      for (const a of B.list) this._boteReplay(a, res || {});
      this._boteRefresh();
    }).catch((e) => {
      if (this._bote !== B) return;
      B.hist = 'fehlgeschlagen';
      console.debug('pika-pet-card Haus-Bote: Verlauf nicht lesbar, Stand geschätzt', e);
    });
  }

  // Ein Gerät aus dem Verlauf neu aufbauen, dann den jetzigen Stand darauflegen
  _boteReplay(a, res) {
    const rows = (id) => (Array.isArray(res[id]) ? res[id] : [])
      .map((r) => ({ t: Math.round((Number(r.lu ?? r.lc) || Date.parse(r.last_updated || r.last_changed) / 1000) * 1000), s: r.s ?? r.state }))
      .filter((r) => Number.isFinite(r.t));
    const S = rows(a.cfg.state).map((r) => ({ ...r, k: 0 }));
    if (!S.length) return;
    const D = a.cfg.door ? rows(a.cfg.door).map((r) => ({ ...r, k: 1 })) : [];
    const ev = [...S, ...D].sort((x, y) => x.t - y.t || x.k - y.k);
    const keep = { el: a.el, bar: a.bar, tag: a.tag, view: a.view, spec: a.spec, objs: a.objs };
    for (const k of ['seen', 'st', 'door', 'changed', 'pct', 'end', 'opened', 'wait', 'finAt', 'run', 'emptyUntil', 'deadAt', 'phase', 'live']) delete a[k];
    const o = (r) => r && { state: r.s, last_changed: new Date(r.t).toISOString() };
    let st = null;
    let dr = null;
    for (const r of ev) {
      if (r.k) dr = r;
      else st = r;
      if (st) this._boteRead(a, [o(st), null, null, o(dr)], r.t, true);
    }
    Object.assign(a, keep);
    // der jetzige Stand (mit Fortschritt und Endzeit) obendrauf, wie ein gewöhnliches Update
    const S0 = this._hass?.states || {};
    const c = a.cfg;
    a.objs = [S0[c.state], c.progress && S0[c.progress], c.end && S0[c.end], c.door && S0[c.door]];
    this._boteRead(a, a.objs, this._haNow());
  }

  // Einmal je Seite und Grund melden (auch bei mehreren Karten): Entity fehlt oder Zustand unbekannt
  _boteWarn(a, st, s, dead, more) {
    const c = a.cfg;
    const msgs = [];
    if (!st) msgs.push(`Entity ${c.state} nicht gefunden`);
    else if (!dead && !BOTE_RUN.has(s) && !BOTE_IDLE.has(s) && s !== 'finished') msgs.push(`unbekannter Zustand "${st.state}" von ${c.state}`);
    ['progress', 'end', 'door'].forEach((k, i) => c[k] && !more[i] && msgs.push(`Entity ${c[k]} nicht gefunden`));
    for (const m of msgs) {
      if (BOTE_WARNED.has(m)) continue;
      BOTE_WARNED.add(m);
      console.warn(`pika-pet-card Haus-Bote: ${m}`);
    }
  }

  // Fortschritt in %; ohne Einheit "%" gilt ein Wert zwischen 0 und 1 als Anteil (0.45 → 45 %), eine ganze 1 aber
  // als 1 % (ganzzahlige Prozent ohne Einheit), außer das Gerät meldete schon Anteile (a.frac) oder "1.0"
  _botePct(pr, a) {
    let v = Number.parseFloat(pr?.state);
    if (!Number.isFinite(v)) return null;
    if (pr.attributes?.unit_of_measurement !== '%' && v > 0 && v <= 1) {
      if (v < 1) a.frac = true;
      if (v < 1 || a.frac || /\./.test(pr.state)) v *= 100;
    }
    return clamp(v, 0, 100);
  }

  // Endzeit: Zeitstempel, oder Restzeit als Zahl (Einheit s/min/h aus unit_of_measurement, sonst Minuten) bzw.
  // als h:mm(:ss). Nur Werte von jetzt −1 h bis +24 h zählen, alles andere (z. B. "83" als Jahr) wird ignoriert.
  _boteEnd(en, now) {
    const v = String(en?.state ?? '').trim();
    if (BOTE_DEAD.has(v.toLowerCase())) return null;
    const base = Math.min(now, Date.parse(en.last_changed) || Date.parse(en.last_updated) || now);
    let t;
    if (/^-?\d+(\.\d+)?$/.test(v)) {
      const u = String(en.attributes?.unit_of_measurement || 'min').toLowerCase();
      t = base + Number(v) * ({ ms: 1, s: 1e3, sec: 1e3, m: 6e4, min: 6e4, h: 36e5, d: 864e5 }[u] ?? 6e4);
    } else if (/^\d+:\d\d(:\d\d)?$/.test(v)) {
      const [h, m, sec = 0] = v.split(':').map(Number);
      t = base + ((h * 60 + m) * 60 + sec) * 1000;
    } else t = Date.parse(v);
    return Number.isFinite(t) && t >= now - 36e5 && t <= now + 864e5 ? t : null;
  }

  // Zeitabhängiges neu bewerten (Frist abgelaufen, "fertig seit …"), Wind für die Wäscheleine
  _boteRefresh() {
    const B = this._bote;
    if (!B?.list.length) return;
    const now = this._haNow();
    for (const a of B.list) {
      if (!a.seen) continue;
      const ph = this._botePhase(a, now);
      if (ph !== a.phase) {
        a.phase = ph;
        if (ph !== 'empty') a.live = false;
      }
      this._boteRender(a, true);
    }
    this._boteLayout();
  }

  // Gerade live ausgeräumt: Der Pika räumt sichtbar auf, wenn man zuschaut und er wach ist
  _boteLive(a) {
    if (!this._g || !this._attached || this._away() || this._asleep) return;
    const B = this._bote;
    a.live = true;
    a.liveAt = this._haNow();
    if (!B.queue.includes(a)) B.queue.push(a);
    // Eine Beschäftigung aus dem Tagesplan macht er fertig (sie finge sonst von vorn an), aufgeräumt wird danach
    const slot = this._slot && this._action === this._slot.act;
    if (this._running && !this._wx.shelter && !this._next && !slot
      && !['eatFood', 'goSleep', 'wakeUp', 'poop', 'boteEmpty', 'coffee', 'giftShoot', 'giftOpen'].includes(this._action)) this._interrupt();
  }

  _boteText(a) {
    // Uhrzeit in der Zeitzone, die HA im Profil eingestellt hat (Server- oder Browserzeit)
    const hs = this._hass;
    const tz = hs?.locale?.time_zone === 'server' ? hs.config?.time_zone : undefined;
    const hm = (t) => {
      const o = { hour: '2-digit', minute: '2-digit' };
      try {
        return new Date(t).toLocaleTimeString('de-DE', tz ? { ...o, timeZone: tz } : o);
      } catch (e) {
        return new Date(t).toLocaleTimeString('de-DE', o); // unbekannte Zeitzone
      }
    };
    if (a.phase === 'run') {
      const p = [];
      const s = a.st;
      const label = { pause: 'Pause', delayedstart: 'Startvorwahl', actionrequired: 'braucht Hilfe', error: 'Störung', aborting: 'bricht ab' }[s];
      if (label) p.push(label);
      if (a.pct != null && s !== 'delayedstart') p.push(`${Math.round(a.pct)} %`);
      else if (!p.length) p.push('läuft');
      if (a.end && s !== 'aborting') p.push(a.end > this._haNow() ? `fertig um ${hm(a.end)}` : 'gleich fertig');
      return p.join(' · ');
    }
    if (a.phase === 'done') {
      const m = Math.floor((this._haNow() - (a.finAt ?? a.changed)) / 60000);
      if (m < 1) return 'gerade fertig';
      return `fertig seit ${m < 60 ? `${m} Min` : `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min` : ''}`}`;
    }
    return 'ausgeräumt';
  }

  // ---------- Haus-Bote: Requisiten ----------

  // Ebenen in .props: Requisiten, davor die Fortschrittsbalken (.hb-bars ohne eigenen Stapelkontext, damit vordere
  // Balken mit ihrem Requisit vor den Pika kommen), Werkzeug/Getragenes (.hb-f) und Fähnchen (.hb-t)
  _boteLayers() {
    const B = this._bote;
    if (B.f) return;
    B.bars = document.createElement('div');
    B.bars.className = 'hb-bars';
    B.f = document.createElement('div');
    B.f.className = 'hb-f';
    B.t = document.createElement('div');
    B.t.className = 'hb-t';
    this._el.props.append(B.bars, B.f, B.t);
  }

  // Requisit an die Phase angleichen. Beim Live-Aufräumen bleibt das Bild davor stehen (Wäsche im Korb,
  // Handtuchstapel, Tellerstapel), bis der Pika fertig ist.
  _boteRender(a, noLayout) {
    if (!this._g || !this._el) return;
    const view = a.phase && a.live ? (a.type === 'washer' ? 'empty' : 'done') : a.phase;
    if (!view) {
      if (a.el) {
        const { el, bar, lab } = a;
        a.el = a.bar = a.lab = a.spec = a.view = null;
        el.classList.add('hb-bye');
        bar.classList.remove('on');
        lab?.classList.remove('on');
        setTimeout(() => (el.remove(), bar.remove(), lab?.remove()), 600);
        this._boteTag(a, false);
        if (!noLayout) this._boteLayout();
      }
      return;
    }
    this._boteLayers();
    let relayout = false;
    if (!a.el) {
      const el = document.createElement('div');
      el.className = `hb hb-${a.type}`;
      el.setAttribute('role', 'button');
      el.innerHTML = '<div class="hb-i"></div><span class="hb-a">!</span><span class="hb-sm"><i></i><i></i><i></i></span>';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._found('device');
        this._boteTag(a, !a.tag?.classList.contains('open'));
      });
      this._keyTap(el);
      this._el.props.insertBefore(el, this._bote.bars);
      const bar = document.createElement('div');
      bar.className = 'hb-bar';
      bar.innerHTML = '<b></b>';
      bar.style.setProperty('--bc', BOTE_COLOR[a.type]);
      this._bote.bars.appendChild(bar);
      // Schild (appliance_labels): Restzeit bzw. seit wann fertig, über dem Requisit
      const lab = document.createElement('div');
      lab.className = 'hb-lab';
      this._bote.bars.appendChild(lab);
      a.el = el;
      a.bar = bar;
      a.lab = lab;
    }
    const el = a.el;
    if (view !== a.view) {
      a.view = view;
      a.spec = BOTE_SVG[a.type](view, a.idx);
      el.firstElementChild.innerHTML = `<svg viewBox="${a.spec.vb.join(' ')}" aria-hidden="true">${a.spec.svg}</svg>`;
      el.classList.remove('hb-in', 'hb-emptied', 'hb-boop');
      void el.offsetWidth;
      el.classList.add('hb-in');
      clearTimeout(a.inT);
      a.inT = setTimeout(() => el.classList.remove('hb-in'), 650);
      relayout = true;
    }
    const cl = el.classList;
    for (const p of ['run', 'done', 'empty']) cl.toggle(`hb-${p}`, view === p);
    cl.toggle('hb-live', !!a.live);
    cl.toggle('hb-hang', !!a.live && a.type === 'washer');
    if (!a.live) cl.remove('hb-emptied');
    const halt = view === 'run' && BOTE_HALT.has(a.st);
    cl.toggle('hb-pause', halt);
    cl.toggle('hb-alert', view === 'run' && (a.st === 'error' || a.st === 'actionrequired'));
    // Ruhe, solange der Pika schläft, und nachts außer bei laufenden Geräten (schwaches Tablet)
    // Seit über einer Stunde fertig: auch ruhig (der Pika erinnert ja weiter daran). Nasse Wäsche nicht: Sie wird
    // lauter, mit Müffel-Wölkchen (boteSmell).
    const now = this._haNow();
    const smell = a.live ? 0 : boteSmell(a, now);
    const night = this._el.scene.classList.contains('night');
    const still = !!this._asleep || (view !== 'run' && night)
      || (view === 'done' && !smell && now - (a.finAt || 0) > 60 * 60000);
    cl.toggle('hb-still', still);
    cl.toggle('hb-smell', smell > 0 && !this._asleep && !night);
    cl.toggle('hb-smell2', smell > 1 && !this._asleep && !night);
    // Wind: Richtung aus dem Wetter, Stärke macht das Wehen weiter und schneller
    const wind = this._wind || 0;
    el.style.setProperty('--hbw', `${(-(this._windDir || -1) * clamp(3 + wind / 3.5, 3, 18)).toFixed(1)}deg`);
    el.style.setProperty('--hbs', `${clamp(2.6 - wind / 25, 0.8, 2.6).toFixed(2)}s`);
    // Was über dem Gerät steht (appliance_labels): Fortschritt (Balken, Restzeit) nur bei „all“
    const mode = boteLabelMode(this._cfg.appliance_labels);
    const bar = a.bar;
    bar.classList.toggle('on', view === 'run' && mode === 'all');
    bar.classList.toggle('ind', a.pct == null);
    bar.classList.toggle('pause', halt);
    bar.classList.toggle('hb-still', still);
    if (a.pct != null) bar.style.setProperty('--p', `${a.pct.toFixed(1)}%`);
    const lt = mode === 'none' || a.live || (mode === 'done' && view !== 'done') ? null : boteLabel(a, now);
    if (a.lab.textContent !== (lt || '')) {
      a.lab.textContent = lt || '';
      if (a.spec && a.k) this._boteLabPos(a);
    }
    a.lab.classList.toggle('on', !!lt);
    a.lab.classList.toggle('done', view === 'done');
    const text = this._boteText(a);
    el.setAttribute('aria-label', `${a.name}: ${text}`);
    if (a.tag?.classList.contains('open')) this._boteTagText(a);
    if (relayout && !noLayout) this._boteLayout();
  }

  // Alle Geräte stehen vorn am unteren Rand (näher am Betrachter, also etwas größer und vor dem Pika), von links
  // in der Reihenfolge der Konfiguration. Frei bleiben der Eingang (dort schläft der Pika), die Bodendeko der
  // Festtage und der Vorrat (Nische bzw. Heuhaufen): siehe boteRow. Reicht der Platz nicht, werden alle gemeinsam
  // gleich stark kleiner. Setzt nur Positionen und tut nichts, wenn sich nichts ändert.
  _boteLayout() {
    const B = this._bote;
    if (!this._g || !this._el || !B?.list.length) return;
    const row = B.list.filter((a) => a.el && a.spec).sort((x, y) => x.idx - y.idx);
    // Leere Reihe: die Signatur vergessen. Kommt danach dieselbe Ansicht wieder (Programm abgebrochen und neu
    // gestartet), bekäme das neue Requisit sonst weder Platz noch Größe und läge riesig oben links.
    if (!row.length) {
      B.sig = null;
      this._boteEdge(0);
      return;
    }
    const H = this._H;
    const W = this._W;
    const { hole, hayL, hayR, fMin } = this._g;
    const gap = 0.02 * H;
    const m = 0.01 * H;
    // die hohe Wäscheleine steht vorn deutlich kleiner, sonst überragt sie den Pika
    const w1 = row.map((a) => a.spec.vb[2] * BOTE_K * H * BOTE_FRONT * (a.spec.back ? BOTE_TALL : 1));
    // Bodendeko mit festem Platz (Kürbis, Stiefel, Kranz, Kuchen, Baum, Geschenk); Ostereier und Raketenstäbe sind
    // über die ganze Wiese verstreut und zählen nicht
    const deko = Object.entries(this._festPos || {}).filter(([n]) => !/^(egg|stick)/.test(n))
      .map(([, p]) => [p.l - m, p.l + p.w + m]);
    const r = boteRow(w1, {
      // (rechts steht am Vorabend der Abholung die Mülltonne, siehe Haus-Signale)
      gap, left: 6, right: W - 6 - (this._sigBinW || 0), door: [hole.l - m, hole.r + m], deko, store: [hayL - m, hayR + m],
      meadow: fMin * W + 0.1 * H,
    });
    const out = row.map((a, i) => ({ a, l: r.xs[i], w: w1[i] * r.k }));
    const sig = `${W}x${this._Hs}|${out.map((p) => `${p.a.idx}${p.a.view}:${p.l.toFixed(1)}:${p.w.toFixed(1)}`).join('|')}`;
    if (sig === B.sig) return;
    B.sig = sig;
    for (const p of out) this._botePlace(p.a, p.l, p.w);
    const last = out[out.length - 1];
    this._boteEdge(last.l + last.w);
  }

  // Rechtes Ende der Geräte-Reihe merken: Reicht sie bis auf die Wiese, liegen Häufchen erst rechts davon
  // (ein Gerät stünde sonst davor, und man käme zum Putzen nicht mehr heran)
  _boteEdge(x) {
    if (x === (this._boteRowR || 0)) return;
    this._boteRowR = x;
    this._placePiles?.();
  }

  // Requisit vorn am unteren Rand setzen
  _botePlace(a, l, w) {
    const fr = true;
    const sp = a.spec;
    const H = this._H;
    const k = w / sp.vb[2];
    const { gy } = this._g;
    const ground = gy + BOTE_FRONT_DY * H;
    Object.assign(a, { l, k, w, fr, x: l + w / 2, top: ground - (sp.ground - sp.vb[1]) * k });
    a.vTop = this._boteY(a, sp.vt);
    const s = a.el.style;
    s.left = `${l.toFixed(1)}px`;
    s.top = `${a.top.toFixed(1)}px`;
    s.width = `${w.toFixed(1)}px`;
    a.el.classList.toggle('hb-fr', fr);
    if (!a.el.classList.contains('hb-placed')) requestAnimationFrame(() => a.el?.classList.add('hb-placed'));
    // Fortschrittsbalken immer unter dem Requisit: vorn mit kleinem Abstand unter der Grafik, hinten im
    // Grasstreifen unter dem sichtbaren Teil (dort steckt auch der Pika im Gras, seine Pfoten bleiben frei)
    const [u0, u1] = sp.part;
    const bw = Math.min((u1 - u0) * k * 0.72, H * 0.16);
    const bh = clamp(H * 0.018, 3, 6);
    const bs = a.bar.style;
    a.bar.classList.toggle('hb-fr', fr);
    bs.left = `${(this._boteX(a, (u0 + u1) / 2) - bw / 2).toFixed(1)}px`;
    const bottom = Math.max(ground, a.top + sp.vb[3] * k);
    bs.top = `${(fr ? Math.min(bottom + 0.012 * H, this._Hs - bh - 0.02 * H) : gy - 0.03 * H).toFixed(1)}px`;
    bs.width = `${bw.toFixed(1)}px`;
    this._boteLabPos(a);
    if (a.tag?.classList.contains('open')) this._boteTagPos(a);
  }

  // Schild mittig über dem sichtbaren Teil des Requisits, ganz in der Karte
  _boteLabPos(a) {
    const L = a.lab;
    if (!L || !a.spec || !this._g) return;
    const [u0, u1] = a.spec.part;
    const ls = L.style;
    ls.left = '0px';
    const w = L.offsetWidth;
    const h = L.offsetHeight;
    ls.left = `${clamp(this._boteX(a, (u0 + u1) / 2) - w / 2, 2, Math.max(2, this._W - w - 2)).toFixed(1)}px`;
    ls.top = `${clamp(a.vTop - h - 0.012 * this._H, 2, Math.max(2, this._Hs - h - 2)).toFixed(1)}px`;
  }

  // Requisit-Einheiten → px; ist das Requisit schon weg (Phase vorbei), die Pika-Position bzw. die Bodenlinie
  _boteX(a, u) {
    return a.spec && a.k ? a.l + u * a.k : this._x;
  }

  _boteY(a, v) {
    return a.spec && a.k ? a.top + (v - a.spec.vb[1]) * a.k : this._g.gy;
  }

  // Fähnchen: Gerätename und Stand, schließt nach 9 s; liegt über Statusleiste und Futterknopf
  _boteTag(a, open) {
    clearTimeout(a.tagT);
    if (!open) {
      a.tag?.classList.remove('open');
      return;
    }
    if (!a.el) return;
    // immer nur ein Fähnchen offen, damit sie sich nicht überdecken
    for (const o of this._bote.list) if (o !== a) this._boteTag(o, false);
    if (!a.tag) {
      a.tag = document.createElement('div');
      a.tag.className = 'hb-tag';
      a.tag.addEventListener('click', (e) => (e.stopPropagation(), this._boteTag(a, false)));
      this._bote.t.appendChild(a.tag);
    }
    a.tag.classList.add('open');
    this._boteTagText(a);
    a.tagT = setTimeout(() => this._boteTag(a, false), 9000);
  }

  _boteTagText(a) {
    const html = `<b>${esc(a.name)}</b><div class="more">${esc(this._boteText(a))}</div>`;
    if (html !== a.tagHtml) {
      a.tagHtml = html;
      a.tag.innerHTML = html;
    }
    this._boteTagPos(a);
  }

  // Breite erst an der linken Kante messen (sonst begrenzt die alte Lage die Breite), dann über dem Requisit
  // mittig, aber ganz in der Karte; breiter als die Karte geht es dank max-width und … nicht
  _boteTagPos(a) {
    if (!a.tag || !a.el || !this._g) return;
    const ts = a.tag.style;
    ts.left = '0px';
    const w = Math.min(a.tag.offsetWidth, this._W - 8);
    const h = a.tag.offsetHeight;
    ts.left = `${clamp(a.x - w / 2, 4, Math.max(4, this._W - w - 4)).toFixed(1)}px`;
    ts.top = `${clamp(a.vTop - h - 6, 2, Math.max(2, this._Hs - h - 4)).toFixed(1)}px`;
  }

  // ---------- Haus-Bote: Aktionen ----------

  // Ziel-Gerät: Wunsch aus der Vorschau (_boteFocus = Typ oder Index), sonst das erste passende; beim Beschäftigen
  // mit laufenden Geräten keins, das gerade pausiert, auf den Start wartet oder eine Störung hat
  _boteFind(type, phase) {
    const f = this._boteFocus;
    this._boteFocus = null;
    const ok = (a) => a.el && a.spec && a.phase === phase && !a.live && (!type || a.type === type)
      && !(phase === 'run' && BOTE_HALT.has(a.st));
    const list = this._bote?.list || [];
    return list.find((a) => ok(a) && f != null && (a.type === f || a.idx === f)) || list.find(ok) || null;
  }

  // Standplatz neben einem Bereich L..R im Abstand off (px, von der Pika-Mitte): die nähere Seite, wenn dort Platz ist
  _boteSpot(L, R, off) {
    const { pW } = this._g;
    const lo = pW * 0.45;
    const hi = this._W - pW * 0.45;
    const xl = L - off;
    const xr = R + off;
    const cur = this._liveX();
    let face = Math.abs(cur - xl) <= Math.abs(cur - xr) ? 1 : -1;
    if (face > 0 && xl < lo) face = -1;
    else if (face < 0 && xr > hi) face = 1;
    return { x: face > 0 ? xl : xr, face };
  }

  _boteCls(...names) {
    this._boteC ??= new Set();
    for (const n of names) {
      this._boteC.add(n);
      this._el.pika.classList.add(n);
    }
  }

  _boteUncls() {
    for (const n of this._boteC || []) this._el.pika.classList.remove(n);
    this._boteC?.clear();
  }

  // Tätscheln/Stupsen: nach vorn lehnen, das Requisit wackelt
  _botePat(a, boop = true) {
    const p = this._el.pika;
    p.classList.remove('hb-pat');
    void p.offsetWidth;
    this._boteCls('hb-pat');
    if (boop && a.el) {
      a.el.classList.remove('hb-boop');
      void a.el.offsetWidth;
      a.el.classList.add('hb-boop');
    }
  }

  _boteFxClear() {
    cancelAnimationFrame(this._boteRaf);
    this._boteRaf = 0;
    this._bote?.f?.querySelectorAll('.hb-fx').forEach((e) => e.remove());
  }

  // Effekt in die vordere Ebene; false, wenn es sie nicht (mehr) gibt (Konfiguration gewechselt)
  _boteFx(...els) {
    const f = this._bote?.f;
    if (!f) return false;
    f.append(...els);
    return true;
  }

  _boteBubbles(x, y, n) {
    for (let i = 0; i < n; i++) {
      const b = document.createElement('span');
      b.className = 'hb-bbl hb-fx';
      b.style.left = `${(x + rnd(-0.025, 0.025) * this._H).toFixed(1)}px`;
      b.style.top = `${y.toFixed(1)}px`;
      b.style.setProperty('--dx', `${rnd(-8, 8).toFixed(1)}px`);
      b.style.animationDelay = `${i * 140}ms`;
      if (!this._boteFx(b)) return;
      setTimeout(() => b.remove(), 1300 + i * 140);
    }
  }

  // Etwas, das der Pika trägt: folgt ihm bei jedem Bild (Hoppeln und Sprünge eingerechnet).
  // rx/ry = Haltepunkt in Anteilen der Pika-Grafik (Pfoten 0.758/0.6, Maul 0.9/0.6), size = Breite × Kartenhöhe
  _boteCarry(svg, rx, ry, size) {
    const el = document.createElement('div');
    el.className = 'hb-carry hb-fx';
    el.style.setProperty('--cw', `${(this._H * size).toFixed(1)}px`);
    el.innerHTML = `<i>${svg}</i>`;
    this._boteFx(el);
    // Gemessen wird je Bild nur das Nötige: die drei Stile (Pika, Hoppeln, Sprung) sind einmal geholt und werden nur
    // gelesen. Hat sich keiner geändert (er steht, poliert den Teller), wird nichts gerechnet und nichts geschrieben,
    // der Browser muss dann auch nichts neu durchrechnen. Früher: viermal getComputedStyle und ein Schreiben je Bild.
    const cs = [this._el.pika, this.shadowRoot.querySelector('.hop'), this._el.jump].map((e) => getComputedStyle(e));
    const mat = (t) => (t && t !== 'none' ? new DOMMatrixReadOnly(t) : null);
    let last = '';
    cancelAnimationFrame(this._boteRaf);
    const step = () => {
      if (!el.isConnected || !this._g) return;
      this._boteRaf = requestAnimationFrame(step);
      const [tp, th, tj] = cs.map((c) => c.transform);
      const d = this._dir;
      const key = `${tp}|${th}|${tj}|${d}`;
      if (key === last) return;
      last = key;
      const { pW, pH, gy } = this._g;
      const P = mat(tp);
      const x = (P ? P.m41 + pW / 2 : this._x) + d * (rx - 0.5) * pW;
      const y = gy - 0.945 * pH + ry * pH + (P ? P.m42 : -this._lift) + (mat(th)?.m42 || 0) + (mat(tj)?.m42 || 0);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scaleX(${d})`;
    };
    step();
    return el;
  }

  // Rührstock von der Pfote (px, py) schräg in den Schaum (tx, ty), mit Schaumkragen
  _boteStick(px, py, tx, ty) {
    const len = Math.hypot(px - tx, py - ty) + this._H * 0.025;
    const s = document.createElement('div');
    s.className = 'hb-stick hb-fx';
    s.style.left = `${tx.toFixed(1)}px`;
    s.style.top = `${(ty - len).toFixed(1)}px`;
    s.style.height = `${len.toFixed(1)}px`;
    s.style.setProperty('--ba', `${((Math.atan2(px - tx, ty - py) * 180) / Math.PI).toFixed(1)}deg`);
    const r = document.createElement('div');
    r.className = 'hb-ring hb-fx';
    r.style.left = `${tx.toFixed(1)}px`;
    r.style.top = `${ty.toFixed(1)}px`;
    this._boteFx(s, r);
  }

  // Waschmaschine läuft: hinter dem Zuber stehen und umrühren, dann landet eine Seifenblase auf der Nase
  async _boteStir() {
    const a = this._boteFind('washer', 'run');
    if (!a) return;
    this._bote.runAt = this._haNow();
    const { pW, pH, gy } = this._g;
    const H = this._H;
    const tc = this._boteX(a, 23);
    const s = this._boteSpot(tc, tc, 0.258 * pW + 0.012 * H);
    await this._walkTo(s.x, 0.9);
    this._face(s.face);
    const p = this._el.pika;
    try {
      await this._wait(250);
      if (!a.el) return;
      a.el.classList.add('hb-busy');
      this._boteCls('hb-stir');
      const px = this._x + s.face * 0.258 * pW;
      this._boteStick(px, gy - 0.335 * pH - this._lift, tc + s.face * 0.012 * H, this._boteY(a, 16.8));
      const until = Date.now() + rnd(4500, 7000);
      while (Date.now() < until) {
        await this._wait(rnd(1300, 2100));
        if (a.el) this._boteBubbles(tc, this._boteY(a, 14), 2);
        if (Math.random() < 0.3) this._say(pick(['rühr, rühr…', 'blubb!', 'schaumig!']), 1100);
      }
      this._boteFxClear();
      this._boteUncls();
      a.el?.classList.remove('hb-busy');
      if (!a.el) return;
      // Seifenblase steigt aus dem Schaum, schwebt hoch und landet auf der Nase
      const nx = this._x + s.face * 0.258 * pW;
      const ny = gy - 0.42 * pH - this._lift;
      const fx = tc;
      const fy = this._boteY(a, 13);
      const b = document.createElement('div');
      b.className = 'hb-soap hb-fx';
      b.innerHTML = '<i></i>';
      this._boteFx(b);
      b.animate([
        { transform: `translate(${fx}px, ${fy}px) scale(.3)`, opacity: 0 },
        { transform: `translate(${(fx + nx) / 2 + rnd(-6, 6)}px, ${Math.min(fy, ny) - H * 0.12}px) scale(.9)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${nx}px, ${ny}px) scale(1)`, opacity: 1 },
      ], { duration: 2200, easing: 'ease-in-out', fill: 'forwards' });
      p.classList.add('look-up');
      await this._wait(1300);
      p.classList.remove('look-up');
      await this._wait(900);
      this._blink();
      await this._wait(900);
      this._twitch();
      await this._wait(500);
      b.classList.add('pop');
      this._peep(nx, ny - H * 0.06, 'plopp!');
      this._jump('hop1');
      await this._wait(400);
      this._say(pick(['hihi!', 'hatschi!', 'hihi']), 1200);
      await this._wait(1500);
    } finally {
      a.el?.classList.remove('hb-busy');
      p.classList.remove('look-up');
      this._boteFxClear();
      this._boteUncls();
    }
  }

  // Trockner läuft: der Trommel zuschauen, oft im Liegen; Augen und Kopf drehen mit
  async _boteWatchDrum() {
    const a = this._boteFind('dryer', 'run');
    if (!a) return;
    this._bote.runAt = this._haNow();
    const { pW } = this._g;
    const s = this._boteSpot(this._boteX(a, 6), this._boteX(a, 40), 0.55 * pW);
    await this._walkTo(s.x, 0.8);
    this._face(s.face);
    const p = this._el.pika;
    try {
      p.classList.add('look-f');
      await this._wait(rnd(800, 1400));
      this._boteCls('hb-drum');
      if (Math.random() < 0.6) {
        p.classList.add('lying');
        await this._wait(500);
      }
      const until = Date.now() + rnd(7000, 12000);
      while (Date.now() < until) {
        await this._wait(rnd(1500, 3000));
        const r = Math.random();
        if (r < 0.25) this._say(pick(['rundherum…', 'hui!', 'oh!', 'Socken!']), 1100);
        else if (r < 0.45) this._twitch();
      }
      this._boteUncls();
      p.classList.remove('lying');
      await this._wait(500);
      if (Math.random() < 0.3) this._say('*gähn*', 1200);
      else this._jump('hop1');
      await this._wait(900);
    } finally {
      p.classList.remove('lying', 'look-f');
      this._boteUncls();
    }
  }

  // Spülmaschine läuft: hinter dem Tisch einen Teller ein paarmal in die Schüssel tunken
  async _boteDip() {
    const a = this._boteFind('dishwasher', 'run');
    if (!a) return;
    this._bote.runAt = this._haNow();
    const { pW, pH, gy } = this._g;
    const H = this._H;
    const bc = this._boteX(a, 22);
    const s = this._boteSpot(bc, bc, 0.258 * pW);
    await this._walkTo(s.x, 0.9);
    this._face(s.face);
    try {
      await this._wait(250);
      if (!a.el) return;
      a.el.classList.add('hb-busy');
      this._boteCls('hb-hold');
      const px = this._x + s.face * 0.258 * pW;
      const py = gy - 0.335 * pH - this._lift;
      const wy = this._boteY(a, 19.6);
      const r = 0.032 * H;
      const top = py - 2.4 * r;
      const w = document.createElement('div');
      w.className = 'hb-dipw hb-fx';
      Object.assign(w.style, { left: `${px - 1.5 * r}px`, top: `${top}px`, width: `${3 * r}px`, height: `${Math.max(r, wy - top)}px` });
      w.innerHTML = `<i style="left:${0.5 * r}px;top:${1.4 * r}px;width:${2 * r}px">${BOTE_PLATE_SVG}</i>`;
      this._boteFx(w);
      const plate = w.firstElementChild;
      const deep = `translateY(${(wy - py + 1.25 * r).toFixed(1)}px)`;
      const n = 2 + Math.floor(rnd(0, 2));
      for (let i = 0; i < n; i++) {
        await this._wait(rnd(500, 900));
        plate.animate([{ transform: 'none' }, { transform: `${deep} rotate(-10deg)` }, { transform: 'none' }], { duration: 1200, easing: 'ease-in-out' });
        await this._wait(600);
        this._boteBubbles(px, wy, 3);
        if (i === 0) this._say(pick(['blubb!', 'plitsch!']), 900);
        await this._wait(600);
      }
      this._say(pick(['sauber!', 'blitzblank!', 'hihi']), 1100);
      await this._wait(700);
      // zurück in die Schüssel
      plate.animate([{ transform: 'none' }, { transform: deep }], { duration: 600, easing: 'ease-in', fill: 'forwards' });
      await this._wait(650);
      this._boteBubbles(px, wy, 2);
      await this._wait(700);
    } finally {
      a.el?.classList.remove('hb-busy');
      this._boteFxClear();
      this._boteUncls();
    }
  }

  // Fertig: hinhoppeln, tätscheln/stupsen, zum Betrachter schauen und Bescheid sagen
  async _boteNudge() {
    const B = this._bote;
    const f = this._boteFocus;
    this._boteFocus = null;
    const done = (B?.list || []).filter((o) => o.phase === 'done' && o.el && !o.live);
    const a = done.find((o) => f != null && (o.type === f || o.idx === f))
      || done.sort((x, y) => x.nudgeAt - y.nudgeAt)[0];
    if (!a) return;
    const { pW } = this._g;
    const p = this._el.pika;
    let patted = false;
    try {
      const [u0, u1] = a.spec.part;
      const s = this._boteSpot(this._boteX(a, u0), this._boteX(a, u1), 0.35 * pW);
      if (Math.abs(this._liveX() - s.x) > pW) {
        this._say('!', 700);
        await this._wait(450);
      }
      await this._walkTo(s.x, 1.3);
      this._face(s.face);
      await this._wait(250);
      const n = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        if (!a.el) return;
        this._botePat(a);
        await this._wait(560);
      }
      patted = true;
      this._boteUncls();
      if (a.type === 'dryer') {
        this._say('flauschig!', 1100);
        this._happy(1000);
        await this._wait(1200);
      }
      // Nasse Wäsche liegt seit Stunden: Nase zuhalten
      if (boteSmell(a, this._haNow()) > 1) {
        this._twitch();
        this._mimik('defy', 1800);
        this._say(pick(['puh!', 'müffelt!', 'puuh…']), 1300);
        await this._wait(1500);
      }
      // Kopf zum Betrachter, Maul auf: "Wäsche!"
      this._boteCls('hb-look');
      p.classList.add('calling');
      this._say(pick(BOTE_SAY[a.type]), 1600);
      this._jump('hop1');
      await this._wait(900);
      p.classList.remove('calling');
      await this._wait(1000);
      this._boteUncls();
      await this._wait(rnd(400, 900));
    } finally {
      p.classList.remove('calling');
      this._boteUncls();
      a.el?.classList.remove('hb-boop');
      // Seit über einer Stunde fertig: nur noch alle 20–30 Minuten daran erinnern. Nasse Wäsche nicht (sie müffelt)
      const late = this._haNow() - (a.finAt || 0) > 60 * 60000 && a.type !== 'washer';
      a.nudgeAt = this._haNow() + (patted ? rnd(late ? 20 : 3, late ? 30 : 6) * 60000 : 30000);
    }
  }

  // Gerade ausgeräumt (live): aufhängen, Handtuch oder Teller in den Bau tragen, dann Freude
  async _boteEmpty() {
    const B = this._bote;
    if (!B?.list.length) return;
    const f = this._boteFocus;
    this._boteFocus = null;
    let a = f != null ? B.list.find((o) => (o.type === f || o.idx === f) && o.phase === 'empty' && o.el) : null;
    a ||= B.queue.find((o) => o.live && o.phase === 'empty');
    if (!a) return;
    B.queue = B.queue.filter((o) => o !== a);
    a.live = true;
    a.liveAt = this._haNow();
    this._boteRender(a);
    try {
      this._say('!', 800);
      await this._wait(500);
      if (a.type === 'washer') await this._boteHang(a);
      else if (a.type === 'dryer') await this._boteTowel(a);
      else await this._botePlate(a);
      this._happy();
      this._jump('binky');
      this._say(pick(['fertig!', 'geschafft!', '♥']), 1300);
      await this._wait(1300);
    } finally {
      this._boteFxClear();
      this._boteUncls();
      a.live = false;
      this._boteRender(a);
    }
  }

  // Wäsche aus dem Korb holen und Stück für Stück an die Leine hängen (hochspringen, Klammer dran)
  async _boteHang(a) {
    if (!a.el) return;
    a.el.querySelectorAll('.hb-cl').forEach((g) => g.classList.remove('on'));
    a.el.classList.remove('hb-emptied');
    const { pW } = this._g;
    const kx = this._boteX(a, 58);
    const s = this._boteSpot(kx, kx, 0.4 * pW);
    await this._walkTo(s.x, 1.1);
    this._face(s.face);
    await this._wait(200);
    this._botePat(a, false);
    await this._wait(600);
    this._boteUncls();
    const xs = BOTE_LINE.map(([u]) => this._boteX(a, u));
    const order = this._x > this._boteX(a, 42) ? [3, 2, 1, 0] : [0, 1, 2, 3];
    for (const i of order) {
      await this._walkTo(xs[i], 1.1);
      await this._wait(150);
      this._jump('hop1');
      await this._wait(280);
      a.el?.querySelector(`.hb-c${i}`)?.classList.add('on');
      await this._wait(520);
    }
    a.el?.classList.add('hb-emptied');
    this._face(this._x < this._W / 2 ? 1 : -1);
    await this._wait(400);
  }

  // Trockner ausgeräumt: oberstes Handtuch nehmen ("flauschig!") und in den Bau tragen, der Stapel ist weg
  async _boteTowel(a) {
    if (!a.el) return;
    const { pW } = this._g;
    const s = this._boteSpot(this._boteX(a, 36), this._boteX(a, 60), 0.32 * pW);
    await this._walkTo(s.x, 1.1);
    this._face(s.face);
    await this._wait(250);
    this._botePat(a, false);
    await this._wait(500);
    this._boteUncls();
    a.el?.querySelector('.hb-t3')?.classList.add('hb-gone');
    this._boteCarry(BOTE_TOWEL_SVG, 0.9, 0.6, 0.085);
    this._say('flauschig!', 1200);
    await this._wait(800);
    a.el?.querySelectorAll('.hb-t1, .hb-t2, .hb-steam').forEach((e) => e.classList.add('hb-gone'));
    await this._boteToBurrow();
  }

  // Spülmaschine ausgeräumt: obersten Teller nehmen, polieren (funkelt) und in den Bau tragen
  async _botePlate(a) {
    if (!a.el) return;
    const { pW, pH, gy } = this._g;
    const s = this._boteSpot(this._boteX(a, 14), this._boteX(a, 36), 0.3 * pW);
    await this._walkTo(s.x, 1.1);
    this._face(s.face);
    await this._wait(250);
    this._botePat(a, false);
    await this._wait(450);
    this._boteUncls();
    a.el?.querySelector('.hb-p4')?.classList.add('hb-gone');
    this._boteCls('hb-polish');
    const c = this._boteCarry(BOTE_PLATE_SVG, 0.758, 0.6, 0.065);
    c.classList.add('hb-shine');
    for (let i = 0; i < 4; i++) {
      await this._wait(650);
      this._sparkle(this._x + this._dir * 0.258 * pW, gy - 0.345 * pH - this._lift, 1);
    }
    this._say('blitzblank!', 1200);
    this._boteUncls();
    this._boteCls('hb-hold');
    c.classList.remove('hb-shine');
    a.el?.querySelectorAll('.hb-plates > g, .hb-tw').forEach((e) => e.classList.add('hb-gone'));
    await this._wait(500);
    await this._boteToBurrow();
  }

  // Zum Eingang tragen, Getragenes verschwindet an der Tür, kurz drinnen, wieder heraus
  async _boteToBurrow() {
    await this._walkTo(this._g.home, 0.9);
    this._bote?.f?.querySelectorAll('.hb-carry').forEach((e) => e.classList.add('hb-gone'));
    await this._enterBurrow();
    this._boteFxClear();
    this._boteUncls();
    await this._wait(rnd(1400, 2200));
    await this._comeOut();
  }
}
