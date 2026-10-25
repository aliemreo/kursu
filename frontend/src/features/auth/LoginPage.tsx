import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toUserMessage } from '../../lib/errors';
import { validateLogin, type FieldErrors, type LoginField } from '../../lib/validation';
import { isMockMode } from '../../services';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      setFormError(toUserMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <header className="auth-card__header">
          <span className="brand__mark brand__mark--lg" aria-hidden="true">
            K
          </span>
          <h1 id="login-title">Giriş yap</h1>
          <p>Münazara oyunlarınıza kaldığınız yerden devam edin.</p>
        </header>

        {isMockMode && (
          <Alert tone="info">
            Demo hesap: <strong>demo@kursu.test</strong> / <strong>demo12345</strong>
          </Alert>
        )}

        {formError && <Alert tone="error">{formError}</Alert>}

        <form className="stack" onSubmit={handleSubmit} noValidate>
          <Input
            label="E-posta"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            disabled={submitting}
          />
          <Input
            label="Şifre"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            disabled={submitting}
          />
          <Button type="submit" block loading={submitting}>
            {submitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </Button>
        </form>

        <p className="auth-card__footer">
          Hesabınız yok mu? <Link to="/register">Kayıt olun</Link>
        </p>
      </section>
    </div>
  );
}