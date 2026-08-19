# Stress Testing Methodology

This is a scenario-analysis engine, not a full regulatory capital / bank
stress-testing framework (e.g. it does not model funding liquidity, capital
ratios, or multi-period paths). It answers "what happens to current
exposures if conditions become materially worse," as a single-period shock.

## Inputs

A stress scenario has three shock parameters:

- **Equity shock** (e.g. -0.20 for a 20% equity market decline)
- **Rate shock** in basis points (e.g. +150 for a 150bps parallel rate rise)
- **Default shock** (e.g. +0.30 for a 30% relative increase in PD across
  the loan book)

## Market loss

Applied per-asset by asset class:

- **Equity** holdings take the equity shock directly (price x (1 + equity_shock)).
- **Bond** holdings take a rate-shock-driven price move via a duration
  approximation: delta_P/P = -duration x delta_y. This platform uses a
  documented assumption of 17 years effective duration (modeled on a
  20+ year Treasury ETF-style exposure), not asset-specific duration data.
- **Cash** is unaffected by either shock.

Market loss = baseline portfolio value - stressed portfolio value, summed
across all holdings.

## Credit loss

The default shock is applied as a multiplicative bump to each active
loan's baseline PD (stressed_PD = min(1.0, baseline_PD x (1 + default_shock))),
then Expected Loss is recomputed per loan with the stressed PD. Credit loss
is the increase in total portfolio Expected Loss (stressed EL - baseline
EL) across the *entire active loan book* - there is no foreign-key link
between a specific market portfolio and the credit book in this platform's
schema, so a stress test's credit-loss figure is always firm-wide, not
scoped to the market portfolio named in the request.

## Combined loss

Combined loss = market loss + credit loss. This is a simple sum, not a
correlation-adjusted combination - the platform does not model correlation
between market and credit shocks beyond both being driven by the same
named scenario.
