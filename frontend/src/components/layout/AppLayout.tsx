import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Button } from '../ui/Button';
import { Ornament } from '../ui/Ornament';
import { VavMark } from '../ui/VavMark';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>

      <header className="site-header surface-dark">
        <div className="container site-header__inner">
          <Link to="/" className="brand brand--inverse" aria-label="Kürsü ana sayfa">
            <span className="brand__mark">K</span>
            <span className="brand__name">Kürsü</span>
          </Link>

          <nav className="site-nav" aria-label="Ana gezinme">
            <NavLink to="/" end>
              Panel
            </NavLink>
            <NavLink to="/games/new">Yeni oyun</NavLink>
            <NavLink to="/leaderboard">Sıralama</NavLink>
          </nav>

          <div className="site-header__user">
            <span className="avatar avatar--gold" aria-hidden="true">
              {user?.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="site-header__name">{user?.username}</span>
            <Button
              variant="ghost"
              className="btn--on-dark btn--sm"
              onClick={handleLogout}
              loading={loggingOut}
              title="Tüm cihazlardaki oturumlarınız kapatılır"
            >
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      {/* Sayfa değişiminde içerik yumuşakça belirir. */}
      <main id="main" className="container main page-enter" key={location.pathname}>
        <Outlet />
      </main>

      <footer className="site-footer surface-dark">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            <VavMark size="sm" caption="Birlikte düşünelim" />
          </div>
          <Ornament className="ornament--footer" />
          <p>
            Kürsü kurgusal bir eğitim oyunudur; hakem kararları gerçek politika tahmini değildir.
            Konu içerikleri ParlaMint-TR (CC BY 4.0) temel alınarak hazırlanır.
          </p>
          <p className="site-footer__meta">BLG411E · Beetropic · 2026</p>
        </div>
      </footer>
    </div>
  );
}
