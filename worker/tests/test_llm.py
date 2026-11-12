import json

import httpx
import pytest

from song_worker.llm import LLMError, OpenAICompatible, extract_json


@pytest.mark.parametrize(
    "text",
    [
        '{"a": 1}',
        '<think>let me think {"no": 0}</think>\n{"a": 1}',
        '```json\n{"a": 1}\n```',
        'Here you go:\n{"a": 1}\nHope it helps.',
    ],
)
def test_extract_json(text):
    assert extract_json(text) == {"a": 1}


def test_extract_json_array():
    assert extract_json("result: [1, 2]") == [1, 2]


def test_extract_json_failure():
    with pytest.raises(LLMError):
        extract_json("no json here")


def make(replies, seen):
    it = iter(replies)

    def handler(req: httpx.Request):
        seen.append(req)
        return httpx.Response(200, json={"choices": [{"message": {"content": next(it)}}]})

    return OpenAICompatible(
        "k", "https://api.minimax.io/v1", "MiniMax-M3", transport=httpx.MockTransport(handler)
    )


def test_request_shape():
    seen = []
    assert make(['{"ok": true}'], seen).complete_json("sys", "user") == {"ok": True}
    req = seen[0]
    body = json.loads(req.content)
    assert str(req.url) == "https://api.minimax.io/v1/chat/completions"
    assert req.headers["Authorization"] == "Bearer k"
    assert body["model"] == "MiniMax-M3" and body["reasoning_split"] is True
    assert [m["role"] for m in body["messages"]] == ["system", "user"]


def test_retries_once_on_bad_json():
    seen = []
    assert make(["oops", '{"ok": 1}'], seen).complete_json("s", "u") == {"ok": 1}
    assert len(seen) == 2


def test_http_error_raises():
    llm = OpenAICompatible(
        "k", transport=httpx.MockTransport(lambda r: httpx.Response(401, text="bad key"))
    )
    with pytest.raises(LLMError, match="401"):
        llm.complete_json("s", "u")
