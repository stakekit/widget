import { Data, Duration, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { WalletAddress, YieldId } from "../../domain/identity/identifiers";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { fillRevealedPositions } from "../confidential-values/index";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

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
  staleTime: Duration.minutes(1),
});

const singleYieldBalancesCanonicalAtom = Atom.family(
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

const revealedSingleYieldBalancesAtom = Atom.family(
  (key: SingleYieldBalancesKey) =>
    singleYieldBalancesCanonicalAtom(key).pipe(
      Atom.transform((get, self) =>
        AsyncResult.map(get(self), (response) => ({
          ...response,
          balances:
            fillRevealedPositions(get, [
              { ...response, yieldId: key.yieldId },
            ])[0]?.balances ?? response.balances,
        }))
      )
    )
);

export const singleYieldBalancesResourceAtom = makePresentableResourceFamily(
  revealedSingleYieldBalancesAtom
);
