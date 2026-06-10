# Implementation Brief — Time-Based Strategies (Calendar / Diagonal / Double Calendar)

> Hand this file to an AI (or a future session) to finish the one remaining piece of the
> Options Strategy Trainer: the **time-based strategies**. Everything else is built and verified.
> This brief is self-contained — it has the problem, the exact math, the data to add, and the
> integration points.

---

## 0. Current state of the app (so you have context)

Static vanilla HTML/CSS/JS app in `InternTasks/OptionsStrategyTrainer/`. No framework, no build step.
Opens from `file://` and works on GitHub Pages. Key files:

- `js/payoff.js` — payoff engine. Has a **RELATIVE** engine (strikes relative to a $100 notional spot,
  model-computed premiums) and an **ABSOLUTE** engine (real-dollar strikes/premiums, used by Sandbox).
  Shared SVG renderer `drawCurve(plFn, dom, breakEvens, spot, opts)`.
- `js/strategies.js` — the strategy library (20 strategies). Exposes `StrategyLib` with
  `list`, `all()`, `byId()`, `register(arr)`, `CATEGORIES`, `CATEGORY_LABELS`, `TIERS`.
- `js/greeks.js` — conceptual Greek labels/meanings (`Greeks`).
- `js/modes/*.js` — flashcards, match, test, build, greeks, sandbox. Each self-registers via
  `App.registerMode({...})`.
- `gallery.html` — renders every strategy's payoff (verification surface).

**The 20 existing strategies already include `ratio spread` (an "advanced" non-time strategy).**
The 3 missing ones are calendar, diagonal, double calendar — all flagged `timeBased` once added.

Every strategy currently renders via `Payoff.renderSVG(s.legs, opts)` and
`Payoff.metricsTableHTML(s.legs)`. Both assume a **single expiration** (at-expiration intrinsic).

---

## 1. The problem

A calendar/diagonal/double-calendar holds a **near-dated leg and a far-dated leg**. There is no single
"at expiration" moment: when the *near* leg expires, the *far* leg still carries time value. So the
pure at-expiration intrinsic model used for everything else produces a WRONG (usually V-shaped or
straight) curve instead of the correct **tent** shape that peaks at the strike.

The standard way to view these is **"value the position at the NEAR-dated expiration"**:
- near legs → expire to intrinsic
- far legs → keep their **residual time value** (one period still remaining)

---

## 2. Recommended model — computed near-expiry approximation

This reuses the premium model already in `payoff.js`. **No Black-Scholes.** It is a teaching
approximation (assumes constant implied vol and that "far" = exactly one extra period of time value).

### 2.1 Premium model recap (already in payoff.js)
```
SPOT = 100
intrinsic(type, K, S) = type==='call' ? max(S-K,0) : max(K-S,0)
premium(type, K, expiry) = intrinsic(type, K, SPOT) + atm * exp(-0.5 * ((K - SPOT)/width)^2)
   where atm = (expiry==='far') ? atmTvFar : atmTvNear
   PREMIUM = { atmTvNear: 5.0, atmTvFar: 8.0, width: 18 }   // ATM premium $5 near / $8 far
   // (the §2.4 worked example below uses the older 3.5/6.0 values illustratively —
   //  the SHAPE/method is identical; only the magnitudes scale with these constants)
```
This is the **entry** premium (paid/collected at trade open, when S = SPOT).

### 2.2 Value of each leg AT THE NEAR EXPIRATION (underlying = S)
```
value_at_near(leg, S):
  if leg.type === 'stock':            return S                  // basis handled in P/L below
  if leg.expiry === 'near':           return intrinsic(type, K, S)              // expires
  if leg.expiry === 'far':            return intrinsic(type, K, S)
                                             + atmTvNear * exp(-0.5 * ((S - K)/width)^2)
```
**Key subtlety:** the residual time value for the far leg must be centered on **moneyness `(S - K)`**,
NOT on `(K - SPOT)`. At entry the premium centered TV on `(K - SPOT)` because S = SPOT then; at the
near expiry S varies, so residual TV peaks when **S is at the strike K**. Using one period of decay,
the residual ATM magnitude is `atmTvNear` (one period left ≈ a "near" option).

### 2.3 P/L at near expiry (per share)
```
K(leg)     = SPOT + (leg.strike || 0)              // relative strikes, like the rest of the library
dir(leg)   = leg.action==='buy' ? +1 : -1
entry(leg) = leg.type==='stock' ? SPOT : premium(leg.type, K, leg.expiry)   // per share

payoffAtNearExpiry(legs, S) =
  Σ over legs:  dir * (leg.qty||1) * ( value_at_near(leg, S) - entry(leg) )
  // stock leg contributes dir*qty*(S - SPOT), same as the existing relative engine
```

### 2.4 Worked check — Call Calendar (sell near call@100, buy far call@100)
```
entry: near call = 3.5 (collect), far call = 6.0 (pay) → net debit 2.5
S=100: near=0 → +3.5 ; far=0+3.5=3.5 → (3.5-6.0)=-2.5 ; total = +1.0   (PEAK at strike) ✓
S=120: near=20 → -(20-3.5)=-16.5 ; far=20+3.5*exp(-0.5*(20/18)^2)=21.89 → +15.89 ; total ≈ -0.61 ✓
S→150: near=50 → -46.5 ; far≈50 → +44.0 ; total → -2.5  (floor = net debit) ✓
```
Correct textbook calendar tent: peak at the strike, bounded loss = net debit at the wings.

---

## 3. Engine changes to make in `js/payoff.js`

Add (mirroring the existing relative functions; reuse `solveMetrics`, `displayDomain`, `drawCurve`):

```js
function valueAtNearExpiry(leg, S) { /* §2.2 */ }
function payoffAtNearExpiry(legs, S) { /* §2.3 */ }

function computeMetricsTime(legs) {
  var dom = displayDomain(legs);
  var kinks = legs.filter(l => l.type !== 'stock').map(legStrike);
  var m = solveMetrics(s => payoffAtNearExpiry(legs, s), kinks, 0, dom.hi);
  m.netDebit = netDebit(legs);   // entry premiums net (same as relative engine)
  return m;
}

function renderTimeBased(legs, opts) {
  var dom = displayDomain(legs);
  var m = computeMetricsTime(legs);
  return drawCurve(s => payoffAtNearExpiry(legs, s), dom, m.breakEvens, SPOT, opts);
}

function describeMetricsTime(legs) { /* like describeMetrics but uses computeMetricsTime */ }
function metricsTableHTMLTime(legs) { /* like metricsTableHTML but uses describeMetricsTime */ }
```

Expose them on the global `Payoff` object.

**Convenience routers** (recommended — keeps the consumer code clean):
```js
Payoff.renderFor      = (strategy, opts) => strategy.timeBased ? renderTimeBased(strategy.legs, opts)
                                                               : renderSVG(strategy.legs, opts);
Payoff.metricsTableFor = (strategy)      => strategy.timeBased ? metricsTableHTMLTime(strategy.legs)
                                                               : metricsTableHTML(strategy.legs);
```

Then update the consumers that currently call `renderSVG(s.legs)` / `metricsTableHTML(s.legs)`
to call `renderFor(s)` / `metricsTableFor(s)` where `s` is the full strategy object:
`gallery.html`, `js/modes/flashcards.js`, and the **Match** graph tile + **Test** graph questions
(`js/modes/match.js`, `js/modes/test.js` — they currently pass `s.legs` to `renderSVG`).

### 3.1 Graph labeling
For time-based graphs add a small caption/badge: **"P/L valued at near-dated expiry"** so interns
aren't misled that it's the same at-expiration model. Easiest: when `strategy.timeBased`, append a
`<div class="tag-line">valued at near expiry</div>` under the SVG.

---

## 4. Strategy data to add (`js/strategies.js`)

Append these (or call `StrategyLib.register([...])`). Mark each `timeBased: true`, category
`'advanced'`, tier `'Advanced'`. Strikes are RELATIVE ($5 spacing); use `expiry: 'near' | 'far'`.
Greeks are conceptual signs. **Spot-check the Greek signs and outlooks before shipping.**

```js
{
  id: 'calendar-spread', name: 'Calendar Spread', category: 'advanced', tier: 'Advanced', timeBased: true,
  legs: [
    { action: 'sell', type: 'call', strike: 0, qty: 1, expiry: 'near' },
    { action: 'buy',  type: 'call', strike: 0, qty: 1, expiry: 'far'  }
  ],
  priceOutlook: 'neutral', volOutlook: 'long vol',
  profitPotential: 'limited', risk: 'limited',
  greeks: { delta: 'neutral', gamma: 'short', theta: 'long', vega: 'long' },
  aka: ['calendar spread','calendar','time spread','horizontal spread','call calendar'],
  blurb: 'Sell a near-dated option and buy a far-dated one at the same strike. Profits from the faster decay of the near leg and rising volatility while the underlying pins the strike; value peaks at the strike on the near expiry.'
},
{
  id: 'diagonal-spread', name: 'Diagonal Spread', category: 'advanced', tier: 'Advanced', timeBased: true,
  legs: [
    { action: 'buy',  type: 'call', strike: 0,  qty: 1, expiry: 'far'  },
    { action: 'sell', type: 'call', strike: 5,  qty: 1, expiry: 'near' }
  ],
  priceOutlook: 'bullish', volOutlook: 'long vol',
  profitPotential: 'limited', risk: 'limited',
  greeks: { delta: 'long', gamma: 'short', theta: 'long', vega: 'long' },
  aka: ['diagonal spread','diagonal','call diagonal','poor man\'s covered call'],
  blurb: 'A calendar with different strikes: buy a far-dated option and sell a nearer, higher-strike one. Blends time-decay income with a mild directional lean.'
},
{
  id: 'double-calendar', name: 'Double Calendar', category: 'advanced', tier: 'Advanced', timeBased: true,
  legs: [
    { action: 'sell', type: 'put',  strike: -5, qty: 1, expiry: 'near' },
    { action: 'buy',  type: 'put',  strike: -5, qty: 1, expiry: 'far'  },
    { action: 'sell', type: 'call', strike: 5,  qty: 1, expiry: 'near' },
    { action: 'buy',  type: 'call', strike: 5,  qty: 1, expiry: 'far'  }
  ],
  priceOutlook: 'neutral', volOutlook: 'long vol',
  profitPotential: 'limited', risk: 'limited',
  greeks: { delta: 'neutral', gamma: 'short', theta: 'long', vega: 'long' },
  aka: ['double calendar','double calendar spread'],
  blurb: 'A put calendar below and a call calendar above. A wider neutral profit zone that benefits from time decay and rising volatility; two tent-shaped humps.'
}
```

Greek rationale (textbook): calendars are net **long vega** (far leg has more vega than the near),
**short gamma** (the short near leg dominates gamma near its expiry), **long theta** (you collect the
near leg's faster decay), and **~neutral delta** (mildly long for the call diagonal).

---

## 5. Mode integration

- **Build-a-payoff** (`js/modes/build.js`): ALREADY excludes time-based via
  `ctx.strategies.filter(s => !s.timeBased)`. Leave as is — its leg-picker assumes one expiry and
  matches on the at-expiration curve, which can't represent these. (If you ever want them in Build,
  you'd add a near/far toggle to the leg picker and switch its `curvesMatch` to `payoffAtNearExpiry`.)
- **Match / Test / Flashcards / Gallery / Greeks**: include them. Just make sure the graph rendering
  for these goes through `renderFor`/`renderTimeBased` (see §3) instead of `renderSVG`.
- **Sandbox** (`js/modes/sandbox.js`): is an at-expiration calculator and its structural
  `recognize()` ignores expiry. Leave it at-expiration-only (don't try to recognize calendars there),
  or add a separate note. Not required.

---

## 6. Open decisions (confirm with the user; my recommendations in **bold**)

1. **Payoff model:** **Computed near-expiry approximation** (§2). Alternatives the user may prefer:
   a *stylized fixed curve* (canonical tent, not computed) or *exclude time-based entirely*.
2. **Where shown:** **All modes except Build-a-payoff.** Alternatives: every mode incl. Build, or
   reference-only (Flashcards + Gallery).
3. **Which strategies:** **The 3 in the spec** (calendar, diagonal, double calendar). Optional: add
   put-side variants (put calendar, put diagonal).

---

## 7. Verification

1. Open `gallery.html` — the 3 new cards should show **tent-shaped** curves (calendar/diagonal:
   single peak at/near the strike; double calendar: two humps), each labeled "valued at near expiry".
2. Confirm metrics: max loss ≈ net debit at the wings; peak profit near the strike; finite break-evens
   on either side of the peak.
3. Flashcards / Match / Test should display them with correct graphs and the Greek profile
   Δ ~neutral / Γ short / Θ long / V long.
4. Build-a-payoff should NOT offer them as targets.

---

## 8. Caveats to keep in the code comments

- This is a **teaching approximation**, not a pricing model: constant implied vol, "far" = one extra
  period of ATM time value (`atmTvNear`). It captures the *shape and intuition* (peak at strike, long
  vega/theta), not exact P&L.
- All dollar outputs are per-contract (×100 shares), consistent with the rest of the app.
