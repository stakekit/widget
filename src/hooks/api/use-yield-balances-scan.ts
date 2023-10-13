import {
  APIManager,
  YieldBalanceScanRequestDto,
  getYieldYieldBalancesScanQueryKey,
  useYieldYieldBalancesScan,
} from "@stakekit/api-hooks";
import { Just, Maybe } from "purify-ts";
import { useSKWallet } from "../wallet/use-sk-wallet";
import { useCallback, useMemo } from "react";
import { useLocalStorageValue } from "../use-local-storage-value";

export const useYieldBalancesScan = () => {
  const { network, address, additionalAddresses, isLedgerLive } = useSKWallet();

  const customValidators = useLocalStorageValue(
    "sk-widget@1//customValidators"
  );

  const param = useMemo(
    () =>
      Maybe.fromRecord({
        additionalAddresses: Just(additionalAddresses ?? undefined),
        address: Maybe.fromNullable(address),
        network: Maybe.fromNullable(network),
      }).mapOrDefault<{ dto: YieldBalanceScanRequestDto; enabled: boolean }>(
        (val) => ({
          enabled: true,
          dto: {
            addresses: {
              address: val.address,
              additionalAddresses: val.additionalAddresses,
            },
            network: val.network,
            customValidators: Maybe.fromNullable(customValidators)
              .chainNullable((v) => v[val.network])
              .chainNullable((v) => v[val.address])
              .orDefault([]),
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
    [additionalAddresses, address, customValidators, network]
  );

  return useYieldYieldBalancesScan(
    param.dto,
    { ledgerWalletAPICompatible: isLedgerLive },
    {
      query: {
        enabled: param.enabled,
        staleTime: 1000 * 60 * 5,
      },
    }
  );
};

export const useInvalidateYieldBalances = () =>
  useCallback(() => {
    APIManager.getQueryClient()!.invalidateQueries({
      queryKey: [
        getYieldYieldBalancesScanQueryKey({} as YieldBalanceScanRequestDto)[0],
      ],
    });
  }, []);
