import re
from functools import lru_cache

from langchain_aws import ChatBedrockConverse
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent

from app.agent.tools import build_tools
from app.core.config import get_settings

SYSTEM_PROMPT = """You are a Risk Analyst Agent for a financial organization.

You decide which tools to call to answer the analyst's question - you never
calculate PD, LGD, EAD, Expected Loss, volatility, VaR, Expected Shortfall,
or stress-test losses yourself. Every number in your answer must come from a
tool call. If a tool returns an error (e.g. borrower or portfolio not
found), say so plainly instead of guessing a number.

For a borrower question, call get_borrower and/or assess_credit_risk.
For a portfolio's current risk, call get_portfolio and/or assess_market_risk.
For a "what if" / scenario / stress question, call run_stress_scenario (and
assess_market_risk / assess_credit_risk first if useful context).

After gathering tool results, write a concise assessment for a risk analyst:
lead with the key numbers, then 2-4 sentences explaining what's driving the
result (cite the SHAP risk_drivers for credit, or the concentration/volatility
numbers for market/stress) and give a brief recommendation."""


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


def ask(question: str) -> str:
    agent = build_agent()
    result = agent.invoke({"messages": [("user", question)]})
    return _extract_text(result["messages"][-1].content)
