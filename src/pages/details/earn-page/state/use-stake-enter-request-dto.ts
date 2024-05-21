import { useEarnPageState } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import type { ActionRequestDto, YieldDto } from "@stakekit/api-hooks";
import { Just, List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useReferralCode } from "../../../../hooks/api/referral/use-referral-code";
import { useSKWallet } from "../../../../providers/sk-wallet";

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
        const validatorsOrProvider = Just(val.selectedStake)
          .chain<
            | Pick<ActionRequestDto["args"], "validatorAddresses">
            | Pick<ActionRequestDto["args"], "validatorAddress">
            | Pick<ActionRequestDto["args"], "providerId">
          >((val) => {
            const validators = [...selectedValidators.values()];

            if (val.metadata.isIntegrationAggregator) {
              return List.head(validators).map((v) => ({
                providerId: v.providerId,
              }));
            }
            if (val.args.enter.args?.validatorAddresses?.required) {
              return Just({
                validatorAddresses: validators.map((v) => v.address),
              });
            }

            return List.head(validators)
              .map((v) => v.address)
              .map((v) => ({ validatorAddress: v }));
          })
          .orDefault({});

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
              ...validatorsOrProvider,
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
