import '@testing-library/jest-dom/vitest';
import { clearMocks } from '@tauri-apps/api/mocks';
import { afterEach } from 'vitest';
import { setTauriRuntime } from './tauri';

afterEach(() => {
  clearMocks();
  setTauriRuntime(false);
  window.localStorage.clear();
});
