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
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function profileSig(s) { return [s.priceOutlook, s.volOutlook, s.profitPotential, s.risk].join('|'); }

  function viewSentence(s) {
    var risk = s.risk === 'undefined' ? 'will accept undefined risk' : 'want defined, limited risk';
    var profit = s.profitPotential === 'unlimited' ? ', ideally with unlimited upside' : '';
    return 'You expect ' + PRICE[s.priceOutlook] + ', with ' + VOL[s.volOutlook] +
           '. You ' + risk + profit + '. Which strategy best fits?';
  }

  function makeQuestion(pool) {
    var target = pick(pool);
    var sig = profileSig(target);
    // distractors must NOT share the target's full profile (so the answer is unique among the 4)
    var differ = pool.filter(function (s) { return s.id !== target.id && profileSig(s) !== sig; });
    var fallback = pool.filter(function (s) { return s.id !== target.id; });
    var distract = shuffle(differ.length >= 3 ? differ : fallback).slice(0, 3);
    var opts = shuffle([target].concat(distract));
    return {
      prompt: viewSentence(target),
      options: opts.map(function (s) { return s.name; }),
      answer: opts.indexOf(target),
      explain: target.name + ' — ' + target.priceOutlook + ', ' + target.volOutlook +
               ', profit ' + target.profitPotential + ', risk ' + target.risk + '. ' + target.blurb
    };
  }

  var DB = global.DrillBank = global.DrillBank || {};
  DB.outlook = function (pool) { return function () { return makeQuestion(pool); }; };
})(window);
