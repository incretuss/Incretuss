"""Product-level helpers: normalised categorisation and labelled-field parsing.

Categorisation is rule-based and evidence-driven:

* A category is assigned only when a rule matches text that was actually
  published (product name/description, organiser sector, company text, PDF).
* Every assignment carries the matched snippet as evidence and a *basis*
  string that says where it came from and that it is inferred.
* Products with no matching rule are ``Unclassified`` - never guessed.

The :class:`CategoryClassifier` protocol is the extension point for a future
LLM-based classifier; :class:`RuleBasedClassifier` is the default.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Protocol

from database.models import CategoryAssignment, ProductData, SectorEntry

NORMALIZED_CATEGORIES = [
    "Essential Oils", "Aroma Chemicals", "Natural Extracts", "Botanical Extracts", "Oleoresins",
    "Nutraceutical Ingredients", "Cosmetic Ingredients", "Fragrance Ingredients", "Food Ingredients",
    "Pharmaceutical Ingredients", "APIs", "Pharmaceutical Intermediates", "Excipients",
    "Manufacturing Equipment", "Packaging Equipment", "Laboratory Equipment", "Biotechnology",
    "Contract Manufacturing", "Other", "Unclassified",
]

INGREDIENT_CATS = {
    "Essential Oils", "Aroma Chemicals", "Natural Extracts", "Botanical Extracts", "Oleoresins",
    "Nutraceutical Ingredients", "Cosmetic Ingredients", "Fragrance Ingredients", "Food Ingredients",
    "Pharmaceutical Ingredients", "APIs", "Pharmaceutical Intermediates", "Excipients",
}
EQUIPMENT_CATS = {"Manufacturing Equipment", "Packaging Equipment", "Laboratory Equipment"}
SERVICE_CATS = {"Contract Manufacturing"}

BASIS_SECTOR = "event_sector (organiser-assigned, mapped)"
BASIS_PRODUCT = "product_text keyword rule (inferred)"
BASIS_DESCRIPTION = "company_description keyword rule (inferred)"
BASIS_PDF = "pdf_text keyword rule (inferred)"

I = re.I


@dataclass(frozen=True)
class Rule:
    category: str
    pattern: re.Pattern
    generic: bool = False    # weak rule, dropped when a more specific sibling matches


def _r(p: str, flags=I) -> re.Pattern:
    return re.compile(p, flags)


RULES: list[Rule] = [
    Rule("Essential Oils", _r(r"\bessential oils?\b|эфирн\w* масл")),
    Rule("Aroma Chemicals", _r(r"\baroma[- ]chemicals?\b|\baroma (compounds?|molecules?)\b|\b(acetophenone|vanillin|"
                               r"linalool|menthol|citral|geraniol|eugenol|coumarin|ketones? for fragrance)\b")),
    Rule("Natural Extracts", _r(r"\bnatural extracts?\b|\banimal extracts?\b|\bnatural ingredients?\b")),
    Rule("Botanical Extracts", _r(r"\b(plant|herbal|botanical)s? extracts?\b|\bphyto[- ]?(extracts?|chemicals?)\b|"
                                  r"\bstandardi[sz]ed extracts?\b|\bherbal\b|растительн\w* экстракт")),
    Rule("Oleoresins", _r(r"\boleoresins?\b")),
    Rule("Nutraceutical Ingredients", _r(r"\bnutraceuticals?\b|\bdietary supplements?\b|\bfood supplements?\b|"
                                         r"\b(pro|pre|post)biotics?\b|\bvitamins?\b|\beubiotics?\b|"
                                         r"\bbiologically active (additives?|substances?)\b|\bfunctional foods?\b|"
                                         r"\bБАД\b")),
    Rule("Cosmetic Ingredients", _r(r"\bcosmetics? (ingredients?|raw materials?|actives?|grade)\b|"
                                    r"\braw materials? for (the )?cosmetics?\b|\bcosmeceuticals?\b|"
                                    r"\bpersonal[- ]care ingredients?\b|\bemollients?\b")),
    Rule("Fragrance Ingredients", _r(r"\bfragrances?\b|\bperfum(e|es|ery)\b")),
    Rule("Food Ingredients", _r(r"\bfood (ingredients?|additives?|grade)\b|\bsweeteners?\b|\bflavou?r(s|ings?)\b|"
                                r"\bdietary fib(er|re)s?\b|\bfood colou?rs?\b")),
    Rule("Pharmaceutical Ingredients", _r(r"\bpharmaceutical (ingredients?|raw materials?|substances?)\b|"
                                          r"\braw materials?( and ingredients)? for (manufacturing )?medicines\b|"
                                          r"\bfine chemicals?\b|\bpharma(ceutical)?[- ]grade\b")),
    Rule("APIs", re.compile(r"\bAPIs?\b|\b[Aa]ctive [Pp]harmaceutical [Ii]ngredients?\b|\b[Dd]rug [Ss]ubstances?\b|"
                            r"\bфармсубстанци|\bсубстанци")),
    Rule("Pharmaceutical Intermediates", _r(r"\bintermediates?\b|\bbuilding blocks?\b")),
    Rule("Excipients", _r(r"\bexcipients?\b|\bemulsif(ying|iers?)\b|\bsolubili[sz](ing|ers?)\b|"
                          r"\bdrug delivery systems?\b|\bfilm[- ]coating (agents?|systems?)\b|\bdisintegrants?\b")),
    Rule("Packaging Equipment", _r(r"\bpackag\w* (equipment|machines?|machinery|lines?)\b|\bblister\w*\b|"
                                   r"\bcarton(er|ing)\w*\b|\bfilling (machines?|lines?|equipment)\b|"
                                   r"\blabel+ing (machines?|equipment)\b|\bcapping\b|\bequipment for filling\b|"
                                   r"\bpacking & packaging equipment\b")),
    Rule("Laboratory Equipment", _r(r"\blaborator(y|ies) (equipment|instruments?|furniture|reagents?)\b|"
                                    r"\bfor laboratories\b|\bchromatograph\w*\b|\b(U?HPLC|GC-MS|LC-MS|ICP-MS)\b|"
                                    r"\bspectro(photo)?met\w*\b|\banalytical (instruments?|equipment)\b|"
                                    r"\bmicroscop\w*\b|\btitrat\w*\b|\blab(oratory)? (bioreactors?|systems?)\b|"
                                    r"\b(dissolution|disintegration|leak|hardness|friability|flowability) testers?\b|"
                                    r"\banaly[sz]ers?\b")),
    Rule("Biotechnology", _r(r"\bbiotechnolog\w*\b|\bbio-?react\w*\b|\bcell (culture|lines?)\b|\bferment\w*\b|"
                             r"\bbiologics?\b|\bbiosimilars?\b|\bbioprocess\w*\b|\bmonoclonal\b")),
    Rule("Contract Manufacturing", _r(r"\bcontract manufactur\w*\b|\bCDMOs?\b|\bCMOs?\b|\btoll (manufactur\w*|"
                                      r"processing)\b|\bprivate[- ]label\w*\b|\bcustom (synthesis|manufactur\w*)\b")),
    Rule("Manufacturing Equipment", _r(r"\bmachine(s|ry)?\b|\bdryers?\b|\bgranulat(ors?|ion equipment)\b|"
                                       r"\btablet press\w*\b|\bmixers?\b|\bgrinders?\b|\bsieves?\b|\breactors?\b|"
                                       r"\bvalves?\b|\bpumps?\b|\bproduction lines?\b|\bclean ?rooms?\b|"
                                       r"\bsteril[iy][sz]ers?\b|\bautoclaves?\b|\bisolators?\b|"
                                       r"\bfiltration (systems?|equipment)\b|\bcentrifuges?\b|\bfreeze[- ]dryers?\b|"
                                       r"\blyophili[sz]ers?\b|\btube systems?\b|\bhomogeni[sz]ers?\b|"
                                       r"\bchromatographic systems?\b|\bdepth filtration\b|\bextruders?\b|"
                                       r"\b(conical|hammer|ball|jet|colloid) mills?\b|\buni-?mill\b|"
                                       r"\b(rotary )?tablet press\w*\b|\bcoating (pans?|machines?)\b")),
    # Weak: the bare word "equipment" only counts when nothing more specific matched.
    Rule("Manufacturing Equipment", _r(r"\bequipment\b|оборудовани"), generic=True),
]


def _fold(text: str) -> str:
    """Normalise text for matching: NFKC + map Cyrillic look-alike letters to Latin.

    Some organisers' labels mix scripts (e.g. a Cyrillic "С" in "Сleanrooms").
    """
    text = unicodedata.normalize("NFKC", text or "")
    table = str.maketrans("АВЕКМНОРСТХаеорсухі", "ABEKMHOPCTXaeopcyxi")
    # Only fold look-alikes inside words that are otherwise Latin.
    return re.sub(r"\b\w+\b", lambda m: m.group(0).translate(table)
                  if re.search(r"[A-Za-z]", m.group(0)) else m.group(0), text)


def _snippet(text: str, m: re.Match, width: int = 90) -> str:
    start = max(0, m.start() - width)
    end = min(len(text), m.end() + width)
    s = text[start:end].replace("\n", " ")
    return ("…" if start else "") + s.strip() + ("…" if end < len(text) else "")


class CategoryClassifier(Protocol):
    def classify(self, text: str) -> list[tuple[str, str]]:
        """Return ``[(category, evidence_snippet), ...]`` for explicit evidence in ``text``."""


class RuleBasedClassifier:
    def __init__(self, rules: list[Rule] | None = None):
        self.rules = rules or RULES

    def classify(self, text: str) -> list[tuple[str, str]]:
        folded = _fold(text)
        if not folded.strip():
            return []
        hits: dict[str, str] = {}
        generic_hits: dict[str, str] = {}
        for rule in self.rules:
            m = rule.pattern.search(folded)
            if not m:
                continue
            target = generic_hits if rule.generic else hits
            target.setdefault(rule.category, _snippet(folded, m))
        if not (set(hits) & EQUIPMENT_CATS) and not (set(hits) & {"Biotechnology"}):
            for cat, ev in generic_hits.items():
                hits.setdefault(cat, ev)
        return list(hits.items())


def product_type_for(categories: Iterable[str]) -> str | None:
    cats = set(categories)
    kinds = []
    if cats & EQUIPMENT_CATS:
        kinds.append("Equipment")
    if cats & INGREDIENT_CATS:
        kinds.append("Ingredient")
    if cats & SERVICE_CATS:
        kinds.append("Service")
    return "; ".join(kinds) or None


EQUIPMENT_NAME = re.compile(
    r"\b(machines?|machinery|equipment|equipments|systems?|testers?|analy[sz]ers?|instruments?|devices?|apparatus|"
    r"press(es|e)?|mills?|extruders?|dryers?|granulators?|mixers?|reactors?|bioreactors?|isolators?|pumps?|valves?|"
    r"filters?|columns?|centrifuges?|autoclaves?|steril[iy][sz]ers?|chambers?|lines?|units?|robots?|conveyors?|"
    r"fillers?|cappers?|labell?ers?|cartoners?|incubators?|freezers?|homogeni[sz]ers?|evaporators?|tanks?|vessels?)\b",
    re.I)
SERVICE_NAME = re.compile(r"\b(qualification|validation|calibration|consult\w*|services?|training|audits?|"
                          r"registration|outsourcing|maintenance|engineering|design works|certification)\b", re.I)


# ----------------------------------------------------------- labelled fields
_LABEL = r"(?:^|\n|\.\s|;\s)\s*{label}\s*[:：\-–]\s*(.+?)(?=\n|$|\.\s+[A-Z])"
LABELS = {
    "ingredients": re.compile(_LABEL.format(label=r"(?:ingredients?|composition|состав)"), I),
    "raw_materials": re.compile(_LABEL.format(label=r"(?:raw materials?|source materials?|сырь[её])"), I),
    "applications": re.compile(_LABEL.format(label=r"(?:applications?|application areas?|areas? of application|"
                                                    r"uses?|применение|область применения)"), I),
    "services": re.compile(_LABEL.format(label=r"(?:services?|услуги)"), I),
}


def labelled_fields(text: str | None) -> dict[str, str]:
    """Extract only fields the source explicitly labels (e.g. ``Applications: ...``)."""
    out: dict[str, str] = {}
    if not text:
        return out
    for key, pat in LABELS.items():
        vals = [m.group(1).strip(" .;") for m in pat.finditer(text)]
        vals = [v for v in vals if 2 < len(v) < 600]
        if vals:
            out[key] = "; ".join(dict.fromkeys(vals))
    return out


# ------------------------------------------------------------- company-level
def head_of(label: str) -> str:
    """'Natural extracts: plant extracts, ...' -> 'Natural extracts'."""
    return label.split(":", 1)[0].strip()


def _norm_label(label: str) -> str:
    return re.sub(r"\s+", " ", _fold(label).lower()).strip()


class Categorizer:
    """Builds per-product and per-company normalised categories with evidence."""

    def __init__(self, classifier: CategoryClassifier | None = None, sector_overrides: dict[str, list[str]] | None = None):
        self.classifier = classifier or RuleBasedClassifier()
        self.sector_overrides = {_norm_label(k): v for k, v in (sector_overrides or {}).items()}

    # products -------------------------------------------------------------
    def classify_product(self, p: ProductData) -> dict:
        """Categorise one product from its own name and description.

        Equipment descriptions routinely name what the machine *processes*
        ("capsule filler for APIs and nutraceuticals"). So when the product
        name identifies equipment, only equipment-type categories may come
        from the description. Service names (qualification, validation...)
        are typed as services and never as the equipment they service.
        """
        if p.product_type == "Brand":
            return {"product_category": None, "category_basis": None, "product_type": "Brand", "hits": []}
        name_hits = self.classifier.classify(p.name)
        desc_hits = self.classifier.classify(p.description or "")
        is_service = bool(SERVICE_NAME.search(_fold(p.name)))
        name_cats = {c for c, _ in name_hits}
        is_equipment = not is_service and (bool(name_cats & EQUIPMENT_CATS) or (
            bool(EQUIPMENT_NAME.search(_fold(p.name))) and not name_cats & INGREDIENT_CATS))
        hits = dict(name_hits)
        for cat, ev in desc_hits:
            if is_equipment and cat not in EQUIPMENT_CATS | {"Biotechnology"}:
                continue
            if is_service and cat not in SERVICE_CATS:
                continue
            hits.setdefault(cat, ev)
        if is_service:
            hits = {c: e for c, e in hits.items() if c in SERVICE_CATS} or {"Other": f"service: {p.name}"}
        if is_equipment and not set(hits) & (EQUIPMENT_CATS | {"Biotechnology"}):
            hits["Manufacturing Equipment"] = f"equipment named in product: {p.name}"
        cats = list(hits)
        ptype = p.product_type or ("Service" if is_service else "Equipment" if is_equipment else product_type_for(cats))
        return {
            "product_category": "; ".join(cats) if cats else "Unclassified",
            "category_basis": BASIS_PRODUCT if cats else "no explicit evidence",
            "product_type": ptype,
            "hits": list(hits.items()),
        }

    # sectors --------------------------------------------------------------
    def map_sector_label(self, label: str) -> tuple[list[str], str]:
        """Return (categories, matched_text) for one organiser sector label."""
        key = _norm_label(label)
        if key in self.sector_overrides:
            return self.sector_overrides[key], label
        hkey = _norm_label(head_of(label))
        if hkey in self.sector_overrides:
            return self.sector_overrides[hkey], label
        hits = self.classifier.classify(head_of(label))
        return [c for c, _ in hits], label

    def sector_categories(self, sectors: list[SectorEntry]) -> list[tuple[str, str]]:
        """[(category, evidence)] from organiser sectors. Unmapped sectors -> 'Other'."""
        out: list[tuple[str, str]] = []
        for s in sectors:
            parent_cats, _ = self.map_sector_label(s.sector)
            subs = s.subsectors or []
            if not subs:
                cats = parent_cats or ["Other"]
                out.extend((c, f"Event sector: {s.sector}") for c in cats)
                continue
            for sub in subs:
                if _norm_label(sub) == "other":
                    cats = parent_cats or ["Other"]
                else:
                    cats, _ = self.map_sector_label(sub)
                    cats = cats or parent_cats or ["Other"]
                out.extend((c, f"Event sector: {s.sector} > {sub}") for c in cats)
        return out

    def company_categories(self, *, products: list[ProductData], product_info: list[dict],
                           sectors: list[SectorEntry], description: str | None, new_products_text: str | None,
                           profile_url: str) -> list[CategoryAssignment]:
        agg: dict[tuple[str, str], dict] = {}

        def add(cat: str, basis: str, support: str, evidence: str, url: str | None):
            key = (cat, basis)
            entry = agg.setdefault(key, {"support": [], "evidence": [], "url": url})
            if support not in entry["support"]:
                entry["support"].append(support)
            if evidence and evidence not in entry["evidence"] and len(entry["evidence"]) < 3:
                entry["evidence"].append(evidence)

        for cat, ev in self.sector_categories(sectors):
            add(cat, BASIS_SECTOR, ev.replace("Event sector: ", ""), ev, profile_url)
        for p, info in zip(products, product_info):
            for cat, ev in info.get("hits", []):
                add(cat, BASIS_PRODUCT, p.name, ev, p.source_url)
        for text in (description, new_products_text):
            for cat, ev in self.classifier.classify(text or ""):
                add(cat, BASIS_DESCRIPTION, "company description", ev, profile_url)

        return [
            CategoryAssignment(category=cat, basis=basis, supporting="; ".join(v["support"])[:2000],
                               evidence_text=" | ".join(v["evidence"])[:2000], source_url=v["url"])
            for (cat, basis), v in sorted(agg.items())
        ]

    def pdf_categories(self, text: str, url: str, title: str | None) -> list[CategoryAssignment]:
        return [
            CategoryAssignment(category=cat, basis=BASIS_PDF, supporting=f"PDF: {title or url}",
                               evidence_text=ev[:2000], source_url=url)
            for cat, ev in self.classifier.classify(text)
        ]
