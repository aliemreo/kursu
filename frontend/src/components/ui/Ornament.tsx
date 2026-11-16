import { cx } from '../../lib/cx';

/** İnce altın çizgi ve ortasında sekiz köşeli Anadolu yıldızı: bölüm ayıracı. */
export function Ornament({ className }: { className?: string }) {
  return (
    <div className={cx('ornament', className)} role="presentation">
      <span className="ornament__line" />
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="6" y="6" width="12" height="12" />
        <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
        <circle cx="12" cy="12" r="1.6" />
      </svg>
      <span className="ornament__line" />
    </div>
  );
}
