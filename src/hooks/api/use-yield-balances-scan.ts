import {
  APIManager,
  YieldBalanceScanRequestDto,
  YieldBalancesWithIntegrationIdDto,
  getYieldYieldBalancesScanQueryKey,
  useYieldYieldBalancesScan,
} from "@stakekit/api-hooks";
import { Just, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useLocalStorageValue } from "../use-local-storage-value";
import { useSKWallet } from "../../providers/sk-wallet";
import { useActionHistoryData } from "../../providers/stake-history";
import { useRefetchQueryNTimes } from "../use-refetch-query-n-times";

export const useYieldBalancesScan = <
  T = YieldBalancesWithIntegrationIdDto[],
>(opts?: {
  select?: (data: YieldBalancesWithIntegrationIdDto[]) => T;
}) => {
  const { network, address, additionalAddresses, isLedgerLive } = useSKWallet();

  const actionHistoryData = useActionHistoryData();

  const lastActionTimestamp = useMemo(
    () => actionHistoryData.map((v) => v.timestamp).extractNullable(),
    [actionHistoryData]
  );

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

  const res = useYieldYieldBalancesScan(
    param.dto,
    { ledgerWalletAPICompatible: isLedgerLive },
    {
      query: {
        enabled: param.enabled,
        select: opts?.select,
        refetchInterval: 1000 * 60,
      },
    }
  );

  /**
   * This is a hack to make sure that the yield balances are updated after a transaction
   */
  useRefetchQueryNTimes({
    enabled: !!lastActionTimestamp,
    key: ["yield-balances-refetch", lastActionTimestamp],
    refetch: () => res.refetch(),
    waitMs: 4000,
    shouldRefetch: () =>
      !!lastActionTimestamp && Date.now() - lastActionTimestamp < 1000 * 12,
  });

  return res;
};

export const invalidateYieldBalances = () =>
  APIManager.getQueryClient()!.invalidateQueries({
    queryKey: [
      getYieldYieldBalancesScanQueryKey({} as YieldBalanceScanRequestDto)[0],
    ],
  });
