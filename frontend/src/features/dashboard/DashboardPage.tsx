import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services';
import type { GameSummary } from '../../types/api';
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.listGames(), []);

  return (
    <div className="stack-lg">
      <section className="card hero">
        <div>
          <p className="eyebrow">Hoş geldiniz</p>
          <h1>Merhaba, {user?.displayName}</h1>
          <p className="muted">
            Bir konu seçin, yapay zekâ rakibine karşı münazaraya girin ve hakemin kararını görün.
          </p>
        </div>
        <Link to="/games/new" className="btn btn--primary">
          Yeni münazara başlat
        </Link>
      </section>

      <section className="stack" aria-labelledby="games-title">
        <h2 id="games-title">Önceki oyunlar</h2>

        {loading && <LoadingState label="Oyunlar yükleniyor…" />}
        {error && <ErrorState message={error} onRetry={reload} />}

        {data && data.length === 0 && (
          <EmptyState
            title="Henüz oyun yok"
            description="İlk münazaranızı başlatmak için bir konu seçin."
            action={
              <Link to="/games/new" className="btn btn--primary">
                Konu seç
              </Link>
            }
          />
        )}

        {data && data.length > 0 && (
          <ul className="game-list">
            {data.map((game) => (
              <GameItem key={game.id} game={game} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GameItem({ game }: { game: GameSummary }) {
  const isCompleted = game.status === 'completed';

  return (
    <li>
      <Card className="game-card">
        <div className="game-card__body">
          <div className="game-card__head">
            <h3>{game.title}</h3>
            <StatusBadge status={game.status} />
          </div>
          <span className="game-card__date">
            {new Date(game.createdAt).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <ProgressBar
            value={game.completedSessions}
            max={game.sessionCount}
            label={`${game.completedSessions} / ${game.sessionCount} tur tamamlandı`}
          />
        </div>
        <Link
          to={isCompleted ? `/games/${game.id}/results` : `/games/${game.id}`}
          className="btn btn--secondary"
        >
          {isCompleted ? 'Sonuçları gör' : 'Devam et'}
        </Link>
      </Card>
    </li>
  );
}