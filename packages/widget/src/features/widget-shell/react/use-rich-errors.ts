import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { RichError } from "../../../services/errors/rich-error";
import { RichErrorService } from "../../../services/errors/rich-error-service";

export const richErrorAtom = appRuntime.subscriptionRef(
  Effect.map(RichErrorService, ({ current }) => current)
);

export const useRichErrors = (): {
  error: RichError | null;
  resetError: () => void;
} => {
  const result = useAtomValue(richErrorAtom);
  const setRichError = useAtomSet(richErrorAtom);
  const error = AsyncResult.getOrElse(result, () => null);

  return {
    error,
    resetError: () => setRichError(null),
  };
};
