"""Playwright fallback for JavaScript-rendered pages.

Used only when plain HTTP yields no usable content. Every request the browser
makes is checked by :func:`assert_public_url` (SSRF protection) and images,
fonts and media are blocked to keep rendering light. Supports infinite scroll
and "Load more" buttons for listing pages.
"""
from __future__ import annotations

import os
import re
import time

from config import Settings
from utils.logging import get_logger
from utils.url_utils import UnsafeURLError, assert_public_url

log = get_logger("browser")

FALLBACK_EXECUTABLE = "/opt/pw-browsers/chromium"
LOAD_MORE = re.compile(r"load more|show more|more exhibitors|view more|mehr laden|plus de|cargar más|"
                       r"загрузить ещ|показать ещ", re.I)


class BrowserUnavailable(RuntimeError):
    pass


class BrowserFetcher:
    def __init__(self, settings: Settings, robots_check=None, throttle=None):
        self.settings = settings
        self._throttle = throttle
        self._pw = None
        self._browser = None
        self._robots_check = robots_check

    def _start(self):
        if self._browser:
            return
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:  # pragma: no cover
            raise BrowserUnavailable("playwright is not installed") from exc
        self._pw = sync_playwright().start()
        errors = []
        for kwargs in ({}, {"executable_path": os.environ.get("INSIGHT_CHROMIUM", FALLBACK_EXECUTABLE)}):
            try:
                self._browser = self._pw.chromium.launch(headless=True, args=["--no-sandbox"], **kwargs)
                return
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc).splitlines()[0])
        self._pw.stop()
        self._pw = None
        raise BrowserUnavailable("could not launch Chromium: " + " | ".join(errors))

    def close(self):
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()
        self._browser = self._pw = None

    def render(self, url: str, scroll: bool = False, max_scrolls: int = 30, click_load_more: bool = False,
               max_clicks: int = 50, wait_ms: int = 1500) -> tuple[str, str]:
        """Return ``(final_url, html)`` after JavaScript has run."""
        assert_public_url(url)
        if self._robots_check and not self._robots_check(url):
            raise PermissionError(f"disallowed by robots.txt: {url}")
        self._start()
        if self._throttle:
            self._throttle(url)   # same per-host politeness as plain HTTP
        ctx = self._browser.new_context(user_agent=self.settings.user_agent, java_script_enabled=True)
        page = ctx.new_page()

        def guard(route):
            req = route.request
            if req.resource_type in ("image", "media", "font"):
                return route.abort()
            try:
                assert_public_url(req.url)
            except UnsafeURLError:
                log.warning("browser blocked unsafe request: %s", req.url)
                return route.abort()
            return route.continue_()

        page.route("**/*", guard)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=int(self.settings.timeout * 1000))
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:  # noqa: BLE001
                pass
            assert_public_url(page.url)
            if scroll:
                last_h = 0
                for _ in range(max_scrolls):
                    page.mouse.wheel(0, 20000)
                    time.sleep(max(self.settings.request_delay, 1.0))
                    h = page.evaluate("document.body.scrollHeight")
                    if h == last_h:
                        break
                    last_h = h
            if click_load_more:
                for _ in range(max_clicks):
                    btn = page.get_by_role("button", name=LOAD_MORE)
                    if btn.count() == 0:
                        btn = page.get_by_role("link", name=LOAD_MORE)
                    if btn.count() == 0 or not btn.first.is_visible():
                        break
                    btn.first.click()
                    time.sleep(max(self.settings.request_delay, 1.0))
                    page.wait_for_timeout(wait_ms)
            page.wait_for_timeout(300)
            return page.url, page.content()
        finally:
            ctx.close()
