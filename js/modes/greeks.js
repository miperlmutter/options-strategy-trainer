/* ============================================================
 * modes/greeks.js — Greeks mini-game
 * Rapid-fire questions on conceptual net-Greek profiles:
 *   - "Which strategy is net short theta?"  (pick the strategy)
 *   - "What is the net delta of a long put?" (pick the sign)
 *   - profile → strategy, and strategy → profile.
 * Immediate feedback + streak + score; best score persists.
 * ============================================================ */
(function (global) {
  'use strict';

  var G = function () { return global.Greeks; };

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function sample(a, n) { return shuffle(a).slice(0, n); }

  function profileStr(s) {
    var L = G().SIGN_LABEL;
    return 'Δ ' + L[s.greeks.delta] + ' · Γ ' + L[s.greeks.gamma] +
           ' · Θ ' + L[s.greeks.theta] + ' · V ' + L[s.greeks.vega];
  }

  /* ---- generators ---- */
  function genWhichStrategy(pool) {
    var g = pick(G().GREEKS);
    var sign = pick(['long', 'short']);
    var matches = pool.filter(function (s) { return s.greeks[g] === sign; });
    var nonMatches = pool.filter(function (s) { return s.greeks[g] !== sign; });
    if (!matches.length || nonMatches.length < 3) return null;
    var correct = pick(matches);
    var opts = shuffle([correct].concat(sample(nonMatches, 3)));
    return {
      prompt: 'Which strategy is net ' + sign + ' ' + G().GREEK_LABEL[g] + '?',
      options: opts.map(function (s) { return s.name; }),
      answer: opts.indexOf(correct),
      explain: correct.name + ' is net ' + sign + ' ' + G().GREEK_LABEL[g] + ' — ' + G().MEANING[g][sign] + '.'
    };
  }

  function genWhatSign(pool) {
    var s = pick(pool);
    var g = pick(G().GREEKS);
    var L = G().SIGN_LABEL;
    var opts = [L.long, L.short, L.neutral];
    return {
      prompt: 'What is the net ' + G().GREEK_LABEL[g] + ' of a ' + s.name + '?',
      options: opts,
      answer: opts.indexOf(L[s.greeks[g]]),
      explain: 'A ' + s.name + ' is net ' + L[s.greeks[g]] + ' ' + G().GREEK_LABEL[g] + ' — ' + G().MEANING[g][s.greeks[g]] + '.'
    };
  }

  function genProfileToStrategy(pool) {
    var correct = pick(pool);
    var cp = profileStr(correct);
    var others = pool.filter(function (s) { return profileStr(s) !== cp; });
    if (others.length < 3) return null;
    var opts = shuffle([correct].concat(sample(others, 3)));
    return {
      prompt: 'Which strategy has this net Greek profile?\n' + cp,
      promptMono: cp,
      promptText: 'Which strategy has this net Greek profile?',
      options: opts.map(function (s) { return s.name; }),
      answer: opts.indexOf(correct),
      explain: cp + ' is the profile of a ' + correct.name + '.'
    };
  }

  function genStrategyToProfile(pool) {
    var correct = pick(pool);
    var cp = profileStr(correct);
    var others = [];
    var seen = {}; seen[cp] = true;
    shuffle(pool).forEach(function (s) {
      var p = profileStr(s);
      if (!seen[p]) { seen[p] = true; others.push(p); }
    });
    if (others.length < 3) return null;
    var opts = shuffle([cp].concat(others.slice(0, 3)));
    return {
      promptText: 'What is the net Greek profile of a ' + correct.name + '?',
      options: opts,
      answer: opts.indexOf(cp),
      mono: true,
      explain: 'A ' + correct.name + ': ' + cp + '.'
    };
  }

  var GENS = [genWhichStrategy, genWhatSign, genProfileToStrategy, genStrategyToProfile];

  function init(view, ctx) {
    var h = ctx.h;
    var pool = ctx.strategies;
    var state = { i: 0, n: 10, score: 0, streak: 0, qs: [], answered: false };

    view.appendChild(h('h1', { text: 'Greeks mini-game' }));
    view.appendChild(h('p', { class: 'sub', text: 'Net Greek profiles — conceptual signs only (long / short / ~neutral). Identify which strategy carries a Greek, or match a strategy to its full Δ / Γ / Θ / V profile. Build a streak.' }));

    var setup = h('div', { class: 'muted-box', style: 'margin-bottom:16px' });
    var cs = h('input', { class: 'q-input pairs-input', type: 'number', min: '5', max: '25', step: '1', value: '10' });
    setup.appendChild(h('div', { class: 'row' }, [
      h('span', { class: 'tag-line', text: 'Questions' }), cs,
      h('button', { class: 'btn primary', text: '▶ Start', onclick: start })
    ]));
    view.appendChild(setup);

    var hud = h('div', { class: 'row hud', style: 'margin-bottom:12px;display:none' }, [
      h('span', { class: 'hud-stat' }, [h('span', { class: 'dim', text: 'Q ' }), h('span', { id: 'g-q', class: 'mono', text: '0' })]),
      h('span', { class: 'hud-stat' }, [h('span', { class: 'dim', text: 'Streak ' }), h('span', { id: 'g-streak', class: 'mono', text: '0' })]),
      h('span', { class: 'hud-stat' }, [h('span', { class: 'dim', text: 'Score ' }), h('span', { id: 'g-score', class: 'mono', text: '0' })])
    ]);
    view.appendChild(hud);

    var area = h('div');
    view.appendChild(area);

    function buildQuestions(n) {
      var qs = [], guard = 0;
      while (qs.length < n && guard < n * 12) {
        guard++;
        var q = pick(GENS)(pool);
        if (q) qs.push(q);
      }
      return qs;
    }

    function start() {
      state.n = Math.max(5, Math.min(25, parseInt(cs.value, 10) || 10));
      state.qs = buildQuestions(state.n);
      state.i = 0; state.score = 0; state.streak = 0;
      hud.style.display = 'flex';
      renderQ();
    }

    function renderQ() {
      var q = state.qs[state.i];
      state.answered = false;
      area.innerHTML = '';
      document.getElementById('g-q').textContent = (state.i + 1) + '/' + state.qs.length;
      updateHud();

      var card = h('div', { class: 'muted-box' });
      card.appendChild(h('div', { class: 'q-prompt', text: q.promptText || q.prompt }));
      if (q.promptMono) card.appendChild(h('div', { class: 'greek-profile-prompt mono', text: q.promptMono }));

      var optWrap = h('div', { class: 'q-options' });
      q.options.forEach(function (opt, oi) {
        var b = h('button', { class: 'q-opt' + (q.mono ? ' mono' : ''), text: opt, onclick: function () { answer(oi, optWrap, q); } });
        optWrap.appendChild(b);
      });
      card.appendChild(optWrap);
      card.appendChild(h('div', { id: 'g-fb', style: 'margin-top:10px' }));
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
      if (correct) {
        state.streak++;
        state.score += 10 + (state.streak - 1) * 2;
      } else {
        state.streak = 0;
      }
      updateHud();

      var fb = document.getElementById('g-fb');
      fb.appendChild(h('div', { class: 'feedback ' + (correct ? 'ok' : 'no'), text: (correct ? '✓ ' : '✗ ') + q.explain }));
      var isLast = state.i === state.qs.length - 1;
      fb.appendChild(h('button', { class: 'btn primary', style: 'margin-top:8px', text: isLast ? 'Finish ▸' : 'Next ▸', onclick: function () {
        state.i++;
        if (state.i >= state.qs.length) finish();
        else renderQ();
      } }));
    }

    function updateHud() {
      document.getElementById('g-streak').textContent = state.streak;
      document.getElementById('g-score').textContent = state.score;
    }

    function finish() {
      var rec = ctx.Store.record('greeks', { score: state.score });
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
    id: 'greeks', label: 'Greeks', minStrategies: 4,
    blurb: 'Match net Greek profiles to strategies, or answer "which strategy is net short theta?" prompts.',
    init: init
  });
})(window);
