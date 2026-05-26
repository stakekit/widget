import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import type { SupportedSKChains } from "../domain/types/chains";
import type { InitParams } from "../domain/types/init-params";
import type { SKExternalProviders } from "../domain/types/wallets";
import type { ApiClient } from "../providers/api/api-client";
import { getYieldOpportunity } from "./api/use-yield-opportunity/get-yield-opportunity";
import { getAndValidateInitParams } from "./use-init-query-params";

export const initParamsQueryKey = ["init-params"];
export const initParamsStaleTime = 0;
export const initParamsCacheTime = 0;

type InitParamsQueryParams = {
  isLedgerLive: boolean;
  queryClient: QueryClient;
  apiClient: ApiClient;
  externalProviders: SKExternalProviders | undefined;
};

export const getInitParams = (params: InitParamsQueryParams) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: initParamsQueryKey,
      staleTime: initParamsStaleTime,
      gcTime: initParamsCacheTime,
      queryFn: () => queryInitParams(params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get init query params");
  });

export const queryInitParams = async (params: InitParamsQueryParams) =>
  (await resolveInitParams(params)).unsafeCoerce();

const resolveInitParams = ({
  isLedgerLive,
  queryClient,
  apiClient,
  externalProviders,
}: InitParamsQueryParams): EitherAsync<Error, InitParams> =>
  EitherAsync.liftEither(
    getAndValidateInitParams({
      externalProviderInitToken: externalProviders?.initToken,
    }).toEither(new Error("missing query params"))
  ).chain<Error, InitParams>((val) => {
    const yId = val.yieldId;

    if (yId) {
      return getYieldOpportunity({
        isLedgerLive,
        yieldId: yId,
        queryClient,
        apiClient,
      })
        .map((yieldData) => ({
          ...val,
          network: yieldData.token.network as SupportedSKChains,
          token: yieldData.token.symbol,
          yieldData,
        }))
        .chainLeft(async () => Right({ ...val, yieldData: null }));
    }

    return EitherAsync.liftEither(Right({ ...val, yieldData: null }));
  });
