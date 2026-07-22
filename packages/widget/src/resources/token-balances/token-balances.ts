import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { TokenBalanceScanCommand } from "../../domain/schema/financial-models";
import { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import type { WalletScopeKey } from "../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";

const tokenBalancesPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(1),
  revalidateOnMount: true,
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

export const tokenBalancesResourceAtom = Atom.family((scope: WalletScopeKey) =>
  tokenBalancesRequestAtom(scope).pipe(
    Atom.withRefresh(scheduledRefreshInterval),
    Atom.withLabel("tokenBalancesResourceAtom")
  )
);

export const refreshTokenBalancesAtom = Atom.family((scope: WalletScopeKey) =>
  Atom.fnSync((_input: undefined, get) =>
    get.refresh(tokenBalancesRequestAtom(scope))
  )
);
