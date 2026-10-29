import { cx } from '../../lib/cx';
import { METRIC_LABELS, SPEAKER_LABELS, VICTORY_LABELS } from '../../lib/labels';
import type { GameResultSession } from '../../types/api';
import { METRIC_KEYS } from './MetricHistoryChart';

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '0';
}

export function VerdictCard({ result }: { result: GameResultSession }) {
  const { verdict } = result;

  return (
    <article className="card verdict" aria-labelledby={`verdict-${result.sessionId}`}>
      <div className="verdict__head">
        <div>
          <p className="verdict__meta">Tur {result.index + 1}</p>
          <h3 id={`verdict-${result.sessionId}`}>{result.topicTitle}</h3>
        </div>
        <div className="row">
          <span className="badge badge--winner">{SPEAKER_LABELS[verdict.winner]} kazandı</span>
          <span className="badge badge--pending">{VICTORY_LABELS[verdict.victoryStrength]}</span>
        </div>
      </div>

      <p>{verdict.outcomeNarrative}</p>

      <ul className="chips" aria-label="Değerlendirme kategorileri">
        {verdict.categories.map((category) => (
          <li key={category}>{category}</li>
        ))}
      </ul>

      <ul className="delta-list" aria-label="Metrik değişimleri">
        {METRIC_KEYS.map((key) => {
          const before = verdict.metricsBefore[key];
          const after = verdict.metricsAfter[key];
          const delta = after - before;
          return (
            <li key={key} className="delta-row">
              <span>{METRIC_LABELS[key]}</span>
              <span>
                {before} → {after}
              </span>
              <span className={cx('delta', delta > 0 && 'delta--up', delta < 0 && 'delta--down')}>
                {formatDelta(delta)}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}