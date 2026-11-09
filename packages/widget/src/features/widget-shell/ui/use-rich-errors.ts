import { useAtomSet, useAtomValue } from "@effect/atom-react";

import type { RichError } from "../../../services/errors/rich-error";
import { richErrorAtom, richErrorViewAtom } from "../state/rich-errors";

export const useRichErrors = (): {
  error: RichError | null;
  resetError: () => void;
  /** Dismisses the error and runs its work again; unset when it can't be. */
  retry: (() => void) | null;
} => {
  const { error, retryWith } = useAtomValue(richErrorViewAtom);
  const setRichError = useAtomSet(richErrorAtom);
  const resetError = () => setRichError(null);

  return {
    error,
    resetError,
    retry:
      retryWith === null
        ? null
        : () => {
            resetError();
            retryWith();
          },
  };
};
