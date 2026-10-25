export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

export type LoginField = 'email' | 'password';

export function validateLogin(email: string, password: string): FieldErrors<LoginField> {
  const errors: FieldErrors<LoginField> = {};
  if (!isValidEmail(email)) {
    errors.email = 'Geçerli bir e-posta adresi girin.';
  }
  if (password.length === 0) {
    errors.password = 'Şifre boş bırakılamaz.';
  }
  return errors;
}

export type RegisterField = 'displayName' | 'email' | 'password' | 'passwordRepeat';

export interface RegisterValues {
  displayName: string;
  email: string;
  password: string;
  passwordRepeat: string;
}

export function validateRegister(values: RegisterValues): FieldErrors<RegisterField> {
  const errors: FieldErrors<RegisterField> = {};
  if (values.displayName.trim().length < 2) {
    errors.displayName = 'Ad soyad en az 2 karakter olmalıdır.';
  }
  if (!isValidEmail(values.email)) {
    errors.email = 'Geçerli bir e-posta adresi girin.';
  }
  if (values.password.length < 8) {
    errors.password = 'Şifre en az 8 karakter olmalıdır.';
  }
  if (values.passwordRepeat !== values.password) {
    errors.passwordRepeat = 'Şifreler eşleşmiyor.';
  }
  return errors;
}