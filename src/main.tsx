import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { bootstrap } from './app/bootstrap';
import { logger } from './lib/platform/logger';
import { getSystemTheme, resolveTheme } from './lib/platform/theme';
import { useSettings } from './stores/settingsStore';

async function start(): Promise<void> {
  try {
    await bootstrap();
  } catch (err) {
    logger.error('Startup failed; continuing with defaults', err);
  }
  // Apply the theme before the first paint to avoid a flash of the wrong palette.
  const theme = resolveTheme(useSettings.getState().theme, getSystemTheme());
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
