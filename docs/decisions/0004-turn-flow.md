# 0004: Turn flow, resent turns and AI waiting times

- **Status:** accepted
- **Date:** 2026-11-25

## Context

WBS-3.2 turns the debate into a state machine (FR-06 to FR-08). The v0.2 round stored the
player's turn and the opponent's reply in one transaction, so an opponent failure lost the
player's text, the `against` side could not be played, and a resent request could store a
turn twice. A model reply can take up to a minute, and the frontend gives up on an AI request
after 120 seconds. The Requirements Specification left the AI timeout and retry limit to the
design phase.

## Decision

- **Speaking order.** The `for` side takes the even turns and speaks first; each side speaks
  `max_rounds` times. After the last turn the session is `awaiting_evaluation`, so a player on
  the `against` side closes the debate without a reply. One function (`game.advance`) derives
  the status from the stored turns.
- **Two steps per round.** The player's turn is committed before the opponent is asked, so it
  survives an opponent failure; the session then stays `awaiting_opponent` and the client calls
  the opponent-turn endpoint.
- **No lock while the model works.** An opponent turn is made in three phases: check the state
  under the game row lock and release it, ask the model outside any transaction, then store the
  turn under the lock only if no other request stored it meanwhile. Otherwise the stored turn is
  returned, so concurrent requests all answer with the same turn. The unique `(session_id, seq)`
  constraint is the last guard.
- **Resent turns.** The client sends a `client_turn_id` with every player turn, unique per
  session in the database. A request with a known id answers 200 with the stored round, even if
  its text differs or the session has moved on.
- **Input.** Turn text is stripped before the checks, so whitespace-only text is empty. An empty
  opponent reply counts as a failed try.
- **Waiting times.** Each model call may take `AI_TIMEOUT_SECONDS` (45 s), and a failed opponent
  reply is tried `OPPONENT_RETRIES` (1) more time: at most about 90 s, below the frontend's
  120 s. The engine abandons a try after the timeout even if the adapter does not enforce
  it (the call runs in a small thread pool); adapters should still time out themselves and
  raise `OpponentUnavailable`, because an abandoned call keeps its worker until it returns.
- **No interim evaluation.** The judge no longer runs after the last turn. Until the evaluation
  endpoint of WBS-3.3, a closed session stays `awaiting_evaluation` and the game cannot move to
  its next session; nobody reviews the prototype in that time.

## Consequences

- A request can now commit twice (player turn, opponent turn); it is no longer all-or-nothing,
  by design.
- Concurrency is checked on PostgreSQL only: SQLite in CI ignores `FOR UPDATE`.
- The judge rules (`judge_session`, `validate_verdict`, `apply_deltas`) stay in `game.py` with
  unit tests until WBS-3.3 calls them again.
