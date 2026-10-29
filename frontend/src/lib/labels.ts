import type {
  GameStatus,
  MetricKey,
  SessionStatus,
  Speaker,
  VictoryStrength,
} from '../types/api';

export const METRIC_LABELS: Record<MetricKey, string> = {
  social_cohesion: 'Toplumsal uyum',
  economic_stability: 'Ekonomik istikrar',
  institutional_trust: 'Kurumsal güven',
};

export const SPEAKER_LABELS: Record<Speaker, string> = {
  player: 'Siz',
  opponent: 'Yapay zekâ rakibi',
};

export const VICTORY_LABELS: Record<VictoryStrength, string> = {
  narrow: 'Dar fark',
  clear: 'Net üstünlük',
  decisive: 'Belirgin üstünlük',
};

export const STATUS_LABELS: Record<GameStatus | SessionStatus, string> = {
  pending: 'Bekliyor',
  in_progress: 'Devam ediyor',
  completed: 'Tamamlandı',
};