import type { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import { getTokenGetTokensQueryKey, tokenGetTokens } from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import type { SKWallet } from "../../domain/types";
import { useSKWallet } from "../../providers/sk-wallet";

export const useDefaultTokens = () => {
  const { network } = useSKWallet();

  return useQuery({
    queryKey: getTokenGetTokensQueryKey({ network: network ?? undefined }),
    queryFn: async () => (await queryFn({ network })).unsafeCoerce(),
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
}: {
  network: SKWallet["network"];
}) =>
  EitherAsync(() => tokenGetTokens({ network: network ?? undefined })).map(
    (val) =>
      val.map<TokenBalanceScanResponseDto>((v) => ({ ...v, amount: "0" }))
  );
