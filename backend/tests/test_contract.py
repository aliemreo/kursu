from pathlib import Path

import yaml

from app.main import app

CONTRACT = Path(__file__).parents[2] / "contracts" / "openapi.yaml"
METHODS = {"get", "post", "put", "patch", "delete"}


def operations(paths: dict, prefix: str = "") -> set[tuple[str, str]]:
    return {
        (method, prefix + path)
        for path, item in paths.items()
        for method in item
        if method in METHODS
    }


def test_backend_serves_exactly_the_contract_endpoints() -> None:
    """Fails when an endpoint is added or removed without changing contracts/openapi.yaml."""
    contract = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))

    assert operations(app.openapi()["paths"]) == operations(contract["paths"], "/api/v1")
