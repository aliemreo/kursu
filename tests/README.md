# Tests

All tests outside the frontend live here and run in CI on every pull request.

```
tests/
  backend/
    conftest.py     Shared fixtures: in-memory SQLite database and an API test client
    api/            Endpoint tests through the HTTP API (auth, topics, games, turns, verdicts)
    contract/       The backend serves exactly the endpoints in contracts/openapi.yaml
    db/             Migrations match the models, have a single head and can be rolled back
```

Add new backend tests to the folder that matches what they check, for example game rule
tests next to the API tests or in a new `backend/game/` folder. Planned additions from the
project plan: judge evaluation cases (WBS-4.6) and end-to-end tests (WBS-6.1).

Frontend unit tests stay next to the components in `frontend/src` (`*.test.tsx`), because
Vitest resolves their imports from `frontend/node_modules`.

## Running

```bash
cd backend
pytest                      # all backend tests
pytest ../tests/backend/db  # one folder
ruff check . ../tests       # lint the backend and the tests

cd frontend
npm test
```

No database is needed: API tests use in-memory SQLite and migration tests use a temporary
SQLite file. They never connect to `DATABASE_URL`.
