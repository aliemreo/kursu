import { Link, useParams } from 'react-router-dom';
import { Colonnade } from '../../components/layout/Colonnade';
import { Button } from '../../components/ui/Button';
import { Ornament } from '../../components/ui/Ornament';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Reveal, RevealTitle } from '../../components/ui/Reveal';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { cx } from '../../lib/cx';
import { formatDate, formatDelta } from '../../lib/labels';
import { api } from '../../services';
import type { GameResults, Metric } from '../../types/api';
import { MetricHistoryChart } from './MetricHistoryChart';
import { VerdictCard } from './VerdictCard';

/** Sonuçlar ve her oturumun ayrıntılı hakem kararı birlikte yüklenir. */
async function loadResults(gameId: string) {
  const results = await api.getResults(gameId);
  const verdicts = await Promise.all(
    results.sessions.map((s) => api.getVerdict(gameId, s.session_no)),
  );
  return { results, verdicts };
}

function headline(wins: number, losses: number): string {
  if (wins > losses) return 'Kürsünün hakkını verdiniz!';
  if (wins < losses) return 'Rakip bu kez bir adım öndeydi.';
  return 'Çekişmeli bir münazara oldu.';
}

export function ResultsPage() {
  const { gameId = '' } = useParams();
  const { data, error, loading, reload } = useAsync(() => loadResults(gameId), [gameId]);

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

  const { results, verdicts } = data;
  const count = (winner: string) => results.sessions.filter((s) => s.winner === winner).length;
  const wins = count('player');
  const draws = count('draw');
  const losses = count('opponent');

  return (
    <div className="page">
      <section className="stage bleed surface-dark" aria-labelledby="score-title">
        <Colonnade className="stage__arch" />
        <div className="container stage__inner score-hero">
          <ScoreRing results={results} />
          <div className="score-hero__text">
            <p className="eyebrow eyebrow--gold">
              Oyun tamamlandı · {formatDate(results.finished_at)}
            </p>
            <RevealTitle id="score-title" className="display" text={headline(wins, losses)} />
            <ul className="tally" aria-label="Oturum sonuçları">
              <li className="tally__item tally__item--win">
                <strong>{wins}</strong> galibiyet
              </li>
              <li className="tally__item">
                <strong>{draws}</strong> beraberlik
              </li>
              <li className="tally__item tally__item--loss">
                <strong>{losses}</strong> mağlubiyet
              </li>
            </ul>
            <div className="row">
              <Link to="/games/new" className="btn btn--gold btn--lg">
                Yeni oyun başlat
              </Link>
              <Link to="/leaderboard" className="btn btn--on-dark">
                Sıralamada yerinizi görün
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="final-metrics-title">
        <Reveal>
          <header className="section-head">
            <h2 id="final-metrics-title" className="section-title">
              Son metrik değerleri
            </h2>
          </header>
        </Reveal>
        <div className="metric-grid">
          {results.final_metrics.map((metric, index) => (
            <Reveal key={metric.id} delay={index * 90}>
              <MetricCard metric={metric} start={startValue(results, metric.id)} />
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <section className="card chart-card" aria-labelledby="history-title">
          <h2 id="history-title" className="section-title">
            Metrik gelişimi
          </h2>
          <MetricHistoryChart metrics={results.final_metrics} sessions={results.sessions} />
        </section>
      </Reveal>

      <Ornament />

      <section className="section" aria-labelledby="sessions-title">
        <Reveal>
          <header className="section-head">
            <h2 id="sessions-title" className="section-title">
              Oturum oturum hakem kararları
            </h2>
            <span className="section-head__count">{results.sessions.length}</span>
          </header>
        </Reveal>
        {results.sessions.map((session, index) => (
          <Reveal key={session.session_no}>
            <VerdictCard
              verdict={verdicts[index]}
              topicTitle={session.topic_title}
              playerSide={session.player_side}
            />
          </Reveal>
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

function startValue(results: GameResults, metricId: string): number | null {
  const first = results.sessions[0]?.metric_changes.find((c) => c.metric_id === metricId);
  return first ? first.before : null;
}

function MetricCard({ metric, start }: { metric: Metric; start: number | null }) {
  const delta = start === null ? 0 : metric.value - start;
  return (
    <div className="metric-card">
      <span className="metric-card__name">{metric.name}</span>
      <span className="metric-card__value">
        {metric.value}
        {start !== null && (
          <span className={cx('delta', delta > 0 && 'delta--up', delta < 0 && 'delta--down')}>
            {formatDelta(delta)}
          </span>
        )}
      </span>
      <ProgressBar
        value={metric.value - metric.min}
        max={metric.max - metric.min}
        label={start !== null ? `Başlangıç: ${start}` : `${metric.min} - ${metric.max}`}
      />
    </div>
  );
}

/** Nihai skoru metrik ölçeğine göre dolan bir halka olarak gösterir. */
function ScoreRing({ results }: { results: GameResults }) {
  const min = Math.min(...results.final_metrics.map((m) => m.min), 0);
  const max = Math.max(...results.final_metrics.map((m) => m.max), 100);
  const ratio = Math.min(1, Math.max(0, (results.final_score - min) / (max - min || 1)));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="score-ring"
      role="img"
      aria-label={`Nihai skor ${results.final_score} / ${max}`}
    >
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="score-ring__track" cx="64" cy="64" r={radius} />
        <circle
          className="score-ring__fill"
          cx="64"
          cy="64"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <span className="score-ring__value">
        {results.final_score}
        <small>nihai skor</small>
      </span>
    </div>
  );
}
