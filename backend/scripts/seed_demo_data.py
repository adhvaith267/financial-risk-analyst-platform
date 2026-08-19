"""Seeds demo data into RDS: real GMSC borrower/loan records (sampled from the
same dataset the PD model trains on) plus a synthetic demo portfolio for the
market risk engine.

Market price history here is SYNTHETIC (geometric Brownian motion, fixed
seed) - a placeholder until the real-world data phase wires up FRED/a market
data API. Borrower credit attributes are real GMSC rows, not synthetic.
"""

import io
from datetime import date, timedelta

import boto3
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_engine
from app.models import Asset, Borrower, Loan, MarketPrice, Portfolio, PortfolioHolding

GMSC_BUCKET = "financial-risk-analyst-adhvaith-2026"
GMSC_KEY = "datasets/gmsc/raw/cs-training.csv"
N_BORROWERS = 30
BORROWER_ID_START = 1001

ASSETS = [
    ("AAPL", "Apple Inc.", "equity", 180.0, 0.28),
    ("MSFT", "Microsoft Corp.", "equity", 410.0, 0.24),
    ("JPM", "JPMorgan Chase & Co.", "equity", 195.0, 0.26),
    ("TLT", "iShares 20+ Year Treasury Bond ETF", "bond", 95.0, 0.14),
    ("CASH", "Cash / Money Market", "cash", 1.0, 0.0),
]
PORTFOLIO_ID = "P001"
PORTFOLIO_HOLDINGS = {  # asset_id -> quantity
    "AAPL": 500,
    "MSFT": 300,
    "JPM": 400,
    "TLT": 1000,
    "CASH": 50_000,
}


def load_gmsc_sample(n: int) -> pd.DataFrame:
    settings = get_settings()
    s3 = boto3.client("s3", region_name=settings.aws_region)
    obj = s3.get_object(Bucket=GMSC_BUCKET, Key=GMSC_KEY)
    df = pd.read_csv(io.BytesIO(obj["Body"].read()), index_col=0)
    return df.sample(n=n, random_state=42).reset_index(drop=True)


def seed_borrowers_and_loans(db: Session) -> None:
    sample = load_gmsc_sample(N_BORROWERS)
    for i, row in sample.iterrows():
        borrower_id = f"B{BORROWER_ID_START + i}"
        monthly_income = None if pd.isna(row["MonthlyIncome"]) else float(row["MonthlyIncome"])
        dependents = None if pd.isna(row["NumberOfDependents"]) else float(row["NumberOfDependents"])

        borrower = Borrower(
            borrower_id=borrower_id,
            name=f"Demo Borrower {borrower_id}",
            age=int(row["age"]),
            revolving_utilization_of_unsecured_lines=float(row["RevolvingUtilizationOfUnsecuredLines"]),
            number_of_time_30_59_days_past_due_not_worse=int(row["NumberOfTime30-59DaysPastDueNotWorse"]),
            debt_ratio=float(row["DebtRatio"]),
            monthly_income=monthly_income,
            number_of_open_credit_lines_and_loans=int(row["NumberOfOpenCreditLinesAndLoans"]),
            number_of_times_90_days_late=int(row["NumberOfTimes90DaysLate"]),
            number_real_estate_loans_or_lines=int(row["NumberRealEstateLoansOrLines"]),
            number_of_time_60_89_days_past_due_not_worse=int(row["NumberOfTime60-89DaysPastDueNotWorse"]),
            number_of_dependents=dependents,
        )
        db.merge(borrower)

        has_real_estate = borrower.number_real_estate_loans_or_lines > 0
        loan_type = "mortgage" if has_real_estate else "personal"
        recovery_rate = 0.65 if has_real_estate else 0.55
        income_basis = monthly_income or 3000.0
        outstanding_balance = round(
            min(max(income_basis * 12 * min(borrower.debt_ratio, 2.0), 5_000.0), 500_000.0), 2
        )

        loan = Loan(
            loan_id=f"L{BORROWER_ID_START + i}",
            borrower_id=borrower_id,
            loan_type=loan_type,
            outstanding_balance=outstanding_balance,
            recovery_rate=recovery_rate,
        )
        db.merge(loan)

    db.commit()
    print(f"seeded {N_BORROWERS} GMSC-sampled borrowers/loans (B{BORROWER_ID_START}..B{BORROWER_ID_START + N_BORROWERS - 1})")


def seed_market_data(db: Session) -> None:
    rng = np.random.default_rng(42)
    n_days = 504  # ~2 trading years
    end = date.today()
    business_days = pd.bdate_range(end=end, periods=n_days)

    # MarketPrice/PortfolioHolding use surrogate auto-increment PKs, so merge()/add()
    # would insert duplicates on re-run - clear this script's own rows first instead.
    asset_ids = [a[0] for a in ASSETS]
    db.query(MarketPrice).filter(MarketPrice.asset_id.in_(asset_ids)).delete(synchronize_session=False)
    db.query(PortfolioHolding).filter(PortfolioHolding.portfolio_id == PORTFOLIO_ID).delete(synchronize_session=False)
    db.commit()

    for asset_id, name, asset_class, start_price, annual_vol in ASSETS:
        db.merge(Asset(asset_id=asset_id, name=name, asset_class=asset_class))

        if asset_class == "cash":
            prices = [1.0] * n_days
        else:
            daily_vol = annual_vol / np.sqrt(252)
            daily_drift = 0.07 / 252  # 7% annual drift assumption
            shocks = rng.normal(daily_drift - 0.5 * daily_vol**2, daily_vol, n_days)
            prices = start_price * np.exp(np.cumsum(shocks))

        for price_date, close_price in zip(business_days, prices):
            db.merge(
                MarketPrice(
                    asset_id=asset_id,
                    price_date=price_date.date(),
                    close_price=round(float(close_price), 4),
                )
            )
    db.commit()
    print(f"seeded {len(ASSETS)} assets x {n_days} days of SYNTHETIC price history")

    db.merge(Portfolio(portfolio_id=PORTFOLIO_ID, name="Demo Balanced Portfolio"))
    as_of = end
    for asset_id, quantity in PORTFOLIO_HOLDINGS.items():
        db.add(
            PortfolioHolding(
                portfolio_id=PORTFOLIO_ID, asset_id=asset_id, quantity=quantity, as_of_date=as_of
            )
        )
    db.commit()
    print(f"seeded portfolio {PORTFOLIO_ID} with {len(PORTFOLIO_HOLDINGS)} holdings")


def main() -> None:
    with Session(get_engine()) as db:
        seed_borrowers_and_loans(db)
        seed_market_data(db)


if __name__ == "__main__":
    main()
