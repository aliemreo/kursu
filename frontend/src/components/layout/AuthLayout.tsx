import type { ReactNode } from 'react';
import { RevealTitle } from '../ui/Reveal';
import { VavMark } from '../ui/VavMark';
import { Colonnade } from './Colonnade';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

const STEPS = [
  { title: 'Tarafını seç', text: 'Her oturumda konuyu gör; lehinde ya da aleyhinde dur.' },
  { title: 'Kürsüye çık', text: 'Yapay zekâ rakibine karşı sırayla argümanlarını sun.' },
  { title: 'Hakem karar versin', text: 'Bağımsız hakem kazananı ve metriklere etkisini açıklar.' },
];

/**
 * Giriş ve kayıt ekranları: uygulamanın ilk izlenimi. Solda sinematik koyu sahne
 * (mimari silüet, doku, imza motifi), sağda fildişi zeminde sade form.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <aside className="auth-stage surface-dark" aria-label="Kürsü hakkında">
        <Colonnade className="auth-stage__arch" />
        <div className="auth-stage__top">
          <div className="brand brand--inverse">
            <span className="brand__mark">K</span>
            <span className="brand__name">Kürsü</span>
          </div>
          <span className="auth-stage__meta">Parlamento münazara oyunu</span>
        </div>

        <div className="auth-stage__body">
          <VavMark caption="Söz sende" size="lg" />
          <RevealTitle as="h2" className="display" text="Tezini savun, hakemi ikna et." />
          <ol className="auth-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} style={{ animationDelay: `${600 + index * 140}ms` }}>
                <span className="auth-steps__no">{['I', 'II', 'III'][index]}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="auth-stage__note">
          Kürsü kurgusal bir eğitim oyunudur; sonuçlar gerçek politika tahmini değildir.
        </p>
      </aside>

      <main className="auth-main">
        <section className="auth-card" aria-labelledby="auth-title">
          <header className="auth-card__header">
            <p className="eyebrow">Kürsü’ye hoş geldiniz</p>
            <h1 id="auth-title">{title}</h1>
            <p>{subtitle}</p>
          </header>
          {children}
          <p className="auth-card__footer">{footer}</p>
        </section>
      </main>
    </div>
  );
}
