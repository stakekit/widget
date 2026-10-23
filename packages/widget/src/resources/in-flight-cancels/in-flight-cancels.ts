import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import { getCancellingHandles } from "../../domain/earn/confidential";
import type { YieldId } from "../../domain/identity/identifiers";
import type { WalletScopeOwnerKey } from "../../domain/wallet/wallet-scope";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

// One cancel per pending batch position; a wallet holds a handful at most.
const IN_FLIGHT_CANCELS_LIMIT = 20;

export class InFlightCancelsKey extends Data.Class<{
  readonly scope: WalletScopeOwnerKey;
  readonly yieldId: YieldId;
}> {}

class InFlightCancelsError extends Data.TaggedError("InFlightCancelsError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const inFlightCancelsPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
});

/**
 * Handles of the yield's pending positions with a cancel broadcast but not
 * yet confirmed. Follows the positions' refreshes, since a confirmed cancel
 * removes its position.
 */
const inFlightCancelsAtom = Atom.family((key: InFlightCancelsKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const source = yield* YieldResourceSource;
        const page = yield* source
          .listActivity({
            address: key.scope.address,
            limit: IN_FLIGHT_CANCELS_LIMIT,
            offset: 0,
            statuses: ["PROCESSING"],
            type: "CANCEL_PENDING",
            yieldId: key.yieldId,
          })
          .pipe(
            Effect.mapError((cause) => new InFlightCancelsError({ cause }))
          );
        return getCancellingHandles(page.items ?? []);
      })
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.yieldPositions(key.scope)),
      inFlightCancelsPolicy,
      Atom.withRefresh(Duration.minutes(1)),
      Atom.withLabel("inFlightCancelsResourceAtom")
    )
);

export const inFlightCancelsResourceAtom =
  makePresentableResourceFamily(inFlightCancelsAtom);
