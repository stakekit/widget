import { Just, List, Maybe } from "purify-ts";
import { useLocalStorageValue } from "./use-local-storage-value";
import { useSKWallet } from "./wallet/use-sk-wallet";
import {
  YieldBalanceRequestDto,
  YieldDto,
  useYieldGetSingleYieldBalances,
} from "@stakekit/api-hooks";
import { useMemo } from "react";

export const useYieldBalance = (integration: Maybe<YieldDto>) => {
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
        integrationId: integration.map((s) => s.id),
      }).mapOrDefault<{
        dto: YieldBalanceRequestDto;
        integrationId: string;
        enabled: boolean;
      }>(
        (val) => ({
          enabled: true,
          integrationId: val.integrationId,
          dto: {
            addresses: {
              address: val.address,
              additionalAddresses: val.additionalAddresses,
            },
            args: {
              validatorAddresses: Maybe.fromNullable(customValidators)
                .chainNullable((v) => v[val.network])
                .chainNullable((v) => v[val.address])
                .chain((v) =>
                  List.find(
                    (item) => item.integrationId === val.integrationId,
                    v
                  )
                )
                .map((v) => v.validatorAddresses)
                .orDefault([]),
            },
          },
        }),
        {
          enabled: false,
          integrationId: "",
          dto: {
            addresses: { address: "", additionalAddresses: undefined },
            args: { validatorAddresses: [] },
          },
        }
      ),
    [additionalAddresses, address, customValidators, network, integration]
  );

  return useYieldGetSingleYieldBalances(
    param.integrationId,
    param.dto,
    { ledgerWalletAPICompatible: isLedgerLive },
    { query: { enabled: !!param.integrationId } }
  );
};
