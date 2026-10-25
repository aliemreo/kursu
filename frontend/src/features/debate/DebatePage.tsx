import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { toUserMessage } from '../../lib/errors';
import { SPEAKER_LABELS, VICTORY_LABELS } from '../../lib/labels';
import { api } from '../../services';
import type { Stance } from '../../types/api';
import { TurnMessage } from './TurnMessage';

/** Gerçek API'nin de aynı sınırı uygulaması gerekir (backend tarafında da doğrulanır). */
const MAX_TURN_LENGTH = 1200;

const STANCE_LABELS: Record<Stance, string> = {
  for: 'Lehinde',
  against: 'Aleyhinde',
};

export function DebatePage() {
  const { gameId = '' } = useParams();
  const { data: game, error, loading, reload, setData } = useAsync(
    () => api.getGame(gameId),
    [gameId],
  );

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const activeSession = game?.sessions[game.currentSessionIndex];
  const turnCount = activeSession?.turns.length ?? 0;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [turnCount]);

  if (loading) return <LoadingState label="Münazara yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!game || !activeSession) return null;
  if (game.status === 'completed') {
    return <Navigate to={`/games/${game.id}/results`} replace />;
  }

  const session = activeSession;
  const previousVerdict = game.sessions[game.currentSessionIndex - 1]?.verdict ?? null;
  const opponentStance: Stance = session.playerStance === 'for' ? 'against' : 'for';

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const text = draft.trim();

    if (text.length === 0) {
      setSendError('Argümanınızı yazmadan gönderemezsiniz.');
      return;
    }
    if (text.length > MAX_TURN_LENGTH) {
      setSendError(`Argümanınız en fazla ${MAX_TURN_LENGTH} karakter olabilir.`);
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const updated = await api.submitTurn(game.id, session.id, text);
      setData(updated);
      setDraft('');
    } catch (err) {
      setSendError(toUserMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="debate">
      <header className="debate__header">
        <div>
          <p className="eyebrow">
            Tur {session.index + 1} / {game.sessionCount}
          </p>
          <h1>{session.topic.title}</h1>
          <p className="muted">{session.topic.summary}</p>
        </div>

        <div className="stance-panel" aria-label="Taraflar">
          <div className="stance stance--player">
            <span className="stance__label">Siz · {STANCE_LABELS[session.playerStance]}</span>
            <strong>{session.topic.positions[session.playerStance]}</strong>
          </div>
          <div className="stance stance--opponent">
            <span className="stance__label">Yapay zekâ · {STANCE_LABELS[opponentStance]}</span>
            <strong>{session.topic.positions[opponentStance]}</strong>
          </div>
        </div>
      </header>

      {previousVerdict && (
        <Alert tone="info" title="Önceki tur sonucu">
          {SPEAKER_LABELS[previousVerdict.winner]} kazandı ·{' '}
          {VICTORY_LABELS[previousVerdict.victoryStrength]}. Ayrıntıları sonuç ekranında
          görebilirsiniz.
        </Alert>
      )}

      <ProgressBar
        value={turnCount}
        max={session.maxTurns}
        label={`Tur ilerlemesi: ${turnCount} / ${session.maxTurns} argüman`}
      />

      <section aria-label="Münazara konuşması">
        {session.turns.length === 0 ? (
          <EmptyState
            title="Münazara başlıyor"
            description="İlk argümanı siz sunun. Tezinizi açık ve gerekçeli yazmanız değerlendirmeyi kolaylaştırır."
          />
        ) : (
          <ol className="thread" aria-live="polite">
            {session.turns.map((turn) => (
              <TurnMessage key={turn.id} turn={turn} />
            ))}
            <div ref={threadEndRef} />
          </ol>
        )}
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <label htmlFor="turn-input" className="field__label">
          Argümanınız
        </label>
        <textarea
          id="turn-input"
          className="textarea"
          rows={4}
          maxLength={MAX_TURN_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          aria-describedby="turn-help"
          placeholder="Tezinizi ve gerekçelerinizi yazın…"
        />
        <div className="composer__footer">
          <span id="turn-help" className="field__hint">
            {draft.length} / {MAX_TURN_LENGTH} · Ctrl+Enter ile gönderin
          </span>
          <Button type="submit" loading={sending} disabled={!draft.trim()}>
            Gönder
          </Button>
        </div>
        {sendError && <Alert tone="error">{sendError}</Alert>}
      </form>
    </div>
  );
}