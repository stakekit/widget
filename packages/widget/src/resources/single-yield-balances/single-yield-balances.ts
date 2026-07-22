import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { WalletAddress, YieldId } from "../../domain/schema/identifiers";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";

export class SingleYieldBalancesKey extends Data.TaggedClass(
  "SingleYieldBalancesKey"
)<{
  readonly address: WalletAddress;
  readonly yieldId: YieldId;
}> {}

export class SingleYieldBalancesError extends Data.TaggedError(
  "SingleYieldBalancesError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const balancesPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(1),
  revalidateOnMount: true,
});

export const singleYieldBalancesResourceAtom = Atom.family(
  (key: SingleYieldBalancesKey) =>
    appRuntime
      .atom(() =>
        Effect.gen(function* () {
          const source = yield* YieldResourceSource;
          return yield* source
            .getSingleYieldBalances({
              address: key.address,
              yieldId: key.yieldId,
            })
            .pipe(
              Effect.mapError(
                (cause) => new SingleYieldBalancesError({ cause })
              )
            );
        })
      )
      .pipe(
        Atom.withReactivity(
          resourceInvalidationKeys.singleYieldBalances(key.address)
        ),
        balancesPolicy,
        Atom.withLabel("singleYieldBalancesResourceAtom")
      )
);
