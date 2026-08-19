import pandas as pd
import pytest

from app.engines.stress import StressScenario, apply_default_shock, apply_market_shock
from app.models.borrower import Loan


@pytest.fixture
def scenario() -> StressScenario:
    return StressScenario(name="recession", equity_shock=-0.20, rate_shock_bps=150.0, default_shock=0.30)


def test_equity_shock_hits_equity_only(scenario):
    prices = pd.Series({"AAPL": 100.0, "TLT": 90.0, "CASH": 1.0})
    quantities = pd.Series({"AAPL": 10.0, "TLT": 10.0, "CASH": 1000.0})
    asset_classes = {"AAPL": "equity", "TLT": "bond", "CASH": "cash"}

    market_loss, baseline, stressed = apply_market_shock(prices, quantities, asset_classes, scenario)

    baseline_expected = 10 * 100 + 10 * 90 + 1000 * 1  # 2900
    assert baseline == pytest.approx(baseline_expected)

    # AAPL: -20% -> loses 10*100*0.20 = 200
    # TLT: -17yr duration * 150bps = -25.5% -> loses 10*90*0.255 = 229.5
    # CASH: unaffected
    expected_loss = 10 * 100 * 0.20 + 10 * 90 * 0.255
    assert market_loss == pytest.approx(expected_loss)
    assert stressed == pytest.approx(baseline_expected - expected_loss)


def test_zero_shock_is_a_no_op():
    prices = pd.Series({"AAPL": 100.0})
    quantities = pd.Series({"AAPL": 10.0})
    zero_scenario = StressScenario(name="none", equity_shock=0.0, rate_shock_bps=0.0, default_shock=0.0)

    market_loss, baseline, stressed = apply_market_shock(prices, quantities, {"AAPL": "equity"}, zero_scenario)

    assert market_loss == pytest.approx(0.0)
    assert baseline == pytest.approx(stressed)


def test_default_shock_increases_expected_loss(scenario):
    loan = Loan(loan_id="L1", borrower_id="B1", loan_type="personal",
                outstanding_balance=100_000.0, recovery_rate=0.60)
    baseline_pds = [0.10]

    credit_loss, baseline_el, stressed_el = apply_default_shock([loan], baseline_pds, scenario)

    lgd = 0.40
    expected_baseline_el = 0.10 * lgd * 100_000.0
    expected_stressed_pd = 0.10 * 1.30  # +30% relative shock
    expected_stressed_el = expected_stressed_pd * lgd * 100_000.0

    assert baseline_el == pytest.approx(expected_baseline_el)
    assert stressed_el == pytest.approx(expected_stressed_el)
    assert credit_loss == pytest.approx(expected_stressed_el - expected_baseline_el)
    assert credit_loss > 0


def test_default_shock_clips_pd_at_one():
    loan = Loan(loan_id="L1", borrower_id="B1", loan_type="personal",
                outstanding_balance=100_000.0, recovery_rate=0.50)
    extreme_scenario = StressScenario(name="extreme", equity_shock=0.0, rate_shock_bps=0.0, default_shock=10.0)

    _, _, stressed_el = apply_default_shock([loan], [0.50], extreme_scenario)

    # 0.50 * (1 + 10.0) = 5.5, clipped to 1.0
    assert stressed_el == pytest.approx(1.0 * 0.50 * 100_000.0)


def test_no_active_loans_means_zero_credit_loss():
    credit_loss, baseline_el, stressed_el = apply_default_shock([], [], StressScenario("x", 0, 0, 0))
    assert (credit_loss, baseline_el, stressed_el) == (0.0, 0.0, 0.0)
