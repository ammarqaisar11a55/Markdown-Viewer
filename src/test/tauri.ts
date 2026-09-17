// Test helpers for code paths that check `isTauri()` (reads `globalThis.isTauri`).
type TauriGlobal = typeof globalThis & { isTauri?: boolean };

/** Makes `isTauri()` return `value`. The global setup resets it after each test. */
export function setTauriRuntime(value: boolean): void {
  if (value) (globalThis as TauriGlobal).isTauri = true;
  else delete (globalThis as TauriGlobal).isTauri;
}
