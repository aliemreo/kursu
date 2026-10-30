"""Topic catalog, game metrics and outcome rules.

PLACEHOLDER content so the API is playable end to end. The real topics, categories and
metric bounds are written in WBS-3.4 and replace the values below.
"""

from dataclasses import dataclass, field

from app.schemas import Positions, Topic

ROUNDS_PER_SESSION = 3
OTHER_CHOICE = "other"


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


def _topic(id: str, title: str, motion: str, for_: str, against: str) -> TopicConfig:
    return TopicConfig(
        Topic(id=id, title=title, motion=motion, positions=Positions(for_=for_, against=against))
    )


TOPICS: dict[str, TopicConfig] = {
    config.topic.id: config
    for config in (
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
}


def final_score(values: dict[str, float]) -> float:
    """PLACEHOLDER scoring (WBS-3.3): the mean of the final metric values."""
    return round(sum(values.values()) / len(values), 1)
