# Options Strategy Trainer

A shareable, browser-based learning game that teaches options strategies by the
relationship between their **legs**, their **payoff graph**, their **market outlook**,
and their **net Greek profile**.

Vanilla HTML / CSS / JavaScript — **no framework, no build step, no backend**. Opens
straight from a local file *or* any static host (e.g. GitHub Pages).

## Run it locally
Just open **`index.html`** in any modern browser. That's it.

## Modes
- **Flashcards** — flip cards (name ⇄ graph + outlook + legs + Greeks + the "why"); start from either side. The reference surface.
- **Match** — drag-to-pair tiles across any two facets (graph / name / legs / outlook); timer, streak, pause & reset.
- **Memory** — concentration grid: flip face-down tiles to find matching pairs.
- **Test** — multiple choice, type-the-answer (synonym-aware), and select-all-that-apply, graded with explanations.
- **Build-a-payoff** — reproduce a target payoff by picking legs, or name the strategy.
- **Greeks** — identify net Δ / Γ / Θ / V profiles.
- **Outlook → Strategy** — given a market view, pick the strategy that fits.
- **Sandbox** — free live-graphing calculator with real-dollar strikes/premiums and strategy recognition.

Also: **`gallery.html`** renders every strategy's payoff at once (handy reference / spot-check page).

## Strategy library
28 strategies across singles, vertical spreads, volatility, and advanced/synthetic
categories, defined in **`js/strategies.js`** (human-readable — edit/spot-check freely).
Strikes are generalized around a $100 notional spot.

> **Note on premiums:** payoffs use a deterministic teaching premium model (intrinsic +
> ATM-peaked time value, $5 ATM), *not* Black-Scholes. Greeks are conceptual signs only.

## Not yet included
**Time-based strategies** (calendar / diagonal / double calendar) are documented for a
future pass in **`TIME_BASED_STRATEGIES_NOTES.md`**.

## Project layout
```
index.html          # app shell + mode nav
gallery.html        # all-strategies payoff reference
css/styles.css      # dark trading-desk theme
js/payoff.js        # payoff engine + SVG renderer (relative + absolute)
js/strategies.js    # the strategy library
js/greeks.js        # conceptual Greek labels/meanings
js/storage.js       # localStorage scores/streaks
js/app.js           # session scoping, home screen, router
js/modes/*.js       # one file per mode
```
