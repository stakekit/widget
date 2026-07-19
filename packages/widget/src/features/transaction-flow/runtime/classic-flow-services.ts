import { Context, Data, Effect, Layer } from "effect";
import type { YieldAction } from "../../../domain/schema/action-models";
import {
  type ActionPreviewRequest,
  YieldApiService,
} from "../../../services/api/yield-api-service";
import { makeClassicTransactionFlowIdentity } from "../model/classic-transaction-flow";

export class ClassicFlowPreviewError extends Data.TaggedError(
  "ClassicFlowPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export class ClassicFlowPreviewService extends Context.Service<
  ClassicFlowPreviewService,
  {
    readonly preview: (
      request: ActionPreviewRequest
    ) => Effect.Effect<YieldAction, ClassicFlowPreviewError>;
  }
>()("stakekit/widget/transaction-flow/ClassicFlowPreviewService") {
  static readonly layer = Layer.effect(
    ClassicFlowPreviewService,
    Effect.gen(function* () {
      const api = yield* YieldApiService;

      return ClassicFlowPreviewService.of({
        preview: (request) =>
          api.previewAction(request).pipe(
            Effect.mapError(
              (cause) =>
                new ClassicFlowPreviewError({
                  cause,
                  message: "Classic Transaction Flow Action preview failed.",
                })
            )
          ),
      });
    })
  );
}

export class ClassicFlowIdentityService extends Context.Service<
  ClassicFlowIdentityService,
  {
    readonly next: Effect.Effect<
      ReturnType<typeof makeClassicTransactionFlowIdentity>
    >;
  }
>()("stakekit/widget/transaction-flow/ClassicFlowIdentityService") {
  static readonly layer = Layer.succeed(
    ClassicFlowIdentityService,
    ClassicFlowIdentityService.of({
      next: Effect.sync(() =>
        makeClassicTransactionFlowIdentity(globalThis.crypto.randomUUID())
      ),
    })
  );
}
