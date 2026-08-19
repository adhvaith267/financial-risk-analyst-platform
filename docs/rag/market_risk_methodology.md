# Market Risk Methodology

## Approach: historical simulation

The Market Risk Engine uses historical simulation, not a parametric
covariance model. Today's dollar-weighted portfolio composition is applied
to the portfolio's own historical daily returns to build a hypothetical
daily P&L distribution. This means the risk figures reflect how the
*current* portfolio would have performed on each *historical* day - it
does not assume returns are normally distributed for the historical VaR
and Expected Shortfall figures (only the parametric VaR figure makes that
assumption).

## Volatility

Daily volatility is the sample standard deviation (ddof=1) of the
portfolio's historical daily returns. Annualized volatility multiplies
daily volatility by sqrt(252), assuming 252 trading days per year.

## Value at Risk (VaR)

Two VaR methodologies are reported:

- **Historical VaR** (95% and 99%): the negative of the 5th/1st percentile
  of the portfolio's historical daily return distribution, converted to a
  dollar loss using the current portfolio value. Makes no distributional
  assumption.
- **Parametric VaR** (95%): z_0.95 (1.645) x daily volatility x portfolio
  value. Assumes normally distributed returns; provided alongside the
  historical figure as a sanity check, since the two methods can diverge
  meaningfully when the return distribution is skewed or fat-tailed.

Monte Carlo VaR is not implemented in this platform's MVP scope.

## Expected Shortfall (ES)

ES at the 95% level is the average loss across all historical days whose
loss exceeded the 95% historical VaR threshold - i.e. "given that we're
already in the worst 5% of days, how bad does it get on average." ES is
always >= the corresponding VaR figure, since it captures the tail beyond
the VaR cutoff rather than just the cutoff itself.

## Maximum drawdown

Computed from the portfolio's reconstructed historical value series
(current holding quantities held constant across the lookback window,
multiplied by each day's actual historical prices). Maximum drawdown is
the largest peak-to-trough decline as a percentage of the peak value.

## Concentration

Reported via the Herfindahl-Hirschman Index (HHI = sum of squared dollar
weights) and the single largest position's weight. A well-diversified
portfolio has a low HHI (closer to 1/N for N equally-weighted positions);
a concentrated portfolio has HHI closer to 1.
