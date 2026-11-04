import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import {
  type ConfidentialRevealPosition,
  getConfidentialRevealRequests,
} from "../../domain/earn/confidential";
import type { WalletScopeKey } from "../../domain/wallet/wallet-scope";
import { resourceInvalidationKeys } from "../resource-invalidation";
import { RevealedBalances } from "./revealed-balances";
import { ZamaService } from "./zama-service";

const invalidatePositions = (scope: WalletScopeKey) =>
  Effect.gen(function* () {
    const reactivity = yield* Reactivity.Reactivity;
    yield* reactivity.invalidate([
      ...resourceInvalidationKeys.yieldPositions(scope),
      ...resourceInvalidationKeys.singleYieldBalances(scope.address),
    ]);
  });

/**
 * Reveals the owner's still-hidden position balances: one decryption per
 * chain, each handle once.
 */
export const revealConfidentialPositions = Effect.fn(
  "revealConfidentialPositions"
)(function* (
  scope: WalletScopeKey,
  positions: ReadonlyArray<ConfidentialRevealPosition>
) {
  const requests = getConfidentialRevealRequests(positions);
  if (requests.length === 0) return;

  const zama = yield* ZamaService;
  yield* Effect.forEach(
    requests,
    ({ chainId, handles }) =>
      zama.revealHandles({ chainId, handles, owner: scope.address }),
    { discard: true }
  );
  yield* invalidatePositions(scope);
});

/** Hides every revealed position balance again. */
export const hideConfidentialPositions = Effect.fn("hideConfidentialPositions")(
  function* (scope: WalletScopeKey) {
    yield* (yield* RevealedBalances).forgetHandles;
    yield* invalidatePositions(scope);
  }
);
