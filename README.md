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
contracts/   OpenAPI contract shared by frontend and backend
docs/        Charter, project plan, design decisions, AI-assistance log
.github/     CI workflow, pull request and issue templates
```

## Getting started

Requirements: Python 3.12, Node.js 22, Docker.

```bash
cp .env.example .env                 # never commit .env
docker compose up -d db              # PostgreSQL 16

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload        # http://localhost:8000/docs

cd ../frontend
npm ci
npm run dev                          # http://localhost:5173
```

Run the same checks as CI before opening a pull request:

```bash
cd backend && ruff check . && pytest
cd frontend && npm run typecheck && npm test && npm run build
```

## Working agreement

Work happens in feature branches and reaches `main` only through reviewed pull requests with a green CI. See [CONTRIBUTING.md](CONTRIBUTING.md). Changes to the API start in [contracts/openapi.yaml](contracts/openapi.yaml).

## Documents

- [Project charter](docs/Charter.md)
- [Project plan](docs/Project_Plan.md)
- [Design decisions](docs/decisions/)
- [AI-assistance log](docs/AI_CONTRIBUTIONS.md)

## Data

Debate content is based on the ParlaMint-TR corpus (ParlaMint 5.0, http://hdl.handle.net/11356/2004), licensed under CC BY 4.0. The dataset itself is not stored in this repository.
