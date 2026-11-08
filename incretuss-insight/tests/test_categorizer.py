from adapters.pharmtech_adapter import ExhibitorOnlineManualAdapter
from database.models import ProductData, SectorEntry
from extractors.product_extractor import Categorizer, RuleBasedClassifier, labelled_fields

clf = RuleBasedClassifier()


def cats(text):
    return {c for c, _ in clf.classify(text)}


def test_specific_rules():
    assert "Essential Oils" in cats("Lavender essential oil, steam distilled")
    assert "Oleoresins" in cats("Paprika oleoresin")
    assert "APIs" in cats("We supply APIs and finished dosage forms")
    assert "Laboratory Equipment" in cats("Laboratory chromatographic system")
    assert "Biotechnology" in cats("Single use bioreactors")


def test_no_evidence_no_category():
    assert cats("We are a reliable partner since 1995.") == set()


def test_api_rule_is_case_sensitive():
    # "api" in a URL or word must not trigger the APIs category
    assert "APIs" not in cats("rapid delivery via our api.example.com portal")


def test_generic_equipment_only_when_nothing_specific():
    assert cats("Packaging equipment for blisters") == {"Packaging Equipment"}
    assert cats("Stainless equipment") == {"Manufacturing Equipment"}


def test_cyrillic_lookalike_letters_are_folded():
    # The organiser's label starts with a Cyrillic 'С'
    assert "Manufacturing Equipment" in cats("Сleanroom components")


def test_sector_mapping_uses_label_head_not_full_bundle():
    c = Categorizer(sector_overrides=ExhibitorOnlineManualAdapter.sector_overrides)
    sector = SectorEntry(sector="Raw materials and ingredients for manufacturing medicines or veterinary products",
                         subsectors=["Natural extracts: plant extracts, animal extracts, functional food ingredients, "
                                     "dietary supplement ingredients, nutraceutical ingredients, cosmeceutical "
                                     "ingredients, dietary fiber"])
    got = {cat for cat, _ in c.sector_categories([sector])}
    assert got == {"Natural Extracts"}


def test_sector_other_child_falls_back_to_parent():
    c = Categorizer(sector_overrides=ExhibitorOnlineManualAdapter.sector_overrides)
    got = c.sector_categories([SectorEntry(sector="Manufacturing and general equipment", subsectors=["Other"])])
    assert got[0][0] == "Manufacturing Equipment"


def test_unmapped_sector_is_other_with_evidence():
    c = Categorizer()
    got = c.sector_categories([SectorEntry(sector="Media")])
    assert got == [("Other", "Event sector: Media")]


def test_product_unclassified_and_brand():
    c = Categorizer()
    p = ProductData(name="Widget X", source_url="https://e.com/p")
    assert c.classify_product(p)["product_category"] == "Unclassified"
    b = ProductData(name="TJX", product_type="Brand", source_url="https://e.com/b")
    assert c.classify_product(b)["product_type"] == "Brand"


def test_labelled_fields_only_explicit():
    text = "Turmeric extract.\nApplications: dietary supplements, beverages\nComposition: curcuminoids 95%"
    f = labelled_fields(text)
    assert f["applications"] == "dietary supplements, beverages"
    assert f["ingredients"] == "curcuminoids 95%"
    assert "raw_materials" not in f
    assert labelled_fields("Used widely in many applications") == {}


def test_equipment_description_does_not_add_ingredient_categories():
    c = Categorizer()
    p = ProductData(name="Automatic capsule filling machine XTR",
                    description="Handles powders, pellets and APIs for nutraceutical and pharmaceutical production.",
                    source_url="https://e.com/p")
    info = c.classify_product(p)
    assert "APIs" not in info["product_category"] and "Nutraceutical" not in info["product_category"]
    assert info["product_type"] == "Equipment"


def test_service_names_are_services():
    info = Categorizer().classify_product(ProductData(name="Qualification of Laboratory Equipment",
                                                      source_url="https://e.com/p"))
    assert info["product_type"] == "Service" and info["product_category"] == "Other"


def test_ingredient_name_with_systems_word_is_not_equipment():
    info = Categorizer().classify_product(ProductData(name="Excipients for drug delivery systems",
                                                      source_url="https://e.com/p"))
    assert info["product_category"] == "Excipients" and info["product_type"] == "Ingredient"
