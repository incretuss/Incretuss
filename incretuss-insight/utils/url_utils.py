"""URL normalisation and SSRF protection.

Every URL the crawler requests passes through :func:`assert_public_url`, which
rejects non-HTTP schemes, embedded credentials, unusual ports and any host that
resolves to a private, loopback, link-local, multicast or otherwise reserved IP
address. Redirects are followed manually by the HTTP client so every hop is
validated again.
"""
from __future__ import annotations

import ipaddress
import re
import socket
from functools import lru_cache
from urllib.parse import parse_qsl, unquote, urlencode, urljoin, urlsplit, urlunsplit

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {None, 80, 443, 8080, 8443}
TRACKING_PARAMS = re.compile(r"^(utm_\w+|fbclid|gclid|yclid|mc_cid|mc_eid|_ga|ref|source)$", re.I)


class UnsafeURLError(ValueError):
    """Raised when a URL points to a non-public destination."""


def normalize_url(url: str, base: str | None = None) -> str:
    """Return a canonical form of ``url`` used for de-duplication.

    Lower-cases scheme and host, removes default ports, fragments and tracking
    parameters, sorts the query string and strips a trailing slash (except for
    the root path). Path case is preserved because many servers are
    case-sensitive (and base64 profile IDs certainly are).
    """
    if base:
        url = urljoin(base, url)
    url = url.strip()
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    host = (parts.hostname or "").lower().rstrip(".")
    port = parts.port
    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        port = None
    netloc = host + (f":{port}" if port else "")
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    query = urlencode(sorted((k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
                             if not TRACKING_PARAMS.match(k)))
    return urlunsplit((scheme, netloc, path, query, ""))


def website_key(url: str) -> str:
    """Registrable-ish host used to compare company websites (drops ``www.``)."""
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def same_site(a: str, b: str) -> bool:
    return website_key(a) == website_key(b)


def host_matches(url: str, domains: set[str]) -> bool:
    host = website_key(url)
    return any(host == d or host.endswith("." + d) for d in domains)


def clean_website(url: str) -> str:
    """Tidy an official-website URL for display (keeps what the source showed)."""
    url = url.strip()
    if url and not re.match(r"^[a-z][a-z0-9+.-]*://", url, re.I):
        url = "http://" + url.lstrip("/")
    return url


def looks_like_url(text: str) -> bool:
    return bool(re.match(r"^(https?://|www\.)[\w.-]+\.[a-z]{2,}", text.strip(), re.I))


@lru_cache(maxsize=2048)
def _resolve(host: str) -> tuple[str, ...]:
    infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    return tuple(sorted({info[4][0] for info in infos}))


def _ip_is_public(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not (addr.is_multicast or addr.is_reserved or addr.is_loopback
                                   or addr.is_link_local or addr.is_private or addr.is_unspecified)


def assert_public_url(url: str, resolve_dns: bool = True) -> None:
    """Raise :class:`UnsafeURLError` unless ``url`` is a public web destination."""
    parts = urlsplit(url)
    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        raise UnsafeURLError(f"scheme not allowed: {parts.scheme!r}")
    if parts.username or parts.password:
        raise UnsafeURLError("credentials in URL are not allowed")
    host = (parts.hostname or "").rstrip(".")
    if not host:
        raise UnsafeURLError("missing host")
    try:
        port = parts.port
    except ValueError as exc:
        raise UnsafeURLError(f"invalid port: {exc}") from exc
    if port not in ALLOWED_PORTS:
        raise UnsafeURLError(f"port not allowed: {port}")
    lowered = host.lower()
    if lowered in {"localhost"} or lowered.endswith((".localhost", ".local", ".internal", ".lan", ".home", ".corp")):
        raise UnsafeURLError(f"internal hostname: {host}")
    # Literal IP?
    try:
        ipaddress.ip_address(unquote(host).strip("[]"))
        literal = True
    except ValueError:
        literal = False
    if literal:
        if not _ip_is_public(unquote(host).strip("[]")):
            raise UnsafeURLError(f"non-public IP address: {host}")
        return
    if "." not in host:
        raise UnsafeURLError(f"single-label hostname: {host}")
    if not resolve_dns:
        return
    try:
        ips = _resolve(lowered)
    except socket.gaierror:
        # Behind an egress proxy DNS may not resolve locally; the proxy then
        # performs resolution and enforces its own policy. A name that does not
        # resolve here cannot be a local/private address on *this* machine.
        return
    bad = [ip for ip in ips if not _ip_is_public(ip)]
    if bad:
        raise UnsafeURLError(f"{host} resolves to non-public address(es): {', '.join(bad)}")


def is_pdf_url(url: str) -> bool:
    return urlsplit(url).path.lower().endswith(".pdf")
