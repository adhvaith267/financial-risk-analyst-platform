from app.agent.graph import _extract_text


def test_strips_think_block_from_string():
    raw = "<think>internal reasoning here</think>\n\nFinal assessment: approve the loan."
    assert _extract_text(raw) == "Final assessment: approve the loan."


def test_leaves_plain_answer_untouched():
    raw = "Final assessment: approve the loan."
    assert _extract_text(raw) == raw


def test_strips_multiline_think_block():
    raw = "<think>\nline one\nline two\n</think>\nAnswer text."
    assert _extract_text(raw) == "Answer text."


def test_strips_unmatched_leading_think_tag():
    raw = "<think> Final assessment: approve the loan."
    assert _extract_text(raw) == "Final assessment: approve the loan."


def test_extracts_text_blocks_from_list_content():
    content = [
        {"type": "reasoning_content", "reasoningText": {"text": "internal reasoning"}},
        {"type": "text", "text": "Final assessment: approve the loan."},
    ]
    assert _extract_text(content) == "Final assessment: approve the loan."


def test_joins_multiple_text_blocks():
    content = [{"type": "text", "text": "Part one. "}, {"type": "text", "text": "Part two."}]
    assert _extract_text(content) == "Part one. Part two."
