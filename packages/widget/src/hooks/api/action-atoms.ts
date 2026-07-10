import { Data, Duration, Effect, Schema } from "effect";
import {
  valueEqualAtomFamily,
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../../atoms/api-resource";
import {
  type ActionCommand,
  type ManageActionCommand,
  YieldAction,
} from "../../domain/schema/action-models";
import { ResponseDecodeError } from "../../domain/schema/api-errors";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";

export type ActionRequest =
  | {
      readonly intent: "enter" | "exit";
      readonly command: ActionCommand;
    }
  | {
      readonly intent: "manage";
      readonly command: ManageActionCommand;
    };

export class ActionPreviewKey extends Data.Class<{
  readonly decodeIssue: string | null;
  readonly enabled: boolean;
  readonly request: ActionRequest | null;
}> {}

const executeActionRequest = (request: ActionRequest) =>
  Effect.gen(function* () {
    const api = yield* StakeKitApiService;

    switch (request.intent) {
      case "enter":
        return yield* api.yieldMutations.ActionsControllerEnterYield({
          payload: request.command,
        });
      case "exit":
        return yield* api.yieldMutations.ActionsControllerExitYield({
          payload: request.command,
        });
      case "manage":
        return yield* api.yieldMutations.ActionsControllerManageYield({
          payload: request.command,
        });
    }
  });

export const actionPreviewAtom = valueEqualAtomFamily((key: ActionPreviewKey) =>
  stakeKitApiRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (key.decodeIssue) {
          return yield* new ResponseDecodeError({
            operation: "action-preview-command",
            issue: key.decodeIssue,
            cause: new Error(key.decodeIssue),
          });
        }

        if (!key.enabled || !key.request) return null;

        const response = yield* executeActionRequest(key.request).pipe(
          withApiRequestError(`action-${key.request.intent}-preview`)
        );

        return yield* Schema.decodeUnknownEffect(YieldAction)(response).pipe(
          withResponseDecodeError(`action-${key.request.intent}-preview`)
        );
      })
    )
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.minutes(5),
        staleTime: Duration.infinity,
        revalidateOnMount: false,
      })
    )
);
