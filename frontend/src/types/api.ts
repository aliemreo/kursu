/* Frontend ile backend arasındaki veri sözleşmesi. Mock ve gerçek API bu tipleri kullanır. */

export type MetricKey = 'social_cohesion' | 'economic_stability' | 'institutional_trust';
export type MetricSnapshot = Record<MetricKey, number>;

export type Speaker = 'player' | 'opponent';
export type Stance = 'for' | 'against';
export type SessionStatus = 'pending' | 'in_progress' | 'completed';
export type GameStatus = 'in_progress' | 'completed';
export type VictoryStrength = 'narrow' | 'clear' | 'decisive';

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Topic {
  id: string;
  title: string;
  category: string;
  summary: string;
  positions: Record<Stance, string>;
}

export interface Turn {
  id: string;
  speaker: Speaker;
  content: string;
  turnNumber: number;
  createdAt: string;
}

/**
 * Hakem değerlendirmesi, proje planındaki iki aşamalı yapıyı yansıtır:
 * 1) Niteliksel değerlendirme: kazanan, zafer gücü, anlatı ve kategoriler
 * 2) Niceliksel değerlendirme: sınırlı metrik değişimleri (metricsBefore -> metricsAfter)
 */
export interface JudgeVerdict {
  winner: Speaker;
  victoryStrength: VictoryStrength;
  outcomeNarrative: string;
  categories: string[];
  metricsBefore: MetricSnapshot;
  metricsAfter: MetricSnapshot;
}

export interface DebateSession {
  id: string;
  index: number;
  topic: Topic;
  playerStance: Stance;
  status: SessionStatus;
  maxTurns: number;
  turns: Turn[];
  verdict: JudgeVerdict | null;
}

export interface Game {
  id: string;
  title: string;
  status: GameStatus;
  sessionCount: number;
  currentSessionIndex: number;
  sessions: DebateSession[];
  metrics: MetricSnapshot;
  createdAt: string;
}

export interface GameSummary {
  id: string;
  title: string;
  status: GameStatus;
  sessionCount: number;
  completedSessions: number;
  createdAt: string;
}

export interface CreateGameRequest {
  topicIds: string[];
}

export interface GameResultSession {
  sessionId: string;
  index: number;
  topicTitle: string;
  verdict: JudgeVerdict;
}

export interface GameResults {
  gameId: string;
  finalScore: number;
  finalMetrics: MetricSnapshot;
  sessions: GameResultSession[];
}

export interface HealthResponse {
  status: 'ok';
}

export interface ApiErrorBody {
  code: string;
  message: string;
}