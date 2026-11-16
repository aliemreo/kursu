import { Link } from 'react-router-dom';
import { Colonnade } from '../../components/layout/Colonnade';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Reveal, RevealTitle } from '../../components/ui/Reveal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { formatDate } from '../../lib/labels';
import { api } from '../../services';
import type { GameSummary } from '../../types/api';
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.listGames(), []);

  const games = data ?? [];
  // Liste en yeniden eskiye gelir; numaralar en eskiden başlar.
  const numberOf = (game: GameSummary) => games.length - games.indexOf(game);
  const active = games.filter((g) => g.status === 'active');
  const finished = games.filter((g) => g.status === 'finished');
  const resume = active[0];
  const scores = finished.map((g) => g.final_score).filter((s): s is number => s != null);
  const best = scores.length > 0 ? Math.max(...scores) : null;

  return (
    <div className="page">
      <section className="stage bleed surface-dark" aria-labelledby="welcome-title">
        <Colonnade className="stage__arch" />
        <div className="container stage__inner">
          <div className="stage__text">
            <p className="eyebrow eyebrow--gold">Meclis açıldı</p>
            <RevealTitle
              id="welcome-title"
              className="display"
              text={`Hoş geldiniz, ${user?.username ?? ''}`}
            />
            <p className="lead">
              Tarafınızı seçin, yapay zekâ rakibine karşı tezinizi savunun ve bağımsız hakemin
              kararını dinleyin.
            </p>
          </div>

          {resume ? (
            <ResumeCard game={resume} number={numberOf(resume)} />
          ) : (
            data && (
              <Reveal delay={300} className="stage__cta">
                <Link to="/games/new" className="btn btn--gold btn--lg">
                  Yeni oyun başlat
                </Link>
              </Reveal>
            )
          )}
        </div>
      </section>

      {loading && <LoadingState label="Oyunlar yükleniyor…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && data.length > 0 && (
        <Reveal>
          <ul className="stat-grid" aria-label="Özet">
            <li className="stat">
              <span className="stat__value">{games.length}</span>
              <span className="stat__label">Oynanan oyun</span>
            </li>
            <li className="stat">
              <span className="stat__value">{finished.length}</span>
              <span className="stat__label">Tamamlanan</span>
            </li>
            <li className="stat">
              <span className="stat__value">{best ?? '–'}</span>
              <span className="stat__label">En iyi skor</span>
            </li>
          </ul>
        </Reveal>
      )}

      {data && data.length === 0 && (
        <Reveal>
          <EmptyState
            title="Kürsü sizi bekliyor"
            description="İlk oyununuzu başlatmak için oturum sayısını seçmeniz yeterli. Bir oturum birkaç dakika sürer."
            action={
              <Link to="/games/new" className="btn btn--primary">
                İlk oyunu başlat
              </Link>
            }
          />
        </Reveal>
      )}

      {active.length > 1 && (
        <GameSection title="Devam eden oyunlar" games={active.slice(1)} numberOf={numberOf} />
      )}
      {finished.length > 0 && (
        <GameSection title="Tamamlanan oyunlar" games={finished} numberOf={numberOf} />
      )}
    </div>
  );
}

/** Yarım kalan en son oyun: panelin tek ve belirgin birincil eylemi. */
function ResumeCard({ game, number }: { game: GameSummary; number: number }) {
  return (
    <Reveal delay={250} className="resume-card">
      <p className="eyebrow eyebrow--gold">Yarım kalan oyun</p>
      <h2 className="resume-card__title">
        Oyun {number}
        <span>{game.current_session}. oturum sizi bekliyor</span>
      </h2>
      <ProgressBar
        value={game.completed_sessions}
        max={game.session_count}
        label={`${game.completed_sessions} / ${game.session_count} oturum tamamlandı`}
      />
      <div className="resume-card__actions">
        <Link to={`/games/${game.id}`} className="btn btn--gold btn--lg">
          Kaldığınız yerden devam edin
        </Link>
        <Link to="/games/new" className="btn btn--on-dark">
          Yeni oyun
        </Link>
      </div>
    </Reveal>
  );
}

function GameSection({
  title,
  games,
  numberOf,
}: {
  title: string;
  games: GameSummary[];
  numberOf: (game: GameSummary) => number;
}) {
  return (
    <section className="section" aria-label={title}>
      <Reveal>
        <header className="section-head">
          <h2 className="section-title">{title}</h2>
          <span className="section-head__count">{games.length}</span>
        </header>
      </Reveal>
      <ul className="game-list">
        {games.map((game, index) => (
          <GameItem
            key={game.id}
            game={game}
            number={numberOf(game)}
            delay={Math.min(index, 6) * 70}
          />
        ))}
      </ul>
    </section>
  );
}

function GameItem({ game, number, delay }: { game: GameSummary; number: number; delay: number }) {
  const isFinished = game.status === 'finished';

  return (
    <Reveal as="li" className="game-card" delay={delay}>
      <span className="game-card__no">{String(number).padStart(2, '0')}</span>
      <div className="game-card__body">
        <div className="game-card__head">
          <h3>Oyun {number}</h3>
          <StatusBadge kind="game" status={game.status} />
        </div>
        <span className="game-card__date">
          {formatDate(game.created_at)} · {game.session_count} oturum
        </span>
        {!isFinished && (
          <ProgressBar
            value={game.completed_sessions}
            max={game.session_count}
            label={`${game.completed_sessions} / ${game.session_count} oturum tamamlandı`}
          />
        )}
      </div>
      {isFinished && (
        <span className="game-card__score">
          {game.final_score ?? '–'}
          <small>skor</small>
        </span>
      )}
      <Link
        to={isFinished ? `/games/${game.id}/results` : `/games/${game.id}`}
        className="btn btn--secondary"
      >
        {isFinished ? 'Sonuçlar' : 'Devam et'}
      </Link>
    </Reveal>
  );
}
