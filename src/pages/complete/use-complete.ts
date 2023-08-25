import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useResetApp } from "../../hooks/use-reset-app";
import { useRewardTokenDetails } from "../../hooks/use-reward-token-details";
import { useStakeState } from "../../state/stake";

export const useComplete = () => {
  const resetApp = useResetApp();

  const navigate = useNavigate();

  const { selectedStake } = useStakeState();

  const rewardToken = useRewardTokenDetails(selectedStake);

  const location = useLocation();

  const urls: string[] | undefined = location.state?.urls;

  const onClick = () => {
    resetApp();
    navigate("/");
  };

  const onViewTransactionClick = () => {
    if (!urls) return;

    if (typeof window === "undefined") return;

    urls.forEach((url) => window.open(url, "_blank"));
  };

  const rewardTokenDetails = rewardToken.extractNullable();

  const unstakeMatch = useMatch("unstake/:integrationId/complete");
  const claimMatch = useMatch("claim/:integrationId/complete");

  return {
    rewardTokenDetails,
    onClick,
    onViewTransactionClick,
    unstakeMatch,
    claimMatch,
    hasUrs: !!urls?.length,
  };
};
