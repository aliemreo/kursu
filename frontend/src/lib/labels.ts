import type {
  GameStatus,
  ResultKind,
  SessionStatus,
  Side,
  Speaker,
  VictoryStrength,
  Winner,
} from '../types/api';

export const SPEAKER_LABELS: Record<Speaker, string> = {
  player: 'Siz',
  opponent: 'Yapay zekâ rakibi',
};

export const WINNER_LABELS: Record<Winner, string> = {
  player: 'Siz kazandınız',
  opponent: 'Rakip kazandı',
  draw: 'Berabere',
};

export const SIDE_LABELS: Record<Side, string> = {
  for: 'Lehinde',
  against: 'Aleyhinde',
};

export const VICTORY_LABELS: Record<VictoryStrength, string> = {
  narrow: 'Dar fark',
  clear: 'Net üstünlük',
  decisive: 'Belirgin üstünlük',
};

export const RESULT_KIND_LABELS: Record<ResultKind, string> = {
  full: 'Metrik değişimleri uygulandı',
  narrative_only: 'Yalnızca anlatı: metrikler değişmedi',
  neutral: 'Öngörülmeyen sonuç: nötr kural uygulandı',
};

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  active: 'Devam ediyor',
  finished: 'Tamamlandı',
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  pending: 'Sırada',
  choosing_side: 'Taraf seçimi',
  awaiting_player: 'Sıra sizde',
  awaiting_opponent: 'Rakip yanıtlıyor',
  awaiting_evaluation: 'Hakem bekleniyor',
  evaluation_failed: 'Değerlendirme başarısız',
  evaluated: 'Karar uygulanıyor',
  finished: 'Tamamlandı',
};

/**
 * Hakem kategorileri ve seçenekleri. Bilinmeyen kimlikler olduğu gibi gösterilir;
 * gerçek liste WBS-3.4 ile backend'de netleşir.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  main_benefit: 'Temel kazanım',
  main_cost: 'Temel maliyet',
};

export const CHOICE_LABELS: Record<string, string> = {
  social: 'Toplumsal',
  economic: 'Ekonomik',
  institutional: 'Kurumsal',
  other: 'Diğer',
};

export const opposite = (side: Side): Side => (side === 'for' ? 'against' : 'for');

export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0) return `+${rounded}`;
  return `${rounded}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
