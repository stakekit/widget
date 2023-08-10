import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import {
  BalancesRequestDto,
  TokenDto,
  useTokenGetTokenBalances,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../use-sk-wallet";

export const useTokenAvailableAmount = ({
  tokenDto,
}: {
  tokenDto: Maybe<TokenDto>;
}) => {
  const { address, additionalAddresses } = useSKWallet();

  const balancesRequestDto = tokenDto
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
