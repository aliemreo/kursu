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
import type { Metric, SessionResult } from '../../types/api';

/** Metrik listesi yapılandırılabilir olduğu için renkler sırayla atanır. */
const METRIC_COLORS = ['#722B3C', '#B59A68', '#5A3A2E', '#3F5E5A', '#8A6F9E', '#252321'];

interface MetricHistoryChartProps {
  metrics: Metric[];
  sessions: SessionResult[];
}

export function MetricHistoryChart({ metrics, sessions }: MetricHistoryChartProps) {
  if (sessions.length === 0 || metrics.length === 0) {
    return (
      <EmptyState
        title="Grafik için veri yok"
        description="Metrik gelişimi, en az bir oturum tamamlandığında görünür."
      />
    );
  }

  const point = (name: string, pick: 'before' | 'after', session: SessionResult) => ({
    name,
    ...Object.fromEntries(session.metric_changes.map((c) => [c.metric_id, c[pick]])),
  });

  const data = [
    point('Başlangıç', 'before', sessions[0]),
    ...sessions.map((s) => point(`Oturum ${s.session_no}`, 'after', s)),
  ];
  const min = Math.min(...metrics.map((m) => m.min));
  const max = Math.max(...metrics.map((m) => m.max));

  return (
    <div
      className="chart"
      role="img"
      aria-label="Oyun metriklerinin oturumlara göre değişimini gösteren çizgi grafiği"
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E9DFCF" />
          <XAxis dataKey="name" stroke="#7A6A5C" />
          <YAxis domain={[min, max]} stroke="#7A6A5C" />
          <Tooltip />
          <Legend />
          {metrics.map((metric, index) => (
            <Line
              key={metric.id}
              type="monotone"
              dataKey={metric.id}
              name={metric.name}
              stroke={METRIC_COLORS[index % METRIC_COLORS.length]}
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
