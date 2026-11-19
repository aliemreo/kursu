import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES, messageFor } from './errors';
import { newUuid } from './uuid';
import { isValidUsername, validateRegister } from './validation';

describe('validation', () => {
  it('follows the contract username rule', () => {
    expect(isValidUsername('beyza_k.1')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('çağrı')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
  });

  it('reports every invalid register field', () => {
    const errors = validateRegister({ username: 'x', email: 'no', password: 'short', passwordRepeat: '' });
    expect(Object.keys(errors).sort()).toEqual(['email', 'password', 'passwordRepeat', 'username']);
  });
});

describe('messageFor', () => {
  it('prefers the contract error code', () => {
    expect(messageFor(409, 'NOT_YOUR_TURN', 'x')).toBe(ERROR_MESSAGES.NOT_YOUR_TURN);
  });

  it('maps known backend details without a code', () => {
    expect(messageFor(409, undefined, 'Username already taken')).toBe('Bu kullanıcı adı alınmış.');
  });

  it('names the invalid field of a FastAPI validation error', () => {
    const detail = [{ type: 'value_error', loc: ['body', 'email'], msg: 'reserved name' }];
    expect(messageFor(422, undefined, detail)).toMatch(/E-posta adresi geçersiz/);
  });

  it('falls back to the HTTP status', () => {
    expect(messageFor(0)).toMatch(/Sunucuya ulaşılamadı/);
  });
});

describe('newUuid', () => {
  it('returns a v4 uuid', () => {
    expect(newUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
