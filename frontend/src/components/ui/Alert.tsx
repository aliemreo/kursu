import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

type AlertTone = 'error' | 'success' | 'info' | 'warning';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
}

export function Alert({ tone = 'info', title, children }: AlertProps) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('alert', `alert--${tone}`)}>
      {title && <strong className="alert__title">{title}</strong>}
      <div>{children}</div>
    </div>
  );
}