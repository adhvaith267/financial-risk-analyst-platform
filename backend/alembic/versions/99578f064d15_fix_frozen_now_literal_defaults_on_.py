"""fix frozen now() literal defaults on timestamp columns

Revision ID: 99578f064d15
Revises: 54201d99b481
Create Date: 2026-08-19 23:58:29.126454

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99578f064d15'
down_revision: Union[str, None] = '54201d99b481'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES_AND_COLUMNS = [
    ("borrowers", "created_at"),
    ("methodology_chunks", "created_at"),
    ("risk_results", "computed_at"),
    ("stress_results", "computed_at"),
]


def upgrade() -> None:
    # server_default="now()" (a plain Python string) compiles to
    # DEFAULT 'now()' - QUOTED. Postgres implicitly casts that string
    # literal to a timestamp exactly once, at DDL-execution time, producing
    # a frozen constant default forever after instead of a live per-row
    # now() call. Every row inserted since these tables were created got
    # the same fixed timestamp. Models now use server_default=func.now(),
    # which compiles to the correct unquoted DEFAULT now(); this migration
    # re-points the already-deployed columns at the live function.
    for table, column in TABLES_AND_COLUMNS:
        op.alter_column(table, column, server_default=sa.text("now()"))


def downgrade() -> None:
    for table, column in TABLES_AND_COLUMNS:
        op.alter_column(table, column, server_default=sa.text("'now()'"))
