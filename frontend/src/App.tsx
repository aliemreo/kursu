import { Link, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { MockBanner } from './components/layout/MockBanner';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DebatePage } from './features/debate/DebatePage';
import { ResultsPage } from './features/results/ResultsPage';
import { TopicSelectPage } from './features/topics/TopicSelectPage';

export default function App() {
  return (
    <>
      <MockBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="games/new" element={<TopicSelectPage />} />
            <Route path="games/:gameId" element={<DebatePage />} />
            <Route path="games/:gameId/results" element={<ResultsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

function NotFoundPage() {
  return (
    <div className="auth-page">
      <section className="auth-card">
        <h1>Sayfa bulunamadı</h1>
        <p className="muted">Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
        <Link className="btn btn--primary btn--block" to="/">Ana sayfaya dön</Link>
      </section>
    </div>
  );
}