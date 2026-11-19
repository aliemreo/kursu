# AI-assistance log

Every use of an AI assistant for project work is recorded here, as agreed in the project plan. AI-assisted time is tracked separately and is not counted as human FTE.

| Date | Member | Tool | WBS activity | What the assistant did | Files / PR | Time (h) | Human reviewer |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD | | | WBS-x.y | | | | |
| 2026-10-29 | Ömer Faruk Ekmekçi | Claude Code | WBS-1.2, WBS-4.1 | Drafted contract v0.2 (game sessions, turns, verdicts), game endpoints, game tables and migration, mock opponent/judge adapters, verdict validation and tests | contracts/openapi.yaml, backend/app/{api/games.py,api/topics.py,game.py,content.py,schemas.py,models.py,ai/}, backend/migrations/versions/0002_create_games.py, backend/tests/ | 4 | Ömer Faruk Ekmekçi |
| 2026-11-02 | Furkan Kalay | Claude Code | WBS-2.1 | Neon setup, username field and migration, tests moved to tests/ with migration checks | backend/, tests/, contracts/openapi.yaml | 2 | Furkan Kalay |
| 2026-11-16 | Beyza Kaya | Claude Code | WBS-6.1, WBS-5.1, WBS-5.2, WBS-5.3 | Aligned the frontend with API contract v0.3: types and API client, mock API with the side/turn/evaluation flow, username registration and server logout, new-game, debate, results and leaderboard screens, Vite/Nginx proxy to /api/v1, tests | frontend/ | 2 | Beyza Kaya |
| 2026-11-16 | Beyza Kaya | Claude Code | WBS-5.1, WBS-5.2, WBS-5.3 | Frontend redesign guided by Laws of UX: shared auth layout, resume card and stats on the dashboard, session-count picker, stepper, round dots, optimistic turns and sticky composer in the debate, verdict and score-ring results, leaderboard ranks, responsive fixes | frontend/src/ | 1.5 | Beyza Kaya |
| 2026-11-16 | Beyza Kaya | Claude Code | WBS-5.1, WBS-5.2, WBS-5.3 | Editorial visual identity: burgundy/espresso/ivory/gold tokens, Playfair Display + Inter, paper grain and geometric textures, SVG colonnade, Vav signature motif with stroke animation, scroll reveals and staggered headings (no new dependencies), redesigned shell, auth stage, dashboard, debate, verdict, results, leaderboard and 404 | frontend/index.html, frontend/src/ | 2 | Beyza Kaya |
