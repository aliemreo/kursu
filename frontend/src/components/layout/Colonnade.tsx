import { cx } from '../../lib/cx';

const COLUMNS = [80, 160, 240, 320, 400, 480, 560, 640, 720];

/**
 * Koyu bölümlerin arka planındaki mimari silüet: kubbe, alınlık ve sütun dizisi.
 * Fotoğraf yerine ince çizgili bir SVG kullanılır; hafif ve her ekranda keskindir.
 */
export function Colonnade({ className }: { className?: string }) {
  return (
    <svg
      className={cx('colonnade', className)}
      viewBox="0 0 800 420"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* Kubbe ve kasnak */}
      <path d="M300 150 C300 70 500 70 500 150" />
      <path d="M320 150 C320 92 480 92 480 150" />
      <line x1="400" y1="40" x2="400" y2="78" />
      <circle cx="400" cy="36" r="4" />
      <rect x="290" y="150" width="220" height="22" />
      {/* Alınlık */}
      <path d="M40 232 L400 172 L760 232 Z" />
      <path d="M100 226 L400 184 L700 226" />
      <rect x="30" y="232" width="740" height="18" />
      {/* Sütunlar */}
      {COLUMNS.map((x) => (
        <g key={x}>
          <rect x={x - 14} y="250" width="28" height="10" />
          <line x1={x - 9} y1="260" x2={x - 9} y2="386" />
          <line x1={x} y1="260" x2={x} y2="386" />
          <line x1={x + 9} y1="260" x2={x + 9} y2="386" />
          <rect x={x - 16} y="386" width="32" height="10" />
        </g>
      ))}
      {/* Basamaklar */}
      <rect x="20" y="396" width="760" height="8" />
      <rect x="0" y="404" width="800" height="16" />
    </svg>
  );
}
