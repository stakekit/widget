import {
  APIManager,
  YieldBalanceScanRequestDto,
  YieldBalancesWithIntegrationIdDto,
  getYieldYieldBalancesScanQueryKey,
  useYieldYieldBalancesScan,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Just, Maybe, Right } from "purify-ts";
import { useMemo } from "react";
import { useLocalStorageValue } from "../use-local-storage-value";
import { useSKWallet } from "../../providers/sk-wallet";
import { useActionHistoryData } from "../../providers/stake-history";
import { waitForMs } from "../../utils";

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
        staleTime: 1000 * 60 * 5,
        select: opts?.select,
      },
    }
  );

  /**
   * This is a hack to make sure that the yield balances are updated after a transaction
   */
  useQuery({
    queryKey: [lastActionTimestamp],
    refetchOnMount: false,
    enabled: !!lastActionTimestamp,
    queryFn: async () => {
      if (
        !lastActionTimestamp ||
        Date.now() - lastActionTimestamp > 1000 * 12
      ) {
        return;
      }

      await EitherAsync.sequence(
        Array.from({ length: 2 }).map(() =>
          EitherAsync(async () => {
            await waitForMs(4000);
            await res.refetch();
          }).chainLeft(async () => Right(null))
        )
      );
    },
  });

  return res;
};

export const invalidateYieldBalances = () =>
  APIManager.getQueryClient()!.invalidateQueries({
    queryKey: [
      getYieldYieldBalancesScanQueryKey({} as YieldBalanceScanRequestDto)[0],
    ],
  });
