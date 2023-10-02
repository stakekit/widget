import {
  TokenBalanceScanDto,
  useTokenTokenBalancesScan,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../wallet/use-sk-wallet";
import { Just, Maybe } from "purify-ts";
import { useMemo } from "react";

export const useTokenBalancesScan = () => {
  const { additionalAddresses, address, network } = useSKWallet();

  const param = useMemo(
    () =>
      Maybe.fromRecord({
        additionalAddresses: Just(additionalAddresses ?? undefined),
        address: Maybe.fromNullable(address),
        network: Maybe.fromNullable(network),
      }).mapOrDefault<{ dto: TokenBalanceScanDto; enabled: boolean }>(
        (val) => ({
          enabled: true,
          dto: {
            addresses: {
              address: val.address,
              additionalAddresses: val.additionalAddresses,
            },
            network: val.network,
          },
        }),
        {
          enabled: false,
          dto: {
            addresses: { address: "", additionalAddresses: undefined },
            network: "ethereum",
          },
        }
      ),
    [additionalAddresses, address, network]
  );

  return useTokenTokenBalancesScan(param.dto, {
    query: { enabled: param.enabled },
  });
};
