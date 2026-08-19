import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { YieldBalancesCommand } from "../../domain/finance/models";
import type { YieldId } from "../../domain/identity/identifiers";
import {
  getPositionBalances,
  getPositionData,
  type PositionBalancesByType,
  toPositionBalancesByType,
  toPositionsData,
} from "../../domain/portfolio/positions";
import {
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../domain/wallet/wallet-scope";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const yieldPositionsPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
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

const positionsDataAtom = Atom.family((scope: WalletScopeKey) =>
  yieldPositionsResourceAtom.foreground(scope).pipe(
    Atom.mapResult((page) => toPositionsData(page.items)),
    Atom.withLabel("positionsDataAtom")
  )
);

export class PositionDataKey extends Data.Class<{
  readonly scope: WalletScopeKey;
  readonly yieldId: YieldId | null;
}> {}

export const positionDataAtom = Atom.family((key: PositionDataKey) =>
  positionsDataAtom(key.scope).pipe(
    Atom.mapResult((positions) => getPositionData(positions, key.yieldId))
  )
);

export class PositionBalancesKey extends Data.Class<{
  readonly balanceId: string | null;
  readonly scope: WalletScopeKey;
  readonly yieldId: YieldId | null;
}> {}

export const positionBalancesAtom = Atom.family((key: PositionBalancesKey) =>
  positionDataAtom(
    new PositionDataKey({ scope: key.scope, yieldId: key.yieldId })
  ).pipe(
    Atom.mapResult((position) => getPositionBalances(position, key.balanceId))
  )
);

export const positionBalancesByTypeAtom = Atom.family(
  (key: PositionBalancesKey) =>
    positionBalancesAtom(key).pipe(
      Atom.mapResult((position): PositionBalancesByType | null =>
        position ? toPositionBalancesByType(position.balances) : null
      )
    )
);
