import { http } from '../lib/httpClient';
import type { KursuApi } from './contracts';
import type {
  AuthResponse,
  CreateGameRequest,
  Game,
  GameResults,
  GameSummary,
  HealthResponse,
  LoginRequest,
  RegisterRequest,
  Topic,
  User,
} from '../types/api';

const enc = (value: string) => encodeURIComponent(value);

/**
 * Gerçek backend'e giden çağrılar. Endpoint sözleşmesi docs/api-contract.md dosyasında tanımlanır.
 * Bu fonksiyonlar yalnızca VITE_USE_MOCKS=false iken kullanılır.
 */
export const liveApi: KursuApi = {
  async health() {
    const { data } = await http.get<HealthResponse>('/health');
    return data;
  },
  async register(payload: RegisterRequest) {
    const { data } = await http.post<AuthResponse>('/auth/register', payload);
    return data;
  },
  async login(payload: LoginRequest) {
    const { data } = await http.post<AuthResponse>('/auth/login', payload);
    return data;
  },
  async me() {
    const { data } = await http.get<User>('/auth/me');
    return data;
  },
  async listTopics() {
    const { data } = await http.get<Topic[]>('/topics');
    return data;
  },
  async listGames() {
    const { data } = await http.get<GameSummary[]>('/games');
    return data;
  },
  async createGame(payload: CreateGameRequest) {
    const { data } = await http.post<Game>('/games', payload);
    return data;
  },
  async getGame(gameId: string) {
    const { data } = await http.get<Game>(`/games/${enc(gameId)}`);
    return data;
  },
  async submitTurn(gameId: string, sessionId: string, content: string) {
    const { data } = await http.post<Game>(
      `/games/${enc(gameId)}/sessions/${enc(sessionId)}/turns`,
      { content },
    );
    return data;
  },
  async getResults(gameId: string) {
    const { data } = await http.get<GameResults>(`/games/${enc(gameId)}/results`);
    return data;
  },
};