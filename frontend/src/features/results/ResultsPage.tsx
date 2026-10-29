import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { METRIC_LABELS } from '../../lib/labels';
import { api } from '../../services';
import { METRIC_KEYS, MetricHistoryChart } from './MetricHistoryChart';
import { VerdictCard } from './VerdictCard';

export function ResultsPage() {
  const { gameId = '' } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.getResults(gameId), [gameId]);

  if (loading) return <LoadingState label="Sonuçlar hazırlanıyor…" />;
  if (error) {
    return (
      <div className="stack-lg">
        <ErrorState message={error} onRetry={reload} />
        <Link to={`/games/${gameId}`} className="btn btn--secondary">
          Münazaraya dön
        </Link>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="stack-lg">
      <section className="card hero">
        <div>
          <p className="eyebrow">Oyun tamamlandı</p>
          <h1>Nihai skor: {data.finalScore}</h1>
          <p className="muted">
            Skor, üç metriğin son değerlerinin ortalamasıdır. Bu sonuçlar bir oyun çıktısıdır;
            gerçek politika etkileri hakkında tahmin içermez.
          </p>
        </div>
        <div className="row">
          <Link to="/" className="btn btn--secondary">
            Panele dön
          </Link>
          <Link to="/games/new" className="btn btn--primary">
            Yeni münazara
          </Link>
        </div>
      </section>

      <section className="stack" aria-labelledby="final-metrics-title">
        <h2 id="final-metrics-title">Son metrik değerleri</h2>
        <div className="metric-grid">
          {METRIC_KEYS.map((key) => (
            <div key={key} className="metric-card">
              <span className="muted">{METRIC_LABELS[key]}</span>
              <span className="metric-card__value">{data.finalMetrics[key]}</span>
              <ProgressBar value={data.finalMetrics[key]} max={100} label="0 - 100 ölçeği" />
            </div>
          ))}
        </div>
      </section>

      <section className="card stack" aria-labelledby="history-title">
        <h2 id="history-title">Metrik gelişimi</h2>
        <MetricHistoryChart sessions={data.sessions} />
      </section>

      <section className="stack" aria-labelledby="sessions-title">
        <h2 id="sessions-title">Tur sonuçları</h2>
        {data.sessions.map((result) => (
          <VerdictCard key={result.sessionId} result={result} />
        ))}
      </section>

      <div className="row">
        <Link to="/" className="btn btn--ghost">
          Panele dön
        </Link>
        <Button variant="secondary" onClick={() => window.print()}>
          Yazdır
        </Button>
      </div>
    </div>
  );
}