import { useId, type InputHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy =
    [error ? `${inputId}-error` : null, !error && hint ? `${inputId}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      <input
        id={inputId}
        className={cx('input', error && 'input--error', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}