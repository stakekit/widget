import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import type { GasBalancesCommand } from "../../domain/finance/models";
import type { Token } from "../../domain/token/token";
import { isWalletNetwork } from "../../domain/wallet/network";
import { WalletScopeKey } from "../../domain/wallet/wallet-scope";
import { appRuntime } from "../../runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { LegacyResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class GasTokenBalancesKey extends Data.TaggedClass(
  "GasTokenBalancesKey"
)<{
  readonly command: GasBalancesCommand;
}> {}

/**
 * The key for a Wallet Scope's gas token balance: `token` on its network,
 * or, unset, the native token of the scope's own network.
 */
export const walletScopeGasTokenBalancesKey = (
  scope: Pick<WalletScopeKey, "additionalAddresses" | "address" | "network">,
  token?: Pick<Token, "address" | "network">
) =>
  new GasTokenBalancesKey({
    command: {
      addresses: [
        {
          address: scope.address,
          ...(scope.additionalAddresses
            ? { additionalAddresses: scope.additionalAddresses }
            : {}),
          network: token?.network ?? scope.network,
          ...(token?.address ? { tokenAddress: token.address } : {}),
        },
      ],
    },
  });

class GasTokenBalancesError extends Data.TaggedError("GasTokenBalancesError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const gasBalancesPolicy = withApiResourcePolicy({
  staleTime: Duration.seconds(30),
});

const gasTokenBalancesCanonicalAtom = Atom.family((key: GasTokenBalancesKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const source = yield* LegacyResourceSource;
        return yield* source
          .getGasTokenBalances(key.command)
          .pipe(
            Effect.mapError((cause) => new GasTokenBalancesError({ cause }))
          );
      })
    )
    .pipe(
      Atom.withReactivity(
        key.command.addresses.flatMap((address) =>
          isWalletNetwork(address.network)
            ? resourceInvalidationKeys.walletBalances(
                new WalletScopeKey({
                  additionalAddresses: address.additionalAddresses ?? null,
                  address: address.address,
                  network: address.network,
                })
              )
            : []
        )
      ),
      gasBalancesPolicy,
      Atom.withLabel("gasTokenBalancesResourceAtom")
    )
);

export const gasTokenBalancesResourceAtom = makePresentableResourceFamily(
  gasTokenBalancesCanonicalAtom
);
