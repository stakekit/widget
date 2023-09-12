import { useStakeState } from "../../state/stake";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  const { stakeAmount, selectedStake } = useStakeState();

  const token = selectedStake.map((y) => y.token).extractNullable();
  const metadata = selectedStake.map((y) => y.metadata).extractNullable();

  const network = selectedStake.mapOrDefault((y) => y.token.symbol, "");

  const amount = stakeAmount.mapOrDefault((a) => a.toString(), "");

  return (
    <CompletePage
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
    />
  );
};
