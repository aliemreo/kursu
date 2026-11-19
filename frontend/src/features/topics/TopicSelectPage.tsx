import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { RevealTitle } from '../../components/ui/Reveal';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { cx } from '../../lib/cx';
import { toUserMessage } from '../../lib/errors';
import { api } from '../../services';

const RECOMMENDED_SESSIONS = 3;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Yeni oyun ekranı. Oyuncu yalnızca oturum sayısını seçer; sistem her oturuma farklı bir
 * katalog konusu atar (contracts/openapi.yaml, POST /games). Taraf her oturumun başında seçilir.
 */
export function TopicSelectPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.getGameConfig(), api.listTopics()]),
    [],
  );
  const [config, topics] = data ?? [null, null];

  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (config && sessionCount === null) {
      setSessionCount(Math.min(RECOMMENDED_SESSIONS, config.max_sessions));
    }
  }, [config, sessionCount]);

  async function handleCreate() {
    if (sessionCount === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const game = await api.createGame({ session_count: sessionCount });
      navigate(`/games/${game.id}`);
    } catch (err) {
      setSubmitError(toUserMessage(err));
      setSubmitting(false);
    }
  }

  const options = config
    ? Array.from(
        { length: config.max_sessions - config.min_sessions + 1 },
        (_, i) => config.min_sessions + i,
      )
    : [];

  return (
    <div className="stack-lg narrow">
      <header className="page-header">
        <p className="eyebrow">Yeni oyun</p>
        <RevealTitle className="display display--ink" text="Kaç oturum oynamak istersiniz?" />
        <p className="lead lead--ink">
          Her oturumda katalogdan farklı bir konu gelir. Tarafınızı oturum başında seçersiniz.
        </p>
      </header>

      {loading && <LoadingState label="Oyun ayarları yükleniyor…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {config && (
        <section className="card stack" aria-labelledby="count-title">
          <h2 id="count-title" className="section-title">
            Oturum sayısı
          </h2>
          <div className="count-picker" role="radiogroup" aria-labelledby="count-title">
            {options.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={sessionCount === n}
                className={cx(
                  'count-picker__option',
                  sessionCount === n && 'count-picker__option--selected',
                )}
                onClick={() => setSessionCount(n)}
                disabled={submitting}
              >
                <span className="count-picker__value">{n}</span>
                {n === RECOMMENDED_SESSIONS && <span className="count-picker__tag">Önerilen</span>}
              </button>
            ))}
          </div>

          {sessionCount !== null && (
            <ul className="summary-list" aria-label="Oyun özeti">
              <li>
                <strong>{sessionCount}</strong> farklı konu
              </li>
              <li>
                <strong>{sessionCount * config.rounds_per_session}</strong> argüman yazacaksınız
              </li>
              <li>
                Argüman başına en fazla <strong>{config.max_turn_length}</strong> karakter
              </li>
            </ul>
          )}
        </section>
      )}

      {topics && (
        <details className="card disclosure">
          <summary>
            <span>Konu kataloğu</span>
            <span className="muted">{topics.length} konu · rastgele atanır</span>
          </summary>
          <div className="topic-grid">
            {topics.map((topic, index) => (
              <article key={topic.id} className="topic-card topic-card--static">
                <span className="topic-card__no">{ROMAN[index] ?? index + 1}</span>
                <span className="topic-card__title">{topic.title}</span>
                <span className="topic-card__summary">{topic.motion}</span>
                <span className="topic-card__positions">
                  <span>
                    <strong>Lehinde:</strong> {topic.positions.for}
                  </span>
                  <span>
                    <strong>Aleyhinde:</strong> {topic.positions.against}
                  </span>
                </span>
              </article>
            ))}
          </div>
        </details>
      )}

      {submitError && <Alert tone="error">{submitError}</Alert>}

      {config && (
        <div className="action-bar">
          <Link to="/" className="btn btn--ghost">
            Vazgeç
          </Link>
          <Button
            className="btn--lg"
            onClick={handleCreate}
            disabled={sessionCount === null}
            loading={submitting}
          >
            {sessionCount ?? ''} oturumlu oyunu başlat
          </Button>
        </div>
      )}
    </div>
  );
}
