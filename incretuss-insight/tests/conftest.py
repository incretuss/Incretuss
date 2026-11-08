import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config import Settings  # noqa: E402
from crawler.fetcher import Response  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


class FakeFetcher:
    """Offline stand-in for crawler.fetcher.Fetcher: maps (method, url) -> body."""

    def __init__(self, routes: dict):
        self.routes = routes
        self.calls = []
        self.request_count = 0

    def _resp(self, method, url, data=None):
        self.calls.append((method, url, data))
        self.request_count += 1
        key = (method, url)
        body = self.routes.get(key)
        if body is None:
            for (m, prefix), b in self.routes.items():
                if m == method and prefix.endswith("*") and url.startswith(prefix[:-1]):
                    body = b(url, data) if callable(b) else b
                    break
        if body is None:
            return Response(url=url, status=404, headers={"content-type": "text/html"}, content=b"not found",
                            requested_url=url)
        if callable(body):
            body = body(url, data)
        content = body.encode() if isinstance(body, str) else body
        ctype = "application/pdf" if content.startswith(b"%PDF") else "text/html; charset=utf-8"
        return Response(url=url, status=200, headers={"content-type": ctype}, content=content, requested_url=url)

    def get(self, url, **kw):
        return self._resp("GET", url)

    def post(self, url, data=None, **kw):
        return self._resp("POST", url, data)

    def robots_allowed(self, url):
        return True

    def close(self):
        pass


@pytest.fixture
def settings(tmp_path):
    s = Settings()
    s.db_path = tmp_path / "test.db"
    s.export_dir = tmp_path / "exports"
    s.raw_dir = tmp_path / "data" / "raw"
    s.processed_dir = tmp_path / "data" / "processed"
    s.log_dir = tmp_path / "logs"
    s.request_delay = 0
    s.use_browser_fallback = False
    s.ensure_dirs()
    return s
