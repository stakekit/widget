import { Data, Duration, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { YieldId } from "../../domain/identity/identifiers";
import {
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../domain/wallet/wallet-scope";
import { appRuntime } from "../../runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";
import { fillRevealedPositions } from "../revealed-balances/revealed-balances";

/** One yield's balances of a Wallet Scope Owner, in any address casing. */
export class SingleYieldBalancesKey extends Data.TaggedClass(
  "SingleYieldBalancesKey"
)<{
  readonly scope: WalletScopeOwnerKey;
  readonly yieldId: YieldId;
}> {
  constructor(input: {
    readonly scope: WalletScopeKey | WalletScopeOwnerKey;
    readonly yieldId: YieldId;
  }) {
    super({ scope: walletScopeOwnerKey(input.scope), yieldId: input.yieldId });
  }
}

class SingleYieldBalancesError extends Data.TaggedError(
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
              address: key.scope.address,
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
          resourceInvalidationKeys.singleYieldBalances(key.scope)
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
