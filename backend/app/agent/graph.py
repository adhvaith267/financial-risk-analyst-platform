import json
import re
from functools import lru_cache

from langchain_aws import ChatBedrockConverse
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent

from app.agent.tools import build_tools
from app.core.config import get_settings

# Human-readable label templates for each tool, filled in from that call's
# arguments. Falls back to the raw tool name for anything not listed here.
TOOL_TRACE_LABELS = {
    "get_borrower": "Retrieved borrower {borrower_id}",
    "get_portfolio": "Retrieved portfolio {portfolio_id}",
    "assess_credit_risk": "Calculated credit risk for {borrower_id}",
    "assess_market_risk": "Calculated market risk for {portfolio_id}",
    "run_stress_scenario": "Ran stress scenario on {portfolio_id}",
}

SYSTEM_PROMPT = """You are a Risk Analyst Agent for a financial organization.

You decide which tools to call to answer the analyst's question — you never
calculate PD, LGD, EAD, Expected Loss, volatility, VaR, Expected Shortfall,
or stress-test losses yourself. Every number in your answer must come from a
tool call. If a tool returns an error (e.g. borrower or portfolio not found),
say so plainly instead of guessing a number.

Available tools:
- get_borrower: look up a borrower's credit profile and active loan
- get_portfolio: look up a portfolio's current holdings
- assess_credit_risk: run the Credit Risk Engine (PD via SageMaker + LGD/EAD/EL)
- assess_market_risk: run the Market Risk Engine (volatility, VaR, ES, drawdown)
- run_stress_scenario: run the Stress Testing Engine (equity/rate/default shocks)

For a borrower question, call get_borrower and/or assess_credit_risk.
For a portfolio's current risk, call get_portfolio and/or assess_market_risk.
For a "what if" / scenario / stress question, call run_stress_scenario (and
assess_market_risk / assess_credit_risk first if useful context).
For multi-domain questions (e.g. "assess the borrower AND show the stress
impact"), call the relevant tools in sequence before answering.

After gathering tool results, write a concise assessment for a risk analyst:
lead with the key numbers, then 2-4 sentences explaining what's driving the
result (cite the SHAP risk_drivers for credit, or the concentration/volatility
numbers for market/stress) and give a brief recommendation.

Do not fabricate any numbers. If a value was not returned by a tool, say it
is unavailable rather than estimating it."""


@lru_cache
def build_agent() -> CompiledStateGraph:
    settings = get_settings()
    model = ChatBedrockConverse(model=settings.bedrock_model_id, region_name=settings.aws_region)
    tools = build_tools()
    return create_react_agent(model, tools, prompt=SYSTEM_PROMPT)


def _extract_text(content: str | list) -> str:
    """Bedrock Converse content can come back as a plain string or as a list
    of content blocks (text / reasoning_content / etc, depending on the
    model) - normalize to plain text, keeping only the text blocks."""
    if isinstance(content, str):
        text = content
    else:
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        text = "".join(parts)

    # Some reasoning models (e.g. Kimi K2 Thinking) inline their chain-of-thought
    # as literal <think>...</think> text rather than a separate content block,
    # and occasionally leave an unmatched leading <think> with no closing tag.
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"^\s*<think>", "", text)
    return text.strip()


def _build_trace(messages: list) -> list[dict]:
    """Reconstructs the agent's tool-call sequence from the actual LangGraph
    message history — not a canned/simulated trace. AIMessage.tool_calls give
    call order + arguments; the matching ToolMessage (by tool_call_id) gives
    whether that call succeeded (ToolMessage.status, set by LangGraph's
    ToolNode based on whether the tool raised)."""
    tool_calls: dict[str, dict] = {}
    call_order: list[str] = []
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for call in msg.tool_calls:
                tool_calls[call["id"]] = {"name": call["name"], "args": call.get("args", {})}
                call_order.append(call["id"])

    tool_results: dict[str, ToolMessage] = {
        msg.tool_call_id: msg for msg in messages if isinstance(msg, ToolMessage)
    }

    trace = []
    for call_id in call_order:
        call = tool_calls[call_id]
        name = call["name"]
        template = TOOL_TRACE_LABELS.get(name, name)
        try:
            label = template.format(**call["args"])
        except (KeyError, IndexError):
            label = name

        result_msg = tool_results.get(call_id)
        status = "error" if result_msg is not None and result_msg.status == "error" else "ok"
        # Tools in this codebase signal a handled failure (e.g. "borrower not
        # found") as a normal string return containing {"error": ...}, not a
        # raised exception - ToolMessage.status alone won't catch that case.
        if result_msg is not None and status == "ok" and isinstance(result_msg.content, str):
            try:
                parsed = json.loads(result_msg.content)
                if isinstance(parsed, dict) and "error" in parsed:
                    status = "error"
            except (json.JSONDecodeError, TypeError):
                pass

        trace.append({"tool": name, "label": label, "status": status})

    return trace


def ask(question: str) -> tuple[str, list[dict]]:
    agent = build_agent()
    result = agent.invoke({"messages": [("user", question)]})
    answer = _extract_text(result["messages"][-1].content)
    trace = _build_trace(result["messages"])
    return answer, trace
