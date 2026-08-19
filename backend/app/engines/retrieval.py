from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.rag import MethodologyChunk
from app.services.embeddings import get_embedding_client


@dataclass
class RetrievedChunk:
    source: str
    title: str
    content: str
    distance: float


def search_methodology(db: Session, query: str, top_k: int = 3) -> list[RetrievedChunk]:
    """Cosine-distance nearest-neighbor search over methodology_chunks via
    pgvector's <=> operator. Lower distance = more relevant."""
    query_embedding = get_embedding_client().embed(query)
    distance = MethodologyChunk.embedding.cosine_distance(query_embedding).label("distance")

    rows = db.execute(
        select(MethodologyChunk, distance).order_by(distance).limit(top_k)
    ).all()

    return [
        RetrievedChunk(source=chunk.source, title=chunk.title, content=chunk.content, distance=dist)
        for chunk, dist in rows
    ]
