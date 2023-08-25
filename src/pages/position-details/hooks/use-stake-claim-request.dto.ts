import { useMemo } from "react";
import { Maybe } from "purify-ts";
import { useSKWallet } from "../../../hooks/wallet/use-sk-wallet";
import { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";
import { useUnstakeOrClaimState } from "../../../state/unstake-or-claim";
import {
  PendingActionDto,
  PendingActionRequestDto,
  YieldBalanceDto,
  YieldOpportunityDto,
} from "@stakekit/api-hooks";
import { SKWallet } from "../../../domain/types";

export const useStakeClaimRequestDto = ({
  balance,
  claimAvailableRewards,
  rewardsBalance,
}: {
  balance: ReturnType<typeof useStakedOrLiquidBalance>;
  claimAvailableRewards: Maybe<PendingActionDto>;
  rewardsBalance: Maybe<YieldBalanceDto>;
}) => {
  const { address, additionalAddresses } = useSKWallet();
  const { claim } = useUnstakeOrClaimState();

  return useMemo(
    () =>
      Maybe.fromNullable(address)
        .chain((addr) => claim.map((u) => ({ u, addr })))
        .chain((val) => balance.map((sb) => ({ ...val, sb })))
        .chain((val) => rewardsBalance.map((rb) => ({ ...val, rb })))
        .chain((val) => claimAvailableRewards.map((car) => ({ ...val, car })))
        .map<
          PendingActionRequestDto & {
            gasFeeToken: YieldOpportunityDto["token"]; // TODO: change this on api-hooks update
            address: NonNullable<SKWallet["address"]>;
            additionalAddresses:
              | NonNullable<SKWallet["additionalAddresses"]>
              | undefined;
          }
        >((val) => ({
          address: val.addr,
          additionalAddresses: additionalAddresses ?? undefined,
          gasFeeToken: val.u.integration.metadata.gasFeeToken,
          args: {
            validatorAddress: val.sb.validatorAddress,
            amount: val.rb.amount,
          },
          integrationId: val.u.integration.id,
          passthrough: val.car.passthrough,
          type: val.car.type,
        })),
    [
      additionalAddresses,
      address,
      balance,
      claim,
      claimAvailableRewards,
      rewardsBalance,
    ]
  );
};
