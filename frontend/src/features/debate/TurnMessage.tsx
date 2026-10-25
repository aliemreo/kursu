import { SPEAKER_LABELS } from '../../lib/labels';
import { cx } from '../../lib/cx';
import type { Turn } from '../../types/api';

export function TurnMessage({ turn }: { turn: Turn }) {
  const isPlayer = turn.speaker === 'player';

  return (
    <li className={cx('turn', isPlayer ? 'turn--player' : 'turn--opponent')}>
      <div className="turn__meta">
        <span>{SPEAKER_LABELS[turn.speaker]}</span>
        <span>Argüman {turn.turnNumber}</span>
      </div>
      <p className="turn__bubble">{turn.content}</p>
    </li>
  );
}