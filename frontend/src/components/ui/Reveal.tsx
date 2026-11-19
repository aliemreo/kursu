import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { useInView } from '../../hooks/useInView';
import { cx } from '../../lib/cx';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Gecikme (ms); art arda gelen öğeler sırayla belirir. */
  delay?: number;
  /** Liste içinde `li` olarak kullanılabilir; varsayılan `div`. */
  as?: 'div' | 'li';
}

/** İçeriği ekrana girdiğinde yumuşakça yukarı doğru ortaya çıkarır. */
export function Reveal({ children, className, delay = 0, as: Tag = 'div' }: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement & HTMLLIElement>();
  return (
    <Tag
      ref={ref}
      className={cx('reveal', inView && 'is-visible', className)}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

interface RevealTitleProps {
  text: string;
  as?: 'h1' | 'h2';
  id?: string;
  className?: string;
}

/** Başlığın kelimeleri sırayla belirir. Ekran okuyucular başlığı tek parça okur. */
export function RevealTitle({ text, as: Tag = 'h1', id, className }: RevealTitleProps) {
  const [ref, inView] = useInView<HTMLHeadingElement>();
  return (
    <Tag
      ref={ref}
      id={id}
      aria-label={text}
      className={cx('reveal-words', inView && 'is-visible', className)}
    >
      {/* Boşluk kutunun dışında kalmalı; inline-block içindeki son boşluk silinir. */}
      {text.split(' ').map((word, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          <span aria-hidden="true" style={{ '--i': index } as CSSProperties}>
            {word}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
