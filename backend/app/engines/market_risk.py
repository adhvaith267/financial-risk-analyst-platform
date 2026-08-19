from dataclasses import dataclass

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import MarketPrice, PortfolioHolding

TRADING_DAYS_PER_YEAR = 252
# One-sided normal z-scores, used for parametric VaR.
Z_SCORES = {0.95: 1.645, 0.99: 2.326}


@dataclass
class MarketRiskAssessment:
    portfolio_id: str
    as_of: str
    portfolio_value: float
    daily_volatility: float
    annualized_volatility: float
    historical_var_95: float
    historical_var_99: float
    parametric_var_95: float
    expected_shortfall_95: float
    max_drawdown: float
    hhi: float
    max_position_weight: float
    weights: dict[str, float]


def load_portfolio_data(db: Session, portfolio_id: str) -> tuple[pd.DataFrame, pd.Series]:
    """Returns (prices, quantities): prices is a date x asset_id DataFrame of
    close prices, quantities is asset_id -> held quantity (current snapshot).
    """
    holdings = db.scalars(
        select(PortfolioHolding).where(PortfolioHolding.portfolio_id == portfolio_id)
    ).all()
    if not holdings:
        raise ValueError(f"Portfolio {portfolio_id} has no holdings")

    quantities = pd.Series({h.asset_id: h.quantity for h in holdings})

    rows = db.execute(
        select(MarketPrice.asset_id, MarketPrice.price_date, MarketPrice.close_price)
        .where(MarketPrice.asset_id.in_(quantities.index.tolist()))
        .order_by(MarketPrice.price_date)
    ).all()
    prices = pd.DataFrame(rows, columns=["asset_id", "price_date", "close_price"]).pivot(
        index="price_date", columns="asset_id", values="close_price"
    ).sort_index()

    return prices, quantities


def compute_market_risk(
    portfolio_id: str, prices: pd.DataFrame, quantities: pd.Series
) -> MarketRiskAssessment:
    """Historical-simulation market risk: today's dollar weights applied to the
    portfolio's own historical daily returns. Pure function - no DB access -
    so it's directly unit-testable against a synthetic price history.
    """
    prices = prices.dropna()
    if len(prices) < 2:
        raise ValueError("Need at least 2 days of price history to compute returns")

    portfolio_value_series = prices.mul(quantities, axis=1).sum(axis=1)
    portfolio_value = float(portfolio_value_series.iloc[-1])

    returns = prices.pct_change().dropna()

    dollar_positions = prices.iloc[-1] * quantities
    weights = dollar_positions / dollar_positions.sum()

    portfolio_returns = returns.mul(weights, axis=1).sum(axis=1)

    daily_vol = float(portfolio_returns.std(ddof=1))
    annualized_vol = daily_vol * np.sqrt(TRADING_DAYS_PER_YEAR)

    var_95_return = float(np.percentile(portfolio_returns, 5))
    var_99_return = float(np.percentile(portfolio_returns, 1))
    historical_var_95 = -var_95_return * portfolio_value
    historical_var_99 = -var_99_return * portfolio_value

    parametric_var_95 = Z_SCORES[0.95] * daily_vol * portfolio_value

    tail_returns = portfolio_returns[portfolio_returns <= var_95_return]
    expected_shortfall_95 = float(-tail_returns.mean() * portfolio_value) if len(tail_returns) else historical_var_95

    running_max = portfolio_value_series.cummax()
    drawdown = (portfolio_value_series - running_max) / running_max
    max_drawdown = float(drawdown.min())

    hhi = float((weights**2).sum())
    max_position_weight = float(weights.max())

    return MarketRiskAssessment(
        portfolio_id=portfolio_id,
        as_of=str(prices.index[-1]),
        portfolio_value=portfolio_value,
        daily_volatility=daily_vol,
        annualized_volatility=annualized_vol,
        historical_var_95=historical_var_95,
        historical_var_99=historical_var_99,
        parametric_var_95=parametric_var_95,
        expected_shortfall_95=expected_shortfall_95,
        max_drawdown=max_drawdown,
        hhi=hhi,
        max_position_weight=max_position_weight,
        weights={k: round(v, 4) for k, v in weights.to_dict().items()},
    )


def assess_portfolio(db: Session, portfolio_id: str) -> MarketRiskAssessment:
    prices, quantities = load_portfolio_data(db, portfolio_id)
    return compute_market_risk(portfolio_id, prices, quantities)
