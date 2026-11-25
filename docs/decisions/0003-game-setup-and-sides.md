# 0003: Game setup, side choice and topic snapshots

- **Status:** accepted
- **Date:** 2026-11-24

## Context

WBS-3.1 starts games from the topic catalog (FR-04, FR-05, FR-17) and lets a player resume
an unfinished game at the exact state where it stopped (FR-16). The Requirements
Specification left open how the player's position is assigned and set the configurable
values (session-count range, rounds per session, maximum turn length) to the design phase.
API contract v0.3 already describes the flow: the client sends only a session count and the
player chooses a side when a session opens.

## Decision

- The system assigns the topics: a different, randomly chosen catalog topic per session.
- The player chooses a side per session (`POST .../side`), once, while the session is
  `choosing_side`. The `for` side always speaks first, so choosing `against` makes the
  opponent open the debate. The opponent takes the other side.
- Initial values, versioned in `backend/app/content.py`: 1 to 5 sessions per game (never
  more than the catalog has topics), 3 rounds per session, at most 4000 characters per turn.
  `GET /game-config` reports them.
- Every game stores the catalog version it was created from (`CATALOG_VERSION`).
- Every session stores a snapshot of its topic (title, motion and both positions). A later
  catalog change, such as the WBS-3.4 content replacing the placeholder topics, never changes
  what a running or finished game shows. Judge rules (categories, metric limits) are still
  read from the catalog by topic id.
- The catalog is checked by `validate_catalog` in a test and at startup; an invalid catalog
  stops the backend instead of failing during a game.
- Errors carry a stable `code` (contract `Error` schema), so the client can show Turkish
  messages.
- Choosing a side locks the game row (`SELECT ... FOR UPDATE`) until the request commits, so
  two concurrent requests with different sides cannot both succeed; the second answers
  `SIDE_ALREADY_CHOSEN`. WBS-3.2 can reuse the same lock for turns.

## Consequences

- `POST .../side` moved from WBS-3.2 to WBS-3.1, because a v0.3 game cannot be played
  without it. Until WBS-3.2, the round endpoint keeps its v0.2 behaviour and accepts turns
  only while the session is `awaiting_player`; a player who chose `against` waits for the
  opponent-turn endpoint of WBS-3.2.
- New catalog content must pass `validate_catalog` and change `CATALOG_VERSION`.
- Session statuses use up to 19 characters; the column is `VARCHAR(24)`. A test checks it,
  because SQLite in CI does not enforce lengths.
