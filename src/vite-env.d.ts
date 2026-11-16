/// <reference types="vite/client" />

interface Window {
  /** The Umami tracker. Present only once its script has loaded on the production host. */
  umami?: { track: (name: string, data?: Record<string, string>) => unknown };
}
