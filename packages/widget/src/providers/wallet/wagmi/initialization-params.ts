import { Data, Duration, Effect, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  withApiResourcePolicy,
  withInputValidationError,
} from "../../../atoms/api-resource";
import {
  type WalletInitParams,
  WalletInitQueryParams,
} from "../../../domain/schema/wallet-models";
import { StakeKitApiService } from "../../api/api-service";
import { widgetAtomRuntime } from "../../effect-atom-runtime/widget-runtime";

const persistentResource = withApiResourcePolicy({
  idleTTL: Duration.infinity,
  staleTime: Duration.infinity,
  revalidateOnMount: false,
});

export const enabledNetworksAtom = widgetAtomRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* StakeKitApiService;
      return yield* api.legacy.getEnabledNetworks();
    })
  )
  .pipe(persistentResource);

export class WalletInitParamsKey extends Data.Class<{
  readonly externalProviderInitToken: string | null;
}> {}

const readInitQueryParams = (externalProviderInitToken: string | null) => {
  const url = new URL(globalThis.location?.href ?? "http://localhost");
  const token = url.searchParams.get("token") ?? externalProviderInitToken;

  return {
    accountId: url.searchParams.get("accountId"),
    balanceId: url.searchParams.get("balanceId"),
    network:
      url.searchParams.get("network") ??
      (token?.includes("-") ? token.split("-").slice(0, -1).join("-") : null),
    pendingaction: url.searchParams.get("pendingaction"),
    tab: url.searchParams.get("tab"),
    token,
    validator: url.searchParams.get("validator"),
    yieldId: url.searchParams.get("yieldId"),
  };
};

export const walletInitParamsAtom = Atom.family((key: WalletInitParamsKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        const queryParams = yield* Schema.decodeUnknownEffect(
          WalletInitQueryParams
        )(readInitQueryParams(key.externalProviderInitToken)).pipe(
          withInputValidationError("wallet-init-query-params")
        );

        if (!queryParams.yieldId) {
          return {
            ...queryParams,
            yieldData: null,
          } satisfies WalletInitParams;
        }

        const api = yield* StakeKitApiService;
        const yieldData = yield* api.yield.getYield(queryParams.yieldId);
        const network = yield* Schema.decodeEffect(
          WalletInitQueryParams.fields.network
        )(yieldData?.token.network ?? queryParams.network).pipe(
          withInputValidationError("wallet-init-network")
        );

        return {
          ...queryParams,
          network,
          token: yieldData?.token.symbol ?? queryParams.token,
          yieldData,
        } satisfies WalletInitParams;
      })
    )
    .pipe(persistentResource)
);
