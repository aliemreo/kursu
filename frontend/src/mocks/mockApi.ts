import type {
  AuthResult,
  CategoryChoice,
  Game,
  GameSummary,
  LeaderboardEntry,
  Metric,
  MetricChange,
  Session,
  Side,
  Speaker,
  Turn,
  User,
  Verdict,
  VictoryStrength,
  Winner,
} from '../types/api';
import type { KursuApi } from '../services/contracts';
import { ApiError, ERROR_MESSAGES, messageFor } from '../lib/errors';
import { tokenStorage } from '../lib/tokenStorage';
import { newUuid } from '../lib/uuid';
import {
  DEMO_USER,
  MAX_DELTA,
  MOCK_GAME_CONFIG,
  MOCK_METRICS,
  MOCK_TOPICS,
  OPPONENT_ARGUMENTS,
} from './mockData';

/*
 * MOCK API: Gerçek backend yokken arayüzün çalışmasını sağlar. contracts/openapi.yaml (v0.3)
 * içindeki oyun akışını taklit eder: taraf seçimi, sırayla konuşma, hakem değerlendirmesi.
 * - Veriler yalnızca bu tarayıcıda, localStorage içinde tutulur.
 * - Hakem kararları ve rakip argümanları sahte, deterministik kurallarla üretilir.
 * - Parola saklama da mock amaçlıdır; gerçek sistemde şifreler hashlenir.
 */

const LATENCY_MS = 300;
const STORAGE_KEY = 'kursu.mockState.v2';
const BASE_DELTA = [4, 3, 2];
const VICTORY_FACTOR: Record<VictoryStrength, number> = {
  narrow: 0.5,
  clear: 1,
  decisive: 1.5,
};

interface StoredUser {
  user: User;
  password: string;
  tokenVersion: number;
}

interface ClientTurn {
  sessionNo: number;
  playerTurnId: string;
  opponentTurnId: string | null;
}

interface StoredGame {
  ownerId: string;
  game: Game;
  verdicts: Record<number, Verdict>;
  clientTurns: Record<string, ClientTurn>;
}

interface MockState {
  users: StoredUser[];
  tokens: Record<string, { userId: string; version: number }>;
  games: Record<string, StoredGame>;
}

function loadState(): MockState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as MockState;
    }
  } catch {
    /* Bozuk veri varsa sıfırdan başlanır. */
  }
  return { users: [], tokens: {}, games: {} };
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Depolama dolu veya kapalıysa mock veriler yalnızca bellekte kalır. */
  }
}

const state: MockState = loadState();
if (state.users.length === 0) {
  state.users.push({
    user: {
      id: newUuid(),
      email: DEMO_USER.email,
      username: DEMO_USER.username,
      created_at: new Date().toISOString(),
    },
    password: DEMO_USER.password,
    tokenVersion: 0,
  });
  persist();
}

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS));
const nowIso = () => new Date().toISOString();
const clone = <T,>(value: T): T => structuredClone(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const opposite = (side: Side): Side => (side === 'for' ? 'against' : 'for');

function fail(status: number, code: keyof typeof ERROR_MESSAGES): never {
  throw new ApiError(status, code, ERROR_MESSAGES[code]);
}

function invalid(message: string): never {
  throw new ApiError(422, 'VALIDATION_ERROR', message);
}

function currentUser(): StoredUser {
  const token = tokenStorage.get();
  const entry = token ? state.tokens[token] : undefined;
  const stored = entry ? state.users.find((u) => u.user.id === entry.userId) : undefined;
  if (!entry || !stored || stored.tokenVersion !== entry.version) {
    fail(401, 'NOT_AUTHENTICATED');
  }
  return stored;
}

/** Oyun yalnızca sahibi tarafından görülebilir. Başkasının oyunu "bulunamadı" döner. */
function ownedGame(gameId: string): StoredGame {
  const { user } = currentUser();
  const entry = state.games[gameId];
  if (!entry || entry.ownerId !== user.id) {
    fail(404, 'GAME_NOT_FOUND');
  }
  return entry;
}

function sessionOf(entry: StoredGame, sessionNo: number): Session {
  const session = entry.game.sessions[sessionNo - 1];
  if (!session) fail(404, 'SESSION_NOT_FOUND');
  return session;
}

function authResult(stored: StoredUser): AuthResult {
  const token = `mock-token-${newUuid()}`;
  state.tokens[token] = { userId: stored.user.id, version: stored.tokenVersion };
  persist();
  return { access_token: token, token_type: 'bearer', user: clone(stored.user) };
}

/** `for` tarafı her zaman önce konuşur; her taraf max_rounds kez konuşur. */
function advance(session: Session): void {
  const total = session.max_rounds * 2;
  session.rounds_played = session.turns.filter((t) => t.speaker === 'player').length;
  if (session.turns.length >= total) {
    session.status = 'awaiting_evaluation';
    session.next_speaker = null;
    return;
  }
  const sideToSpeak: Side = session.turns.length % 2 === 0 ? 'for' : 'against';
  const speaker: Speaker = sideToSpeak === session.player_side ? 'player' : 'opponent';
  session.next_speaker = speaker;
  session.status = speaker === 'player' ? 'awaiting_player' : 'awaiting_opponent';
}

function makeTurn(speaker: Speaker, text: string): Turn {
  return { id: newUuid(), speaker, text, created_at: nowIso(), citations: [] };
}

function addOpponentTurn(session: Session): Turn {
  const ordinal = session.turns.filter((t) => t.speaker === 'opponent').length;
  const side = opposite(session.player_side as Side);
  const argument = OPPONENT_ARGUMENTS[ordinal % OPPONENT_ARGUMENTS.length];
  const turn = makeTurn('opponent', `${argument} Savunduğumuz tez: ${session.topic.positions[side]}`);
  session.turns.push(turn);
  advance(session);
  return turn;
}

/** Mock hakem: karakter uzunluğuna dayalı deterministik bir değerlendirme üretir. */
function judge(session: Session, metrics: Metric[]): Verdict {
  const charsBy = (speaker: Speaker) =>
    session.turns
      .filter((t) => t.speaker === speaker)
      .reduce((total, t) => total + t.text.length, 0);

  const playerChars = charsBy('player');
  const opponentChars = charsBy('opponent');
  const margin = Math.abs(playerChars - opponentChars) / Math.max(playerChars + opponentChars, 1);

  const winner: Winner =
    margin < 0.03 ? 'draw' : playerChars > opponentChars ? 'player' : 'opponent';
  const victoryStrength: VictoryStrength =
    margin < 0.1 ? 'narrow' : margin < 0.25 ? 'clear' : 'decisive';
  const playerSide = session.player_side as Side;
  const adoptedSide: Side | null =
    winner === 'draw' ? null : winner === 'player' ? playerSide : opposite(playerSide);

  const winningTurn = session.turns.find((t) => t.speaker === (winner === 'opponent' ? 'opponent' : 'player'));
  const categories: CategoryChoice[] = [
    { category_id: 'main_benefit', choice_id: adoptedSide === 'for' ? 'social' : 'economic' },
    { category_id: 'main_cost', choice_id: adoptedSide === 'for' ? 'economic' : 'institutional' },
  ];

  const sign = winner === 'player' ? 1 : -1;
  const factor = VICTORY_FACTOR[victoryStrength];
  const deltas =
    winner === 'draw'
      ? []
      : metrics.map((metric, index) => ({
          metric_id: metric.id,
          delta: clamp(Math.round(BASE_DELTA[index % BASE_DELTA.length] * sign * factor), -MAX_DELTA, MAX_DELTA),
          reason: 'Mock hakem: argüman uzunluğu ve tutarlılık.',
        }));

  const metricChanges: MetricChange[] = metrics.map((metric) => {
    const proposed = deltas.find((d) => d.metric_id === metric.id)?.delta ?? null;
    const after = clamp(metric.value + (proposed ?? 0), metric.min, metric.max);
    return {
      metric_id: metric.id,
      name: metric.name,
      before: metric.value,
      proposed_delta: proposed,
      applied_delta: round1(after - metric.value),
      after,
      capped: proposed !== null && after - metric.value !== proposed,
    };
  });

  const narrative =
    winner === 'draw'
      ? 'İki taraf da benzer güçte argümanlar sundu; hakem bir tarafı öne çıkarmadı ve politika değişmedi.'
      : winner === 'player'
        ? 'Savunmanız daha tutarlı, daha iyi kanıtlanmış ve karşı argümanlara daha doğrudan yanıt veren bir yapıya sahipti.'
        : 'Rakibin savunması daha tutarlı ve karşı argümanlara daha doğrudan yanıt veren bir yapıya sahipti.';

  return {
    session_no: session.session_no,
    result_kind: winner === 'draw' ? 'neutral' : 'full',
    qualitative: {
      winner,
      victory_strength: victoryStrength,
      narrative: `${narrative} Bu değerlendirme yalnızca oyun içi bir sonuçtur. (Mock hakem kararı)`,
      categories,
      evidence: winningTurn
        ? [{ turn_id: winningTurn.id, quote: winningTurn.text.slice(0, 140) }]
        : [],
    },
    quantitative: winner === 'draw' ? null : { metric_deltas: deltas },
    rejection_reason: null,
    adopted_side: adoptedSide,
    metric_changes: metricChanges,
    judge_model: 'mock-judge (prompt v0)',
  };
}

function toSummary(game: Game): GameSummary {
  return {
    id: game.id,
    status: game.status,
    session_count: game.session_count,
    completed_sessions: game.sessions.filter((s) => s.status === 'finished').length,
    current_session: game.current_session,
    final_score: game.final_score ?? null,
    created_at: game.created_at,
    finished_at: game.finished_at ?? null,
  };
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const mockApi: KursuApi = {
  async health() {
    return { status: 'ok', version: 'mock', environment: 'mock', llm_provider: 'mock' };
  },

  async register(payload) {
    await wait();
    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim().toLowerCase();

    if (!/^[a-z0-9_.]{3,30}$/.test(username)) invalid(messageFor(422));
    if (!/^\S+@\S+\.\S+$/.test(email)) invalid(messageFor(422));
    if (payload.password.length < 8) invalid(messageFor(422));
    if (state.users.some((u) => u.user.email === email)) {
      throw new ApiError(409, 'REQUEST_FAILED', messageFor(409, undefined, 'Email already registered'));
    }
    if (state.users.some((u) => u.user.username === username)) {
      throw new ApiError(409, 'REQUEST_FAILED', messageFor(409, undefined, 'Username already taken'));
    }

    const stored: StoredUser = {
      user: { id: newUuid(), email, username, created_at: nowIso() },
      password: payload.password,
      tokenVersion: 0,
    };
    state.users.push(stored);
    persist();
    return authResult(stored);
  },

  async login(payload) {
    await wait();
    const email = payload.email.trim().toLowerCase();
    const stored = state.users.find((u) => u.user.email === email);
    if (!stored || stored.password !== payload.password) {
      throw new ApiError(401, 'REQUEST_FAILED', messageFor(401, undefined, 'Wrong email or password'));
    }
    return authResult(stored);
  },

  async logout() {
    await wait();
    const stored = currentUser();
    // Tüm cihazlardaki token'lar geçersiz olur.
    stored.tokenVersion += 1;
    persist();
  },

  async me() {
    await wait();
    return clone(currentUser().user);
  },

  async listTopics() {
    await wait();
    return clone(MOCK_TOPICS);
  },

  async getGameConfig() {
    await wait();
    return clone(MOCK_GAME_CONFIG);
  },

  async listGames() {
    await wait();
    const { user } = currentUser();
    return Object.values(state.games)
      .filter((entry) => entry.ownerId === user.id)
      .map((entry) => toSummary(entry.game))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async createGame(payload) {
    await wait();
    const { user } = currentUser();
    const count = payload.session_count;
    const { min_sessions, max_sessions, rounds_per_session, catalog_version } = MOCK_GAME_CONFIG;

    if (!Number.isInteger(count) || count < min_sessions || count > max_sessions) {
      fail(422, 'INVALID_SESSION_COUNT');
    }

    const game: Game = {
      id: newUuid(),
      status: 'active',
      session_count: count,
      completed_sessions: 0,
      current_session: 1,
      final_score: null,
      created_at: nowIso(),
      finished_at: null,
      catalog_version,
      metrics: MOCK_METRICS.map((m) => ({ id: m.id, name: m.name, value: m.initial, min: m.min, max: m.max })),
      sessions: shuffled(MOCK_TOPICS)
        .slice(0, count)
        .map((topic, index) => ({
          session_no: index + 1,
          topic,
          player_side: null,
          status: index === 0 ? 'choosing_side' : 'pending',
          next_speaker: null,
          rounds_played: 0,
          max_rounds: rounds_per_session,
          turns: [],
          verdict_available: false,
          adopted_side: null,
        })),
    };

    state.games[game.id] = { ownerId: user.id, game, verdicts: {}, clientTurns: {} };
    persist();
    return clone(game);
  },

  async getGame(gameId) {
    await wait();
    const { game } = ownedGame(gameId);
    return clone({ ...game, completed_sessions: toSummary(game).completed_sessions });
  },

  async chooseSide(gameId, sessionNo, side) {
    await wait();
    const entry = ownedGame(gameId);
    const session = sessionOf(entry, sessionNo);

    if (session.player_side !== null) fail(409, 'SIDE_ALREADY_CHOSEN');
    if (session.status !== 'choosing_side') fail(409, 'SESSION_NOT_ACTIVE');

    session.player_side = side;
    advance(session);
    persist();
    return clone(session);
  },

  async submitTurn(gameId, sessionNo, payload) {
    await wait();
    const entry = ownedGame(gameId);
    const session = sessionOf(entry, sessionNo);

    // Aynı client_turn_id ikinci bir tur oluşturmaz; kayıtlı tur geri döner.
    const earlier = entry.clientTurns[payload.client_turn_id];
    if (earlier && earlier.sessionNo === sessionNo) {
      const find = (id: string | null) => session.turns.find((t) => t.id === id) ?? null;
      return clone({
        player_turn: find(earlier.playerTurnId) as Turn,
        opponent_turn: find(earlier.opponentTurnId),
        session,
      });
    }

    if (entry.game.status === 'finished') fail(409, 'GAME_FINISHED');
    if (session.status === 'awaiting_opponent') fail(409, 'NOT_YOUR_TURN');
    if (session.status !== 'awaiting_player') fail(409, 'SESSION_NOT_ACTIVE');

    const text = payload.text.trim();
    if (text.length === 0 || text.length > MOCK_GAME_CONFIG.max_turn_length) {
      invalid(`Argümanınız 1 ile ${MOCK_GAME_CONFIG.max_turn_length} karakter arasında olmalıdır.`);
    }

    const playerTurn = makeTurn('player', text);
    session.turns.push(playerTurn);
    advance(session);
    // advance() durumu değiştirdiği için TypeScript'in önceki daraltması burada geçerli değil.
    const statusAfter = session.status as Session['status'];
    const opponentTurn = statusAfter === 'awaiting_opponent' ? addOpponentTurn(session) : null;

    entry.clientTurns[payload.client_turn_id] = {
      sessionNo,
      playerTurnId: playerTurn.id,
      opponentTurnId: opponentTurn?.id ?? null,
    };
    persist();
    return clone({ player_turn: playerTurn, opponent_turn: opponentTurn, session });
  },

  async requestOpponentTurn(gameId, sessionNo) {
    await wait();
    const entry = ownedGame(gameId);
    const session = sessionOf(entry, sessionNo);

    if (session.status === 'awaiting_player') fail(409, 'NOT_YOUR_TURN');
    if (session.status !== 'awaiting_opponent') fail(409, 'SESSION_NOT_ACTIVE');

    const opponentTurn = addOpponentTurn(session);
    persist();
    return clone({ opponent_turn: opponentTurn, session });
  },

  async evaluateSession(gameId, sessionNo) {
    await wait();
    const entry = ownedGame(gameId);
    const { game } = entry;
    const session = sessionOf(entry, sessionNo);

    // İdempotent: karar zaten varsa yeniden uygulanmaz.
    const existing = entry.verdicts[sessionNo];
    if (existing) {
      return clone({ verdict: existing, game: toSummary(game) });
    }
    if (!['awaiting_evaluation', 'evaluation_failed', 'evaluated'].includes(session.status)) {
      fail(409, 'SESSION_NOT_ACTIVE');
    }

    const verdict = judge(session, game.metrics);
    entry.verdicts[sessionNo] = verdict;
    for (const change of verdict.metric_changes) {
      const metric = game.metrics.find((m) => m.id === change.metric_id);
      if (metric) metric.value = change.after;
    }
    session.status = 'finished';
    session.verdict_available = true;
    session.adopted_side = verdict.adopted_side;

    const next = game.sessions[sessionNo];
    if (next) {
      next.status = 'choosing_side';
      game.current_session = next.session_no;
    } else {
      game.status = 'finished';
      game.finished_at = nowIso();
      game.final_score = round1(game.metrics.reduce((t, m) => t + m.value, 0) / game.metrics.length);
    }
    game.completed_sessions = toSummary(game).completed_sessions;

    persist();
    return clone({ verdict, game: toSummary(game) });
  },

  async getVerdict(gameId, sessionNo) {
    await wait();
    const entry = ownedGame(gameId);
    sessionOf(entry, sessionNo);
    const verdict = entry.verdicts[sessionNo];
    if (!verdict) fail(409, 'EVALUATION_NOT_READY');
    return clone(verdict);
  },

  async getResults(gameId) {
    await wait();
    const entry = ownedGame(gameId);
    const { game } = entry;
    if (game.status !== 'finished') fail(409, 'GAME_NOT_FINISHED');

    return clone({
      game_id: game.id,
      final_score: game.final_score ?? 0,
      final_metrics: game.metrics,
      finished_at: game.finished_at ?? nowIso(),
      sessions: game.sessions.map((s) => {
        const verdict = entry.verdicts[s.session_no];
        return {
          session_no: s.session_no,
          topic_title: s.topic.title,
          player_side: s.player_side as Side,
          winner: verdict.qualitative.winner,
          victory_strength: verdict.qualitative.victory_strength,
          result_kind: verdict.result_kind,
          adopted_side: verdict.adopted_side,
          metric_changes: verdict.metric_changes,
        };
      }),
    });
  },

  async getLeaderboard(limit = 20) {
    await wait();
    const best = new Map<string, number>();
    for (const entry of Object.values(state.games)) {
      const score = entry.game.final_score;
      if (entry.game.status !== 'finished' || score == null) continue;
      best.set(entry.ownerId, Math.max(best.get(entry.ownerId) ?? -Infinity, score));
    }

    const sorted = [...best.entries()].sort((a, b) => b[1] - a[1]);
    // Eşit skorlar aynı sırayı paylaşır (1, 1, 3, ...).
    const ranked = sorted.map(([userId, score]) => ({
      userId,
      entry: {
        rank: sorted.findIndex(([, s]) => s === score) + 1,
        username: state.users.find((u) => u.user.id === userId)?.user.username ?? '?',
        best_score: score,
      } satisfies LeaderboardEntry,
    }));

    let meId: string | null = null;
    try {
      meId = currentUser().user.id;
    } catch {
      /* Sıralama herkese açıktır; token yoksa `me` boş kalır. */
    }

    return {
      entries: ranked.slice(0, limit).map((r) => r.entry),
      me: ranked.find((r) => r.userId === meId)?.entry ?? null,
    };
  },
};
