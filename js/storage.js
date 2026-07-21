/* ============================================================
 * storage.js — localStorage persistence (scores, streaks, best times)
 * Degrades gracefully to an in-memory store when localStorage is
 * unavailable (private mode / file:// restrictions).
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'ost.v1';
  var available = true;
  var mem = {};

  try {
    var t = '__ost_test__';
    global.localStorage.setItem(t, '1');
    global.localStorage.removeItem(t);
  } catch (e) {
    available = false;
  }

  function read() {
    if (!available) return mem;
    try {
      var raw = global.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function write(obj) {
    if (!available) { mem = obj; return; }
    try { global.localStorage.setItem(KEY, JSON.stringify(obj)); }
    catch (e) { available = false; mem = obj; }
  }

  // One-time data migrations. Bump SCHEMA and add a step whenever a stored
  // field changes meaning, so old values are not misread. Runs at load (before
  // any gameplay writes new data) and stamps db.__schema so each step runs once.
  var SCHEMA = 1;
  function migrate() {
    var db = read();
    var done = db.__schema || 0;
    if (done >= SCHEMA) return;
    // v1: Test switched from storing a raw correct-count to storing a grade (%).
    // A pre-upgrade test score is a raw count that would render as a bogus "N%",
    // so clear it; the play count stays valid and "best" restarts under the new unit.
    if (done < 1 && db.test) { db.test.bestScore = null; db.test.lastScore = null; }
    db.__schema = SCHEMA;
    write(db);
  }
  migrate();

  // Record a result for a mode. Tracks best score and best (lowest) time.
  // result = { score, total, timeMs }  (any field optional)
  function record(mode, result) {
    var db = read();
    var rec = db[mode] || { plays: 0, bestScore: null, bestTimeMs: null, lastScore: null };
    rec.plays += 1;
    if (typeof result.score === 'number') {
      rec.lastScore = result.score;
      if (rec.bestScore === null || result.score > rec.bestScore) rec.bestScore = result.score;
    }
    if (typeof result.timeMs === 'number' && result.timeMs > 0) {
      if (rec.bestTimeMs === null || result.timeMs < rec.bestTimeMs) rec.bestTimeMs = result.timeMs;
    }
    db[mode] = rec;
    write(db);
    return rec;
  }

  function get(mode) {
    var db = read();
    return db[mode] || { plays: 0, bestScore: null, bestTimeMs: null, lastScore: null };
  }

  function all() { return read(); }

  function clear() {
    if (available) { try { global.localStorage.removeItem(KEY); } catch (e) {} }
    mem = {};
  }

  function fmtTime(ms) {
    if (ms === null || ms === undefined) return '—';
    var s = ms / 1000;
    var m = Math.floor(s / 60);
    var rem = (s - m * 60);
    return m > 0 ? (m + ':' + rem.toFixed(1).padStart(4, '0')) : (rem.toFixed(1) + 's');
  }

  global.Store = {
    available: function () { return available; },
    record: record,
    get: get,
    all: all,
    clear: clear,
    fmtTime: fmtTime
  };
})(window);
