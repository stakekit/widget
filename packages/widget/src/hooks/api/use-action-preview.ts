import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
  ActionCommand,
  ManageActionCommand,
} from "../../domain/schema/action-models";
import type { ActionPreviewRequest } from "../../providers/api/yield-api-service";
import { ActionPreviewKey, actionPreviewAtom } from "./action-atoms";

type ActionPreviewInput =
  | {
      readonly command: ActionCommand;
      readonly enabled: boolean;
      readonly intent: "enter" | "exit";
    }
  | {
      readonly command: ManageActionCommand;
      readonly enabled: boolean;
      readonly intent: "manage";
    };

export const useActionPreview = (input: ActionPreviewInput) => {
  const request = {
    intent: input.intent,
    command: input.command,
  } as ActionPreviewRequest;
  const resource = actionPreviewAtom(
    new ActionPreviewKey({
      enabled: input.enabled,
      request,
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
