import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { pendingActionDeepLinkViewAtom } from "../../../../pending-action-deep-link";

export const usePendingActionDeepLink = () => {
  const result = useAtomValue(pendingActionDeepLinkViewAtom);

  return {
    data: result.pipe(AsyncResult.value, Option.getOrUndefined),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result),
  } as const;
};
