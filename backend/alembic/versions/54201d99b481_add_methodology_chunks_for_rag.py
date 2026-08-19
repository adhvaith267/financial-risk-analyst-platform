"""add methodology_chunks for RAG (removed — RAG pipeline deleted)

Revision ID: 54201d99b481
Revises: 021eeffc43f5
Create Date: 2026-08-19 20:39:05.544151

NOTE: This migration originally created the methodology_chunks pgvector table
for the RAG pipeline. That pipeline has been removed. The migration is kept as
a no-op to preserve the Alembic revision chain so existing deployed databases
do not need manual intervention.
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '54201d99b481'
down_revision: Union[str, None] = '021eeffc43f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # RAG pipeline removed — methodology_chunks table no longer needed.
    # No-op: existing deployed DBs that already have the table will keep it
    # harmlessly; fresh DBs won't create it.
    pass


def downgrade() -> None:
    pass
