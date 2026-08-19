import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from ingest_rag_docs import chunk_markdown


def test_chunks_by_heading():
    text = "# Title\n\nintro\n\n## Section A\n\ncontent a\n\n## Section B\n\ncontent b\n"
    chunks = chunk_markdown(text, "doc.md")

    assert len(chunks) == 2
    assert chunks[0] == ("doc.md#0", "Section A", "## Section A\n\ncontent a")
    assert chunks[1] == ("doc.md#1", "Section B", "## Section B\n\ncontent b")


def test_no_headings_returns_whole_doc_as_one_chunk():
    text = "just some plain text with no headings"
    chunks = chunk_markdown(text, "doc.md")

    assert chunks == [("doc.md#0", "doc.md", text)]


def test_source_ids_are_stable_and_ordered():
    text = "## First\na\n## Second\nb\n## Third\nc\n"
    chunks = chunk_markdown(text, "x.md")

    assert [c[0] for c in chunks] == ["x.md#0", "x.md#1", "x.md#2"]
