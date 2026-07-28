import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { GasBalancesCommand } from "../../domain/schema/financial-models";
import { isSupportedChain } from "../../domain/types/chains";
import { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { WalletScopeKey } from "../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class GasTokenBalancesKey extends Data.TaggedClass(
  "GasTokenBalancesKey"
)<{
  readonly command: GasBalancesCommand;
}> {}

class GasTokenBalancesError extends Data.TaggedError("GasTokenBalancesError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const gasBalancesPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.seconds(30),
  revalidateOnMount: true,
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
          isSupportedChain(address.network)
            ? resourceInvalidationKeys.walletBalances(
                new WalletScopeKey({
                  additionalAddresses: address.additionalAddresses,
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
