import { create } from "zustand";

/**
 * The short message that the {@link Notice} shows, such as "Picture copied to the clipboard.".
 * One message at a time: a new one replaces the old one. Any code can show one with
 * `useNoticeStore.getState().show(message)`. The component hides it after {@link NOTICE_MS}.
 */
export interface NoticeState {
  message: string | null;
  /** Counts every `show`, so the same message twice still restarts the timer and is announced again. */
  serial: number;

  show: (message: string) => void;
  /** Hide the message, but only if it is still the one numbered `serial`. */
  dismiss: (serial: number) => void;
}

/** How long a message stays on screen. */
export const NOTICE_MS = 2500;

export const useNoticeStore = create<NoticeState>()((set) => ({
  message: null,
  serial: 0,
  show: (message) => set((s) => ({ message, serial: s.serial + 1 })),
  dismiss: (serial) => set((s) => (s.serial === serial ? { message: null } : s)),
}));
