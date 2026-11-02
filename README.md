# Kürsü

Kürsü is a browser-based educational strategy game. A player debates an AI opponent over a configurable number of sessions on predefined social and policy topics. An independent AI judge evaluates each debate transcript in two structured stages, and the game engine validates the judge's output before updating the game metrics and the final score.

Kürsü is a fictional simulation. Judge assessments and metric changes are game outcomes, not predictions of real policy effects or public opinion.

BLG411E Software Engineering, fall 2026, group **Beetropic**.

## Team

| Member | Role |
|---|---|
| Ali Emre Özcan | Project Manager; AI and Evaluation Engineer |
| Furkan Kalay | Backend & Database Engineer; Game Logic Designer |
| Ömer Faruk Ekmekçi | Backend & AI Inference Engineer |
| Beyza Kaya | Frontend & DevOps Engineer |

## Repository layout

```
backend/     FastAPI service (Python 3.12)
frontend/    React + TypeScript app (Vite)
tests/       Backend, contract and migration tests (see tests/README.md)
contracts/   OpenAPI contract shared by frontend and backend
docs/        Charter, project plan, design decisions, AI-assistance log
.github/     CI workflow, pull request and issue templates
```

## Getting started

Requirements: Python 3.12, Node.js 22 and a PostgreSQL database on [Neon](https://neon.tech).

1. Copy the settings file: `cp .env.example .env`. Never commit `.env`.
2. In `.env`, set:
   - `DATABASE_URL`: the Neon connection string from *Dashboard > Connect*, with connection pooling turned off (no `-pooler` in the host) and `?sslmode=require` kept.
   - `JWT_SECRET`: a random value, e.g. from `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
3. Start the backend and the frontend in two terminals:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate               # Windows; on macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head                 # create or update the database tables
uvicorn app.main:app --reload        # http://localhost:8000/docs

cd frontend
npm ci
npm run dev                          # http://localhost:5173
```

Run the same checks as CI before opening a pull request:

```bash
cd backend && ruff check . ../tests && pytest
cd frontend && npm run typecheck && npm test && npm run build
```

## Database

The database runs on Neon; there is no local PostgreSQL. Tables are created and changed only through Alembic migrations in `backend/migrations/`:

- After pulling changes, run `alembic upgrade head`.
- After changing `backend/app/models.py`, generate a migration with `alembic revision --autogenerate -m "short description"`, review it, then run `alembic upgrade head`. CI fails if the models and the migrations do not match.
- Each member should use their own Neon branch (and its connection string), so that a migration on a feature branch does not change the database the others use.

The tests do not need a database: they use SQLite and never connect to `DATABASE_URL`.

## Working agreement

Work happens in feature branches and reaches `main` only through reviewed pull requests with a green CI. See [CONTRIBUTING.md](CONTRIBUTING.md). Changes to the API start in [contracts/openapi.yaml](contracts/openapi.yaml).

## Documents

- [Project charter](docs/charter_v1.1.md)
- [Project plan](docs/Project_Plan.md)
- [Design decisions](docs/decisions/)
- [AI-assistance log](docs/AI_CONTRIBUTIONS.md)

## Data

Debate content is based on the ParlaMint-TR corpus (ParlaMint 5.0, http://hdl.handle.net/11356/2004), licensed under CC BY 4.0. The dataset itself is not stored in this repository.
