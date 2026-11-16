import { http } from '../lib/httpClient';
import type { KursuApi } from './contracts';
import type {
  AuthResult,
  EvaluationResult,
  Game,
  GameConfig,
  GameResults,
  GameSummary,
  HealthResponse,
  Leaderboard,
  OpponentTurnResult,
  Session,
  Topic,
  TurnResult,
  User,
  Verdict,
} from '../types/api';

const enc = (value: string) => encodeURIComponent(value);
const sessionPath = (gameId: string, sessionNo: number) =>
  `/games/${enc(gameId)}/sessions/${sessionNo}`;

/** Yapay zekâ çağrıları (rakip, hakem) normal isteklerden uzun sürebilir. */
const AI_TIMEOUT_MS = 120000;

/**
 * Gerçek backend'e giden çağrılar. Endpoint sözleşmesi contracts/openapi.yaml dosyasındadır.
 * Bu fonksiyonlar yalnızca VITE_USE_MOCKS=false iken kullanılır.
 */
export const liveApi: KursuApi = {
  async health() {
    const { data } = await http.get<HealthResponse>('/health');
    return data;
  },
  async register(payload) {
    const { data } = await http.post<AuthResult>('/auth/register', payload);
    return data;
  },
  async login(payload) {
    const { data } = await http.post<AuthResult>('/auth/login', payload);
    return data;
  },
  async logout() {
    await http.post('/auth/logout');
  },
  async me() {
    const { data } = await http.get<User>('/auth/me');
    return data;
  },
  async listTopics() {
    const { data } = await http.get<Topic[]>('/topics');
    return data;
  },
  async getGameConfig() {
    const { data } = await http.get<GameConfig>('/game-config');
    return data;
  },
  async listGames() {
    const { data } = await http.get<GameSummary[]>('/games');
    return data;
  },
  async createGame(payload) {
    const { data } = await http.post<Game>('/games', payload);
    return data;
  },
  async getGame(gameId) {
    const { data } = await http.get<Game>(`/games/${enc(gameId)}`);
    return data;
  },
  async chooseSide(gameId, sessionNo, side) {
    const { data } = await http.post<Session>(`${sessionPath(gameId, sessionNo)}/side`, { side });
    return data;
  },
  async submitTurn(gameId, sessionNo, payload) {
    const { data } = await http.post<TurnResult>(`${sessionPath(gameId, sessionNo)}/turns`, payload, {
      timeout: AI_TIMEOUT_MS,
    });
    return data;
  },
  async requestOpponentTurn(gameId, sessionNo) {
    const { data } = await http.post<OpponentTurnResult>(
      `${sessionPath(gameId, sessionNo)}/opponent-turn`,
      undefined,
      { timeout: AI_TIMEOUT_MS },
    );
    return data;
  },
  async evaluateSession(gameId, sessionNo) {
    const { data } = await http.post<EvaluationResult>(
      `${sessionPath(gameId, sessionNo)}/evaluation`,
      undefined,
      { timeout: AI_TIMEOUT_MS },
    );
    return data;
  },
  async getVerdict(gameId, sessionNo) {
    const { data } = await http.get<Verdict>(`${sessionPath(gameId, sessionNo)}/verdict`);
    return data;
  },
  async getResults(gameId) {
    const { data } = await http.get<GameResults>(`/games/${enc(gameId)}/results`);
    return data;
  },
  async getLeaderboard(limit = 20) {
    const { data } = await http.get<Leaderboard>('/leaderboard', { params: { limit } });
    return data;
  },
};
