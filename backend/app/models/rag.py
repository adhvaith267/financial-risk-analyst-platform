from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

EMBEDDING_DIM = 1024  # amazon.titan-embed-text-v2:0


class MethodologyChunk(Base):
    """A chunk of risk-methodology/assumptions documentation, embedded for
    retrieval. Source docs live in S3 (docs/rag/*.md in this repo, uploaded
    via infra/scripts/04_upload_rag_docs.sh); this table is the RAG index.
    """

    __tablename__ = "methodology_chunks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(200))  # e.g. "credit_risk.md#2"
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
