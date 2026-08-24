"""add indexes and snapshot uniqueness constraints

Revision ID: c6d9b5f2e1a3
Revises: 99578f064d15
Create Date: 2026-08-24 15:00:00
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text


revision: str = "c6d9b5f2e1a3"
down_revision: str | None = "99578f064d15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _assert_no_duplicates(table: str, columns: tuple[str, ...]) -> None:
    column_sql = ", ".join(columns)
    duplicate = op.get_bind().execute(
        text(
            f"SELECT {column_sql} FROM {table} "
            f"GROUP BY {column_sql} HAVING COUNT(*) > 1 LIMIT 1"
        )
    ).first()
    if duplicate is not None:
        values = ", ".join(str(value) for value in duplicate)
        raise RuntimeError(
            f"Cannot add snapshot uniqueness to {table}; duplicate key ({values}) exists. "
            "Resolve duplicate records and rerun the migration."
        )


def upgrade() -> None:
    # Fail with an actionable message instead of allowing a late constraint
    # failure after indexes have already been created.
    _assert_no_duplicates("market_prices", ("asset_id", "price_date"))
    _assert_no_duplicates("portfolio_holdings", ("portfolio_id", "asset_id", "as_of_date"))
    op.create_unique_constraint(
        "uq_market_price_asset_date", "market_prices", ["asset_id", "price_date"]
    )
    op.create_index(
        "ix_market_prices_asset_date", "market_prices", ["asset_id", "price_date"]
    )
    op.create_unique_constraint(
        "uq_portfolio_holding_snapshot",
        "portfolio_holdings",
        ["portfolio_id", "asset_id", "as_of_date"],
    )
    op.create_index(
        "ix_portfolio_holdings_portfolio", "portfolio_holdings", ["portfolio_id"]
    )
    op.create_index("ix_loans_borrower_id", "loans", ["borrower_id"])
    op.create_index("ix_loans_status", "loans", ["status"])
    op.create_index(
        "ix_risk_results_type_computed", "risk_results", ["risk_type", "computed_at"]
    )
    op.create_index("ix_risk_results_entity", "risk_results", ["entity_type", "entity_id"])
    op.create_index("ix_risk_results_computed_at", "risk_results", ["computed_at"])
    op.create_index("ix_stress_results_computed", "stress_results", ["computed_at"])
    op.create_index("ix_stress_results_portfolio", "stress_results", ["portfolio_id"])


def downgrade() -> None:
    op.drop_index("ix_stress_results_portfolio", table_name="stress_results")
    op.drop_index("ix_stress_results_computed", table_name="stress_results")
    op.drop_index("ix_risk_results_computed_at", table_name="risk_results")
    op.drop_index("ix_risk_results_entity", table_name="risk_results")
    op.drop_index("ix_risk_results_type_computed", table_name="risk_results")
    op.drop_index("ix_loans_status", table_name="loans")
    op.drop_index("ix_loans_borrower_id", table_name="loans")
    op.drop_index("ix_portfolio_holdings_portfolio", table_name="portfolio_holdings")
    op.drop_constraint(
        "uq_portfolio_holding_snapshot", "portfolio_holdings", type_="unique"
    )
    op.drop_index("ix_market_prices_asset_date", table_name="market_prices")
    op.drop_constraint("uq_market_price_asset_date", "market_prices", type_="unique")
