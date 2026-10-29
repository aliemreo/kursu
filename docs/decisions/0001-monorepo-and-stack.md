# 0001: Monorepo, technology stack and contract-first API

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Four people build the frontend, backend, AI services and documentation in parallel over ten weeks. The project plan (WBS-1.1, WBS-1.2) asks for one shared baseline and a versioned API contract so that tracks do not block each other.

## Decision

- One repository with `backend/`, `frontend/`, `contracts/` and `docs/`.
- Backend: Python 3.12 and FastAPI; frontend: React, TypeScript and Vite; database: PostgreSQL 16; Docker Compose for local services.
- The API is contract-first: `contracts/openapi.yaml` is changed before or together with the code.
- AI calls go through adapters with a mock implementation, selected by `LLM_PROVIDER`, so the game stays playable and testable without a model.
- Judge output is never applied directly: the game engine validates both judge stages against the topic's limits first.

## Consequences

- Frontend work can start against the contract and mock data.
- Every API change needs a contract update in the same pull request.
- New design decisions are recorded as numbered files in this folder.
