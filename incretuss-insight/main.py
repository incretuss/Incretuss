#!/usr/bin/env python3
"""Incretuss Insight - Universal Exhibition Exhibitor Crawler (v1.0).

Examples
--------
Discover the directory from the exhibition homepage and crawl everything::

    python main.py --url "https://expopharmtech.com/"

Skip discovery and give the directory yourself::

    python main.py --directory-url "https://exhibitors-itegroup.exhibitoronlinemanual.com/pharmtech-and-ingredients-2026/en/Exhibitor"

Resume the most recent crawl after an interruption::

    python main.py --resume

Re-export the workbook without crawling::

    python main.py --export-only
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from adapters import ADAPTERS, adapter_by_name, select_adapter  # noqa: E402
from config import APP_NAME, APP_VERSION, settings  # noqa: E402
from crawler.browser import BrowserFetcher  # noqa: E402
from crawler.discovery import DiscoveryEngine  # noqa: E402
from crawler.fetcher import FetchError, Fetcher  # noqa: E402
from crawler.spider import CrawlEngine  # noqa: E402
from database.connection import connect  # noqa: E402
from database.repository import Repository  # noqa: E402
from exporters.excel_exporter import ExcelExporter  # noqa: E402
from utils.logging import setup_logging  # noqa: E402
from utils.url_utils import UnsafeURLError, assert_public_url, clean_website  # noqa: E402


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        prog="main.py", description=f"{APP_NAME} {APP_VERSION} - exhibition exhibitor crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__.split("Examples", 1)[1])
    src = p.add_argument_group("what to crawl")
    src.add_argument("--url", help="exhibition website URL (the directory is discovered automatically)")
    src.add_argument("--directory-url", help="exhibitor directory URL (skips discovery)")
    src.add_argument("--adapter", choices=[a.name for a in ADAPTERS], help="force an adapter")
    src.add_argument("--event-name", help="name stored for the event (default: page title)")
    src.add_argument("--resume", action="store_true", help="continue the most recently updated event")
    src.add_argument("--event-id", type=int, help="continue / export a specific stored event")
    src.add_argument("--list-events", action="store_true", help="list events stored in the database and exit")

    run = p.add_argument_group("run control")
    run.add_argument("--discover-only", action="store_true", help="show the proposed strategy and stop")
    run.add_argument("--limit", type=int, help="process at most N exhibitor profiles in this run")
    run.add_argument("--max-exhibitors", type=int, help="stop the directory listing after N exhibitors (testing)")
    run.add_argument("--refresh", action="store_true", help="re-extract every profile, not just pending/failed ones")
    run.add_argument("--refresh-listing", action="store_true", help="re-scan the directory listing")
    run.add_argument("--no-retry-failed", action="store_true", help="do not retry failed/partial profiles")
    run.add_argument("--no-pdf", action="store_true", help="do not download/extract brochure PDFs")
    run.add_argument("--no-browser", action="store_true", help="never use Playwright")
    run.add_argument("--delay", type=float, help=f"seconds between requests to one host (default {settings.request_delay})")
    run.add_argument("-y", "--yes", action="store_true", help="do not ask for confirmation (non-interactive)")
    run.add_argument("-v", "--verbose", action="store_true")

    out = p.add_argument_group("output")
    out.add_argument("--export-only", action="store_true", help="only (re)generate the Excel workbook")
    out.add_argument("--reclassify", action="store_true",
                     help="recompute normalised categories from stored data (no crawling), then export")
    out.add_argument("--no-export", action="store_true", help="do not write the Excel workbook")
    out.add_argument("--output", type=Path, help="workbook path (default data/exports/<event>/Event_Exhibitor_Database.xlsx)")
    out.add_argument("--db", type=Path, help=f"SQLite database path (default {settings.db_path})")
    return p.parse_args(argv)


def slugify(text: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", text or "").strip("-").lower()
    return s[:60] or "event"


def default_export_path(event) -> Path:
    name = event["name"] or event["directory_url"]
    return settings.export_dir / slugify(name) / settings.export_filename


def ask(prompt: str, interactive: bool) -> str:
    if not interactive:
        return ""
    try:
        return input(prompt).strip()
    except EOFError:
        return ""


def print_discovery(result) -> None:
    print("\nDirectory candidates (best first):")
    shown = sorted([c for c in result.candidates if c.evaluated], key=lambda c: -c.score)[:8]
    for c in shown:
        status = c.error or (f"adapter={c.adapter} ({c.adapter_score:.1f}), profile links={c.profile_links}"
                             + (f", reports {c.reported_total}" if c.reported_total else "")
                             + (", JS pagination" if c.js_pagination else ""))
        print(f"  [{c.score:6.1f}] {c.final_url or c.url}\n           via {c.source}: {status}")
    for n in result.notes:
        print(f"  note: {n}")


def main(argv=None) -> int:
    args = parse_args(argv)
    if args.delay is not None:
        settings.request_delay = max(0.2, args.delay)
    if args.db:
        settings.db_path = args.db
    if args.no_pdf:
        settings.extract_pdfs = False
    if args.no_browser:
        settings.use_browser_fallback = False
    settings.ensure_dirs()
    log = setup_logging(settings.log_dir, args.verbose)
    interactive = sys.stdin.isatty() and not args.yes

    conn = connect(settings.db_path)
    repo = Repository(conn)

    if args.list_events:
        for e in repo.list_events():
            st = repo.stats(e["event_id"])
            print(f"#{e['event_id']}  {e['name'] or '-'}\n     {e['directory_url']}\n     adapter={e['adapter']} "
                  f"listing_complete={bool(e['listing_complete'])} discovered={st['discovered']} "
                  f"processed={st['processed']} products={st['products']} updated={e['updated_at']}")
        return 0

    # ------------------------------------------------------------- export only
    if args.export_only or args.reclassify:
        events = repo.list_events()
        if not events:
            print("No events in the database yet.")
            return 1
        event = repo.get_event(args.event_id) if args.event_id else max(events, key=lambda e: e["updated_at"])
        if args.reclassify:
            adapter_cls = adapter_by_name(event["adapter"] or "generic")
            engine = CrawlEngine(settings, repo, None, adapter_cls(None, settings), event["event_id"])
            print(f"Reclassified {engine.reclassify()} companies from stored data.")
        path = ExcelExporter(repo).export(event["event_id"], args.output or default_export_path(event))
        print(f"Workbook written: {path}")
        return 0

    fetcher = Fetcher(settings)
    browser = BrowserFetcher(settings, robots_check=fetcher.robots_allowed, throttle=fetcher._throttle) if settings.use_browser_fallback else None
    try:
        # ------------------------------------------------------ choose event
        start_url = args.url
        directory_url = args.directory_url
        adapter_name = args.adapter
        event_name = args.event_name

        if args.resume or args.event_id:
            events = repo.list_events()
            if not events:
                print("Nothing to resume: the database has no events.")
                return 1
            event = repo.get_event(args.event_id) if args.event_id else max(events, key=lambda e: e["updated_at"])
            if event is None:
                print(f"No event with id {args.event_id}.")
                return 1
            directory_url, adapter_name = event["directory_url"], adapter_name or event["adapter"]
            start_url, event_name = event["start_url"], event["name"]
            print(f"Resuming event #{event['event_id']}: {event_name or directory_url}")
        elif not directory_url:
            if not start_url:
                start_url = ask("Exhibition website URL: ", interactive)
                if not start_url:
                    print("Give --url or --directory-url (see --help).")
                    return 2
            start_url = clean_website(start_url)
            try:
                assert_public_url(start_url)
            except UnsafeURLError as exc:
                print(f"Refusing to crawl {start_url}: {exc}")
                return 2
            result = DiscoveryEngine(fetcher, settings).discover(start_url)
            print_discovery(result)
            best = result.best
            if best:
                directory_url = best.final_url or best.url
                event_name = event_name or best.title
                print(f"\nProposed exhibitor directory: {directory_url}")
                answer = ask("Press Enter to accept, or paste a different directory URL: ", interactive)
                if answer:
                    directory_url = clean_website(answer)
            else:
                print("\nAutomatic discovery did not find an exhibitor directory.")
                directory_url = ask("Paste the exhibitor directory URL (or Enter to quit): ", interactive)
                if not directory_url:
                    print("Re-run with --directory-url \"<url>\" once you have located the directory.")
                    return 3
                directory_url = clean_website(directory_url)

        try:
            assert_public_url(directory_url)
        except UnsafeURLError as exc:
            print(f"Refusing to crawl {directory_url}: {exc}")
            return 2

        # ------------------------------------------------------ choose adapter
        if adapter_name:
            adapter_cls = adapter_by_name(adapter_name)
            reason = "forced" if args.adapter else "stored for event"
        else:
            try:
                resp = fetcher.get(directory_url)
                html, directory_url = resp.text, resp.url
                event_name = event_name or (re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I) or [None, None])[1]
            except FetchError as exc:
                print(f"Could not load the directory page: {exc}")
                return 4
            adapter_cls, score = select_adapter(directory_url, html)
            reason = f"detected, confidence {score:.1f}"
        if event_name:
            event_name = re.sub(r"\s+", " ", event_name).strip()
        adapter = adapter_cls(fetcher, settings, browser)
        if hasattr(adapter, "exclude_domains"):
            adapter.exclude_domains(start_url, directory_url)

        print("\nCrawling strategy")
        print("-----------------")
        for line in adapter.describe_strategy(directory_url):
            print(f"  {line}")
        print(f"  Adapter selection: {reason}")
        delay = settings.request_delay
        robots = fetcher._robots.get(fetcher._origin(directory_url))
        cd = robots.crawl_delay(settings.user_agent) if robots else None
        delay_txt = f"{delay:.1f}s" + (f" (robots.txt Crawl-delay {cd:g}s applies)" if cd and cd > delay else "")
        print(f"  Politeness: {delay_txt} between requests per host, sequential, robots.txt respected")
        print(f"  PDFs: {'yes' if settings.extract_pdfs else 'no'} | Browser fallback: "
              f"{'yes' if browser else 'no'} | Database: {settings.db_path}")
        if args.discover_only:
            return 0
        if interactive and ask("\nStart crawling? [Y/n] ", interactive).lower().startswith("n"):
            return 0

        event = repo.get_or_create_event(directory_url, event_name, start_url, adapter_cls.name)
        event_id = event["event_id"]
        engine = CrawlEngine(settings, repo, fetcher, adapter, event_id)
        interrupted = False
        try:
            try:
                engine.run_listing(directory_url, refresh=args.refresh_listing, max_exhibitors=args.max_exhibitors)
            except FetchError:
                log.warning("Continuing with the exhibitors discovered so far.")
            engine.run_profiles(limit=args.limit, retry_failed=not args.no_retry_failed, refresh=args.refresh)
            engine.run_pending_documents()
        except KeyboardInterrupt:
            interrupted = True
            print("\nInterrupted. All completed work is saved; run `python main.py --resume` to continue.")

        st = engine.summary()
        print("\nSummary")
        print("-------")
        print(f"  Exhibitors discovered : {st['discovered']}")
        print(f"  Exhibitors processed  : {st['processed']}  (pending {st['pending']})")
        print(f"  Successful extractions: {st['success']}  partial: {st['partial']}")
        print(f"  Failed extractions    : {st['failed']}")
        print(f"  Products extracted    : {st['products']}  (+ {st['brands']} brands)")
        print(f"  Websites discovered   : {st['websites']}")
        print(f"  Documents             : {st['documents'] or 'none'}")
        print(f"  HTTP requests (run)   : {st['requests']}  elapsed {st['elapsed_s']}s")

        if not args.no_export:
            event = repo.get_event(event_id)
            path = ExcelExporter(repo).export(event_id, args.output or default_export_path(event))
            print(f"\nWorkbook written: {path}")
        return 130 if interrupted else 0
    finally:
        fetcher.close()
        if browser:
            browser.close()
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
