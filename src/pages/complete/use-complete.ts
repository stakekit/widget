import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { useRewardTokenDetails } from "../../hooks/use-reward-token-details";
import { useStakeState } from "../../state/stake";

export const useComplete = () => {
  const navigate = useNavigate();

  const { selectedStake } = useStakeState();

  const rewardToken = useRewardTokenDetails(selectedStake);

  const location = useLocation();

  const urls: string[] | undefined = location.state?.urls;

  const onClick = () => {
    navigate("/");
  };

  const onViewTransactionClick = () => {
    if (!urls) return;

    if (typeof window === "undefined") return;

    urls.forEach((url) => window.open(url, "_blank"));
  };

  const rewardTokenDetails = rewardToken.extractNullable();

  const unstakeMatch = useMatch(
    "unstake/:integrationId/:defaultOrValidatorId/complete"
  );
  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/complete"
  );

  return {
    rewardTokenDetails,
    onClick,
    onViewTransactionClick,
    unstakeMatch,
    pendingActionMatch,
    hasUrs: !!urls?.length,
  };
};
