"""The topic catalog, its validator and topic assignment (FR-04, FR-17), without the API."""

import random
from dataclasses import replace

import pytest

from app import content
from app.content import (
    CATALOG,
    METRICS,
    OTHER_CHOICE,
    SESSION_LIMIT,
    Category,
    pick_topics,
    validate_catalog,
)
from app.schemas import Positions


def test_catalog_is_valid() -> None:
    assert validate_catalog(CATALOG, METRICS) == []


def first_topic_changed(**changes) -> tuple:
    return (replace(CATALOG[0], **changes), *CATALOG[1:])


@pytest.mark.parametrize(
    ("catalog", "problem"),
    [
        pytest.param(CATALOG[:4], "5 are needed", id="too-few-topics"),
        pytest.param((*CATALOG, CATALOG[0]), "Topic ids repeat", id="repeated-topic"),
        pytest.param(
            first_topic_changed(max_delta={METRICS[0].id: 10}), "max_delta", id="missing-limit"
        ),
        pytest.param(
            first_topic_changed(max_delta={m.id: 0 for m in METRICS}),
            "positive",
            id="zero-limit",
        ),
        pytest.param(
            first_topic_changed(
                topic=CATALOG[0].topic.model_copy(
                    update={"positions": Positions(for_="Evet", against=" ")}
                )
            ),
            "position is empty",
            id="empty-position",
        ),
        pytest.param(first_topic_changed(categories=()), "no outcome categories", id="no-category"),
        pytest.param(
            first_topic_changed(categories=(Category("c", "C", ("a",)),) * 2),
            "category ids repeat",
            id="repeated-category",
        ),
        pytest.param(
            first_topic_changed(categories=(Category("c", "C", ("a", OTHER_CHOICE)),)),
            "reserved",
            id="reserved-choice",
        ),
        pytest.param(
            first_topic_changed(unknown_claim_rule="ignore"),
            "unknown_claim_rule",
            id="unknown-claim-rule",
        ),
    ],
)
def test_validator_reports_broken_catalogs(catalog: tuple, problem: str) -> None:
    problems = validate_catalog(catalog, METRICS)

    assert any(problem in p for p in problems), problems


@pytest.mark.parametrize("count", range(1, len(CATALOG) + 1))
def test_picked_topics_never_repeat_and_come_from_the_catalog(count: int) -> None:
    picked = pick_topics(count, random.Random(count))

    assert len(picked) == len(set(picked)) == count
    assert set(picked) <= set(content.TOPICS)


def test_the_same_seed_picks_the_same_topics() -> None:
    assert pick_topics(3, random.Random(7)) == pick_topics(3, random.Random(7))


def test_session_range_follows_the_catalog(monkeypatch: pytest.MonkeyPatch) -> None:
    assert content.game_config().max_sessions == min(SESSION_LIMIT, len(content.TOPICS))

    monkeypatch.setattr(content, "TOPICS", dict(list(content.TOPICS.items())[:2]))

    assert content.game_config().max_sessions == 2
