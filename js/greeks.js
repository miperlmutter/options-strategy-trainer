/* ============================================================
 * greeks.js — conceptual net-Greek profiles + helpers
 * Greeks are CONCEPTUAL SIGNS ONLY (long / short / neutral).
 * The Greeks mini-game (js/modes/greeks.js) builds on this.
 * ============================================================ */
(function (global) {
  'use strict';

  var GREEKS = ['delta', 'gamma', 'theta', 'vega'];
  var SIGN_LABEL = { long: 'long', short: 'short', neutral: '~neutral' };
  var GREEK_LABEL = { delta: 'Delta (Δ)', gamma: 'Gamma (Γ)', theta: 'Theta (Θ)', vega: 'Vega (V)' };

  // Plain-language meaning of each net sign — used in flashcards/reference.
  var MEANING = {
    delta: { long: 'gains as the underlying rises', short: 'gains as the underlying falls', neutral: 'little directional bias' },
    gamma: { long: 'delta grows in your favor as price moves', short: 'delta moves against you as price moves', neutral: 'stable delta' },
    theta: { long: 'time decay works for you', short: 'time decay works against you', neutral: 'little time sensitivity' },
    vega: { long: 'gains when implied vol rises', short: 'gains when implied vol falls', neutral: 'little vol sensitivity' }
  };

  function profileString(s) {
    return GREEKS.map(function (g) { return SIGN_LABEL[s.greeks[g]]; }).join(' / ');
  }

  global.Greeks = {
    GREEKS: GREEKS,
    SIGN_LABEL: SIGN_LABEL,
    GREEK_LABEL: GREEK_LABEL,
    MEANING: MEANING,
    profileString: profileString
  };
})(window);
