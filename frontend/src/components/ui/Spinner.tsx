import { cx } from '../../lib/cx';

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return <span className={cx('spinner', size === 'sm' && 'spinner--sm')} aria-hidden="true" />;
}