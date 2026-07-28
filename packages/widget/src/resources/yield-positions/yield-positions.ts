import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { YieldBalancesCommand } from "../../domain/schema/financial-models";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import {
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const yieldPositionsPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(1),
  revalidateOnMount: true,
});
const scheduledRefreshInterval = Duration.minutes(1);

export class YieldPositionsError extends Data.TaggedError(
  "YieldPositionsError"
)<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const toYieldPositionsCommand = (
  scope: WalletScopeOwnerKey
): YieldBalancesCommand => ({
  queries: [{ address: scope.address, network: scope.network }],
});

const yieldPositionsRequestAtom = Atom.family((scope: WalletScopeOwnerKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const source = yield* YieldResourceSource;
        return yield* source
          .getPositions(toYieldPositionsCommand(scope))
          .pipe(Effect.mapError((cause) => new YieldPositionsError({ cause })));
      })
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.yieldPositions(scope)),
      yieldPositionsPolicy,
      Atom.withLabel("yieldPositionsRequestAtom")
    )
);

const yieldPositionsByOwnerResourceAtom = Atom.family(
  (scope: WalletScopeOwnerKey) =>
    yieldPositionsRequestAtom(scope).pipe(
      Atom.withRefresh(scheduledRefreshInterval),
      Atom.withLabel("yieldPositionsResourceAtom")
    )
);

const yieldPositionsByOwnerResource = makePresentableResourceFamily(
  yieldPositionsByOwnerResourceAtom
);

const localYieldPositionsResourceAtom = (scope: WalletScopeKey) =>
  yieldPositionsByOwnerResource.local(walletScopeOwnerKey(scope));

const foregroundYieldPositionsResourceAtom = (scope: WalletScopeKey) =>
  yieldPositionsByOwnerResource.foreground(walletScopeOwnerKey(scope));

export const yieldPositionsResourceAtom = Object.assign(
  foregroundYieldPositionsResourceAtom,
  {
    foreground: foregroundYieldPositionsResourceAtom,
    local: localYieldPositionsResourceAtom,
  }
);

const refreshYieldPositionsByOwnerAtom = Atom.family(
  (scope: WalletScopeOwnerKey) =>
    Atom.fnSync((_input: undefined, get) =>
      get.refresh(yieldPositionsRequestAtom(scope))
    )
);

export const refreshYieldPositionsAtom = (scope: WalletScopeKey) =>
  refreshYieldPositionsByOwnerAtom(walletScopeOwnerKey(scope));
