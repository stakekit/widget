import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import type { TokenBalanceScanResponseDto } from "../../domain/types/token-balance";
import type { TokenGetTokensParams } from "../../domain/types/tokens";
import type { ApiClient } from "../../providers/api/api-client";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSettings } from "../../providers/settings";
import { useSKWallet } from "../../providers/sk-wallet";

const getTokenGetTokensQueryKey = (params?: TokenGetTokensParams) =>
  ["/v1/tokens", ...(params ? [params] : [])] as const;

export const useDefaultTokens = () => {
  const { network } = useSKWallet();
  const { tokensForEnabledYieldsOnly } = useSettings();
  const apiClient = useApiClient();

  return useQuery({
    queryKey: getTokenGetTokensQueryKey({ network: network ?? undefined }),
    queryFn: async () =>
      (
        await queryFn({
          apiClient,
          network: network ?? undefined,
          enabledYieldsOnly: !!tokensForEnabledYieldsOnly,
        })
      ).unsafeCoerce(),
    staleTime: 1000 * 60 * 5,
  });
};

export const getDefaultTokens = (
  params: Parameters<typeof queryFn>[0] & { queryClient: QueryClient }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getTokenGetTokensQueryKey({
        network: params.network ?? undefined,
      }),
      queryFn: async () => (await queryFn(params)).unsafeCoerce(),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get multi yields");
  });

const queryFn = ({
  apiClient,
  network,
  enabledYieldsOnly,
}: Pick<TokenGetTokensParams, "network" | "enabledYieldsOnly"> & {
  apiClient: ApiClient;
}) =>
  EitherAsync(() =>
    apiClient.legacy.TokenControllerGetTokens({
      params: {
        network,
        enabledYieldsOnly: enabledYieldsOnly || undefined,
      },
    })
  ).map((val) =>
    val.map<TokenBalanceScanResponseDto>((v) => ({
      token: v.token,
      availableYields: v.availableYields,
      amount: "0",
    }))
  );
