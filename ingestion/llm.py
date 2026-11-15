"""The only file that talks to the LLM: one JSON-in-schema call plus token-to-dollar cost.
Exists so the provider, model name and prices live in one place and nothing else imports the SDK."""
import json
import os

import anthropic


def call_json(system: str, user: str, schema: dict) -> tuple:
    """Return (parsed_json, {"tokens_in": n, "tokens_out": n}). Raises if refused or cut off."""
    client = anthropic.Anthropic(api_key=os.environ["LLM_API_KEY"])
    resp = client.messages.create(
        model=os.environ["LLM_MODEL"],
        max_tokens=16000,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"format": {"type": "json_schema", "schema": schema}},
    )
    if resp.stop_reason in ("refusal", "max_tokens"):
        raise RuntimeError(f"llm stopped: {resp.stop_reason}")
    text = next(b.text for b in resp.content if b.type == "text")
    return json.loads(text), {"tokens_in": resp.usage.input_tokens, "tokens_out": resp.usage.output_tokens}


def cost_usd(tokens_in: int, tokens_out: int):
    """Dollars from per-million prices in env; None when prices are unset (report says 'not computed')."""
    try:
        p_in, p_out = float(os.environ["LLM_PRICE_IN_PER_MTOK"]), float(os.environ["LLM_PRICE_OUT_PER_MTOK"])
    except (KeyError, ValueError):
        return None
    return (tokens_in * p_in + tokens_out * p_out) / 1_000_000
