import json

import httpx

from song_worker.repo import Job, SupabaseRepo


def make_repo(handler):
    return SupabaseRepo(
        "https://x.supabase.co", "service-key", transport=httpx.MockTransport(handler)
    )


def test_claim_uses_rpc_in_song_teaching_schema():
    seen = {}

    def handler(req: httpx.Request):
        seen["path"] = req.url.path
        seen["profile"] = req.headers["Content-Profile"]
        seen["auth"] = req.headers["Authorization"]
        row = {"id": "j1", "youtube_id": "M7lc1UVf-VE", "source_lang": "ko", "duration_sec": "200"}
        return httpx.Response(200, json=[row])

    job = make_repo(handler).claim()
    assert job == Job(id="j1", youtube_id="M7lc1UVf-VE", source_lang="ko", duration_sec=200.0)
    assert seen == {
        "path": "/rest/v1/rpc/claim_job",
        "profile": "song_teaching",
        "auth": "Bearer service-key",
    }


def test_claim_empty_queue():
    assert make_repo(lambda req: httpx.Response(200, json=[])).claim() is None


def test_save_timeline_upserts():
    seen = {}

    def handler(req: httpx.Request):
        seen["url"] = str(req.url)
        seen["prefer"] = req.headers["Prefer"]
        seen["body"] = json.loads(req.content)
        return httpx.Response(201)

    job = Job(id="j1", youtube_id="M7lc1UVf-VE", source_lang="ja")
    make_repo(handler).save_timeline(job, {"schemaVersion": "1.0", "song": {}, "segments": []})
    assert "on_conflict=youtube_id%2Csource_lang" in seen["url"]
    assert "merge-duplicates" in seen["prefer"]
    assert seen["body"]["job_id"] == "j1" and seen["body"]["schema_version"] == "1.0"


def test_fail_patches_status():
    seen = {}

    def handler(req: httpx.Request):
        seen["method"] = req.method
        seen["query"] = (
            str(req.url.query, "ascii") if isinstance(req.url.query, bytes) else req.url.query
        )
        seen["body"] = json.loads(req.content)
        return httpx.Response(204)

    make_repo(handler).fail("j1", "too_long")
    assert seen["method"] == "PATCH"
    assert "id=eq.j1" in seen["query"]
    assert seen["body"]["status"] == "failed" and seen["body"]["error"] == "too_long"
