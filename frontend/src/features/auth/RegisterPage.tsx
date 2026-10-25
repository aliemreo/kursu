import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toUserMessage } from '../../lib/errors';
import {
  validateRegister,
  type FieldErrors,
  type RegisterField,
  type RegisterValues,
} from '../../lib/validation';
import { useAuth } from './AuthContext';

const EMPTY_VALUES: RegisterValues = {
  displayName: '',
  email: '',
  password: '',
  passwordRepeat: '',
};

export function RegisterPage() {
  const { user, register } = useAuth();
  const [values, setValues] = useState<RegisterValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  function updateField(field: keyof RegisterValues) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateRegister(values);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        password: values.password,
      });
    } catch (error) {
      setFormError(toUserMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <header className="auth-card__header">
          <span className="brand__mark brand__mark--lg" aria-hidden="true">
            K
          </span>
          <h1 id="register-title">Hesap oluştur</h1>
          <p>Birkaç bilgiyle hemen münazaraya başlayabilirsiniz.</p>
        </header>

        {formError && <Alert tone="error">{formError}</Alert>}

        <form className="stack" onSubmit={handleSubmit} noValidate>
          <Input
            label="Ad soyad"
            autoComplete="name"
            value={values.displayName}
            onChange={updateField('displayName')}
            error={fieldErrors.displayName}
            disabled={submitting}
          />
          <Input
            label="E-posta"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={updateField('email')}
            error={fieldErrors.email}
            disabled={submitting}
          />
          <Input
            label="Şifre"
            type="password"
            autoComplete="new-password"
            hint="En az 8 karakter."
            value={values.password}
            onChange={updateField('password')}
            error={fieldErrors.password}
            disabled={submitting}
          />
          <Input
            label="Şifre tekrarı"
            type="password"
            autoComplete="new-password"
            value={values.passwordRepeat}
            onChange={updateField('passwordRepeat')}
            error={fieldErrors.passwordRepeat}
            disabled={submitting}
          />
          <Button type="submit" block loading={submitting}>
            {submitting ? 'Hesap oluşturuluyor…' : 'Kayıt ol'}
          </Button>
        </form>

        <p className="auth-card__footer">
          Zaten hesabınız var mı? <Link to="/login">Giriş yapın</Link>
        </p>
      </section>
    </div>
  );
}