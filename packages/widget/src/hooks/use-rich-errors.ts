import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { widgetAtomRuntime } from "../providers/effect-atom-runtime/widget-runtime";
import {
  type RichError,
  RichErrorService,
} from "../providers/rich-error/service";

export const richErrorAtom = widgetAtomRuntime.subscriptionRef(
  Effect.map(RichErrorService, ({ current }) => current)
);

export const useRichErrors = (): {
  error: RichError | null;
  resetError: () => void;
} => {
  const result = useAtomValue(richErrorAtom);
  const setRichError = useAtomSet(richErrorAtom);

  return {
    error: AsyncResult.getOrElse(result, () => null),
    resetError: () => setRichError(null),
  };
};
