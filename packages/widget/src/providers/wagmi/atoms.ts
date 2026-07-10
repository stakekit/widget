import { Data, Duration, Effect, Schema } from "effect";
import {
  valueEqualAtomFamily,
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../../atoms/api-resource";
import {
  EnabledNetworksResponse,
  WalletInitParams,
  WalletInitQueryParams,
} from "../../domain/schema/wallet-models";
import { StakeKitApiService } from "../api/api-client";
import { stakeKitApiRuntime } from "../effect-atom-runtime/stakekit-api-service";

const persistentResource = withApiResourcePolicy({
  idleTTL: Duration.infinity,
  staleTime: Duration.infinity,
  revalidateOnMount: false,
});

export const enabledNetworksAtom = stakeKitApiRuntime
  .atom(() =>
    Effect.gen(function* () {
      const api = yield* StakeKitApiService;
      const response = yield* api.legacy
        .YieldControllerGetMyNetworks(undefined)
        .pipe(withApiRequestError("enabled-networks"));

      return yield* Schema.decodeUnknownEffect(EnabledNetworksResponse)(
        response
      ).pipe(withResponseDecodeError("enabled-networks"));
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

export const walletInitParamsAtom = valueEqualAtomFamily(
  (key: WalletInitParamsKey) =>
    stakeKitApiRuntime
      .atom(() =>
        Effect.gen(function* () {
          const queryParams = yield* Schema.decodeUnknownEffect(
            WalletInitQueryParams
          )(readInitQueryParams(key.externalProviderInitToken)).pipe(
            withResponseDecodeError("wallet-init-query-params")
          );

          if (!queryParams.yieldId) {
            return yield* Schema.decodeUnknownEffect(WalletInitParams)({
              ...queryParams,
              yieldData: null,
            }).pipe(withResponseDecodeError("wallet-init-params"));
          }

          const api = yield* StakeKitApiService;
          const response = yield* api.yield
            .YieldsControllerGetYield(queryParams.yieldId, undefined)
            .pipe(withApiRequestError("wallet-init-yield"));
          const yieldData = yield* Schema.decodeUnknownEffect(
            WalletInitParams.fields.yieldData
          )(response).pipe(withResponseDecodeError("wallet-init-yield"));

          return yield* Schema.decodeUnknownEffect(WalletInitParams)({
            ...queryParams,
            network: yieldData?.token.network ?? queryParams.network,
            token: yieldData?.token.symbol ?? queryParams.token,
            yieldData,
          }).pipe(withResponseDecodeError("wallet-init-params"));
        })
      )
      .pipe(persistentResource)
);
