/* ============================================================
 * modes/test.js — Test mode (mixed question types)
 *   - multiple choice
 *   - type-the-answer (normalized, synonym/abbreviation aware)
 *   - select-all-that-apply
 * Score-only: graded at the end, no per-answer explanations
 * (the "why" lives in Flashcards). Best score persists.
 * ============================================================ */
(function (global) {
  'use strict';

  var SPOT = 100;
  var OUTLOOKS = ['bullish', 'bearish', 'neutral', 'agnostic'];
  var VOLS = ['long vol', 'short vol', 'neutral'];

  function legStrHtml(leg) {
    var sign = leg.action === 'buy' ? '+' : '−';
    var cls = leg.action === 'buy' ? 'buy' : 'sell';
    var qty = leg.qty || 1;
    if (leg.type === 'stock') return '<span class="' + cls + '">' + sign + qty + ' Stock @ $' + SPOT + '</span>';
    var k = SPOT + (leg.strike || 0);
    var typ = leg.type === 'call' ? 'Call' : 'Put';
    var exp = leg.expiry === 'far' ? ' (far)' : '';
    return '<span class="' + cls + '">' + sign + qty + ' ' + typ + ' $' + k + exp + '</span>';
  }

  function norm(str) { return String(str).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(a, n) { return shuffle(a).slice(0, n); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function DB() { return global.DrillBank || {}; }
  function pxNum(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2); }
  function money2(n) { var a = Math.abs(n); return (n < 0 ? '−$' : '$') + (Number.isInteger(a) ? String(a) : a.toFixed(2)); }

  /* ---- distractor names: n wrong names different from the answer ---- */
  function otherNames(pool, answer, n) {
    return sample(pool.filter(function (s) { return s.id !== answer.id; }), n).map(function (s) { return s.name; });
  }

  /* ---- question generators (each returns a question object or null) ---- */
  function mc(prompt, node, correctLabel, distractors, explain) {
    var opts = shuffle([correctLabel].concat(distractors));
    return { kind: 'mc', prompt: prompt, node: node, options: opts, answer: opts.indexOf(correctLabel), correctLabel: correctLabel, explain: explain };
  }

  function genGraphToName(pool) {
    var s = pick(pool);
    return mc('Which strategy produces this payoff at expiration?',
      function () { return global.Payoff.renderStrategy(s, { width: 420, height: 220 }); },
      s.name, otherNames(pool, s, 3), s.blurb);
  }
  function genLegsToName(pool) {
    var s = pick(pool);
    return mc('Which strategy is built from these legs?',
      function () { return legsNode(s); }, s.name, otherNames(pool, s, 3),
      s.name + ': ' + s.blurb);
  }
  function genNameToOutlook(pool) {
    var s = pick(pool);
    var distract = shuffle(OUTLOOKS.filter(function (o) { return o !== s.priceOutlook; })).slice(0, 3);
    return mc('What is the price outlook of a ' + s.name + '?', null, s.priceOutlook, distract,
      'A ' + s.name + ' is ' + s.priceOutlook + ' on price. ' + s.blurb);
  }
  function genNameToVol(pool) {
    var s = pick(pool);
    var distract = VOLS.filter(function (o) { return o !== s.volOutlook; });
    return mc('What is the volatility outlook of a ' + s.name + '?', null, s.volOutlook, distract,
      'A ' + s.name + ' is ' + s.volOutlook + ' (net ' + s.greeks.vega + ' vega). ' + s.blurb);
  }
  function genTypeFromGraph(pool) {
    var s = pick(pool);
    return { kind: 'type', prompt: 'Name this strategy from its payoff graph:',
      node: function () { return global.Payoff.renderSVG(s.legs, { width: 420, height: 220 }); },
      accept: [norm(s.name)].concat((s.aka || []).map(norm)), displayAnswer: s.name, explain: s.blurb };
  }
  function genTypeFromLegs(pool) {
    var s = pick(pool);
    return { kind: 'type', prompt: 'Name this strategy from its legs:',
      node: function () { return legsNode(s); },
      accept: [norm(s.name)].concat((s.aka || []).map(norm)), displayAnswer: s.name, explain: s.blurb };
  }

  function genSelectAllGreek(pool) {
    var g = pick(global.Greeks.GREEKS);
    var sign = pick(['long', 'short']);
    var items = sample(pool, Math.min(6, pool.length));
    var correctCount = items.filter(function (s) { return s.greeks[g] === sign; }).length;
    if (correctCount === 0 || correctCount === items.length) return null; // degenerate
    return {
      kind: 'sall',
      prompt: 'Select ALL strategies that are net ' + sign + ' ' + global.Greeks.GREEK_LABEL[g] + ':',
      options: items.map(function (s) { return { label: s.name, correct: s.greeks[g] === sign }; }),
      explain: 'Net ' + sign + ' ' + global.Greeks.GREEK_LABEL[g] + ' means ' + global.Greeks.MEANING[g][sign] + '.'
    };
  }
  function genSelectAllAttr(pool) {
    var defs = [
      { p: 'have UNDEFINED (unlimited) risk', f: function (s) { return s.risk === 'undefined'; },
        why: 'Undefined-risk strategies have at least one naked short option, so loss is not capped.' },
      { p: 'have UNLIMITED profit potential', f: function (s) { return s.profitPotential === 'unlimited'; },
        why: 'Unlimited profit comes from a net long call or long stock exposure that keeps gaining as price rises.' },
      { p: 'are BULLISH on price', f: function (s) { return s.priceOutlook === 'bullish'; },
        why: 'Bullish strategies profit primarily when the underlying rises.' },
      { p: 'are NEUTRAL on price', f: function (s) { return s.priceOutlook === 'neutral'; },
        why: 'Neutral strategies profit when the underlying stays in a range.' },
      { p: 'are LONG volatility (long vega)', f: function (s) { return s.volOutlook === 'long vol'; },
        why: 'Long-vol strategies are net long options, so they gain when implied volatility rises.' }
    ];
    var d = pick(defs);
    var items = sample(pool, Math.min(6, pool.length));
    var correctCount = items.filter(d.f).length;
    if (correctCount === 0 || correctCount === items.length) return null;
    return {
      kind: 'sall',
      prompt: 'Select ALL strategies that ' + d.p + ':',
      options: items.map(function (s) { return { label: s.name, correct: d.f(s) }; }),
      explain: d.why
    };
  }

  function legsNode(s) {
    var d = document.createElement('div');
    d.className = 'legs q-legs';
    d.innerHTML = s.legs.map(legStrHtml).join('<br>');
    return d;
  }

  /* ---- questions reused from the Drill games (via global.DrillBank) ----
     Test pulls every game's question type, so it spans the whole app. */
  function wrapMc(q) {
    if (!q) return null;
    return { kind: 'mc', prompt: q.promptText || q.prompt, promptMono: q.promptMono || null,
      node: null, options: q.options, answer: q.answer, correctLabel: q.options[q.answer],
      explain: q.explain, mono: !!q.mono };
  }
  function legsHtmlNode(htmlLines) {
    var d = document.createElement('div'); d.className = 'legs q-legs';
    d.innerHTML = htmlLines.join('<br>');
    return d;
  }

  function genMoneyness() {
    if (!DB().moneyness) return null;
    var q = DB().moneyness();   // { type, K, S, answer:'ITM'|'ATM'|'OTM' }
    var opts = ['ITM', 'ATM', 'OTM'];
    var rule = q.type === 'Call' ? 'in-the-money when the stock is ABOVE the strike'
                                 : 'in-the-money when the stock is BELOW the strike';
    return { kind: 'mc', prompt: 'A ' + q.type + ' struck at $' + pxNum(q.K) + ' with the stock at $' + pxNum(q.S) + ' — is it…?',
      node: null, options: opts, answer: opts.indexOf(q.answer), correctLabel: q.answer,
      explain: 'A ' + q.type.toLowerCase() + ' is ' + rule + '. Stock $' + pxNum(q.S) + ' vs strike $' + pxNum(q.K) + ' → ' + q.answer + '.' };
  }
  function genIntrinsic() {
    if (!DB().optionValue) return null;
    var q = DB().optionValue();   // { type, K, S, prem, hasPrem, answer, prompt, explain }
    var node = function () {
      return legsHtmlNode([
        q.hasPrem
          ? '<span class="buy">Bought 1 ' + q.type + ' · strike $' + pxNum(q.K) + ' · paid $' + pxNum(q.prem) + '</span>'
          : '<span>1 ' + q.type + ' · strike $' + pxNum(q.K) + '</span>',
        '<span class="mono">Stock at expiration: $' + pxNum(q.S) + '</span>'
      ]);
    };
    return { kind: 'num', prompt: q.prompt, node: node, answer: q.answer, displayAnswer: money2(q.answer), explain: q.explain, tol: 0.01 };
  }
  function genBreakevenNum() {
    if (!DB().breakeven) return null;
    var q = DB().breakeven();   // { legs:[html], prompt, answer, explain }
    return { kind: 'num', prompt: q.prompt, node: function () { return legsHtmlNode(q.legs); },
      answer: q.answer, displayAnswer: money2(q.answer), explain: q.explain, tol: 0.01 };
  }
  function genBoxNum() {
    if (!DB().box) return null;
    var q = DB().box();   // { legs:[{sign,t,k,p}], prompt, answer, explain }
    var node = function () {
      return legsHtmlNode(q.legs.map(function (l) {
        var cls = l.sign === '+' ? 'buy' : 'sell';
        return '<span class="' + cls + '">' + l.sign + '1 ' + l.t + ' $' + l.k + ' @ $' + l.p + '</span>';
      }));
    };
    return { kind: 'num', prompt: q.prompt, node: node, answer: q.answer, displayAnswer: money2(q.answer), explain: q.explain, tol: 0.01 };
  }
  function genGreeksIdentify(pool) { return DB().greeksIdentify ? wrapMc(DB().greeksIdentify(pool)()) : null; }
  function genGreeksPredict(pool) { return DB().greeksPredict ? wrapMc(DB().greeksPredict(pool)()) : null; }
  function genOutlookPick(pool) { return DB().outlook ? wrapMc(DB().outlook(pool)()) : null; }

  var GENERATORS = [genGraphToName, genLegsToName, genNameToOutlook, genNameToVol,
                    genTypeFromGraph, genTypeFromLegs, genSelectAllGreek, genSelectAllAttr,
                    genMoneyness, genIntrinsic, genBreakevenNum, genBoxNum,
                    genGreeksIdentify, genGreeksPredict, genOutlookPick];

  function buildQuestions(pool, n) {
    var qs = [];
    var guard = 0;
    while (qs.length < n && guard < n * 12) {
      guard++;
      var gen = pick(GENERATORS);
      // select-all generators need a few strategies
      if ((gen === genSelectAllGreek || gen === genSelectAllAttr) && pool.length < 4) continue;
      var q = gen(pool);
      if (q) qs.push(q);
    }
    return qs;
  }

  /* ---- mode ---- */
  function init(view, ctx) {
    var h = ctx.h;
    var pool = ctx.strategies;
    var state = { qs: [], i: 0, answers: [], count: 10 };

    view.appendChild(h('h1', { text: 'Test' }));
    view.appendChild(h('p', { class: 'sub', text: 'A mixed exam spanning every mode — recognize strategies from graphs and legs, outlook & Greeks, moneyness, intrinsic value, and break-evens. Multiple choice, type-the-answer, calculate-the-value, and select-all. Graded at the end with the correct answer and a short "why" for each.' }));

    var setup = h('div', { class: 'muted-box', style: 'margin-bottom:16px' });
    var cs = h('select', { class: 'btn ghost' });
    [5, 10, 15, 20].forEach(function (n) { cs.appendChild(h('option', { value: n, text: n + ' questions' })); });
    cs.value = state.count;
    cs.addEventListener('change', function () { state.count = +cs.value; });
    setup.appendChild(h('div', { class: 'row' }, [
      h('span', { class: 'tag-line', text: 'Length' }), cs,
      h('button', { class: 'btn primary', text: '▶ Start test', onclick: start })
    ]));
    view.appendChild(setup);

    var area = h('div');
    view.appendChild(area);

    function start() {
      state.qs = buildQuestions(pool, state.count);
      state.i = 0; state.answers = [];
      renderQuestion();
    }

    function renderQuestion() {
      var q = state.qs[state.i];
      area.innerHTML = '';

      var head = h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, [
        h('span', { class: 'tag-line', text: 'Question ' + (state.i + 1) + ' of ' + state.qs.length }),
        h('span', { class: 'tag-line', text: qkindLabel(q.kind) })
      ]);
      area.appendChild(head);
      var bar = h('div', { class: 'progress' }, [ h('div', { class: 'progress-fill', style: 'width:' + (state.i / state.qs.length * 100) + '%' }) ]);
      area.appendChild(bar);

      var card = h('div', { class: 'muted-box', style: 'margin-top:14px' });
      card.appendChild(h('div', { class: 'q-prompt', text: q.prompt }));
      if (q.promptMono) card.appendChild(h('div', { class: 'greek-profile-prompt mono', text: q.promptMono }));
      if (q.node) card.appendChild(h('div', { class: 'q-node' }, [q.node()]));

      var chosen = { mc: null, type: '', sall: {} };

      if (q.kind === 'mc') {
        var optWrap = h('div', { class: 'q-options' });
        q.options.forEach(function (opt, oi) {
          var b = h('button', { class: 'q-opt' + (q.mono ? ' mono' : ''), text: opt, onclick: function () {
            chosen.mc = oi;
            Array.prototype.forEach.call(optWrap.children, function (c) { c.classList.remove('chosen'); });
            b.classList.add('chosen');
          } });
          optWrap.appendChild(b);
        });
        card.appendChild(optWrap);

      } else if (q.kind === 'type') {
        var inp = h('input', { class: 'q-input', type: 'text', placeholder: 'Type the strategy name…', autocomplete: 'off' });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        card.appendChild(inp);
        card.appendChild(h('div', { class: 'tag-line', text: 'Synonyms & abbreviations accepted (e.g. "IC", "ironfly", "long call spread").' }));
        chosen._inp = inp;

      } else if (q.kind === 'sall') {
        var sw = h('div', { class: 'q-options' });
        q.options.forEach(function (opt, oi) {
          var b = h('button', { class: 'q-opt', text: opt.label, onclick: function () {
            chosen.sall[oi] = !chosen.sall[oi];
            b.classList.toggle('chosen', !!chosen.sall[oi]);
          } });
          sw.appendChild(b);
        });
        card.appendChild(sw);
        card.appendChild(h('div', { class: 'tag-line', text: 'Select every strategy that applies, then submit.' }));

      } else if (q.kind === 'num') {
        var ninp = h('input', { class: 'q-input', type: 'number', step: '0.25', placeholder: 'Type a dollar amount…', autocomplete: 'off', style: 'max-width:260px' });
        ninp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        card.appendChild(ninp);
        card.appendChild(h('div', { class: 'tag-line', text: 'Enter the price / amount in dollars (per share).' }));
        chosen._ninp = ninp;
      }

      var submitBtn = h('button', { class: 'btn primary', style: 'margin-top:14px', text: state.i === state.qs.length - 1 ? 'Finish ▸' : 'Submit ▸', onclick: submit });
      card.appendChild(submitBtn);
      area.appendChild(card);

      function submit() {
        var correct = grade(q, chosen);
        state.answers.push({ q: q, correct: correct });
        state.i++;
        if (state.i >= state.qs.length) finish();
        else renderQuestion();
      }
    }

    function grade(q, chosen) {
      if (q.kind === 'mc') return chosen.mc === q.answer;
      if (q.kind === 'type') return q.accept.indexOf(norm(chosen._inp.value)) >= 0;
      if (q.kind === 'num') { var v = parseFloat(chosen._ninp.value); return !isNaN(v) && Math.abs(v - q.answer) < (q.tol || 0.01); }
      if (q.kind === 'sall') {
        for (var i = 0; i < q.options.length; i++) {
          if (!!chosen.sall[i] !== !!q.options[i].correct) return false;
        }
        return true;
      }
      return false;
    }

    function finish() {
      var score = state.answers.filter(function (a) { return a.correct; }).length;
      var total = state.answers.length;
      var rec = ctx.Store.record('test', { score: score, total: total });
      area.innerHTML = '';
      var pct = Math.round(score / total * 100);
      area.appendChild(h('div', { class: 'muted-box' }, [
        h('h2', { text: 'Score: ' + score + ' / ' + total + '  (' + pct + '%)' }),
        h('p', { class: 'tag-line', text: 'Best score this machine: ' + (rec.bestScore || score) + ' · tests taken: ' + rec.plays }),
        review(),
        h('div', { class: 'row', style: 'margin-top:8px' }, [
          h('button', { class: 'btn primary', text: '▶ New test', onclick: start }),
          h('button', { class: 'btn', text: '← Home', onclick: ctx.home })
        ])
      ]));
    }

    function review() {
      var wrap = h('div', { style: 'margin:12px 0' });
      wrap.appendChild(h('div', { class: 'fc-section-label', text: 'Review — correct answer and why' }));
      state.answers.forEach(function (a, i) {
        var ans = a.q.kind === 'mc' ? a.q.correctLabel
                : (a.q.kind === 'type' || a.q.kind === 'num') ? a.q.displayAnswer
                : a.q.options.filter(function (o) { return o.correct; }).map(function (o) { return o.label; }).join(', ') || '(none)';
        wrap.appendChild(h('div', { class: 'review-row' }, [
          h('span', { class: a.correct ? 'profit' : 'loss', text: a.correct ? '✓' : '✗' }),
          h('span', { class: 'review-q', text: (i + 1) + '. ' + a.q.prompt }),
          h('span', { class: 'review-a dim', text: ans })
        ]));
        if (a.q.explain) {
          wrap.appendChild(h('div', { class: 'review-why', text: a.q.explain }));
        }
      });
      return wrap;
    }

    function qkindLabel(k) {
      return k === 'mc' ? 'multiple choice' : k === 'type' ? 'type the answer' : k === 'num' ? 'calculate the value' : 'select all that apply';
    }
  }

  global.App.registerMode({
    id: 'test', label: 'Test', minStrategies: 4,
    blurb: 'A mixed exam spanning all modes: recognition, outlook, Greeks, moneyness, intrinsic value, and break-evens.',
    init: init
  });
})(window);
