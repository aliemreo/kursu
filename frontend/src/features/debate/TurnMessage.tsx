import { SPEAKER_LABELS } from '../../lib/labels';
import { cx } from '../../lib/cx';
import type { Turn } from '../../types/api';

interface TurnMessageProps {
  turn: Turn;
  number: number;
  /** Sunucu yanıtı beklenen, henüz kaydedilmemiş argüman. */
  pending?: boolean;
}

export function TurnMessage({ turn, number, pending = false }: TurnMessageProps) {
  const isPlayer = turn.speaker === 'player';

  return (
    <li
      className={cx('turn', isPlayer ? 'turn--player' : 'turn--opponent', pending && 'turn--pending')}
    >
      <span className={cx('avatar', !isPlayer && 'avatar--opponent')} aria-hidden="true">
        {isPlayer ? 'S' : 'YZ'}
      </span>
      <div className="turn__content">
        <div className="turn__meta">
          <span>{SPEAKER_LABELS[turn.speaker]}</span>
          <span>{pending ? 'Gönderiliyor…' : `Konuşma ${number}`}</span>
        </div>
        <p className="turn__bubble">{turn.text}</p>
        {turn.citations.length > 0 && (
          <ul className="citations" aria-label="Kaynak konuşmalar (ParlaMint-TR)">
            {turn.citations.map((citation) => (
              <li key={citation.speech_id}>
                <q>{citation.excerpt}</q>
                <span className="citations__meta">
                  {[citation.speaker, citation.date, citation.speech_id].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
