import { useLocation, useMatch, useNavigate } from "react-router-dom";

export const useComplete = () => {
  const navigate = useNavigate();

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

  const unstakeMatch = useMatch(
    "unstake/:integrationId/:defaultOrValidatorId/complete"
  );
  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/complete"
  );

  return {
    onClick,
    onViewTransactionClick,
    unstakeMatch,
    pendingActionMatch,
    hasUrs: !!urls?.length,
  };
};
