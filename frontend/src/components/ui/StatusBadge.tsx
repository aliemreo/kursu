import { GAME_STATUS_LABELS, SESSION_STATUS_LABELS } from '../../lib/labels';
import type { GameStatus, SessionStatus } from '../../types/api';

type BadgeStatus = { kind: 'game'; status: GameStatus } | { kind: 'session'; status: SessionStatus };

export function StatusBadge(props: BadgeStatus) {
  const label =
    props.kind === 'game' ? GAME_STATUS_LABELS[props.status] : SESSION_STATUS_LABELS[props.status];
  return <span className={`badge badge--${props.status}`}>{label}</span>;
}
