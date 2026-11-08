"""Duplicate detection.

Policy (deliberately conservative):

* Two exhibitor records are the *same* company only when their normalised
  exhibitor-profile URL is identical (the organiser's own identifier). This is
  the only automatic merge.
* Records that share an official website domain, or have identical normalised
  names, are **flagged** as possible duplicates but never merged: different
  legal entities (subsidiaries, distributors, regional branches) often share a
  name stem or a parent website.
"""
from __future__ import annotations

import re
import unicodedata
from collections import defaultdict

from utils.url_utils import website_key

_LEGAL_SUFFIXES = re.compile(
    r"\b(ltd|limited|llc|inc|gmbh|ag|sa|srl|spa|bv|nv|plc|pvt|private|co|corp|corporation|company|"
    r"ooo|ооо|ао|зао|пао|jsc|cjsc|pjsc|kg|oy|ab|as|sl|sarl|kft|sp z o o)\b\.?",
    re.I,
)


def name_key(name: str) -> str:
    """Loose comparison key for a company name. Used for *flagging only*."""
    s = unicodedata.normalize("NFKC", name or "").lower()
    s = re.sub(r"[\"'«»“”„()\[\],.&/+-]", " ", s)
    s = _LEGAL_SUFFIXES.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def find_possible_duplicates(companies: list[dict]) -> dict[str, list[str]]:
    """Return ``{company_id: [reason, ...]}`` for records that may be duplicates.

    ``companies`` items need ``company_id``, ``company_name`` and
    ``official_website`` keys.
    """
    by_name: dict[str, list[str]] = defaultdict(list)
    by_site: dict[str, list[str]] = defaultdict(list)
    for c in companies:
        nk = name_key(c.get("company_name") or "")
        if nk:
            by_name[nk].append(c["company_id"])
        site = c.get("official_website") or ""
        if site:
            by_site[website_key(site)].append(c["company_id"])

    flags: dict[str, list[str]] = defaultdict(list)
    for key, ids in by_name.items():
        if len(ids) > 1:
            for cid in ids:
                others = [o for o in ids if o != cid]
                flags[cid].append(f"same normalised name as {', '.join(others)}")
    for key, ids in by_site.items():
        if len(ids) > 1:
            for cid in ids:
                others = [o for o in ids if o != cid]
                flags[cid].append(f"same website domain ({key}) as {', '.join(others)}")
    return dict(flags)
