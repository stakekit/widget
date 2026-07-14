import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../atoms/api-resource";
import { StakeKitApiService } from "../../providers/api/api-service";
import type { ActionPreviewRequest } from "../../providers/api/yield-api-service";
import { widgetAtomRuntime } from "../../providers/effect-atom-runtime/widget-runtime";

export class ActionPreviewKey extends Data.Class<{
  readonly enabled: boolean;
  readonly request: ActionPreviewRequest | null;
}> {}

export const actionPreviewAtom = Atom.family((key: ActionPreviewKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.enabled || !key.request) return null;

        const api = yield* StakeKitApiService;
        return yield* api.yield.previewAction(key.request);
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
