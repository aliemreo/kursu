import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card', className)} {...rest} />;
}