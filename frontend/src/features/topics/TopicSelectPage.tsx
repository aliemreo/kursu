import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/StateViews';
import { useAsync } from '../../hooks/useAsync';
import { cx } from '../../lib/cx';
import { toUserMessage } from '../../lib/errors';
import { api } from '../../services';
import type { Topic } from '../../types/api';

const MAX_TOPICS = 5;

export function TopicSelectPage() {
  const navigate = useNavigate();
  const { data: topics, error, loading, reload } = useAsync(() => api.listTopics(), []);

  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byCategory = new Map<string, Topic[]>();
    for (const topic of topics ?? []) {
      byCategory.set(topic.category, [...(byCategory.get(topic.category) ?? []), topic]);
    }
    return Array.from(byCategory.entries());
  }, [topics]);

  function toggle(topicId: string) {
    setSelected((current) => {
      if (current.includes(topicId)) return current.filter((id) => id !== topicId);
      if (current.length >= MAX_TOPICS) return current;
      return [...current, topicId];
    });
  }

  async function handleCreate() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const game = await api.createGame({ topicIds: selected });
      navigate(`/games/${game.id}`);
    } catch (err) {
      setSubmitError(toUserMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="stack-lg">
      <header className="page-header">
        <p className="eyebrow">Yeni münazara</p>
        <h1>Konularınızı seçin</h1>
        <p className="muted">
          1 ile {MAX_TOPICS} konu seçebilirsiniz. Her turda taraf değişir; rakip karşı tarafı
          savunur.
        </p>
      </header>

      {loading && <LoadingState label="Konular yükleniyor…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {groups.map(([category, items]) => (
        <section key={category} className="topic-group" aria-labelledby={`cat-${category}`}>
          <h2 id={`cat-${category}`}>{category}</h2>
          <div className="topic-grid">
            {items.map((topic) => {
              const isSelected = selected.includes(topic.id);
              const isLimitReached = !isSelected && selected.length >= MAX_TOPICS;
              return (
                <button
                  key={topic.id}
                  type="button"
                  className={cx('topic-card', isSelected && 'topic-card--selected')}
                  aria-pressed={isSelected}
                  onClick={() => toggle(topic.id)}
                  disabled={submitting || isLimitReached}
                >
                  <span className="topic-card__check" aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                  <span className="topic-card__category">{topic.category}</span>
                  <span className="topic-card__title">{topic.title}</span>
                  <span className="topic-card__summary">{topic.summary}</span>
                  <span className="topic-card__positions">
                    <span>
                      <strong>Lehinde:</strong> {topic.positions.for}
                    </span>
                    <span>
                      <strong>Aleyhinde:</strong> {topic.positions.against}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {submitError && <Alert tone="error">{submitError}</Alert>}

      {topics && (
        <div className="action-bar">
          <span className="muted">
            Seçilen konu: {selected.length} / {MAX_TOPICS}
          </span>
          <div className="row">
            <Link to="/" className="btn btn--ghost">
              Vazgeç
            </Link>
            <Button
              onClick={handleCreate}
              disabled={selected.length === 0}
              loading={submitting}
            >
              Münazarayı başlat
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}