import { Link, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Colonnade } from './components/layout/Colonnade';
import { MockBanner } from './components/layout/MockBanner';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DebatePage } from './features/debate/DebatePage';
import { LeaderboardPage } from './features/leaderboard/LeaderboardPage';
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
            <Route path="leaderboard" element={<LeaderboardPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

function NotFoundPage() {
  return (
    <div className="not-found surface-dark">
      <Colonnade className="stage__arch" />
      <section className="not-found__card">
        <p className="eyebrow eyebrow--gold">404</p>
        <h1 className="display">Sayfa bulunamadı</h1>
        <p className="lead">Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
        <Link className="btn btn--gold btn--lg" to="/">
          Ana sayfaya dön
        </Link>
      </section>
    </div>
  );
}