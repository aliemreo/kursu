"""Topic catalog, game settings, metrics and outcome rules.

PLACEHOLDER content so the API is playable end to end. The real topics, categories and
metric bounds are written in WBS-3.4 and replace the values below. Every catalog must pass
validate_catalog, and CATALOG_VERSION changes whenever the catalog does.
"""

import random
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Literal, get_args

from app.schemas import MAX_TURN_LENGTH, GameConfig, Positions, Topic

# Stored with every game, so it is known which catalog its topics came from (FR-17).
CATALOG_VERSION = "0.1-placeholder"
MIN_TOPICS = 5

MIN_SESSIONS = 1
# Upper limit on sessions per game; a smaller catalog lowers it further.
SESSION_LIMIT = 5
ROUNDS_PER_SESSION = 3

# Choice id the judge may use for an outcome the options do not cover; needs an explanation.
OTHER_CHOICE = "other"

# What a session gets when the judge reports an outcome the topic has no mapping for:
# a narrative without metric changes, or the topic's neutral changes (used in WBS-3.3).
UnknownClaimRule = Literal["narrative_only", "neutral"]


@dataclass(frozen=True)
class MetricDefinition:
    id: str
    name: str
    min: float = 0
    max: float = 100
    initial: float = 50


METRICS: tuple[MetricDefinition, ...] = (
    MetricDefinition("social_cohesion", "Toplumsal uyum"),
    MetricDefinition("economic_stability", "Ekonomik istikrar"),
    MetricDefinition("institutional_trust", "Kurumlara güven"),
)


@dataclass(frozen=True)
class Category:
    id: str
    name: str
    choices: tuple[str, ...]


# Categories every topic offers; topics may add their own.
GLOBAL_CATEGORIES: tuple[Category, ...] = (
    Category("main_benefit", "Main benefit", ("social", "economic", "institutional")),
    Category("main_cost", "Main cost", ("social", "economic", "institutional")),
)


@dataclass(frozen=True)
class TopicConfig:
    topic: Topic
    # Largest allowed absolute change per metric in one session.
    max_delta: dict[str, float] = field(
        default_factory=lambda: {metric.id: 10 for metric in METRICS}
    )
    categories: tuple[Category, ...] = GLOBAL_CATEGORIES
    unknown_claim_rule: UnknownClaimRule = "narrative_only"


def _topic(id: str, title: str, motion: str, for_: str, against: str) -> TopicConfig:
    return TopicConfig(
        Topic(id=id, title=title, motion=motion, positions=Positions(for_=for_, against=against))
    )


CATALOG: tuple[TopicConfig, ...] = (
    _topic(
        "public-transport",
        "Toplu taşıma",
        "Büyükşehirlerde toplu taşıma öğrencilere ücretsiz olmalıdır.",
        "Ücretsiz toplu taşıma eğitime erişimi kolaylaştırır.",
        "Kaynaklar hat ve sefer sayısını artırmaya ayrılmalıdır.",
    ),
    _topic(
        "renewable-energy",
        "Yenilenebilir enerji",
        "Yeni enerji yatırımlarının yarısı yenilenebilir kaynaklara ayrılmalıdır.",
        "Yenilenebilir enerji dışa bağımlılığı azaltır.",
        "Kota yerine maliyet ve arz güvenliği esas alınmalıdır.",
    ),
    _topic(
        "remote-work",
        "Uzaktan çalışma",
        "Kamuda haftada iki gün uzaktan çalışma hakkı tanınmalıdır.",
        "Uzaktan çalışma verimliliği ve şehir trafiğini iyileştirir.",
        "Kamu hizmetinin yüz yüze sunulması önceliklidir.",
    ),
    _topic(
        "school-meals",
        "Okul yemeği",
        "İlkokullarda tüm öğrencilere ücretsiz öğle yemeği verilmelidir.",
        "Ücretsiz yemek beslenmeyi ve okula devamı artırır.",
        "Destek yalnızca ihtiyacı olan ailelere yöneltilmelidir.",
    ),
    _topic(
        "urban-green",
        "Kentsel yeşil alan",
        "Belediyeler imar planlarında kişi başına asgari yeşil alanı iki katına çıkarmalıdır.",
        "Yeşil alan halk sağlığını ve yaşam kalitesini artırır.",
        "Konut arzı ve arsa maliyetleri öncelikli tutulmalıdır.",
    ),
)

TOPICS: dict[str, TopicConfig] = {config.topic.id: config for config in CATALOG}


def game_config() -> GameConfig:
    """The limits for new games. Read at call time, so it follows the current catalog."""
    return GameConfig(
        min_sessions=MIN_SESSIONS,
        max_sessions=min(SESSION_LIMIT, len(TOPICS)),
        rounds_per_session=ROUNDS_PER_SESSION,
        max_turn_length=MAX_TURN_LENGTH,
        catalog_version=CATALOG_VERSION,
    )


_rng = random.Random()


def pick_topics(count: int, rng: random.Random | None = None) -> list[str]:
    """`count` different topic ids in random order, one per session."""
    # Sorted first, so that a seeded generator always gives the same topics.
    return (rng or _rng).sample(sorted(TOPICS), count)


def validate_catalog(
    catalog: Iterable[TopicConfig], metrics: Iterable[MetricDefinition]
) -> list[str]:
    """Every problem that makes the catalog unusable; empty when it is valid."""
    catalog, metrics = tuple(catalog), tuple(metrics)
    problems: list[str] = []
    metric_ids = [metric.id for metric in metrics]

    if len(set(metric_ids)) != len(metric_ids):
        problems.append("Metric ids repeat")
    for metric in metrics:
        if not metric.min <= metric.initial <= metric.max:
            problems.append(f"Metric {metric.id!r}: initial value is outside its bounds")

    topic_ids = [config.topic.id for config in catalog]
    if len(set(topic_ids)) < MIN_TOPICS:
        problems.append(f"The catalog has {len(set(topic_ids))} topics; {MIN_TOPICS} are needed")
    if len(set(topic_ids)) != len(topic_ids):
        problems.append("Topic ids repeat")

    for config in catalog:
        topic, where = config.topic, f"Topic {config.topic.id!r}"
        if not topic.title.strip() or not topic.motion.strip():
            problems.append(f"{where}: title or motion is empty")
        if not topic.positions.for_.strip() or not topic.positions.against.strip():
            problems.append(f"{where}: a position is empty")
        if set(config.max_delta) != set(metric_ids):
            problems.append(f"{where}: max_delta must name exactly the metrics {metric_ids}")
        if any(limit <= 0 for limit in config.max_delta.values()):
            problems.append(f"{where}: every max_delta must be positive")
        category_ids = [category.id for category in config.categories]
        if not category_ids:
            problems.append(f"{where}: no outcome categories")
        if len(set(category_ids)) != len(category_ids):
            problems.append(f"{where}: category ids repeat")
        for category in config.categories:
            if not category.choices or len(set(category.choices)) != len(category.choices):
                problems.append(f"{where}: category {category.id!r} needs distinct choices")
            if OTHER_CHOICE in category.choices:
                problems.append(f"{where}: choice {OTHER_CHOICE!r} is reserved for the judge")
        if config.unknown_claim_rule not in get_args(UnknownClaimRule):
            problems.append(f"{where}: unknown_claim_rule {config.unknown_claim_rule!r}")
    return problems


def final_score(values: dict[str, float]) -> float:
    """PLACEHOLDER scoring (WBS-3.3): the mean of the final metric values."""
    return round(sum(values.values()) / len(values), 1)


# A broken catalog stops the app at startup instead of failing during a game.
_problems = validate_catalog(CATALOG, METRICS)
if _problems:
    raise RuntimeError("Invalid topic catalog: " + "; ".join(_problems))
