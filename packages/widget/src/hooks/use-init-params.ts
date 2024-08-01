import { getAndValidateInitParams } from "@sk-widget/hooks/use-init-query-params";
import {
  type SettingsContextType,
  useSettings,
} from "@sk-widget/providers/settings";
import { useYieldYieldOpportunityHook } from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import type { SupportedSKChains } from "../domain/types/chains";
import type { InitParams } from "../domain/types/init-params";
import { useSKQueryClient } from "../providers/query-client";
import { useSKWallet } from "../providers/sk-wallet";
import { getYieldOpportunity } from "./api/use-yield-opportunity";

const queryKey = ["init-params"];
const staleTime = 0;
const cacheTime = 0;

export const useInitParams = <T = InitParams>(opts?: {
  select: (val: InitParams) => T;
}) => {
  const { isLedgerLive } = useSKWallet();

  const { externalProviders } = useSettings();

  const queryClient = useSKQueryClient();

  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  return useQuery({
    queryKey,
    staleTime,
    gcTime: cacheTime,
    queryFn: () =>
      queryFn({
        isLedgerLive,
        queryClient,
        yieldYieldOpportunity,
        externalProviders,
      }),
    select: opts?.select,
  });
};

export const getInitParams = (
  params: Parameters<typeof fn>[0] & { queryClient: QueryClient }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey,
      staleTime,
      gcTime: cacheTime,
      queryFn: () => queryFn(params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get init query params");
  });

const queryFn = async (params: Parameters<typeof fn>[0]) =>
  (await fn(params)).unsafeCoerce();

const fn = ({
  isLedgerLive,
  queryClient,
  yieldYieldOpportunity,
  externalProviders,
}: {
  isLedgerLive: boolean;
  queryClient: QueryClient;
  yieldYieldOpportunity: ReturnType<typeof useYieldYieldOpportunityHook>;
  externalProviders: SettingsContextType["externalProviders"];
}): EitherAsync<Error, InitParams> =>
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
        yieldYieldOpportunity,
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
