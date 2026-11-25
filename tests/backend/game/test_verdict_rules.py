"""Validation and application of judge reports, without the API.

The evaluation endpoint that uses these rules arrives with WBS-3.3; until then they are
tested directly.
"""

from app import game as rules
from app.content import CATALOG, METRICS, OTHER_CHOICE
from app.schemas import (
    CategoryChoice,
    Evidence,
    JudgeQualitative,
    JudgeQuantitative,
    MetricDelta,
)

CONFIG = CATALOG[0]
TURN_ID = "11111111-1111-1111-1111-111111111111"


def qualitative(**changes) -> JudgeQualitative:
    report = {
        "winner": "player",
        "victory_strength": "clear",
        "narrative": "Oyuncu daha tutarlıydı.",
        "categories": [
            CategoryChoice(category_id=c.id, choice_id=c.choices[0]) for c in CONFIG.categories
        ],
        "evidence": [Evidence(turn_id=TURN_ID, quote="...")],
    }
    return JudgeQualitative(**(report | changes))


def deltas(*items: tuple[str, float]) -> JudgeQuantitative:
    return JudgeQuantitative(metric_deltas=[MetricDelta(metric_id=m, delta=d) for m, d in items])


def validate(qual: JudgeQualitative, quant: JudgeQuantitative) -> str | None:
    return rules.validate_verdict(qual, quant, CONFIG, {TURN_ID})


def test_a_valid_report_passes() -> None:
    assert validate(qualitative(), deltas((METRICS[0].id, 5))) is None


def test_a_delta_beyond_the_topic_limit_is_rejected() -> None:
    limit = CONFIG.max_delta[METRICS[0].id]

    assert "limit" in validate(qualitative(), deltas((METRICS[0].id, limit + 1)))


def test_unknown_or_repeated_metrics_are_rejected() -> None:
    assert "Unknown metric" in validate(qualitative(), deltas(("nope", 1)))
    assert "twice" in validate(qualitative(), deltas((METRICS[0].id, 1), (METRICS[0].id, 1)))


def test_categories_must_come_from_the_topic() -> None:
    category = CONFIG.categories[0]
    unknown = qualitative(categories=[CategoryChoice(category_id="nope", choice_id="x")])
    wrong_choice = qualitative(categories=[CategoryChoice(category_id=category.id, choice_id="x")])
    other = qualitative(
        categories=[CategoryChoice(category_id=category.id, choice_id=OTHER_CHOICE)]
    )

    assert "Unknown category" in validate(unknown, deltas())
    assert "Unknown choice" in validate(wrong_choice, deltas())
    assert "explanation" in validate(other, deltas())


def test_evidence_must_cite_a_transcript_turn() -> None:
    report = qualitative(evidence=[Evidence(turn_id="not-a-turn", quote="...")])

    assert "unknown turn" in validate(report, deltas())


def test_applied_deltas_stay_within_the_metric_bounds() -> None:
    metric = METRICS[0]
    values = {m.id: m.initial for m in METRICS}

    result = rules.apply_deltas(values | {metric.id: metric.max - 1}, deltas((metric.id, 5)))

    assert result[metric.id] == metric.max
