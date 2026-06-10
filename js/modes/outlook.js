/* ============================================================
 * modes/outlook.js — Outlook → Strategy quiz
 * Describes a market view (direction + volatility + risk appetite)
 * and the intern picks the strategy that best fits. Tests strategy
 * SELECTION / decision-making (the recognition modes don't).
 * Immediate feedback + streak + score; best score persists.
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

  function init(view, ctx) {
    var h = ctx.h;
    var pool = ctx.strategies;
    var state = { i: 0, n: 10, score: 0, streak: 0, qs: [], answered: false };

    view.appendChild(h('h1', { text: 'Outlook → Strategy' }));
    view.appendChild(h('p', { class: 'sub', text: 'You\'re given a market view — direction, volatility, and risk appetite. Pick the strategy that best fits. This is about CHOOSING the right trade, not just recognizing one.' }));

    var setup = h('div', { class: 'muted-box', style: 'margin-bottom:16px' });
    var cs = h('input', { class: 'q-input pairs-input', type: 'number', min: '5', max: '25', step: '1', value: '10' });
    setup.appendChild(h('div', { class: 'row' }, [
      h('span', { class: 'tag-line', text: 'Questions' }), cs,
      h('button', { class: 'btn primary', text: '▶ Start', onclick: start })
    ]));
    view.appendChild(setup);

    var hud = h('div', { class: 'row hud', style: 'margin-bottom:12px;display:none' }, [
      h('span', { class: 'hud-stat' }, [h('span', { class: 'dim', text: 'Q ' }), h('span', { id: 'o-q', class: 'mono', text: '0' })]),
      h('span', { class: 'hud-stat' }, [h('span', { class: 'dim', text: 'Streak ' }), h('span', { id: 'o-streak', class: 'mono', text: '0' })]),
      h('span', { class: 'hud-stat' }, [h('span', { class: 'dim', text: 'Score ' }), h('span', { id: 'o-score', class: 'mono', text: '0' })])
    ]);
    view.appendChild(hud);

    var area = h('div');
    view.appendChild(area);

    function start() {
      state.n = Math.max(5, Math.min(25, parseInt(cs.value, 10) || 10));
      state.qs = []; for (var i = 0; i < state.n; i++) state.qs.push(makeQuestion(pool));
      state.i = 0; state.score = 0; state.streak = 0;
      hud.style.display = 'flex';
      renderQ();
    }

    function renderQ() {
      var q = state.qs[state.i];
      state.answered = false;
      area.innerHTML = '';
      document.getElementById('o-q').textContent = (state.i + 1) + '/' + state.qs.length;
      updateHud();

      var card = h('div', { class: 'muted-box' });
      card.appendChild(h('div', { class: 'q-prompt', text: q.prompt }));
      var optWrap = h('div', { class: 'q-options' });
      q.options.forEach(function (opt, oi) {
        optWrap.appendChild(h('button', { class: 'q-opt', text: opt, onclick: function () { answer(oi, optWrap, q); } }));
      });
      card.appendChild(optWrap);
      card.appendChild(h('div', { id: 'o-fb', style: 'margin-top:10px' }));
      area.appendChild(card);
    }

    function answer(oi, optWrap, q) {
      if (state.answered) return;
      state.answered = true;
      var correct = oi === q.answer;
      Array.prototype.forEach.call(optWrap.children, function (b, idx) {
        b.disabled = true;
        if (idx === q.answer) b.classList.add('opt-correct');
        else if (idx === oi) b.classList.add('opt-wrong');
      });
      if (correct) { state.streak++; state.score += 10 + (state.streak - 1) * 2; }
      else { state.streak = 0; }
      updateHud();

      var fb = document.getElementById('o-fb');
      fb.appendChild(h('div', { class: 'feedback ' + (correct ? 'ok' : 'no'), text: (correct ? '✓ ' : '✗ ') + q.explain }));
      var isLast = state.i === state.qs.length - 1;
      fb.appendChild(h('button', { class: 'btn primary', style: 'margin-top:8px', text: isLast ? 'Finish ▸' : 'Next ▸', onclick: function () {
        state.i++;
        if (state.i >= state.qs.length) finish(); else renderQ();
      } }));
    }

    function updateHud() {
      document.getElementById('o-streak').textContent = state.streak;
      document.getElementById('o-score').textContent = state.score;
    }

    function finish() {
      var rec = ctx.Store.record('outlook', { score: state.score });
      area.innerHTML = '';
      var best = (rec.bestScore === state.score) ? ' 🏆 new best!' : '';
      area.appendChild(h('div', { class: 'muted-box' }, [
        h('h2', { text: 'Final score: ' + state.score + best }),
        h('p', { class: 'tag-line', text: 'Best score this machine: ' + (rec.bestScore || state.score) + ' · games played: ' + rec.plays }),
        h('div', { class: 'row' }, [
          h('button', { class: 'btn primary', text: '▶ Play again', onclick: start }),
          h('button', { class: 'btn', text: '← Home', onclick: ctx.home })
        ])
      ]));
      hud.style.display = 'none';
    }
  }

  global.App.registerMode({
    id: 'outlook', label: 'Outlook', minStrategies: 4,
    blurb: 'Given a market view (direction, volatility, risk appetite), pick the strategy that best fits.',
    init: init
  });
})(window);
