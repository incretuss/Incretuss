"""Polite, SSRF-safe HTTP client built on HTTPX.

* One shared ``httpx.Client`` (keeps cookies, connection pooling).
* Per-host throttling with jitter; honours ``Crawl-delay`` from robots.txt.
* robots.txt checked before every request (RFC 9309 semantics: 4xx means
  "no restrictions", 5xx / unreachable means "do not crawl").
* Redirects are followed manually and every hop is validated with
  :func:`utils.url_utils.assert_public_url`.
* Retries with exponential back-off on network errors, 429 and 5xx.
* Response bodies are streamed and capped in size.
"""
from __future__ import annotations

import random
import threading
import time
import urllib.robotparser
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

import httpx

from config import Settings
from utils.logging import get_logger
from utils.url_utils import UnsafeURLError, assert_public_url

log = get_logger("fetcher")

RETRY_STATUSES = {429, 500, 502, 503, 504, 520, 521, 522, 524}


class FetchError(Exception):
    def __init__(self, message: str, url: str, status: int | None = None):
        super().__init__(message)
        self.url = url
        self.status = status


class RobotsDisallowed(FetchError):
    pass


@dataclass
class Response:
    url: str               # final URL after redirects
    status: int
    headers: dict
    content: bytes
    requested_url: str
    redirects: list[str] = field(default_factory=list)

    @property
    def content_type(self) -> str:
        return (self.headers.get("content-type") or "").split(";")[0].strip().lower()

    @property
    def text(self) -> str:
        ctype = self.headers.get("content-type") or ""
        enc = None
        if "charset=" in ctype:
            enc = ctype.split("charset=")[-1].split(";")[0].strip()
        for candidate in (enc, "utf-8", "cp1251", "latin-1"):
            if not candidate:
                continue
            try:
                return self.content.decode(candidate)
            except (LookupError, UnicodeDecodeError):
                continue
        return self.content.decode("utf-8", errors="replace")

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300


class _Robots:
    def __init__(self, parser: urllib.robotparser.RobotFileParser | None, allow_all: bool, deny_all: bool):
        self.parser = parser
        self.allow_all = allow_all
        self.deny_all = deny_all

    def crawl_delay(self, agent: str) -> float | None:
        if self.parser is None:
            return None
        try:
            d = self.parser.crawl_delay(agent) or self.parser.crawl_delay("*")
            return float(d) if d else None
        except Exception:  # noqa: BLE001
            return None


class Fetcher:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = httpx.Client(
            headers={
                "User-Agent": settings.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7",
                "Accept-Language": "en;q=0.9,*;q=0.5",
            },
            timeout=settings.timeout,
            follow_redirects=False,
            http2=False,
        )
        self._last_request: dict[str, float] = {}
        self._robots: dict[str, _Robots] = {}
        self._lock = threading.Lock()
        self.request_count = 0

    # ------------------------------------------------------------------ utils
    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    @staticmethod
    def _origin(url: str) -> str:
        p = urlsplit(url)
        return f"{p.scheme}://{p.netloc}"

    def _throttle(self, url: str) -> None:
        host = urlsplit(url).netloc.lower()
        delay = self.settings.request_delay
        robots = self._robots.get(self._origin(url))
        if robots:
            cd = robots.crawl_delay(self.settings.user_agent)
            if cd:
                delay = max(delay, min(cd, 30.0))
        with self._lock:
            last = self._last_request.get(host)
            now = time.monotonic()
            if last is not None:
                wait = delay + random.uniform(0, self.settings.delay_jitter) - (now - last)
                if wait > 0:
                    time.sleep(wait)
            self._last_request[host] = time.monotonic()

    # ----------------------------------------------------------------- robots
    def _get_robots(self, url: str) -> _Robots:
        origin = self._origin(url)
        if origin in self._robots:
            return self._robots[origin]
        robots_url = origin + "/robots.txt"
        robots: _Robots
        try:
            resp = self._request("GET", robots_url, check_robots=False, max_bytes=512 * 1024, retries=1)
            if resp.ok and "html" not in resp.content_type:
                parser = urllib.robotparser.RobotFileParser()
                parser.parse(resp.text.splitlines())
                robots = _Robots(parser, allow_all=False, deny_all=False)
            elif resp.ok or 400 <= resp.status < 500:
                # 200 with an HTML error page, or any 4xx: no usable rules.
                robots = _Robots(None, allow_all=True, deny_all=False)
            else:
                log.warning("robots.txt at %s returned %s; treating site as disallowed", robots_url, resp.status)
                robots = _Robots(None, allow_all=False, deny_all=True)
        except FetchError as exc:
            log.warning("robots.txt at %s unreachable (%s); treating site as disallowed", robots_url, exc)
            robots = _Robots(None, allow_all=False, deny_all=True)
        self._robots[origin] = robots
        return robots

    def robots_allowed(self, url: str) -> bool:
        if not self.settings.respect_robots_txt:
            return True
        r = self._get_robots(url)
        if r.allow_all:
            return True
        if r.deny_all:
            return False
        return r.parser.can_fetch(self.settings.user_agent, url)

    # ---------------------------------------------------------------- request
    def get(self, url: str, **kw) -> Response:
        return self._request("GET", url, **kw)

    def post(self, url: str, data: dict | str | None = None, **kw) -> Response:
        return self._request("POST", url, data=data, **kw)

    def _request(
        self,
        method: str,
        url: str,
        data: dict | str | None = None,
        headers: dict | None = None,
        check_robots: bool = True,
        max_bytes: int | None = None,
        retries: int | None = None,
    ) -> Response:
        max_bytes = max_bytes or self.settings.max_html_bytes
        retries = self.settings.max_retries if retries is None else retries
        try:
            assert_public_url(url)
        except UnsafeURLError as exc:
            raise FetchError(f"blocked unsafe URL: {exc}", url) from exc
        if check_robots and not self.robots_allowed(url):
            raise RobotsDisallowed("disallowed by robots.txt", url)

        attempt = 0
        while True:
            attempt += 1
            try:
                return self._follow(method, url, data, headers, max_bytes)
            except FetchError as exc:
                retryable = exc.status in RETRY_STATUSES or exc.status is None
                if isinstance(exc, RobotsDisallowed) or "blocked unsafe" in str(exc) or "too large" in str(exc):
                    retryable = False
                if not retryable or attempt > retries:
                    raise
                wait = self.settings.retry_backoff * (2 ** (attempt - 1))
                log.debug("retry %d/%d for %s in %.0fs (%s)", attempt, retries, url, wait, exc)
                time.sleep(wait)

    def _follow(self, method, url, data, headers, max_bytes) -> Response:
        current = url
        redirects: list[str] = []
        for _ in range(self.settings.max_redirects + 1):
            self._throttle(current)
            self.request_count += 1
            try:
                req = self._client.build_request(method, current, data=data, headers=headers)
                resp = self._client.send(req, stream=True)
            except httpx.HTTPError as exc:
                raise FetchError(f"{type(exc).__name__}: {exc}", current) from exc
            try:
                if resp.status_code in (301, 302, 303, 307, 308) and "location" in resp.headers:
                    nxt = urljoin(current, resp.headers["location"])
                    try:
                        assert_public_url(nxt)
                    except UnsafeURLError as exc:
                        raise FetchError(f"blocked unsafe redirect to {nxt}: {exc}", url) from exc
                    if self.settings.respect_robots_txt and not self.robots_allowed(nxt):
                        raise RobotsDisallowed(f"redirect target disallowed by robots.txt: {nxt}", url)
                    redirects.append(nxt)
                    if resp.status_code == 303 or (resp.status_code in (301, 302) and method == "POST"):
                        method, data = "GET", None
                    current = nxt
                    continue
                declared = int(resp.headers.get("content-length") or 0)
                if declared and declared > max_bytes:
                    raise FetchError(f"response too large ({declared} bytes)", current, resp.status_code)
                chunks, size = [], 0
                for chunk in resp.iter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        raise FetchError(f"response too large (> {max_bytes} bytes)", current, resp.status_code)
                    chunks.append(chunk)
                body = b"".join(chunks)
            except httpx.HTTPError as exc:
                raise FetchError(f"{type(exc).__name__}: {exc}", current) from exc
            finally:
                resp.close()
            result = Response(url=current, status=resp.status_code, headers=dict(resp.headers),
                              content=body, requested_url=url, redirects=redirects)
            if resp.status_code in RETRY_STATUSES:
                raise FetchError(f"HTTP {resp.status_code}", current, resp.status_code)
            return result
        raise FetchError("too many redirects", url)
