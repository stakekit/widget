import { useMemo } from "react";
import { List, Maybe } from "purify-ts";
import { ActionRequestDto, YieldDto } from "@stakekit/api-hooks";
import { useStakeState } from "../../../../state/stake";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useReferralCode } from "../../../../hooks/api/referral/use-referral-code";

export const useStakeEnterRequestDto = () => {
  const { selectedStake, stakeAmount, selectedValidators, tronResource } =
    useStakeState();
  const { address, additionalAddresses, isLedgerLive } = useSKWallet();

  const referralcode = useReferralCode();

  return useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        selectedStake,
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
      selectedValidators,
      stakeAmount,
      tronResource,
    ]
  );
};
