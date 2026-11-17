import { type JSX, useEffect } from "react";
import { NOTICE_MS, useNoticeStore } from "@/store/noticeStore";

/**
 * A small message near the top of the window that confirms an action, then goes away after
 * {@link NOTICE_MS}. Show one from anywhere with `useNoticeStore.getState().show(message)`.
 *
 * The live region is always mounted, so screen readers announce each new message. The message is
 * keyed by its serial, so a repeated message is announced again.
 */
export function Notice(): JSX.Element {
  const message = useNoticeStore((s) => s.message);
  const serial = useNoticeStore((s) => s.serial);

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(() => useNoticeStore.getState().dismiss(serial), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [message, serial]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-14 z-50 flex justify-center px-4"
    >
      {message !== null && (
        <div
          key={serial}
          className="max-w-md rounded bg-inverse px-3 py-2 text-center text-sm text-on-inverse shadow-lg"
        >
          {message}
        </div>
      )}
    </div>
  );
}
