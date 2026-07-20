import { Context, Effect, Layer } from "effect";
import { makeClassicTransactionFlowIdentity } from "../model/classic-transaction-flow";

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
