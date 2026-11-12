"""OpenAI-compatible chat client. Defaults to MiniMax; any compatible provider works via env:

LLM_BASE_URL  (default https://api.minimax.io/v1; mainland-China accounts: https://api.minimaxi.com/v1)
LLM_API_KEY   (or MINIMAX_API_KEY)
LLM_MODEL     (default MiniMax-M3)
"""

import json
import logging
import re
from typing import Any, Protocol

import httpx

log = logging.getLogger("song_worker")

DEFAULT_BASE_URL = "https://api.minimax.io/v1"
DEFAULT_MODEL = "MiniMax-M3"


class LLMError(Exception):
    pass


class ChatModel(Protocol):
    def complete_json(self, system: str, user: str) -> Any: ...


_THINK = re.compile(r"<think>.*?</think>", re.S)
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.S)


def extract_json(text: str) -> Any:
    """Parse the JSON object/array in a model reply, tolerating <think> blocks, code fences
    and prose around it."""
    t = _THINK.sub("", text).strip()
    t = _FENCE.sub("", t).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    starts = [i for i in (t.find("{"), t.find("[")) if i != -1]
    if not starts:
        raise LLMError(f"no JSON in reply: {t[:200]!r}")
    start = min(starts)
    end = max(t.rfind("}"), t.rfind("]"))
    try:
        return json.loads(t[start : end + 1])
    except json.JSONDecodeError as e:
        raise LLMError(f"invalid JSON in reply: {e}") from e


class OpenAICompatible:
    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        model: str = DEFAULT_MODEL,
        timeout: float = 180,
        transport: httpx.BaseTransport | None = None,
    ):
        self.model = model
        self.http = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
            transport=transport,
        )

    def chat(self, system: str, user: str) -> str:
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            # MiniMax: keep reasoning out of `content` (ignored by other providers).
            "reasoning_split": True,
        }
        r = self.http.post("/chat/completions", json=body)
        if r.status_code >= 400:
            raise LLMError(f"HTTP {r.status_code}: {r.text[:300]}")
        data = r.json()
        try:
            return data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as e:
            raise LLMError(f"unexpected response: {str(data)[:300]}") from e

    def complete_json(self, system: str, user: str) -> Any:
        """One retry on unparsable output."""
        last: Exception | None = None
        for attempt in range(2):
            text = self.chat(system, user)
            try:
                return extract_json(text)
            except LLMError as e:
                last = e
                log.warning("LLM returned unparsable JSON (attempt %d): %s", attempt + 1, e)
        raise LLMError(str(last))
