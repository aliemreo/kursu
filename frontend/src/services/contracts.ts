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

/**
 * Mock ve gerçek API'nin uygulaması zorunlu olan ortak arayüz.
 * Ekranlar yalnızca bu arayüzü bilir.
 */
export interface KursuApi {
  health(): Promise<HealthResponse>;
  register(payload: RegisterRequest): Promise<AuthResponse>;
  login(payload: LoginRequest): Promise<AuthResponse>;
  me(): Promise<User>;
  listTopics(): Promise<Topic[]>;
  listGames(): Promise<GameSummary[]>;
  createGame(payload: CreateGameRequest): Promise<Game>;
  getGame(gameId: string): Promise<Game>;
  submitTurn(gameId: string, sessionId: string, content: string): Promise<Game>;
  getResults(gameId: string): Promise<GameResults>;
}