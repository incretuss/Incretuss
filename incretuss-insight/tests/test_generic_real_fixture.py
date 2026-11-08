"""Generic adapter against saved pages of a real, structurally different site
(Naturally Good Expo 2026 directory: WordPress cards, ?id= profiles, offset paging)."""
from adapters import select_adapter
from adapters.base_adapter import ProfileContext
from adapters.generic_adapter import GenericAdapter
from tests.conftest import FakeFetcher, fixture_text

DIR = "https://naturallygood.com.au/exhibitor-directory/"
PROFILE = "https://naturallygood.com.au/exhibitor-directory/exhibitor?id=97"


def _adapter(settings):
    f = FakeFetcher({("GET", DIR): fixture_text("ng_listing.html"),
                     ("GET", PROFILE): fixture_text("ng_profile_acala.html")})
    ad = GenericAdapter(f, settings)
    ad.exclude_domains("https://naturallygood.com.au/")
    return ad


def test_generic_selected_for_unknown_platform():
    cls, _ = select_adapter(DIR, fixture_text("ng_listing.html"))
    assert cls is GenericAdapter


def test_listing_names_not_call_to_action_and_pagination(settings):
    page = next(_adapter(settings).iter_listing(DIR, {}))
    names = [s.name for s in page.stubs]
    assert len(names) == 16 and "View Profile" not in names
    assert names[:2] == ["3P Partners", "575 Greens"]
    assert page.stubs[0].booth == "F16" and page.stubs[0].country == "Australia"
    assert "offset=16" in page.state["next_url"]


def test_profile_fields(settings):
    r = _adapter(settings).extract_profile(ProfileContext(company_id="x", name="View Profile", profile_url=PROFILE))
    c = r.company
    assert c.name == "Acala Stem"
    assert c.official_website == "https://www.acalastem.com"     # globe link, not Facebook/LinkedIn
    assert c.booth == "B5"
    assert [s.sector for s in c.event_sectors] == ["Beauty & Cosmetics", "Parent, Baby & Children"]
    assert c.description.startswith("Acala Stem is a visionary brand")
    assert len(r.documents) == 1 and r.documents[0].title == "Promotional PDF"
