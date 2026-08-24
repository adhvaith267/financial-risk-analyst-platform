import json

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from app.agent.graph import _build_trace, _extract_text


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


def test_build_trace_orders_calls_and_fills_labels_from_args():
    messages = [
        HumanMessage(content="Assess borrower B102"),
        AIMessage(
            content="",
            tool_calls=[{"name": "get_borrower", "args": {"borrower_id": "B102"}, "id": "call_1"}],
        ),
        ToolMessage(
            content=json.dumps({"borrower_id": "B102"}), tool_call_id="call_1", status="success"
        ),
        AIMessage(
            content="",
            tool_calls=[
                {"name": "assess_credit_risk", "args": {"borrower_id": "B102"}, "id": "call_2"}
            ],
        ),
        ToolMessage(content=json.dumps({"pd": 0.08}), tool_call_id="call_2", status="success"),
        AIMessage(content="Borrower B102 has elevated risk."),
    ]

    trace = _build_trace(messages)

    assert trace == [
        {"tool": "get_borrower", "label": "Retrieved borrower B102", "status": "ok"},
        {"tool": "assess_credit_risk", "label": "Calculated credit risk for B102", "status": "ok"},
    ]


def test_build_trace_flags_a_raised_tool_error():
    messages = [
        AIMessage(
            content="",
            tool_calls=[{"name": "get_borrower", "args": {"borrower_id": "B999"}, "id": "call_1"}],
        ),
        ToolMessage(content="boom", tool_call_id="call_1", status="error"),
    ]

    trace = _build_trace(messages)

    assert trace == [
        {"tool": "get_borrower", "label": "Retrieved borrower B999", "status": "error"}
    ]


def test_build_trace_flags_a_handled_json_error_even_with_ok_status():
    # Tools in this codebase catch "not found" cases and return a normal
    # {"error": ...} JSON string rather than raising - ToolMessage.status
    # stays "success" for those, so _build_trace must also inspect content.
    messages = [
        AIMessage(
            content="",
            tool_calls=[{"name": "get_borrower", "args": {"borrower_id": "B999"}, "id": "call_1"}],
        ),
        ToolMessage(
            content=json.dumps({"error": "Borrower B999 not found"}),
            tool_call_id="call_1",
            status="success",
        ),
    ]

    trace = _build_trace(messages)

    assert trace == [
        {"tool": "get_borrower", "label": "Retrieved borrower B999", "status": "error"}
    ]


def test_build_trace_falls_back_to_tool_name_for_unknown_tool_or_missing_args():
    messages = [
        AIMessage(content="", tool_calls=[{"name": "some_new_tool", "args": {}, "id": "call_1"}]),
        ToolMessage(content="{}", tool_call_id="call_1", status="success"),
    ]

    trace = _build_trace(messages)

    assert trace == [{"tool": "some_new_tool", "label": "some_new_tool", "status": "ok"}]


def test_build_trace_empty_when_no_tool_calls():
    messages = [HumanMessage(content="How is ES calculated?"), AIMessage(content="ES is...")]

    assert _build_trace(messages) == []
