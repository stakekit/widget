import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { RichError } from "../../../services/errors/rich-error";
import {
  type RichErrorRetry,
  RichErrorService,
} from "../../../services/errors/rich-error-service";

export const richErrorAtom = appRuntime.subscriptionRef(
  Effect.map(RichErrorService, ({ current }) => current)
);

const richErrorRetryAtom = appRuntime.subscriptionRef(
  Effect.map(RichErrorService, ({ retry }) => retry)
);

export const useRichErrors = (): {
  error: RichError | null;
  resetError: () => void;
  /** Dismisses the error and runs its work again; unset when it can't be. */
  retry: (() => void) | null;
} => {
  const result = useAtomValue(richErrorAtom);
  const setRichError = useAtomSet(richErrorAtom);
  const retryWith: RichErrorRetry | null = AsyncResult.getOrElse(
    useAtomValue(richErrorRetryAtom),
    () => null
  );
  const error = AsyncResult.getOrElse(result, () => null);
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
