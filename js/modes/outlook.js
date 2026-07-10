/* ============================================================
 * modes/outlook.js — Outlook → Strategy question factory (consumed by Drills)
 * No longer a top-level mode. Exposes on global.DrillBank:
 *   outlook(pool) -> make()   describes a market view (direction + vol + risk
 *   appetite) and asks for the best-fitting strategy. Tests SELECTION.
 * make() yields an MC question: { prompt, options[], answer, explain }.
 * Runs as a timed-10 drill under the Drills tab.
 * ============================================================ */
(function (global) {
  'use strict';

  var PRICE = {
    bullish: 'the underlying to rise',
    bearish: 'the underlying to fall',
    neutral: 'the underlying to stay range-bound',
    agnostic: 'a large move in either direction'
  };
  var VOL = {
    'long vol': 'implied volatility to rise',
    'short vol': 'implied volatility to fall or stay low',
    'neutral': 'volatility is not your main bet'
  };

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function profileSig(s) { return [s.priceOutlook, s.volOutlook, s.profitPotential, s.risk].join('|'); }

  function viewSentence(s) {
    var risk = s.risk === 'undefined' ? 'will accept undefined risk' : 'want defined, limited risk';
    var profit = s.profitPotential === 'unlimited' ? ', ideally with unlimited upside' : '';
    return 'You expect ' + PRICE[s.priceOutlook] + ', with ' + VOL[s.volOutlook] +
           '. You ' + risk + profit + '. Which strategy best fits?';
  }

  function build(target, differ) {
    var distract = shuffle(differ).slice(0, 3);
    var opts = shuffle([target].concat(distract));
    return {
      prompt: viewSentence(target),
      options: opts.map(function (s) { return s.name; }),
      answer: opts.indexOf(target),
      explain: target.name + ' — ' + target.priceOutlook + ', ' + target.volOutlook +
               ', profit ' + target.profitPotential + ', risk ' + target.risk + '. ' + target.blurb
    };
  }

  function makeQuestion(pool) {
    // Every distractor must have a DIFFERENT full profile than the target, since
    // the prompt is built only from the profile, so a same-profile option would
    // be just as correct. Prefer a target with >=3 such peers (a full 4-option
    // question); fall back to any target with >=1; give up if the pool is all one
    // profile (the runner regenerates / widens scope).
    var order = shuffle(pool);
    var fallback = null;
    for (var t = 0; t < order.length; t++) {
      var target = order[t];
      var sig = profileSig(target);
      var differ = pool.filter(function (s) { return s.id !== target.id && profileSig(s) !== sig; });
      if (differ.length >= 3) return build(target, differ);
      if (differ.length >= 1 && !fallback) fallback = { target: target, differ: differ };
    }
    return fallback ? build(fallback.target, fallback.differ) : null;
  }

  var DB = global.DrillBank = global.DrillBank || {};
  DB.outlook = function (pool) { return function () { return makeQuestion(pool); }; };
})(window);
