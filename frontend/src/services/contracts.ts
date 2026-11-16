import type {
  AuthResult,
  CreateGameRequest,
  Credentials,
  EvaluationResult,
  Game,
  GameConfig,
  GameResults,
  GameSummary,
  HealthResponse,
  Leaderboard,
  OpponentTurnResult,
  Registration,
  Session,
  Side,
  Topic,
  TurnRequest,
  TurnResult,
  User,
  Verdict,
} from '../types/api';

/**
 * Mock ve gerçek API'nin uygulaması zorunlu olan ortak arayüz.
 * Her metot contracts/openapi.yaml içindeki bir endpoint'e karşılık gelir.
 * Ekranlar yalnızca bu arayüzü bilir.
 */
export interface KursuApi {
  health(): Promise<HealthResponse>;
  register(payload: Registration): Promise<AuthResult>;
  login(payload: Credentials): Promise<AuthResult>;
  logout(): Promise<void>;
  me(): Promise<User>;
  listTopics(): Promise<Topic[]>;
  getGameConfig(): Promise<GameConfig>;
  listGames(): Promise<GameSummary[]>;
  createGame(payload: CreateGameRequest): Promise<Game>;
  getGame(gameId: string): Promise<Game>;
  chooseSide(gameId: string, sessionNo: number, side: Side): Promise<Session>;
  submitTurn(gameId: string, sessionNo: number, payload: TurnRequest): Promise<TurnResult>;
  requestOpponentTurn(gameId: string, sessionNo: number): Promise<OpponentTurnResult>;
  evaluateSession(gameId: string, sessionNo: number): Promise<EvaluationResult>;
  getVerdict(gameId: string, sessionNo: number): Promise<Verdict>;
  getResults(gameId: string): Promise<GameResults>;
  getLeaderboard(limit?: number): Promise<Leaderboard>;
}
