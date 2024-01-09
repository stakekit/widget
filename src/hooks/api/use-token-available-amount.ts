import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import {
  APIManager,
  BalancesRequestDto,
  TokenDto,
  getTokenGetTokenBalancesQueryKey,
  useTokenGetTokenBalances,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";

export const useTokenAvailableAmount = ({
  tokenDto,
}: {
  tokenDto: Maybe<TokenDto>;
}) => {
  const { address, additionalAddresses, network } = useSKWallet();

  const balancesRequestDto = tokenDto
    .filter((t) => t.network === network)
    .map((t) => ({
      network: t.network,
      tokenAddress: t.address,
    }))
    .chain((d) =>
      Maybe.fromNullable(address).map((a) => ({ ...d, address: a }))
    )
    .mapOrDefault<{ dto: BalancesRequestDto; enabled: boolean }>(
      (n) => ({
        enabled: true,
        dto: {
          addresses: [
            {
              address: n.address,
              network: n.network,
              tokenAddress: n.tokenAddress,
              additionalAddresses: additionalAddresses ?? undefined,
            },
          ],
        },
      }),
      {
        dto: {
          addresses: [
            {
              address: "",
              network: "ethereum",
              tokenAddress: "",
            },
          ],
        },
        enabled: false,
      }
    );

  return useTokenGetTokenBalances(balancesRequestDto.dto, {
    query: {
      enabled: balancesRequestDto.enabled,
      select: (data) =>
        List.head(data).mapOrDefault(
          (b) => new BigNumber(b.amount ?? 0),
          new BigNumber(0)
        ),
    },
  });
};

export const invalidateTokenAvailableAmount = () =>
  APIManager.getQueryClient()!.invalidateQueries({
    queryKey: [getTokenGetTokenBalancesQueryKey({} as any)[0]],
  });
