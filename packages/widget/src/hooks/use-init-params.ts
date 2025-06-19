import { getYieldOpportunity } from "@sk-widget/hooks/api/use-yield-opportunity/get-yield-opportunity";
import { getAndValidateInitParams } from "@sk-widget/hooks/use-init-query-params";
import { useWhitelistedValidators } from "@sk-widget/hooks/use-whitelisted-validators";
import { useSettings } from "@sk-widget/providers/settings";
import type { SettingsContextType } from "@sk-widget/providers/settings/types";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import type { SupportedSKChains } from "../domain/types/chains";
import type { InitParams } from "../domain/types/init-params";
import { useSKQueryClient } from "../providers/query-client";

const queryKey = ["init-params"];
const staleTime = 0;
const cacheTime = 0;

export const useInitParams = <T = InitParams>(opts?: {
  select: (val: InitParams) => T;
}) => {
  const { isLedgerLive } = useSKWallet();
  const { externalProviders } = useSettings();
  const queryClient = useSKQueryClient();
  const whitelistedValidatorAddresses = useWhitelistedValidators();

  return useQuery({
    queryKey,
    staleTime,
    gcTime: cacheTime,
    queryFn: () =>
      queryFn({
        isLedgerLive,
        queryClient,
        externalProviders,
        whitelistedValidatorAddresses,
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
  externalProviders,
  whitelistedValidatorAddresses,
}: {
  isLedgerLive: boolean;
  queryClient: QueryClient;
  externalProviders: SettingsContextType["externalProviders"];
  whitelistedValidatorAddresses: Set<string> | null;
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
        whitelistedValidatorAddresses,
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
