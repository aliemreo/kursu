import { STATUS_LABELS } from '../../lib/labels';
import type { GameStatus, SessionStatus } from '../../types/api';

export function StatusBadge({ status }: { status: GameStatus | SessionStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>;
}