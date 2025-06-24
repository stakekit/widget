import { isEigenRestaking, p2pProviderId } from "@sk-widget/domain/types";
import { useEarnPageState } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import type {
  ActionRequestDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
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
        selectedValidators: Map<string, ValidatorDto>;
        selectedStake: YieldDto;
      }>(({ address, selectedStake, selectedToken }) => {
        const validatorsOrProvider = Just(selectedStake)
          .chain<
            | Pick<ActionRequestDto["args"], "validatorAddresses">
            | Pick<ActionRequestDto["args"], "validatorAddress" | "subnetId">
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

            const subnetIdRequired =
              !!selectedStake.args.enter.args?.subnetId?.required;

            return List.head(validators).map((v) => ({
              validatorAddress: v.address,
              subnetId: subnetIdRequired ? v.subnetId : undefined,
            }));
          })
          .orDefault({});

        return {
          selectedValidators,
          selectedStake: selectedStake,
          gasFeeToken: selectedStake.metadata.gasFeeToken,
          dto: {
            addresses: {
              address: address,
              additionalAddresses: additionalAddresses ?? undefined,
            },
            integrationId: selectedStake.id,
            referralCode: referralcode.data?.code,
            args: {
              inputToken: selectedToken,
              ledgerWalletAPICompatible: isLedgerLive ?? undefined,
              tronResource: tronResource.extract(),
              amount: stakeAmount.toString(10),
              ...(isEigenRestaking(selectedStake) && {
                providerId: p2pProviderId,
              }),
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
