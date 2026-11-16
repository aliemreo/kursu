import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../lib/errors';
import { tokenStorage } from '../lib/tokenStorage';
import { newUuid } from '../lib/uuid';
import { mockApi } from './mockApi';
import { DEMO_USER } from './mockData';

async function loginDemo() {
  const result = await mockApi.login({ email: DEMO_USER.email, password: DEMO_USER.password });
  tokenStorage.set(result.access_token);
  return result;
}

const turn = (text: string) => ({ text, client_turn_id: newUuid() });

describe('mockApi (contract v0.3 game flow)', () => {
  beforeEach(() => tokenStorage.clear());

  it('plays a full one-session game as the "for" side', async () => {
    await loginDemo();
    const game = await mockApi.createGame({ session_count: 1 });
    expect(game.sessions[0].status).toBe('choosing_side');

    const session = await mockApi.chooseSide(game.id, 1, 'for');
    expect(session.status).toBe('awaiting_player');

    let last = session;
    for (let round = 0; round < session.max_rounds; round += 1) {
      const result = await mockApi.submitTurn(game.id, 1, turn(`Argüman ${round} `.repeat(20)));
      last = result.session;
      // "for" speaks first, so the opponent answers every turn, closing words included.
      expect(result.opponent_turn).not.toBeNull();
    }
    expect(last.status).toBe('awaiting_evaluation');

    const evaluation = await mockApi.evaluateSession(game.id, 1);
    expect(evaluation.game.status).toBe('finished');
    expect(evaluation.verdict.metric_changes).toHaveLength(game.metrics.length);

    // Evaluating again returns the same verdict without applying it twice.
    const again = await mockApi.evaluateSession(game.id, 1);
    expect(again.verdict).toEqual(evaluation.verdict);

    const results = await mockApi.getResults(game.id);
    expect(results.final_score).toBe(evaluation.game.final_score);
  });

  it('lets the opponent open when the player chooses "against"', async () => {
    await loginDemo();
    const game = await mockApi.createGame({ session_count: 1 });
    const session = await mockApi.chooseSide(game.id, 1, 'against');
    expect(session.status).toBe('awaiting_opponent');

    await expect(mockApi.submitTurn(game.id, 1, turn('Erken söz'))).rejects.toMatchObject({
      code: 'NOT_YOUR_TURN',
    });
    const { session: after } = await mockApi.requestOpponentTurn(game.id, 1);
    expect(after.status).toBe('awaiting_player');

    // The player speaks last; that turn closes the session without an opponent reply.
    for (let round = 0; round < after.max_rounds; round += 1) {
      const result = await mockApi.submitTurn(game.id, 1, turn(`Yanıt ${round}`));
      expect(result.opponent_turn === null).toBe(round === after.max_rounds - 1);
    }
  });

  it('does not store a resent turn twice', async () => {
    await loginDemo();
    const game = await mockApi.createGame({ session_count: 1 });
    await mockApi.chooseSide(game.id, 1, 'for');

    const payload = turn('Aynı argüman');
    const first = await mockApi.submitTurn(game.id, 1, payload);
    const second = await mockApi.submitTurn(game.id, 1, payload);
    expect(second.player_turn.id).toBe(first.player_turn.id);
    expect(second.session.turns).toHaveLength(first.session.turns.length);
  });

  it('rejects a session count outside /game-config', async () => {
    await loginDemo();
    const config = await mockApi.getGameConfig();
    await expect(
      mockApi.createGame({ session_count: config.max_sessions + 1 }),
    ).rejects.toMatchObject({ code: 'INVALID_SESSION_COUNT' });
  });

  it('invalidates every token on logout', async () => {
    const { access_token } = await loginDemo();
    const other = await mockApi.login({ email: DEMO_USER.email, password: DEMO_USER.password });
    await mockApi.logout();

    for (const token of [access_token, other.access_token]) {
      tokenStorage.set(token);
      await expect(mockApi.me()).rejects.toBeInstanceOf(ApiError);
    }
  });
});
