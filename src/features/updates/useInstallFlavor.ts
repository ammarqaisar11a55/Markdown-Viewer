import { useEffect, useState } from 'react';
import { logger } from '@/lib/platform/logger';
import { installFlavor, type InstallFlavor } from './platform';

/**
 * How this copy of the app was installed, or `null` until it is known — which
 * is also what the Settings dialog gets while the answer is on its way.
 */
export function useInstallFlavor(): InstallFlavor | null {
  const [flavor, setFlavor] = useState<InstallFlavor | null>(null);

  useEffect(() => {
    let cancelled = false;
    installFlavor().then(
      (value) => {
        if (!cancelled) setFlavor(value);
      },
      (err: unknown) => {
        logger.warn('Could not tell how Markdown Viewer was installed', err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return flavor;
}
