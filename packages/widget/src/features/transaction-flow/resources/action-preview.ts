import { Data, Duration, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { ActionPreviewRequest } from "../../../services/api/yield-api-service";
import { YieldApiService } from "../../../services/api/yield-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import type { ClassicTransactionFlowActionPreviewIntent } from "../model/classic-transaction-flow";
import { enterStakeRequestAtom } from "../state/enter-request";
import { exitStakeRequestAtom } from "../state/exit-request";
import { pendingActionRequestAtom } from "../state/pending-action-request";

export class ActionPreviewKey extends Data.Class<{
  readonly request: ActionPreviewRequest | null;
}> {}

export const actionPreviewAtom = Atom.family((key: ActionPreviewKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.request) return null;

        const api = yield* YieldApiService;
        return yield* api.previewAction(key.request);
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

export type ActionPreviewIntent = ClassicTransactionFlowActionPreviewIntent;

export class CurrentActionPreviewKey extends Data.Class<{
  readonly enabled: boolean;
  readonly intent: ActionPreviewIntent;
}> {}

const getCurrentActionPreviewRequest = (
  get: Atom.AtomContext,
  intent: ActionPreviewIntent
): ActionPreviewRequest | null => {
  switch (intent) {
    case "enter": {
      const request = get(enterStakeRequestAtom);
      return request ? { command: request.requestDto, intent } : null;
    }
    case "exit": {
      const request = get(exitStakeRequestAtom);
      return request ? { command: request.requestDto, intent } : null;
    }
    case "manage": {
      const request = get(pendingActionRequestAtom);
      return request ? { command: request.requestDto, intent } : null;
    }
  }
};

export const currentActionPreviewAtom = Atom.family(
  (selection: CurrentActionPreviewKey) =>
    Atom.make((get) => {
      const request = selection.enabled
        ? getCurrentActionPreviewRequest(get, selection.intent)
        : null;

      return request
        ? get(actionPreviewAtom(new ActionPreviewKey({ request })))
        : AsyncResult.success(null);
    })
);
