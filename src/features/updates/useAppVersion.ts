import { useEffect, useState } from 'react';
import { logger } from '@/lib/platform/logger';
import { appVersion } from './platform';

/**
 * The running app version, or `null` until it is known — which is also what
 * `npm run dev` in a browser gets, where there is no package to ask.
 */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    appVersion().then(
      (value) => {
        if (!cancelled) setVersion(value);
      },
      (err: unknown) => {
        logger.warn('Could not read the app version', err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}
