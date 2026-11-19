import { useEffect, useRef, useState } from 'react';

/**
 * Öğe ekrana girdiğinde bir kez true olur; kaydırmayla ortaya çıkma animasyonları için.
 * IntersectionObserver yoksa (eski tarayıcı, test ortamı) içerik hemen görünür.
 */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    // İlk açılışta zaten ekranda olan öğe gözlemciyi beklemeden görünür.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, inView] as const;
}
