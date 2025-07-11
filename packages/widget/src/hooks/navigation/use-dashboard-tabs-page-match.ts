import { useMatch } from "react-router";

export const useDashboardTabsPageMatch = () => {
  const rootMatch = useMatch("/");
  const rewardsMatch = useMatch("/rewards");
  const activityMatch = useMatch("/activity");

  return !!(rootMatch || rewardsMatch || activityMatch);
};
