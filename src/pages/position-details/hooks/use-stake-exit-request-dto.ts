import { useMemo } from "react";
import { Maybe } from "purify-ts";
import { useSKWallet } from "../../../hooks/use-sk-wallet";
import { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";
import { useUnstakeOrClaimState } from "../../../state/unstake-or-claim";
import { StakeRequestDto, YieldOpportunityDto } from "@stakekit/api-hooks";

export const useStakeExitRequestDto = ({
  balance,
}: {
  balance: ReturnType<typeof useStakedOrLiquidBalance>;
}) => {
  const { address, additionalAddresses } = useSKWallet();
  const { unstake } = useUnstakeOrClaimState();

  return useMemo(
    () =>
      Maybe.fromNullable(address)
        .chain((addr) => unstake.map((u) => ({ u, addr })))
        .chain((val) => val.u.amount.map((amount) => ({ ...val, amount })))
        .chain((val) => balance.map((sb) => ({ ...val, sb })))
        .map<
          StakeRequestDto & {
            gasFeeToken: YieldOpportunityDto["token"]; // TODO: change this on api-hooks update
          }
        >((val) => ({
          // @ts-expect-error
          gasFeeToken: val.u.integration.metadata.gasFeeToken,
          addresses: {
            address: val.addr,
            additionalAddresses: additionalAddresses ?? undefined,
          },
          integrationId: val.u.integration.id,
          args: {
            amount: val.amount.toString(),
            validatorAddress: val.sb.validatorAddress,
          },
        })),
    [additionalAddresses, address, balance, unstake]
  );
};
