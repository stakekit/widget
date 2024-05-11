import { useMemo } from "react";
import { List, Maybe } from "purify-ts";
import type { ActionRequestDto, YieldDto } from "@stakekit/api-hooks";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useReferralCode } from "../../../../hooks/api/referral/use-referral-code";
import { useEarnPageState } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";

export const useStakeEnterRequestDto = () => {
  const {
    selectedStake,
    stakeAmount,
    selectedValidators,
    tronResource,
    selectedToken,
  } = useEarnPageState();
  const { address, additionalAddresses, isLedgerLive } = useSKWallet();

  const referralcode = useReferralCode();

  return useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        selectedStake,
        selectedToken,
      }).map<{
        gasFeeToken: YieldDto["token"];
        dto: ActionRequestDto;
      }>((val) => {
        return {
          gasFeeToken: val.selectedStake.metadata.gasFeeToken,
          dto: {
            addresses: {
              address: val.address,
              additionalAddresses: additionalAddresses ?? undefined,
            },
            integrationId: val.selectedStake.id,
            referralCode: referralcode.data?.code,
            args: {
              inputToken: val.selectedToken,
              ledgerWalletAPICompatible: isLedgerLive ?? undefined,
              tronResource: tronResource.extract(),
              amount: stakeAmount.toString(10),
              ...(val.selectedStake.args.enter.args?.validatorAddresses
                ?.required
                ? {
                    validatorAddresses: [...selectedValidators.values()].map(
                      (v) => v.address
                    ),
                  }
                : {
                    validatorAddress: List.head([
                      ...selectedValidators.values(),
                    ])
                      .map((v) => v.address)
                      .extract(),
                  }),
            },
          },
        };
      }),
    [
      additionalAddresses,
      address,
      isLedgerLive,
      referralcode.data?.code,
      selectedStake,
      selectedToken,
      selectedValidators,
      stakeAmount,
      tronResource,
    ]
  );
};
