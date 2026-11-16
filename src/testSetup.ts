import { vi } from "vitest";

/**
 * A plain in-memory `Storage` for the test run. Node 25 and later define their own global
 * `localStorage`, which is `undefined` unless Node gets a storage file, and it shadows the one
 * from jsdom. Installing this one in every test file makes the tests independent of the Node
 * version. Each test file starts with an empty storage.
 */
class MemoryStorage implements Storage {
  private readonly _items = new Map<string, string>();

  get length(): number {
    return this._items.size;
  }

  clear(): void {
    this._items.clear();
  }

  getItem(key: string): string | null {
    return this._items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this._items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this._items.delete(key);
  }

  setItem(key: string, value: string): void {
    this._items.set(key, String(value));
  }
}

vi.stubGlobal("localStorage", new MemoryStorage());
