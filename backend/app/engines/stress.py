from dataclasses import dataclass

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PortfolioDataUnavailableError
from app.engines.market_risk import load_portfolio_data
from app.models.borrower import Borrower, Loan
from app.models.market import Asset
from app.services.sagemaker_client import get_pd_model_client

# Documented MVP assumption: effective duration used to translate a rate
# shock into a bond price move (ΔP/P ≈ -duration * Δy). Modeled on a
# 20+yr treasury ETF-style exposure (e.g. TLT), not asset-specific.
BOND_EFFECTIVE_DURATION_YEARS = 17.0


@dataclass
class StressScenario:
    name: str
    equity_shock: float  # e.g. -0.20 for -20%
    rate_shock_bps: float  # e.g. 150 for +150bps
    default_shock: float  # e.g. 0.30 for +30% relative PD increase

    def __post_init__(self) -> None:
        if not -1.0 <= self.equity_shock <= 0.0:
            raise ValueError("equity_shock must be between -1.0 and 0.0")
        if not -1000.0 <= self.rate_shock_bps <= 2000.0:
            raise ValueError("rate_shock_bps must be between -1000 and 2000")
        if not 0.0 <= self.default_shock <= 10.0:
            raise ValueError("default_shock must be between 0 and 10")


@dataclass
class StressResult:
    portfolio_id: str
    scenario: StressScenario
    market_loss: float
    credit_loss: float
    combined_loss: float
    baseline_portfolio_value: float
    stressed_portfolio_value: float
    baseline_total_expected_loss: float
    stressed_total_expected_loss: float
    vulnerabilities: list[str]


# Concentration above this weight in a single position is called out as a
# vulnerability on its own (independent of the shock applied).
CONCENTRATION_THRESHOLD = 0.20


def _asset_price_shock(asset_class: str, scenario: StressScenario) -> float:
    if asset_class == "equity":
        return scenario.equity_shock
    if asset_class == "bond":
        return max(
            -1.0,
            -BOND_EFFECTIVE_DURATION_YEARS * (scenario.rate_shock_bps / 10_000),
        )
    return 0.0  # cash and anything else: unaffected


def apply_market_shock(
    latest_prices: pd.Series,
    quantities: pd.Series,
    asset_classes: dict[str, str],
    scenario: StressScenario,
) -> tuple[float, float, float]:
    """Pure: no DB access. Returns (market_loss, baseline_value, stressed_value)."""
    baseline_value = float((latest_prices * quantities).sum())
    if not pd.notna(baseline_value) or baseline_value <= 0:
        raise PortfolioDataUnavailableError("Portfolio has no positive priced value")
    if latest_prices.reindex(quantities.index).isna().any():
        raise PortfolioDataUnavailableError("Portfolio has incomplete priced positions")

    stressed_value = 0.0
    for asset_id, qty in quantities.items():
        shock = _asset_price_shock(asset_classes.get(asset_id, ""), scenario)
        stressed_value += latest_prices[asset_id] * (1 + shock) * qty

    market_loss = baseline_value - stressed_value
    return market_loss, baseline_value, stressed_value


def derive_vulnerabilities(
    latest_prices: pd.Series,
    quantities: pd.Series,
    asset_classes: dict[str, str],
    scenario: StressScenario,
) -> list[str]:
    """Pure: plain-language labels for what's driving the loss, derived from
    the same portfolio composition and shock magnitudes apply_market_shock
    uses - not a separate model, just naming what's already there."""
    dollar_positions = latest_prices * quantities
    portfolio_value = float(dollar_positions.sum())
    if not pd.notna(portfolio_value) or portfolio_value <= 0:
        raise PortfolioDataUnavailableError("Portfolio has no positive priced value")
    weights = dollar_positions / portfolio_value

    vulnerabilities = []

    top_asset = weights.idxmax()
    if weights[top_asset] >= CONCENTRATION_THRESHOLD:
        vulnerabilities.append(
            f"Concentrated position in {top_asset} ({weights[top_asset]:.0%} of portfolio)"
        )

    equity_weight = sum(w for a, w in weights.items() if asset_classes.get(a) == "equity")
    if equity_weight > 0 and scenario.equity_shock != 0:
        vulnerabilities.append(
            f"Equity exposure ({equity_weight:.0%} of portfolio) to the "
            f"{scenario.equity_shock:+.0%} equity shock"
        )

    bond_weight = sum(w for a, w in weights.items() if asset_classes.get(a) == "bond")
    if bond_weight > 0 and scenario.rate_shock_bps != 0:
        vulnerabilities.append(
            f"Rate-sensitive bond holdings ({bond_weight:.0%} of portfolio) to the "
            f"+{scenario.rate_shock_bps:.0f}bps rate shock"
        )

    return vulnerabilities


def apply_default_shock(
    loans: list[Loan], baseline_pds: list[float], scenario: StressScenario
) -> tuple[float, float, float]:
    """Pure: takes already-fetched baseline PDs (same order as loans).
    Returns (credit_loss, baseline_expected_loss, stressed_expected_loss).
    """
    baseline_el = 0.0
    stressed_el = 0.0
    for loan, baseline_pd in zip(loans, baseline_pds, strict=True):
        stressed_pd = min(1.0, baseline_pd * (1 + scenario.default_shock))
        lgd = 1 - loan.recovery_rate
        baseline_el += baseline_pd * lgd * loan.outstanding_balance
        stressed_el += stressed_pd * lgd * loan.outstanding_balance

    return stressed_el - baseline_el, baseline_el, stressed_el


def compute_market_loss(
    db: Session, portfolio_id: str, scenario: StressScenario
) -> tuple[float, float, float, list[str]]:
    prices, quantities = load_portfolio_data(db, portfolio_id)
    complete_prices = prices.reindex(columns=quantities.index).dropna()
    if complete_prices.empty:
        raise PortfolioDataUnavailableError(
            f"Portfolio {portfolio_id} does not have a complete latest price snapshot"
        )
    latest_prices = complete_prices.iloc[-1]

    assets = db.scalars(select(Asset).where(Asset.asset_id.in_(quantities.index.tolist()))).all()
    asset_classes = {a.asset_id: a.asset_class for a in assets}

    market_loss, baseline_value, stressed_value = apply_market_shock(
        latest_prices, quantities, asset_classes, scenario
    )
    vulnerabilities = derive_vulnerabilities(latest_prices, quantities, asset_classes, scenario)
    return market_loss, baseline_value, stressed_value, vulnerabilities


def compute_credit_loss(db: Session, scenario: StressScenario) -> tuple[float, float, float]:
    """Applies the default shock across the full active loan book. There's no
    FK between portfolios and loans in this schema (see architecture doc
    section 25 - credit and market books are parallel, not nested), so this
    is firm-wide, not scoped to a single portfolio_id.
    """
    loans = db.scalars(select(Loan).where(Loan.status == "active")).all()
    if not loans:
        return 0.0, 0.0, 0.0

    borrower_ids = [loan.borrower_id for loan in loans]
    borrowers = {
        b.borrower_id: b
        for b in db.scalars(select(Borrower).where(Borrower.borrower_id.in_(borrower_ids)))
    }

    payloads = [borrowers[loan.borrower_id].to_pd_model_payload() for loan in loans]
    predictions = get_pd_model_client().predict(payloads)  # one batched round trip
    baseline_pds = [p["pd"] for p in predictions]

    return apply_default_shock(loans, baseline_pds, scenario)


def run_stress_test(db: Session, portfolio_id: str, scenario: StressScenario) -> StressResult:
    market_loss, baseline_value, stressed_value, vulnerabilities = compute_market_loss(
        db, portfolio_id, scenario
    )
    credit_loss, baseline_el, stressed_el = compute_credit_loss(db, scenario)

    return StressResult(
        portfolio_id=portfolio_id,
        scenario=scenario,
        market_loss=market_loss,
        credit_loss=credit_loss,
        combined_loss=market_loss + credit_loss,
        baseline_portfolio_value=baseline_value,
        stressed_portfolio_value=stressed_value,
        baseline_total_expected_loss=baseline_el,
        stressed_total_expected_loss=stressed_el,
        vulnerabilities=vulnerabilities,
    )
