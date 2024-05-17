import type { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import {
  getTokenGetTokensQueryKey,
  useTokenGetTokensHook,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";
import type { SKWallet } from "../../domain/types";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";

export const useDefaultTokens = () => {
  const { network } = useSKWallet();
  const tokenGetTokens = useTokenGetTokensHook();

  return useQuery({
    queryKey: getTokenGetTokensQueryKey({ network: network ?? undefined }),
    queryFn: async () =>
      (await queryFn({ network, tokenGetTokens })).unsafeCoerce(),
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
  tokenGetTokens,
}: {
  network: SKWallet["network"];
  tokenGetTokens: ReturnType<typeof useTokenGetTokensHook>;
}) =>
  EitherAsync(() => tokenGetTokens({ network: network ?? undefined })).map(
    (val) =>
      val.map<TokenBalanceScanResponseDto>((v) => ({ ...v, amount: "0" }))
  );
