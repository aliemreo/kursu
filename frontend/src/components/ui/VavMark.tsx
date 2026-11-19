import { useInView } from '../../hooks/useInView';
import { cx } from '../../lib/cx';

interface VavMarkProps {
  /** Çizim tamamlanınca yanında beliren kısa söz, ör. "Söz sende". */
  caption?: string;
  tone?: 'gold' | 'ivory' | 'wine';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Kürsü'nün imza motifi: "و" (vav) harfinden esinlenen, ekrana girince kendini çizen
 * ince bir kalem izi. Birleştiren bağlacın harfi olarak "birlikte düşünme" fikrini taşır.
 * Yalnızca birkaç anlamlı anda kullanılır (giriş, söz hakeme geçtiğinde, alt bilgi).
 */
export function VavMark({ caption, tone = 'gold', size = 'md', className }: VavMarkProps) {
  const [ref, inView] = useInView<HTMLSpanElement>();

  return (
    <span
      ref={ref}
      className={cx('vav', `vav--${tone}`, `vav--${size}`, inView && 'is-drawn', className)}
    >
      <svg viewBox="0 0 120 140" aria-hidden="true" focusable="false">
        {/* Baş: kapalı düğüm; kuyruk: aşağı ve sola doğru akan uzun bir kavis. */}
        <path
          className="vav__stroke"
          pathLength={1}
          d="M80 50 C80 33 61 27 52 38 C43 49 50 64 65 64 C73 64 79 59 81 51 C85 74 79 96 62 112 C49 124 32 130 16 127"
        />
      </svg>
      {caption && <span className="vav__caption">{caption}</span>}
    </span>
  );
}
