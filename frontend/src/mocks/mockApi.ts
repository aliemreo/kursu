import type {
  AuthResponse,
  DebateSession,
  Game,
  GameResults,
  GameResultSession,
  GameSummary,
  JudgeVerdict,
  MetricKey,
  MetricSnapshot,
  SessionStatus,
  Speaker,
  Stance,
  Topic,
  Turn,
  User,
  VictoryStrength,
} from '../types/api';
import type { KursuApi } from '../services/contracts';
import { ApiError } from '../lib/errors';
import { tokenStorage } from '../lib/tokenStorage';
import {
  DEMO_USER,
  INITIAL_METRICS,
  MAX_DELTA,
  MAX_TURN_LENGTH,
  METRIC_BOUNDS,
  MOCK_TOPICS,
  OPPONENT_ARGUMENTS,
  TURNS_PER_SESSION,
  VERDICT_CATEGORIES,
} from './mockData';

/*
 * MOCK API: Gerçek backend yokken arayüzün çalışmasını sağlar.
 * - Veriler yalnızca bu tarayıcıda, localStorage içinde tutulur.
 * - Hakem kararları ve rakip argümanları sahte, deterministik kurallarla üretilir.
 * - Parola saklama da mock amaçlıdır; gerçek sistemde şifreler hashlenir.
 */

const LATENCY_MS = 300;
const STORAGE_KEY = 'kursu.mockState.v1';
const METRIC_KEYS: MetricKey[] = ['social_cohesion', 'economic_stability', 'institutional_trust'];
const BASE_DELTA: MetricSnapshot = {
  social_cohesion: 4,
  economic_stability: 3,
  institutional_trust: 2,
};
const VICTORY_FACTOR: Record<VictoryStrength, number> = {
  narrow: 0.5,
  clear: 1,
  decisive: 1.5,
};

interface StoredUser {
  user: User;
  password: string;
}

interface StoredGame {
  ownerId: string;
  game: Game;
}

interface MockState {
  users: StoredUser[];
  tokens: Record<string, string>;
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

let state: MockState = loadState();
if (state.users.length === 0) {
  state.users.push({
    user: { id: 'usr_demo', email: DEMO_USER.email, displayName: DEMO_USER.displayName },
    password: DEMO_USER.password,
  });
  persist();
}

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS));
const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();
const clone = <T,>(value: T): T => structuredClone(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function userFromToken(): User {
  const token = tokenStorage.get();
  const userId = token ? state.tokens[token] : undefined;
  const stored = userId ? state.users.find((u) => u.user.id === userId) : undefined;
  if (!stored) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
  }
  return stored.user;
}

/** Oyun yalnızca sahibi tarafından görülebilir. Yetkisiz erişimde varlık bilgisi sızdırılmaz. */
function ownedGame(gameId: string): StoredGame {
  const user = userFromToken();
  const entry = state.games[gameId];
  if (!entry || entry.ownerId !== user.id) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Oyun bulunamadı.');
  }
  return entry;
}

function authResponse(user: User): AuthResponse {
  const token = newId('mock-token');
  state.tokens[token] = user.id;
  persist();
  return { accessToken: token, user };
}

function buildSession(topic: Topic, index: number, status: SessionStatus): DebateSession {
  const playerStance: Stance = index % 2 === 0 ? 'for' : 'against';
  return {
    id: newId('ses'),
    index,
    topic,
    playerStance,
    status,
    maxTurns: TURNS_PER_SESSION,
    turns: [],
    verdict: null,
  };
}

function makeTurn(speaker: Speaker, content: string, turnNumber: number): Turn {
  return { id: newId('turn'), speaker, content, turnNumber, createdAt: nowIso() };
}

function opponentReply(session: DebateSession, ordinal: number): string {
  const opponentStance: Stance = session.playerStance === 'for' ? 'against' : 'for';
  const argument = OPPONENT_ARGUMENTS[ordinal % OPPONENT_ARGUMENTS.length];
  return `${argument} Savunduğumuz tez: ${session.topic.positions[opponentStance]}`;
}

/** Mock hakem: karakter uzunluğuna dayalı deterministik bir değerlendirme üretir. */
function judgeSession(session: DebateSession, before: MetricSnapshot): JudgeVerdict {
  const charsBy = (speaker: Speaker) =>
    session.turns
      .filter((t) => t.speaker === speaker)
      .reduce((total, t) => total + t.content.length, 0);

  const playerChars = charsBy('player');
  const opponentChars = charsBy('opponent');
  const total = Math.max(playerChars + opponentChars, 1);
  const margin = Math.abs(playerChars - opponentChars) / total;

  const victoryStrength: VictoryStrength =
    margin < 0.1 ? 'narrow' : margin < 0.25 ? 'clear' : 'decisive';
  const winner: Speaker = playerChars > opponentChars ? 'player' : 'opponent';
  const sign = winner === 'player' ? 1 : -1;
  const factor = VICTORY_FACTOR[victoryStrength];

  const metricsAfter: MetricSnapshot = { ...before };
  for (const key of METRIC_KEYS) {
    const delta = clamp(Math.round(BASE_DELTA[key] * sign * factor), -MAX_DELTA, MAX_DELTA);
    metricsAfter[key] = clamp(before[key] + delta, METRIC_BOUNDS.min, METRIC_BOUNDS.max);
  }

  const narrative =
    winner === 'player'
      ? 'Savunmanız daha tutarlı, daha iyi kanıtlanmış ve karşı argümanlara daha doğrudan yanıt veren bir yapıya sahipti.'
      : 'Rakibin savunması daha tutarlı ve karşı argümanlara daha doğrudan yanıt veren bir yapıya sahipti.';

  return {
    winner,
    victoryStrength,
    outcomeNarrative: `${narrative} Bu değerlendirme yalnızca oyun içi bir sonuçtur; gerçek politikalar hakkında tahmin içermez. (Mock hakem kararı)`,
    categories: [
      VERDICT_CATEGORIES[0],
      winner === 'player' ? VERDICT_CATEGORIES[1] : VERDICT_CATEGORIES[2],
    ],
    metricsBefore: { ...before },
    metricsAfter,
  };
}

function finalizeSession(game: Game, session: DebateSession): void {
  session.verdict = judgeSession(session, game.metrics);
  session.status = 'completed';
  game.metrics = { ...session.verdict.metricsAfter };

  const next = game.sessions[session.index + 1];
  if (next) {
    next.status = 'in_progress';
    game.currentSessionIndex = next.index;
  } else {
    game.status = 'completed';
  }
}

function toSummary(game: Game): GameSummary {
  return {
    id: game.id,
    title: game.title,
    status: game.status,
    sessionCount: game.sessionCount,
    completedSessions: game.sessions.filter((s) => s.status === 'completed').length,
    createdAt: game.createdAt,
  };
}

export const mockApi: KursuApi = {
  async health() {
    return { status: 'ok' };
  },

  async register(payload) {
    await wait();
    const email = payload.email.trim().toLowerCase();
    const displayName = payload.displayName.trim();

    if (displayName.length < 2) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Ad soyad en az 2 karakter olmalıdır.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Geçerli bir e-posta adresi girin.');
    }
    if (payload.password.length < 8) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Şifre en az 8 karakter olmalıdır.');
    }
    if (state.users.some((u) => u.user.email === email)) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'Bu e-posta adresiyle zaten bir hesap var.');
    }

    const user: User = { id: newId('usr'), email, displayName };
    state.users.push({ user, password: payload.password });
    persist();
    return clone(authResponse(user));
  },

  async login(payload) {
    await wait();
    const email = payload.email.trim().toLowerCase();
    const stored = state.users.find((u) => u.user.email === email);
    if (!stored || stored.password !== payload.password) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.');
    }
    return clone(authResponse(stored.user));
  },

  async me() {
    await wait();
    return clone(userFromToken());
  },

  async listTopics() {
    await wait();
    return clone(MOCK_TOPICS);
  },

  async listGames() {
    await wait();
    const user = userFromToken();
    return Object.values(state.games)
      .filter((entry) => entry.ownerId === user.id)
      .map((entry) => toSummary(entry.game))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createGame(payload) {
    await wait();
    const user = userFromToken();
    const ids = payload.topicIds;

    if (ids.length < 1 || ids.length > 5) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Bir oyun için 1 ile 5 konu arasında seçim yapmalısınız.');
    }
    if (new Set(ids).size !== ids.length) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Aynı konu birden fazla kez seçilemez.');
    }

    const topics: Topic[] = [];
    for (const id of ids) {
      const topic = MOCK_TOPICS.find((t) => t.id === id);
      if (!topic) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Seçilen konulardan biri bulunamadı.');
      }
      topics.push(topic);
    }

    const game: Game = {
      id: newId('game'),
      title: `${topics.length} konulu münazara`,
      status: 'in_progress',
      sessionCount: topics.length,
      currentSessionIndex: 0,
      sessions: topics.map((topic, index) =>
        buildSession(topic, index, index === 0 ? 'in_progress' : 'pending'),
      ),
      metrics: { ...INITIAL_METRICS },
      createdAt: nowIso(),
    };

    state.games[game.id] = { ownerId: user.id, game };
    persist();
    return clone(game);
  },

  async getGame(gameId) {
    await wait();
    return clone(ownedGame(gameId).game);
  },

  async submitTurn(gameId, sessionId, content) {
    await wait();
    const { game } = ownedGame(gameId);
    const session = game.sessions.find((s) => s.id === sessionId);

    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Münazara oturumu bulunamadı.');
    }
    if (session.status !== 'in_progress') {
      throw new ApiError(409, 'SESSION_NOT_ACTIVE', 'Bu münazara turu şu anda aktif değil.');
    }

    const text = content.trim();
    if (text.length === 0 || text.length > MAX_TURN_LENGTH) {
      throw new ApiError(
        422,
        'INVALID_TURN',
        `Argümanınız 1 ile ${MAX_TURN_LENGTH} karakter arasında olmalıdır.`,
      );
    }

    session.turns.push(makeTurn('player', text, session.turns.length + 1));

    if (session.turns.length < session.maxTurns) {
      const turnNumber = session.turns.length + 1;
      const ordinal = turnNumber / 2 - 1;
      session.turns.push(makeTurn('opponent', opponentReply(session, ordinal), turnNumber));
    }

    if (session.turns.length >= session.maxTurns) {
      finalizeSession(game, session);
    }

    persist();
    return clone(game);
  },

  async getResults(gameId) {
    await wait();
    const { game } = ownedGame(gameId);

    if (game.status !== 'completed') {
      throw new ApiError(409, 'GAME_NOT_COMPLETED', 'Sonuçlar, oyun tamamlandığında hazır olur.');
    }

    const finalScore = Math.round(
      METRIC_KEYS.reduce((total, key) => total + game.metrics[key], 0) / METRIC_KEYS.length,
    );

    const sessions: GameResultSession[] = game.sessions.flatMap((s) =>
      s.verdict
        ? [{ sessionId: s.id, index: s.index, topicTitle: s.topic.title, verdict: s.verdict }]
        : [],
    );

    const results: GameResults = {
      gameId: game.id,
      finalScore,
      finalMetrics: game.metrics,
      sessions,
    };
    return clone(results);
  },
};