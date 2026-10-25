import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Button } from '../ui/Button';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>

      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand" aria-label="Kürsü ana sayfa">
            <span className="brand__mark">K</span>
            <span className="brand__name">Kürsü</span>
          </Link>

          <nav className="site-nav" aria-label="Ana gezinme">
            <NavLink to="/" end>
              Panel
            </NavLink>
            <NavLink to="/games/new">Yeni münazara</NavLink>
          </nav>

          <div className="site-header__user">
            <span className="site-header__name">{user?.displayName}</span>
            <Button variant="ghost" onClick={handleLogout}>
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="container main">
        <Outlet />
      </main>
    </div>
  );
}