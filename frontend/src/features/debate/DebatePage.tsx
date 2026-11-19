import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VavMark } from '../../components/ui/VavMark';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { cx } from '../../lib/cx';
import { isApiError, toUserMessage } from '../../lib/errors';
import { SIDE_LABELS, opposite } from '../../lib/labels';
import { newUuid } from '../../lib/uuid';
import { api } from '../../services';
import type { Game, Session, Side, Verdict } from '../../types/api';
import { VerdictCard } from '../results/VerdictCard';
import { TurnMessage } from './TurnMessage';

/** /game-config yüklenemezse kullanılır; backend aynı sınırı ayrıca doğrular. */
const FALLBACK_MAX_TURN_LENGTH = 4000;

type Busy = 'side' | 'send' | 'opponent' | 'evaluate' | null;

const EVALUATION_STATUSES = ['awaiting_evaluation', 'evaluation_failed', 'evaluated'];

export function DebatePage() {
  const { gameId = '' } = useParams();
  const {
    data: game,
    error,
    loading,
    reload,
    setData,
  } = useAsync(() => api.getGame(gameId), [gameId]);
  const { data: config } = useAsync(() => api.getGameConfig(), []);
  const maxTurnLength = config?.max_turn_length ?? FALLBACK_MAX_TURN_LENGTH;

  const [draft, setDraft] = useState('');
  // Gönderilen argüman sunucu yanıtını beklemeden konuşmada gösterilir.
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastVerdict, setLastVerdict] = useState<{
    verdict: Verdict;
    topicTitle: string;
    side: Side | null;
  } | null>(null);
  // Aynı argüman tekrar gönderilirse aynı kimlik kullanılır; backend ikinci bir tur oluşturmaz.
  const clientTurnId = useRef(newUuid());
  const autoRequested = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const session = game?.sessions[game.current_session - 1];
  const turnCount = session?.turns.length ?? 0;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [turnCount, busy, pendingText]);

  const replaceSession = useCallback(
    (current: Game, updated: Session) => {
      setData({
        ...current,
        sessions: current.sessions.map((s) => (s.session_no === updated.session_no ? updated : s)),
      });
    },
    [setData],
  );

  const requestOpponent = useCallback(
    async (current: Game, sessionNo: number) => {
      setBusy('opponent');
      setActionError(null);
      try {
        const result = await api.requestOpponentTurn(current.id, sessionNo);
        replaceSession(current, result.session);
      } catch (err) {
        setActionError(toUserMessage(err));
      } finally {
        setBusy(null);
      }
    },
    [replaceSession],
  );

  // Sıra rakipteyse (açılış konuşması, kaldığı yerden devam) rakip turu bir kez otomatik istenir.
  useEffect(() => {
    if (!game || !session || session.status !== 'awaiting_opponent' || busy) return;
    const key = `${session.session_no}:${session.turns.length}`;
    if (autoRequested.current === key) return;
    autoRequested.current = key;
    void requestOpponent(game, session.session_no);
  }, [game, session, busy, requestOpponent]);

  if (loading && !game) return <LoadingState label="Münazara yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!game || !session) return null;

  if (lastVerdict) {
    const finished = game.status === 'finished';
    return (
      <div className="debate">
        <SessionStrip game={game} highlight={lastVerdict.verdict.session_no} />
        <VerdictCard
          verdict={lastVerdict.verdict}
          topicTitle={lastVerdict.topicTitle}
          playerSide={lastVerdict.side}
          highlight
        />
        <div className="action-bar">
          <span className="muted">
            {finished
              ? 'Tüm oturumlar tamamlandı. Nihai skorunuz hazır.'
              : `Sıradaki: ${game.current_session}. oturum · ${session.topic.title}`}
          </span>
          {finished ? (
            <Link to={`/games/${game.id}/results`} className="btn btn--primary btn--lg">
              Oyun sonucunu gör
            </Link>
          ) : (
            <Button className="btn--lg" onClick={() => setLastVerdict(null)}>
              Sonraki oturuma geç
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (game.status === 'finished') {
    return <Navigate to={`/games/${game.id}/results`} replace />;
  }

  const current = game;
  const playerSide = session.player_side;
  const opponentTurns = session.turns.filter((t) => t.speaker === 'opponent').length;
  const remaining = session.max_rounds - session.rounds_played;
  const nearLimit = draft.length > maxTurnLength * 0.9;
  // Aleyhindeki oyuncunun kapanış konuşmasına yanıt gelmez.
  const opponentReplies = !(playerSide === 'against' && remaining === 1);

  async function handleChooseSide(side: Side) {
    setBusy('side');
    setActionError(null);
    try {
      const updated = await api.chooseSide(current.id, session!.session_no, side);
      replaceSession(current, updated);
    } catch (err) {
      setActionError(toUserMessage(err));
      if (isApiError(err, 'SIDE_ALREADY_CHOSEN')) reload();
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = draft.trim();

    if (text.length === 0) {
      setActionError('Argümanınızı yazmadan gönderemezsiniz.');
      return;
    }
    if (text.length > maxTurnLength) {
      setActionError(`Argümanınız en fazla ${maxTurnLength} karakter olabilir.`);
      return;
    }

    setBusy('send');
    setActionError(null);
    setPendingText(text);
    setDraft('');
    try {
      const result = await api.submitTurn(current.id, session!.session_no, {
        text,
        client_turn_id: clientTurnId.current,
      });
      replaceSession(current, result.session);
      clientTurnId.current = newUuid();
    } catch (err) {
      setActionError(toUserMessage(err));
      if (isApiError(err, 'OPPONENT_UNAVAILABLE')) {
        // Argüman kaydedildi; rakip turu ayrıca istenecek.
        clientTurnId.current = newUuid();
        autoRequested.current = `${session!.session_no}:${session!.turns.length + 1}`;
        reload();
      } else {
        // Gönderilemedi: metin geri gelir, aynı kimlikle yeniden gönderilebilir.
        setDraft(text);
      }
    } finally {
      setPendingText(null);
      setBusy(null);
    }
  }

  async function handleEvaluate() {
    setBusy('evaluate');
    setActionError(null);
    try {
      const result = await api.evaluateSession(current.id, session!.session_no);
      setLastVerdict({
        verdict: result.verdict,
        topicTitle: session!.topic.title,
        side: playerSide,
      });
      reload();
    } catch (err) {
      setActionError(toUserMessage(err));
      if (isApiError(err, 'EVALUATION_FAILED')) reload();
    } finally {
      setBusy(null);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="debate">
      <SessionStrip game={game} highlight={session.session_no} />

      <header className="debate__header">
        <div className="debate__title">
          <p className="eyebrow">
            Oturum {session.session_no} / {game.session_count}
          </p>
          <h1 className="display display--ink">{session.topic.title}</h1>
          <blockquote className="motion">{session.topic.motion}</blockquote>
        </div>

        {playerSide && (
          <div className="stance-panel" aria-label="Taraflar">
            <div className="stance stance--player">
              <span className="stance__label">Siz · {SIDE_LABELS[playerSide]}</span>
              <strong>{session.topic.positions[playerSide]}</strong>
              <RoundDots
                done={session.rounds_played}
                total={session.max_rounds}
                label="Sizin konuşmalarınız"
              />
            </div>
            <div className="stance stance--opponent">
              <span className="stance__label">
                Yapay zekâ · {SIDE_LABELS[opposite(playerSide)]}
              </span>
              <strong>{session.topic.positions[opposite(playerSide)]}</strong>
              <RoundDots
                done={opponentTurns}
                total={session.max_rounds}
                label="Rakibin konuşmaları"
              />
            </div>
          </div>
        )}
      </header>

      {session.status === 'choosing_side' && (
        <SidePicker session={session} busy={busy === 'side'} onChoose={handleChooseSide} />
      )}

      {playerSide && (
        <section aria-label="Münazara konuşması">
          <ol className="thread" aria-live="polite">
            {session.turns.length === 0 && !pendingText && session.status === 'awaiting_player' && (
              <li className="thread__empty">
                <strong>İlk söz sizde.</strong> Tezinizi açık bir iddia ve en az bir gerekçeyle
                kurun; hakem dökümün tamamını değerlendirir.
              </li>
            )}
            {session.turns.map((turn, index) => (
              <TurnMessage key={turn.id} turn={turn} number={index + 1} />
            ))}
            {pendingText && (
              <TurnMessage
                turn={{
                  id: 'pending',
                  speaker: 'player',
                  text: pendingText,
                  created_at: '',
                  citations: [],
                }}
                number={session.turns.length + 1}
                pending
              />
            )}
            {(busy === 'opponent' || (busy === 'send' && pendingText && opponentReplies)) && (
              <li className="turn turn--opponent turn--typing" aria-label="Rakip yanıt hazırlıyor">
                <span className="avatar avatar--opponent" aria-hidden="true">
                  YZ
                </span>
                <div className="turn__content">
                  <p className="turn__bubble">
                    <span className="typing-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    Rakip yanıt hazırlıyor
                  </p>
                </div>
              </li>
            )}
            <div ref={threadEndRef} className="thread__end" />
          </ol>
        </section>
      )}

      {session.status === 'awaiting_opponent' && busy !== 'opponent' && actionError && (
        <div className="row">
          <Button
            variant="secondary"
            onClick={() => void requestOpponent(current, session.session_no)}
          >
            Rakip yanıtını tekrar iste
          </Button>
        </div>
      )}

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {session.status === 'awaiting_player' && (
        <form className="composer" onSubmit={handleSubmit}>
          <div className="composer__head">
            <label htmlFor="turn-input" className="field__label">
              Sıra sizde
            </label>
            <span
              className={cx('composer__remaining', remaining === 1 && 'composer__remaining--last')}
            >
              {remaining === 1 ? 'Kapanış konuşmanız' : `${remaining} konuşma hakkınız kaldı`}
            </span>
          </div>
          <textarea
            id="turn-input"
            className="textarea"
            rows={3}
            maxLength={maxTurnLength}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy === 'send'}
            aria-describedby="turn-help"
            placeholder="İddianız, gerekçeniz ve rakibin argümanına yanıtınız…"
          />
          <div className="composer__footer">
            <span id="turn-help" className={cx('field__hint', nearLimit && 'field__hint--warn')}>
              {draft.length} / {maxTurnLength} · Ctrl+Enter ile gönderin
            </span>
            <Button
              type="submit"
              className="btn--lg"
              loading={busy === 'send'}
              disabled={!draft.trim()}
            >
              {busy === 'send' ? 'Gönderiliyor…' : 'Gönder'}
            </Button>
          </div>
        </form>
      )}

      {EVALUATION_STATUSES.includes(session.status) && (
        <section className="judge-panel surface-dark" aria-labelledby="judge-title">
          <VavMark
            size="lg"
            caption={session.status === 'evaluation_failed' ? undefined : 'Söz hakemde'}
          />
          <div className="judge-panel__text">
            <h2 id="judge-title">
              {session.status === 'evaluation_failed'
                ? 'Değerlendirme tamamlanamadı'
                : 'Konuşmalar tamamlandı'}
            </h2>
            <p>
              {session.status === 'evaluation_failed'
                ? 'Metrikler değişmedi. Değerlendirmeyi yeniden başlatabilirsiniz.'
                : 'Bağımsız hakem dökümün tamamını okuyup önce kazananı, sonra metriklere etkisini belirleyecek.'}
            </p>
          </div>
          <Button
            className="btn--lg btn--gold"
            onClick={handleEvaluate}
            loading={busy === 'evaluate'}
          >
            {busy === 'evaluate'
              ? 'Hakem değerlendiriyor…'
              : session.status === 'awaiting_evaluation'
                ? 'Kararı açıkla'
                : 'Tekrar dene'}
          </Button>
        </section>
      )}
    </div>
  );
}

function RoundDots({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <span className="round-dots" role="img" aria-label={`${label}: ${done} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx('round-dots__dot', i < done && 'round-dots__dot--done')} />
      ))}
    </span>
  );
}

function SidePicker({
  session,
  busy,
  onChoose,
}: {
  session: Session;
  busy: boolean;
  onChoose: (side: Side) => void;
}) {
  const sides: Side[] = ['for', 'against'];
  return (
    <section className="stack" aria-labelledby="side-title">
      <div>
        <h2 id="side-title" className="section-title">
          Hangi tarafı savunacaksınız?
        </h2>
        <p className="muted">
          Rakip diğer tarafı savunur. Her taraf {session.max_rounds} kez konuşur.
        </p>
      </div>
      <div className="side-picker">
        {sides.map((side) => (
          <button
            key={side}
            type="button"
            className={cx('side-option', `side-option--${side}`)}
            onClick={() => onChoose(side)}
            disabled={busy}
          >
            <span className="side-option__label">{SIDE_LABELS[side]}</span>
            <span className="side-option__text">{session.topic.positions[side]}</span>
            <span className="side-option__hint">
              {side === 'for' ? 'İlk sözü siz alırsınız' : 'Rakip açılışı yapar, siz kapanışı'}
            </span>
          </button>
        ))}
      </div>
      {busy && <LoadingState label="Taraf kaydediliyor…" />}
    </section>
  );
}

function SessionStrip({ game, highlight }: { game: Game; highlight: number }) {
  return (
    <ol className="session-strip" aria-label="Oturumlar">
      {game.sessions.map((s) => (
        <li
          key={s.session_no}
          className={cx(
            'session-strip__item',
            s.status === 'finished' && 'session-strip__item--done',
            s.session_no === highlight && 'session-strip__item--current',
          )}
          aria-current={s.session_no === highlight ? 'step' : undefined}
        >
          <span className="session-strip__no">{s.status === 'finished' ? '✓' : s.session_no}</span>
          <span className="session-strip__body">
            <span className="session-strip__title">{s.topic.title}</span>
            <StatusBadge kind="session" status={s.status} />
          </span>
        </li>
      ))}
    </ol>
  );
}
