"""Chunks the RAG methodology docs (synced to S3 via
infra/scripts/04_upload_rag_docs.sh), embeds each chunk with Titan Embed
Text v2, and upserts into methodology_chunks. Idempotent: re-running clears
and re-inserts chunks for each source file, so edits to the .md files are
picked up on re-ingestion.

Chunking is section-level: each "## Heading" starts a new chunk, running
until the next "## " or end of file. These docs are short and already
well-segmented by heading, so this is sufficient - no sliding-window/overlap
chunking needed.
"""

import re

import boto3
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_engine
from app.models.rag import MethodologyChunk
from app.services.embeddings import get_embedding_client

BUCKET = "financial-risk-analyst-adhvaith-2026"
PREFIX = "rag-docs/"

SECTION_RE = re.compile(r"^## (.+)$", re.MULTILINE)


def chunk_markdown(text: str, filename: str) -> list[tuple[str, str, str]]:
    """Returns list of (source, title, content) tuples, one per section."""
    headings = list(SECTION_RE.finditer(text))
    if not headings:
        return [(f"{filename}#0", filename, text.strip())]

    chunks = []
    for i, match in enumerate(headings):
        start = match.start()
        end = headings[i + 1].start() if i + 1 < len(headings) else len(text)
        title = match.group(1).strip()
        content = text[start:end].strip()
        chunks.append((f"{filename}#{i}", title, content))
    return chunks


def main() -> None:
    settings = get_settings()
    s3 = boto3.client("s3", region_name=settings.aws_region)
    embedding_client = get_embedding_client()

    objects = s3.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX).get("Contents", [])
    md_keys = [obj["Key"] for obj in objects if obj["Key"].endswith(".md")]
    if not md_keys:
        raise RuntimeError(f"No .md files found at s3://{BUCKET}/{PREFIX}")

    with Session(get_engine()) as db:
        total_chunks = 0
        for key in md_keys:
            filename = key.removeprefix(PREFIX)
            body = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read().decode("utf-8")
            chunks = chunk_markdown(body, filename)

            db.execute(delete(MethodologyChunk).where(MethodologyChunk.source.like(f"{filename}#%")))

            for source, title, content in chunks:
                embedding = embedding_client.embed(content)
                db.add(MethodologyChunk(source=source, title=title, content=content, embedding=embedding))

            total_chunks += len(chunks)
            print(f"{filename}: {len(chunks)} chunks")

        db.commit()
    print(f"ingested {total_chunks} chunks from {len(md_keys)} documents")


if __name__ == "__main__":
    main()
