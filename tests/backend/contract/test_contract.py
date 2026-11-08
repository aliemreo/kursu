from pathlib import Path

import yaml

from app.main import app

CONTRACT = Path(__file__).parents[3] / "contracts" / "openapi.yaml"
METHODS = {"get", "post", "put", "patch", "delete"}
# planned: in the contract, not served yet. changing: served, but still in its old shape.
STATUSES = {"planned", "changing"}


def load_contract() -> dict:
    return yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))


Operation = tuple[str, str]


def operations(paths: dict, prefix: str = "", *, skip_planned: bool = False) -> set[Operation]:
    return {
        (method, prefix + path)
        for path, item in paths.items()
        for method, operation in item.items()
        if method in METHODS
        and not (skip_planned and operation.get("x-status") == "planned")
    }


def test_backend_serves_exactly_the_contract_endpoints() -> None:
    """Fails when an endpoint is added or removed without changing contracts/openapi.yaml.

    Operations marked `x-status: planned` are skipped; once one is served, its marker must
    be removed, or this test fails.
    """
    contract = load_contract()

    served = operations(app.openapi()["paths"])
    expected = operations(contract["paths"], "/api/v1", skip_planned=True)

    assert served == expected


def test_status_markers_are_known_and_name_their_wbs_activity() -> None:
    for path, item in load_contract()["paths"].items():
        for method, operation in item.items():
            if method not in METHODS or "x-status" not in operation:
                continue
            assert operation["x-status"] in STATUSES, f"{method} {path}"
            assert str(operation.get("x-wbs", "")).startswith("WBS-"), f"{method} {path}"


def test_every_reference_resolves() -> None:
    """Catches typos in hand-written $ref values, which YAML parsing alone accepts."""
    contract = load_contract()

    def refs(node):
        if isinstance(node, dict):
            for key, value in node.items():
                if key == "$ref":
                    yield value
                else:
                    yield from refs(value)
        elif isinstance(node, list):
            for value in node:
                yield from refs(value)

    for ref in refs(contract):
        assert ref.startswith("#/"), ref
        target = contract
        for part in ref[2:].split("/"):
            assert part in target, f"Unresolved $ref {ref}"
            target = target[part]
