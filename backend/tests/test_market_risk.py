import pandas as pd
import pytest

from app.engines.market_risk import compute_market_risk


@pytest.fixture
def prices() -> pd.DataFrame:
    dates = pd.bdate_range("2026-01-05", periods=5)
    # X swings up then down to a trough on day 4, recovers on day 5.
    # CASH is flat (0 daily return every day).
    return pd.DataFrame(
        {"X": [100.0, 105.0, 100.0, 95.0, 100.0], "CASH": [1.0, 1.0, 1.0, 1.0, 1.0]},
        index=dates,
    )


@pytest.fixture
def quantities() -> pd.Series:
    return pd.Series({"X": 10.0, "CASH": 500.0})


def test_weights_and_portfolio_value(prices, quantities):
    result = compute_market_risk("PTEST", prices, quantities)

    # Last day: X = 10 * 100 = 1000, CASH = 500 * 1 = 500, total = 1500.
    assert result.portfolio_value == pytest.approx(1500.0)
    assert result.weights["X"] == pytest.approx(1000 / 1500, abs=1e-3)
    assert result.weights["CASH"] == pytest.approx(500 / 1500, abs=1e-3)
    assert sum(result.weights.values()) == pytest.approx(1.0, abs=1e-6)


def test_hhi_and_max_position_weight(prices, quantities):
    result = compute_market_risk("PTEST", prices, quantities)

    w_x, w_cash = 1000 / 1500, 500 / 1500
    assert result.hhi == pytest.approx(w_x**2 + w_cash**2, abs=1e-3)
    assert result.max_position_weight == pytest.approx(w_x, abs=1e-3)


def test_max_drawdown_matches_known_trough(prices, quantities):
    result = compute_market_risk("PTEST", prices, quantities)

    # Portfolio value path: 1500, 1550, 1500, 1450, 1500 (10*price + 500).
    # Peak before the trough is 1550 (day 2); trough is 1450 (day 4).
    expected_dd = (1450 - 1550) / 1550
    assert result.max_drawdown == pytest.approx(expected_dd, abs=1e-6)


def test_risk_metrics_are_internally_consistent(prices, quantities):
    result = compute_market_risk("PTEST", prices, quantities)

    assert result.daily_volatility > 0
    assert result.annualized_volatility > result.daily_volatility
    assert result.historical_var_95 > 0
    assert result.historical_var_99 >= result.historical_var_95  # deeper tail, larger loss
    assert result.expected_shortfall_95 >= result.historical_var_95  # ES averages the tail beyond VaR
    assert result.max_drawdown <= 0


def test_raises_on_unknown_portfolio_with_no_holdings():
    with pytest.raises(ValueError):
        compute_market_risk("EMPTY", pd.DataFrame(), pd.Series(dtype=float))
