/* ============================================================
 * modes/greeks.js — Greeks question factories (consumed by Drills)
 * No longer a top-level mode. Exposes on global.DrillBank:
 *   greeksIdentify(pool) -> make()   ("which strategy is net …", profile↔strategy)
 *   greeksPredict(pool)  -> make()   (price/vol/time scenario → profit/loss/flat)
 * Each make() yields an MC question:
 *   { prompt|promptText, promptMono?, options[], answer, explain, mono? }
 * These run as timed-10 drills under the Drills tab.
 * ============================================================ */
(function (global) {
  'use strict';

  var G = function () { return global.Greeks; };

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function sample(a, n) { return shuffle(a).slice(0, n); }
  function profileStr(s) {
    var L = G().SIGN_LABEL;
    return 'Δ ' + L[s.greeks.delta] + ' · Γ ' + L[s.greeks.gamma] + ' · Θ ' + L[s.greeks.theta] + ' · V ' + L[s.greeks.vega];
  }

  var DB = global.DrillBank = global.DrillBank || {};

  /* ===================== Identify ===================== */
  DB.greeksIdentify = function (pool) {
    function genWhichStrategy() {
      var g = pick(G().GREEKS), sign = pick(['long', 'short']);
      var m = pool.filter(function (s) { return s.greeks[g] === sign; });
      var nm = pool.filter(function (s) { return s.greeks[g] !== sign; });
      if (!m.length || nm.length < 3) return null;
      var c = pick(m), opts = shuffle([c].concat(sample(nm, 3)));
      return { prompt: 'Which strategy is net ' + sign + ' ' + G().GREEK_LABEL[g] + '?',
        options: opts.map(function (s) { return s.name; }), answer: opts.indexOf(c),
        explain: c.name + ' is net ' + sign + ' ' + G().GREEK_LABEL[g] + ' — ' + G().MEANING[g][sign] + '.' };
    }
    function genWhatSign() {
      var s = pick(pool), g = pick(G().GREEKS), L = G().SIGN_LABEL, opts = [L.long, L.short, L.neutral];
      return { prompt: 'What is the net ' + G().GREEK_LABEL[g] + ' of a ' + s.name + '?',
        options: opts, answer: opts.indexOf(L[s.greeks[g]]),
        explain: 'A ' + s.name + ' is net ' + L[s.greeks[g]] + ' ' + G().GREEK_LABEL[g] + ' — ' + G().MEANING[g][s.greeks[g]] + '.' };
    }
    function genProfileToStrategy() {
      var c = pick(pool), cp = profileStr(c), others = pool.filter(function (s) { return profileStr(s) !== cp; });
      if (others.length < 3) return null;
      var opts = shuffle([c].concat(sample(others, 3)));
      return { promptText: 'Which strategy has this net Greek profile?', promptMono: cp,
        options: opts.map(function (s) { return s.name; }), answer: opts.indexOf(c), explain: cp + ' is the profile of a ' + c.name + '.' };
    }
    function genStrategyToProfile() {
      var c = pick(pool), cp = profileStr(c), seen = {}, others = []; seen[cp] = true;
      shuffle(pool).forEach(function (s) { var p = profileStr(s); if (!seen[p]) { seen[p] = true; others.push(p); } });
      if (others.length < 3) return null;
      var opts = shuffle([cp].concat(others.slice(0, 3)));
      return { promptText: 'What is the net Greek profile of a ' + c.name + '?', options: opts, answer: opts.indexOf(cp), mono: true, explain: 'A ' + c.name + ': ' + cp + '.' };
    }
    var GENS = [genWhichStrategy, genWhatSign, genProfileToStrategy, genStrategyToProfile];
    return function () { return pick(GENS)(); };
  };

  /* ===================== Predict the P&L ===================== */
  var SCENARIOS = [
    { text: 'the underlying RISES', greek: 'delta', invert: false },
    { text: 'the underlying FALLS', greek: 'delta', invert: true },
    { text: 'implied VOLATILITY RISES', greek: 'vega', invert: false },
    { text: 'implied VOLATILITY FALLS', greek: 'vega', invert: true },
    { text: 'a day passes with NO move (TIME decay)', greek: 'theta', invert: false },
    { text: 'the underlying makes a BIG move (either direction)', greek: 'gamma', invert: false }
  ];
  function flip(sign) { return sign === 'long' ? 'short' : (sign === 'short' ? 'long' : 'neutral'); }

  DB.greeksPredict = function (pool) {
    var OPTS = ['Profit', 'Loss', 'Little change'];
    return function () {
      var s = pick(pool), sc = pick(SCENARIOS);
      var sign = s.greeks[sc.greek];
      var eff = sc.invert ? flip(sign) : sign;
      var outcome = eff === 'long' ? 'Profit' : (eff === 'short' ? 'Loss' : 'Little change');
      return {
        prompt: 'You hold a ' + s.name + '. If ' + sc.text + ', what happens to your P&L (all else equal)?',
        options: OPTS.slice(), answer: OPTS.indexOf(outcome),
        explain: 'A ' + s.name + ' is net ' + G().SIGN_LABEL[sign] + ' ' + G().GREEK_LABEL[sc.greek] +
                 ' (' + G().MEANING[sc.greek][sign] + ') → ' + outcome.toLowerCase() + '.'
      };
    };
  };
})(window);
