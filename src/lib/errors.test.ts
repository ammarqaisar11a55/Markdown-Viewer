import { isFsErrorPayload, toAppError } from './errors';

describe('toAppError', () => {
  it('maps notFound to the friendly file message', () => {
    const error = toAppError({ kind: 'notFound', message: 'ENOENT: no such file' });
    expect(error).toEqual({
      kind: 'notFound',
      title: 'Unable to open this file.',
      description: 'The file may have been moved or deleted.',
      technical: 'ENOENT: no such file',
    });
  });

  it('uses folder wording in the folder context', () => {
    const error = toAppError({ kind: 'notFound', message: 'x' }, 'folder');
    expect(error.title).toBe('Unable to open this folder.');
    expect(error.description).toBe('The folder may have been moved or deleted.');
  });

  it.each(['permissionDenied', 'tooLarge', 'unsupportedType', 'notADirectory', 'io'] as const)(
    'gives %s a friendly message without technical details',
    (kind) => {
      const error = toAppError({ kind, message: 'os error 13 /secret/path' });
      expect(error.kind).toBe(kind);
      expect(error.title).not.toContain('os error');
      expect(error.description).not.toContain('/secret/path');
      expect(error.technical).toBe('os error 13 /secret/path');
    },
  );

  it('maps unknown errors', () => {
    expect(toAppError(new TypeError('boom'))).toMatchObject({
      kind: 'unknown',
      title: 'Something went wrong.',
      technical: 'TypeError: boom',
    });
    expect(toAppError('plain').technical).toBe('plain');
    expect(toAppError(undefined).technical).toBe('undefined');
    expect(toAppError({ kind: 'weird', message: 'x' }).kind).toBe('unknown');
  });

  it('passes AppErrors through unchanged', () => {
    const error = toAppError({ kind: 'io', message: 'x' });
    expect(toAppError(error)).toBe(error);
  });
});

describe('isFsErrorPayload', () => {
  it('validates the shape', () => {
    expect(isFsErrorPayload({ kind: 'io', message: 'x' })).toBe(true);
    expect(isFsErrorPayload({ kind: 'io' })).toBe(false);
    expect(isFsErrorPayload(null)).toBe(false);
  });
});
