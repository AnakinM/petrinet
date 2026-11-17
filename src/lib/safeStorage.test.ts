import { afterEach, describe, expect, it, vi } from "vitest";
import { SafeStorage } from "@/lib/safeStorage";

const STORAGE = globalThis.localStorage;

const denied = (): never => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};
/** A storage whose every method throws, as in a browser that blocks site data. */
const BLOCKED_STORAGE = { getItem: denied, setItem: denied, removeItem: denied };

describe("SafeStorage", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: STORAGE,
    });
    STORAGE.clear();
  });

  it("reads, writes and removes through localStorage", () => {
    SafeStorage.set("k", "v");
    expect(STORAGE.getItem("k")).toBe("v");
    expect(SafeStorage.get("k")).toBe("v");
    SafeStorage.remove("k");
    expect(SafeStorage.get("k")).toBeNull();
  });

  it("finds nothing and drops writes when every method throws", () => {
    vi.stubGlobal("localStorage", BLOCKED_STORAGE);
    expect(SafeStorage.get("k")).toBeNull();
    expect(() => SafeStorage.set("k", "v")).not.toThrow();
    expect(() => SafeStorage.remove("k")).not.toThrow();
  });

  it("finds nothing and drops writes when localStorage itself throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    expect(SafeStorage.get("k")).toBeNull();
    expect(() => SafeStorage.set("k", "v")).not.toThrow();
    expect(() => SafeStorage.remove("k")).not.toThrow();
  });

  it("finds nothing where there is no localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(SafeStorage.get("k")).toBeNull();
    expect(() => SafeStorage.set("k", "v")).not.toThrow();
  });
});
