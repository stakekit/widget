import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { TokenBalanceScanCommand } from "../../domain/finance/models";
import {
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../domain/wallet/wallet-scope";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { LegacyResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const tokenBalancesPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
});
const scheduledRefreshInterval = Duration.minutes(1);

export class TokenBalancesError extends Data.TaggedError("TokenBalancesError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const toTokenBalancesScanCommand = (
  scope: WalletScopeOwnerKey
): TokenBalanceScanCommand => ({
  address: scope.address,
  network: scope.network,
});

const tokenBalancesRequestAtom = Atom.family((scope: WalletScopeOwnerKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const source = yield* LegacyResourceSource;
        return yield* source
          .scanTokenBalances(toTokenBalancesScanCommand(scope))
          .pipe(Effect.mapError((cause) => new TokenBalancesError({ cause })));
      })
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.walletBalances(scope)),
      tokenBalancesPolicy,
      Atom.withLabel("tokenBalancesRequestAtom")
    )
);

const tokenBalancesByOwnerCanonicalAtom = Atom.family(
  (scope: WalletScopeOwnerKey) =>
    tokenBalancesRequestAtom(scope).pipe(
      Atom.withRefresh(scheduledRefreshInterval),
      Atom.withLabel("tokenBalancesResourceAtom")
    )
);

const tokenBalancesByOwnerResource = makePresentableResourceFamily(
  tokenBalancesByOwnerCanonicalAtom
);

const localTokenBalancesResourceAtom = (scope: WalletScopeKey) =>
  tokenBalancesByOwnerResource.local(walletScopeOwnerKey(scope));

const foregroundTokenBalancesResourceAtom = (scope: WalletScopeKey) =>
  tokenBalancesByOwnerResource.foreground(walletScopeOwnerKey(scope));

export const tokenBalancesResourceAtom = Object.assign(
  foregroundTokenBalancesResourceAtom,
  {
    foreground: foregroundTokenBalancesResourceAtom,
    local: localTokenBalancesResourceAtom,
  }
);

const refreshTokenBalancesByOwnerAtom = Atom.family(
  (scope: WalletScopeOwnerKey) =>
    Atom.fnSync((_input: undefined, get) =>
      get.refresh(tokenBalancesRequestAtom(scope))
    )
);

export const refreshTokenBalancesAtom = (scope: WalletScopeKey) =>
  refreshTokenBalancesByOwnerAtom(walletScopeOwnerKey(scope));
