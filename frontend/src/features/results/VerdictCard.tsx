import { cx } from '../../lib/cx';
import {
  CATEGORY_LABELS,
  CHOICE_LABELS,
  RESULT_KIND_LABELS,
  SIDE_LABELS,
  VICTORY_LABELS,
  WINNER_LABELS,
  formatDelta,
} from '../../lib/labels';
import type { Side, Verdict } from '../../types/api';

interface VerdictCardProps {
  verdict: Verdict;
  topicTitle: string;
  playerSide: Side | null;
  /** Karar ilk kez açıklanıyorsa daha belirgin gösterilir. */
  highlight?: boolean;
}

/** Bir oturumun iki aşamalı hakem kararı: niteliksel değerlendirme ve metrik değişimleri. */
export function VerdictCard({ verdict, topicTitle, playerSide, highlight = false }: VerdictCardProps) {
  const { qualitative } = verdict;
  const titleId = `verdict-${verdict.session_no}`;

  return (
    <article
      className={cx('card verdict', `verdict--${qualitative.winner}`, highlight && 'verdict--highlight')}
      aria-labelledby={titleId}
    >
      <header className="verdict__band">
        <div>
          <p className="verdict__meta">
            Oturum {verdict.session_no} · {topicTitle}
            {playerSide && ` · Tarafınız: ${SIDE_LABELS[playerSide]}`}
          </p>
          <h3 id={titleId} className="verdict__title">
            {WINNER_LABELS[qualitative.winner]}
          </h3>
        </div>
        {qualitative.winner !== 'draw' && (
          <span className="verdict__strength">{VICTORY_LABELS[qualitative.victory_strength]}</span>
        )}
      </header>

      <section className="verdict__stage" aria-label="1. aşama: niteliksel değerlendirme">
        <p className="verdict__stage-title">
          <span className="verdict__step">1</span> Hakemin değerlendirmesi
        </p>
        <p className="verdict__narrative">{qualitative.narrative}</p>

        {qualitative.categories.length > 0 && (
          <ul className="chips" aria-label="Sonuç kategorileri">
            {qualitative.categories.map((c) => (
              <li key={c.category_id} title={c.explanation ?? undefined}>
                <span className="chips__key">{CATEGORY_LABELS[c.category_id] ?? c.category_id}</span>
                {CHOICE_LABELS[c.choice_id] ?? c.choice_id}
              </li>
            ))}
          </ul>
        )}

        {qualitative.evidence && qualitative.evidence.length > 0 && (
          <div className="evidence">
            <p className="evidence__title">Hakemin dayandığı alıntılar</p>
            {qualitative.evidence.map((e) => (
              <blockquote key={e.turn_id}>{e.quote}</blockquote>
            ))}
          </div>
        )}
      </section>

      <section className="verdict__stage" aria-label="2. aşama: metrik değişimleri">
        <p className="verdict__stage-title">
          <span className="verdict__step">2</span> Metriklere etkisi
        </p>
        <p className="muted">
          {RESULT_KIND_LABELS[verdict.result_kind]}
          {verdict.adopted_side
            ? ` · Kabul edilen politika: ${SIDE_LABELS[verdict.adopted_side]}`
            : ' · Politika değişmedi'}
        </p>
        {verdict.rejection_reason && (
          <p className="field__hint">Öneri uygulanmadı: {verdict.rejection_reason}</p>
        )}

        <ul className="delta-list" aria-label="Metrik değişimleri">
          {verdict.metric_changes.map((change) => (
            <li key={change.metric_id} className="delta-row">
              <span className="delta-row__name">
                {change.name}
                {change.capped && (
                  <span className="badge badge--capped" title="Metriğin sınırı önerilen değişimi kesti">
                    sınırlandı
                  </span>
                )}
              </span>
              <span className="delta-row__values">
                {change.before} → <strong>{change.after}</strong>
                {change.proposed_delta !== null && change.proposed_delta !== change.applied_delta && (
                  <span className="muted"> (önerilen {formatDelta(change.proposed_delta)})</span>
                )}
              </span>
              <span
                className={cx(
                  'delta',
                  change.applied_delta > 0 && 'delta--up',
                  change.applied_delta < 0 && 'delta--down',
                )}
              >
                {formatDelta(change.applied_delta)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="verdict__footer">
        Kurgusal oyun sonucu; gerçek politika etkileri hakkında tahmin değildir · Hakem:{' '}
        {verdict.judge_model}
      </p>
    </article>
  );
}
