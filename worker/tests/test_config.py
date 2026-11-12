from song_worker.config import load_dotenv


def test_load_dotenv(tmp_path, monkeypatch):
    for k in ("A", "B", "C", "D", "E"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("E", "from-env")
    f = tmp_path / ".env"
    f.write_text(
        "# comment\n"
        "A=plain\n"
        "B=https://api.minimax.io/v1      # inline comment\n"
        'C="quoted # not a comment"\n'
        "D=\n"
        "E=from-file\n",
        encoding="utf-8",
    )
    load_dotenv(f)
    import os

    assert os.environ["A"] == "plain"
    assert os.environ["B"] == "https://api.minimax.io/v1"
    assert os.environ["C"] == "quoted # not a comment"
    assert os.environ["D"] == ""
    assert os.environ["E"] == "from-env"  # real env wins
