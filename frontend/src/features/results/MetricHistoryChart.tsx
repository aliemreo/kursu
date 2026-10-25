import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '../../components/ui/EmptyState';
import { METRIC_LABELS } from '../../lib/labels';
import type { GameResultSession, MetricKey } from '../../types/api';

export const METRIC_KEYS: MetricKey[] = [
  'social_cohesion',
  'economic_stability',
  'institutional_trust',
];

const METRIC_COLORS: Record<MetricKey, string> = {
  social_cohesion: '#8b1e2d',
  economic_stability: '#b8892b',
  institutional_trust: '#2f5d62',
};

interface MetricHistoryChartProps {
  sessions: GameResultSession[];
}

export function MetricHistoryChart({ sessions }: MetricHistoryChartProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Grafik için veri yok"
        description="Metrik gelişimi, en az bir tur tamamlandığında görünür."
      />
    );
  }

  const data = [
    { name: 'Başlangıç', ...sessions[0].verdict.metricsBefore },
    ...sessions.map((session) => ({
      name: `Tur ${session.index + 1}`,
      ...session.verdict.metricsAfter,
    })),
  ];

  return (
    <div className="chart" role="img" aria-label="Oyun metriklerinin turlara göre değişimini gösteren çizgi grafiği">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4dccb" />
          <XAxis dataKey="name" stroke="#776c5e" />
          <YAxis domain={[0, 100]} stroke="#776c5e" />
          <Tooltip />
          <Legend />
          {METRIC_KEYS.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={METRIC_LABELS[key]}
              stroke={METRIC_COLORS[key]}
              strokeWidth={2.5}
              dot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}