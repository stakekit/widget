import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  type ActionPreviewIntent,
  CurrentActionPreviewKey,
  currentActionPreviewAtom,
} from "../resources/action-preview";

type ActionPreviewInput = {
  readonly enabled: boolean;
  readonly intent: ActionPreviewIntent;
};

export const useActionPreview = (input: ActionPreviewInput) => {
  const resource = currentActionPreviewAtom(
    new CurrentActionPreviewKey({
      enabled: input.enabled,
      intent: input.intent,
    })
  );
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: value ?? undefined,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isError: AsyncResult.isFailure(result),
    isFetching: result.waiting,
    isLoading: input.enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
