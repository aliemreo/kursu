/*
 * Frontend ile backend arasındaki veri sözleşmesi. contracts/openapi.yaml (v0.3) ile birebir
 * aynı alan adlarını kullanır; sözleşme değişirse önce orası, sonra bu dosya güncellenir.
 * Mock ve gerçek API bu tipleri kullanır.
 */

export type Side = 'for' | 'against';
export type Speaker = 'player' | 'opponent';
export type Winner = 'player' | 'opponent' | 'draw';
export type VictoryStrength = 'narrow' | 'clear' | 'decisive';
export type ResultKind = 'full' | 'narrative_only' | 'neutral';
export type GameStatus = 'active' | 'finished';
export type SessionStatus =
  | 'pending'
  | 'choosing_side'
  | 'awaiting_player'
  | 'awaiting_opponent'
  | 'awaiting_evaluation'
  | 'evaluation_failed'
  | 'evaluated'
  | 'finished';

export type ErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'GAME_NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'INVALID_SESSION_COUNT'
  | 'SIDE_ALREADY_CHOSEN'
  | 'NOT_YOUR_TURN'
  | 'SESSION_NOT_ACTIVE'
  | 'GAME_FINISHED'
  | 'GAME_NOT_FINISHED'
  | 'OPPONENT_UNAVAILABLE'
  | 'EVALUATION_FAILED'
  | 'EVALUATION_NOT_READY';

/** Hata gövdesi. 422 doğrulama hatalarında `detail` bir listedir ve `code` yoktur. */
export interface ApiErrorBody {
  detail: string | unknown[];
  code?: ErrorCode;
}

export interface HealthResponse {
  status: string;
  version: string;
  environment?: string;
  llm_provider?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  username: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface AuthResult {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Topic {
  id: string;
  title: string;
  motion: string;
  positions: Record<Side, string>;
}

export interface Metric {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
}

export interface GameConfig {
  min_sessions: number;
  max_sessions: number;
  rounds_per_session: number;
  max_turn_length: number;
  catalog_version: string;
}

export interface CreateGameRequest {
  session_count: number;
}

export interface GameSummary {
  id: string;
  status: GameStatus;
  session_count: number;
  completed_sessions: number;
  current_session: number;
  final_score?: number | null;
  created_at: string;
  finished_at?: string | null;
}

export interface Citation {
  speech_id: string;
  speaker?: string | null;
  date?: string | null;
  excerpt: string;
}

export interface Turn {
  id: string;
  speaker: Speaker;
  text: string;
  created_at: string;
  citations: Citation[];
}

export interface Session {
  session_no: number;
  topic: Topic;
  player_side: Side | null;
  status: SessionStatus;
  next_speaker: Speaker | null;
  rounds_played: number;
  max_rounds: number;
  turns: Turn[];
  verdict_available: boolean;
  adopted_side: Side | null;
}

export interface Game extends GameSummary {
  catalog_version: string;
  metrics: Metric[];
  sessions: Session[];
}

export interface TurnRequest {
  text: string;
  client_turn_id: string;
}

export interface TurnResult {
  player_turn: Turn;
  opponent_turn: Turn | null;
  session: Session;
}

export interface OpponentTurnResult {
  opponent_turn: Turn;
  session: Session;
}

export interface CategoryChoice {
  category_id: string;
  choice_id: string;
  explanation?: string | null;
}

export interface Evidence {
  turn_id: string;
  quote: string;
}

/** Hakemin 1. aşaması: dökümün tamamına dayalı niteliksel değerlendirme. */
export interface JudgeQualitative {
  winner: Winner;
  victory_strength: VictoryStrength;
  narrative: string;
  categories: CategoryChoice[];
  evidence?: Evidence[];
}

export interface MetricDelta {
  metric_id: string;
  delta: number;
  reason?: string | null;
}

/** Hakemin 2. aşaması: sınırlı metrik değişim önerileri. */
export interface JudgeQuantitative {
  metric_deltas: MetricDelta[];
}

export interface MetricChange {
  metric_id: string;
  name: string;
  before: number;
  proposed_delta: number | null;
  applied_delta: number;
  after: number;
  capped: boolean;
}

export interface Verdict {
  session_no: number;
  result_kind: ResultKind;
  qualitative: JudgeQualitative;
  quantitative: JudgeQuantitative | null;
  rejection_reason?: string | null;
  adopted_side: Side | null;
  metric_changes: MetricChange[];
  judge_model: string;
}

export interface EvaluationResult {
  verdict: Verdict;
  game: GameSummary;
}

export interface SessionResult {
  session_no: number;
  topic_title: string;
  player_side: Side;
  winner: Winner;
  victory_strength: VictoryStrength;
  result_kind: ResultKind;
  adopted_side: Side | null;
  metric_changes: MetricChange[];
}

export interface GameResults {
  game_id: string;
  final_score: number;
  final_metrics: Metric[];
  sessions: SessionResult[];
  finished_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  best_score: number;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}
