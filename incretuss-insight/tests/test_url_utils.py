import pytest

from utils.url_utils import UnsafeURLError, assert_public_url, normalize_url, website_key


def test_normalize_removes_tracking_fragment_and_default_port():
    assert normalize_url("HTTPS://Example.COM:443/a/b/?utm_source=x&b=2&a=1#frag") == "https://example.com/a/b?a=1&b=2"


def test_normalize_preserves_path_case_and_base64_ids():
    u = "https://h.example.com/ev/en/Exhibitor/ExbDetails/MzIzMjI="
    assert normalize_url(u) == u


def test_normalize_resolves_relative():
    assert normalize_url("../x", "https://a.com/b/c/") == "https://a.com/b/x"


def test_website_key_drops_www():
    assert website_key("http://www.Alianbio.com/en") == "alianbio.com"


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/", "http://localhost:80/", "http://10.0.0.5/x", "http://192.168.1.1/", "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/", "file:///etc/passwd", "ftp://example.com/", "http://user:pw@example.com/",
    "http://example.com:22/", "http://intranet/", "http://printer.local/", "http://0.0.0.0/",
])
def test_ssrf_blocks_non_public(url):
    with pytest.raises(UnsafeURLError):
        assert_public_url(url, resolve_dns=False)


def test_ssrf_allows_public_literal_ip_and_hostname():
    assert_public_url("https://8.8.8.8/", resolve_dns=False)
    assert_public_url("https://expopharmtech.com/", resolve_dns=False)
