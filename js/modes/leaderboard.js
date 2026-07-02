/* ============================================================
 * modes/leaderboard.js — the Leaderboard tab.
 * Game picker + Perfect/Overall toggle + top-10 table (medals,
 * accuracy detail, date), with a pinned "your standing" row when the
 * current player is outside the top 10. Reads via global.Leaderboard.
 * Purely additive: if Supabase isn't configured/reachable it degrades
 * to a friendly message and never blocks the rest of the app.
 * ============================================================ */
(function (global) {
  'use strict';

  var MEDAL = ['🥇', '🥈', '🥉'];

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2);
  }

  function init(view, ctx) {
    var h = ctx.h;
    var LB = global.Leaderboard;

    view.appendChild(h('h1', { text: 'Leaderboard' }));

    if (!LB || !LB.configured()) {
      view.appendChild(h('div', { class: 'muted-box' }, [
        h('p', { class: 'sub', text: 'The leaderboard is not set up yet. Once it is, scores you post from any game show up here.' })
      ]));
      return;
    }

    view.appendChild(h('p', { class: 'sub', text: 'How everyone stacks up. Perfect ranks your best flawless (100%) run; Overall ranks your best score at any accuracy. Post a score from any game’s results screen.' }));

    var state = { game: LB.lastGame || LB.GAMES[0].id, category: 'overall' };

    var controls = h('div', { class: 'muted-box', style: 'margin-bottom:16px' });
    var gsel = h('select', { class: 'btn ghost' });
    LB.GAMES.forEach(function (g) { gsel.appendChild(h('option', { value: g.id, text: g.label })); });
    gsel.value = state.game;
    gsel.addEventListener('change', function () { state.game = gsel.value; load(); });

    var overallBtn = h('button', { class: 'btn', text: 'Overall' });
    var perfectBtn = h('button', { class: 'btn', text: 'Perfect' });
    function syncCat() {
      overallBtn.className = 'btn' + (state.category === 'overall' ? ' primary' : '');
      perfectBtn.className = 'btn' + (state.category === 'perfect' ? ' primary' : '');
    }
    overallBtn.onclick = function () { state.category = 'overall'; syncCat(); load(); };
    perfectBtn.onclick = function () { state.category = 'perfect'; syncCat(); load(); };

    var refreshBtn = h('button', { class: 'btn ghost', text: '↻ Refresh' });
    refreshBtn.onclick = function () { load(); };

    controls.appendChild(h('div', { class: 'row toolbar' }, [
      h('span', { class: 'tag-line', text: 'Game' }), gsel,
      h('span', { style: 'width:10px' }),
      overallBtn, perfectBtn,
      h('span', { style: 'flex:1' }),
      refreshBtn
    ]));
    view.appendChild(controls);
    syncCat();

    var area = h('div');
    view.appendChild(area);

    function rowEl(rank, r, isMe, noMedal) {
      // medals only in the ranked top-10 list, never on the pinned "your standing" row
      var medal = (!noMedal && MEDAL[rank - 1]) || '';
      return h('div', { class: 'lb-row' + (isMe ? ' lb-me' : '') }, [
        h('span', { class: 'lb-rank mono', text: medal || String(rank) }),
        h('span', { class: 'lb-name', text: r.nickname }),
        h('span', { class: 'lb-detail mono dim', text: r.correct + '/' + r.attempted }),
        h('span', { class: 'lb-date dim', text: fmtDate(r.created_at) }),
        h('span', { class: 'lb-score mono', text: String(r.score) })
      ]);
    }

    function header() {
      return h('div', { class: 'lb-row lb-head' }, [
        h('span', { class: 'lb-rank', text: '#' }),
        h('span', { class: 'lb-name', text: 'Player' }),
        h('span', { class: 'lb-detail', text: 'Acc.' }),
        h('span', { class: 'lb-date', text: 'Date' }),
        h('span', { class: 'lb-score', text: 'Score' })
      ]);
    }

    function load() {
      var game = state.game, cat = state.category, myToken = LB.token();
      area.innerHTML = '';
      area.appendChild(h('p', { class: 'tag-line', text: 'Loading…' }));

      LB.board(game, cat, 10).then(function (rows) {
        if (state.game !== game || state.category !== cat) return;   // selection changed mid-load
        area.innerHTML = '';
        if (!rows || !rows.length) {
          area.appendChild(h('div', { class: 'muted-box' }, [
            h('p', { class: 'sub', text: 'No scores yet — be the first. Post one from the game’s results screen.' })
          ]));
          return;
        }
        var box = h('div', { class: 'muted-box lb-table' });
        box.appendChild(header());
        var meInTop = false;
        rows.forEach(function (r, i) {
          var isMe = r.owner_token === myToken;
          if (isMe) meInTop = true;
          box.appendChild(rowEl(i + 1, r, isMe));
        });
        area.appendChild(box);

        if (!meInTop) {
          LB.myRow(game, cat).then(function (mine) {
            if (!mine || state.game !== game || state.category !== cat) return;
            LB.rankOf(game, cat, mine.score, mine.created_at).then(function (rank) {
              if (state.game !== game || state.category !== cat) return;
              var wrap = h('div', { class: 'muted-box lb-table', style: 'margin-top:10px' });
              wrap.appendChild(h('div', { class: 'tag-line', style: 'margin-bottom:4px', text: 'Your standing' }));
              wrap.appendChild(rowEl(rank || '—', mine, true, true));
              area.appendChild(wrap);
            });
          });
        }
      });
    }

    load();
  }

  global.App.registerMode({
    id: 'leaderboard', label: 'Leaderboard', minStrategies: 0,
    blurb: 'See how everyone stacks up — per-game Perfect and Overall boards.',
    init: init
  });
})(window);
