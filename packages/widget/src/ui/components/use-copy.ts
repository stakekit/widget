import { useEffect, useState } from "react";

/** How long a copy control shows that it copied. */
const copiedFor = 1500;

type CopyState = {
  /** Successful copies so far. */
  readonly copies: number;
  /** The copy being shown, numbered from 1; 0 while none is. */
  readonly shown: number;
};

/**
 * Copies a value to the clipboard and reports `copied` for a moment after it
 * succeeds, so a control can show and announce the outcome. Copying again
 * while `copied` restarts the moment and announces again.
 */
export const useCopy = () => {
  const [{ shown }, setState] = useState<CopyState>({ copies: 0, shown: 0 });
  const copied = shown !== 0;

  // Each copy shows a new number, so a repeated copy restarts the timer.
  useEffect(() => {
    if (shown === 0) return;

    const timeout = setTimeout(
      () => setState((state) => ({ ...state, shown: 0 })),
      copiedFor
    );

    return () => clearTimeout(timeout);
  }, [shown]);

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value).then(
      () =>
        setState(({ copies }) => ({ copies: copies + 1, shown: copies + 1 })),
      () => setState((state) => ({ ...state, shown: 0 }))
    );
  };

  /**
   * The text for a `role="status"` region: `copiedLabel` while copied. A
   * repeated copy alternates a trailing no-break space, so the region's text
   * changes and assistive technology announces it again.
   */
  const announcement = (copiedLabel: string) => {
    if (!copied) return "";

    const marker = shown % 2 === 1 ? "" : "\u00A0";
    return `${copiedLabel}${marker}`;
  };

  return { copied, copy, announcement };
};
