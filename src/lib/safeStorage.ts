/**
 * `localStorage` that never throws. Storage can be missing (the build's pre-render, some test
 * setups) or throw on access or on every call (private modes, blocked site data, a full quota).
 * Then a read finds nothing and a write is dropped: the app starts with its defaults and keeps
 * working, and a setting holds for the current visit only.
 */
export class SafeStorage {
  /** The stored value, or `null` when there is none or storage cannot be read. */
  static get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  static set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Blocked or full: the value is not kept.
    }
  }
}
