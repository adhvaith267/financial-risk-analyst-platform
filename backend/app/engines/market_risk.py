from dataclasses import dataclass

import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import PortfolioDataUnavailableError
from app.models.market import MarketPrice, PortfolioHolding

TRADING_DAYS_PER_YEAR = 252
# One-sided normal z-scores, used for parametric VaR.
Z_SCORES = {0.95: 1.645, 0.99: 2.326}
# A single position at or above this weight is called out as a concentration
# risk driver on its own.
CONCENTRATION_THRESHOLD = 0.20
# Two holdings moving this closely together add correlation risk beyond
# what the weights alone show - a "diversified-looking" portfolio can still
# fall together if its pieces are highly correlated.
HIGH_CORRELATION_THRESHOLD = 0.70


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
    correlation_matrix: dict[str, dict[str, float]]
    value_history: list[dict]
    risk_drivers: list[str]
    confidence_level: float
    selected_var: float
    selected_expected_shortfall: float


def load_portfolio_data(db: Session, portfolio_id: str) -> tuple[pd.DataFrame, pd.Series]:
    """Returns (prices, quantities): prices is a date x asset_id DataFrame of
    close prices, quantities is asset_id -> held quantity from the latest
    portfolio snapshot.
    """
    latest_snapshot = db.scalar(
        select(func.max(PortfolioHolding.as_of_date)).where(
            PortfolioHolding.portfolio_id == portfolio_id
        )
    )
    if latest_snapshot is None:
        raise PortfolioDataUnavailableError(f"Portfolio {portfolio_id} has no holdings")

    holdings = db.scalars(
        select(PortfolioHolding).where(
            PortfolioHolding.portfolio_id == portfolio_id,
            PortfolioHolding.as_of_date == latest_snapshot,
        )
    ).all()
    if not holdings:
        raise PortfolioDataUnavailableError(f"Portfolio {portfolio_id} has no holdings")

    quantities = pd.Series({h.asset_id: h.quantity for h in holdings})

    rows = db.execute(
        select(MarketPrice.asset_id, MarketPrice.price_date, MarketPrice.close_price)
        .where(MarketPrice.asset_id.in_(quantities.index.tolist()))
        .order_by(MarketPrice.price_date)
    ).all()
    prices = (
        pd.DataFrame(rows, columns=["asset_id", "price_date", "close_price"])
        .pivot(index="price_date", columns="asset_id", values="close_price")
        .sort_index()
    )

    missing_assets = quantities.index.difference(prices.columns)
    if len(missing_assets):
        missing = ", ".join(str(asset) for asset in missing_assets)
        raise PortfolioDataUnavailableError(
            f"Portfolio {portfolio_id} has no price history for: {missing}"
        )

    return prices, quantities


def _derive_risk_drivers(
    weights: pd.Series, correlation_matrix: dict[str, dict[str, float]]
) -> list[str]:
    """Pure: plain-language labels for what's driving this portfolio's risk,
    derived only from data already computed above (weights, correlation) -
    not a separate model."""
    drivers = []

    top_asset = weights.idxmax()
    if weights[top_asset] >= CONCENTRATION_THRESHOLD:
        drivers.append(
            f"Concentrated position in {top_asset} ({weights[top_asset]:.0%} of portfolio)"
        )

    assets = list(weights.index)
    for i, asset_a in enumerate(assets):
        for asset_b in assets[i + 1 :]:
            corr = correlation_matrix.get(asset_a, {}).get(asset_b)
            if corr is not None and corr >= HIGH_CORRELATION_THRESHOLD:
                drivers.append(f"High correlation between {asset_a} and {asset_b} ({corr:.2f})")

    return drivers


def compute_market_risk(
    portfolio_id: str,
    prices: pd.DataFrame,
    quantities: pd.Series,
    *,
    lookback_days: int = 250,
    confidence_level: float = 0.95,
) -> MarketRiskAssessment:
    """Historical-simulation market risk: today's dollar weights applied to the
    portfolio's own historical daily returns. Pure function - no DB access -
    so it's directly unit-testable against a synthetic price history.
    """
    if not 0.90 <= confidence_level <= 0.999:
        raise ValueError("confidence_level must be between 0.90 and 0.999")
    if quantities.empty or not np.isfinite(quantities.to_numpy(dtype=float)).all():
        raise PortfolioDataUnavailableError(f"Portfolio {portfolio_id} has invalid holdings")

    prices = (
        prices.replace([np.inf, -np.inf], np.nan)
        .reindex(columns=quantities.index)
        .dropna()
        .tail(lookback_days)
    )
    if len(prices) < 3:
        raise PortfolioDataUnavailableError(
            f"Portfolio {portfolio_id} does not have enough complete price history"
        )

    returns = prices.pct_change().dropna()

    dollar_positions = prices.iloc[-1] * quantities
    portfolio_value = float(dollar_positions.sum())
    if not np.isfinite(portfolio_value) or portfolio_value <= 0:
        raise PortfolioDataUnavailableError(
            f"Portfolio {portfolio_id} has no positive priced value"
        )
    weights = dollar_positions / portfolio_value
    portfolio_value_series = prices.mul(quantities, axis=1).sum(axis=1)
    if not np.isfinite(portfolio_value_series.to_numpy()).all() or (
        portfolio_value_series <= 0
    ).any():
        raise PortfolioDataUnavailableError(
            f"Portfolio {portfolio_id} has invalid historical priced values"
        )

    portfolio_returns = returns.mul(weights, axis=1).sum(axis=1)

    daily_vol = float(portfolio_returns.std(ddof=1))
    annualized_vol = daily_vol * np.sqrt(TRADING_DAYS_PER_YEAR)

    var_95_return = float(np.percentile(portfolio_returns, 5))
    var_99_return = float(np.percentile(portfolio_returns, 1))
    historical_var_95 = -var_95_return * portfolio_value
    historical_var_99 = -var_99_return * portfolio_value

    selected_var_return = float(np.percentile(portfolio_returns, (1 - confidence_level) * 100))
    selected_var = -selected_var_return * portfolio_value
    selected_tail_returns = portfolio_returns[portfolio_returns <= selected_var_return]
    selected_expected_shortfall = (
        float(-selected_tail_returns.mean() * portfolio_value)
        if len(selected_tail_returns)
        else selected_var
    )

    parametric_var_95 = Z_SCORES[0.95] * daily_vol * portfolio_value

    tail_returns = portfolio_returns[portfolio_returns <= var_95_return]
    expected_shortfall_95 = (
        float(-tail_returns.mean() * portfolio_value) if len(tail_returns) else historical_var_95
    )

    running_max = portfolio_value_series.cummax()
    drawdown = (portfolio_value_series - running_max) / running_max
    max_drawdown = float(drawdown.min())

    hhi = float((weights**2).sum())
    max_position_weight = float(weights.max())

    # Pairwise correlation of daily returns - genuinely part of the risk
    # picture (concentrated + highly-correlated is worse than concentrated
    # alone), and cheap since `returns` is already computed above. A
    # zero-variance series (e.g. cash) makes correlation undefined (NaN),
    # which isn't valid JSON - fill with 0 (an asset with no variance has no
    # linear relationship to anything, which 0 encodes correctly enough).
    correlation_matrix = returns.corr().fillna(0.0).round(3).to_dict()

    # Reconstructed portfolio value over the lookback window: today's
    # holdings, priced at each historical day's close. Not a claim about
    # what was actually held on those dates.
    value_history = [
        {"date": str(idx), "value": round(float(v), 2)} for idx, v in portfolio_value_series.items()
    ]

    risk_drivers = _derive_risk_drivers(weights, correlation_matrix)

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
        correlation_matrix=correlation_matrix,
        value_history=value_history,
        risk_drivers=risk_drivers,
        confidence_level=confidence_level,
        selected_var=selected_var,
        selected_expected_shortfall=selected_expected_shortfall,
    )


def assess_portfolio(
    db: Session,
    portfolio_id: str,
    *,
    lookback_days: int = 250,
    confidence_level: float = 0.95,
) -> MarketRiskAssessment:
    prices, quantities = load_portfolio_data(db, portfolio_id)
    return compute_market_risk(
        portfolio_id,
        prices,
        quantities,
        lookback_days=lookback_days,
        confidence_level=confidence_level,
    )
