import type {
  TokenBalanceScanResponseDto,
  TokenGetTokensParams,
} from "@stakekit/api-hooks";
import { getTokenGetTokensQueryKey, tokenGetTokens } from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useSettings } from "../../providers/settings";
import { useSKWallet } from "../../providers/sk-wallet";

export const useDefaultTokens = () => {
  const { network } = useSKWallet();
  const { tokensForEnabledYieldsOnly } = useSettings();

  return useQuery({
    queryKey: getTokenGetTokensQueryKey({ network: network ?? undefined }),
    queryFn: async () =>
      (
        await queryFn({
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
  network,
  enabledYieldsOnly,
}: Pick<TokenGetTokensParams, "network" | "enabledYieldsOnly">) =>
  EitherAsync(() =>
    tokenGetTokens({
      network,
      enabledYieldsOnly: enabledYieldsOnly || undefined,
    })
  ).map((val) =>
    val.map<TokenBalanceScanResponseDto>((v) => ({ ...v, amount: "0" }))
  );
