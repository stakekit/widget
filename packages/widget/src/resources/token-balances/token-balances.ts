import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { TokenBalanceScanCommand } from "../../domain/finance/models";
import type { WalletScopeKey } from "../../domain/wallet/wallet-scope";
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
  scope: WalletScopeKey
): TokenBalanceScanCommand => ({
  addresses: {
    address: scope.address,
    ...(scope.additionalAddresses
      ? { additionalAddresses: scope.additionalAddresses }
      : {}),
  },
  network: scope.network,
});

const tokenBalancesRequestAtom = Atom.family((scope: WalletScopeKey) =>
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

const tokenBalancesCanonicalAtom = Atom.family((scope: WalletScopeKey) =>
  tokenBalancesRequestAtom(scope).pipe(
    Atom.withRefresh(scheduledRefreshInterval),
    Atom.withLabel("tokenBalancesResourceAtom")
  )
);

export const tokenBalancesResourceAtom = makePresentableResourceFamily(
  tokenBalancesCanonicalAtom
);

export const refreshTokenBalancesAtom = Atom.family((scope: WalletScopeKey) =>
  Atom.fnSync((_input: undefined, get) =>
    get.refresh(tokenBalancesRequestAtom(scope))
  )
);
