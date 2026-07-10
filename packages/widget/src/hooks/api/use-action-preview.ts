import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  ActionCommand,
  ManageActionCommand,
} from "../../domain/schema/action-models";
import type {
  YieldCreateActionDto,
  YieldCreateManageActionDto,
} from "../../domain/types/action";
import {
  ActionPreviewKey,
  type ActionRequest,
  actionPreviewAtom,
} from "./action-atoms";

type ActionPreviewInput =
  | {
      readonly command: YieldCreateActionDto;
      readonly enabled: boolean;
      readonly intent: "enter" | "exit";
    }
  | {
      readonly command: YieldCreateManageActionDto;
      readonly enabled: boolean;
      readonly intent: "manage";
    };

const decodeRequest = (input: ActionPreviewInput) => {
  const decoded =
    input.intent === "manage"
      ? Schema.decodeUnknownResult(ManageActionCommand)(input.command)
      : Schema.decodeUnknownResult(ActionCommand)(input.command);

  if (Result.isFailure(decoded)) {
    return {
      decodeIssue: decoded.failure.message,
      request: null,
    } as const;
  }

  return {
    decodeIssue: null,
    request: {
      intent: input.intent,
      command: decoded.success,
    } as ActionRequest,
  } as const;
};

export const useActionPreview = (input: ActionPreviewInput) => {
  const decoded = decodeRequest(input);
  const resource = actionPreviewAtom(
    new ActionPreviewKey({
      ...decoded,
      enabled: input.enabled,
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
