# Contributing

## Branches

- `main` is protected: no direct pushes, merges only through pull requests.
- Create one branch per task, named after its WBS activity: `feature/wbs-3.2-debate-state-machine`, `fix/wbs-5.2-turn-order`.

## Pull requests

- Link the issue or WBS activity the change belongs to.
- Keep pull requests small enough to review in one sitting.
- At least **one approval** from another member and a **green CI** are required before merging.
- API changes update `contracts/openapi.yaml` in the same pull request, and the API/change review coordinator (Furkan) reviews them.
- Do not commit secrets, `.env` files, datasets or model weights. Put new settings in `.env.example` with a placeholder value.

## Commits

Short imperative messages, optionally prefixed with the area: `backend: add session model`, `frontend: show turn timer`.

## Code style and checks

- Backend: `ruff check .` and `pytest` must pass.
- Frontend: `npm run typecheck`, `npm test` and `npm run build` must pass.

## AI-assisted work

AI coding assistants may be used for routine code, but every use is recorded in [docs/AI_CONTRIBUTIONS.md](docs/AI_CONTRIBUTIONS.md) with the task, the time spent and the human reviewer. AI-generated code is reviewed like any other code.

## Repository settings (one-time, by the repository owner)

- Protect `main`: require a pull request, one approval and the CI checks.
- Enable GitHub secret scanning and push protection.
