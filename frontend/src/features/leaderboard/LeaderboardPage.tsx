import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { RevealTitle } from '../../components/ui/Reveal';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { cx } from '../../lib/cx';
import { api } from '../../services';
import { useAuth } from '../auth/AuthContext';

/** Oyuncular en iyi nihai skorlarına göre sıralanır; yalnızca kullanıcı adı ve skor görünür. */
export function LeaderboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.getLeaderboard(20), []);

  return (
    <div className="stack-lg">
      <header className="page-header">
        <p className="eyebrow">Sıralama</p>
        <RevealTitle className="display display--ink" text="Kürsünün en iyileri" />
        <p className="lead lead--ink">
          Her oyuncunun tamamladığı oyunlar arasındaki en yüksek nihai skoru.
        </p>
      </header>

      {loading && <LoadingState label="Sıralama yükleniyor…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && data.me && !data.entries.some((e) => e.username === data.me?.username) && (
        <Alert tone="info">
          Sizin sıranız: <strong>{data.me.rank}.</strong> · En iyi skor {data.me.best_score}
        </Alert>
      )}

      {data && data.entries.length === 0 && (
        <EmptyState
          title="Henüz tamamlanmış oyun yok"
          description="Bir oyunu bitiren ilk oyuncu sıralamada yer alır."
          action={
            <Link to="/games/new" className="btn btn--primary">
              Oyun başlat
            </Link>
          }
        />
      )}

      {data && data.entries.length > 0 && (
        <div className="card table-card reveal is-visible">
          <table className="leaderboard">
            <thead>
              <tr>
                <th scope="col">Sıra</th>
                <th scope="col">Oyuncu</th>
                <th scope="col" className="leaderboard__score">
                  En iyi skor
                </th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => {
                const isMe = entry.username === user?.username;
                return (
                  <tr
                    key={entry.username}
                    className={cx(isMe && 'leaderboard__me')}
                    aria-current={isMe ? 'true' : undefined}
                  >
                    <td>
                      <span className={cx('rank', entry.rank <= 3 && `rank--${entry.rank}`)}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="leaderboard__player">
                      <span className="avatar avatar--sm" aria-hidden="true">
                        {entry.username.slice(0, 1).toUpperCase()}
                      </span>
                      {entry.username}
                      {isMe && <span className="muted"> (siz)</span>}
                    </td>
                    <td className="leaderboard__score">{entry.best_score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
