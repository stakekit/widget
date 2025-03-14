import { useMatch } from "react-router";

export const useDetailsMatch = () => {
  const rootMatch = useMatch("/");
  const positionsMatch = useMatch("/positions");
  const activityMatch = useMatch("/activity");

  return rootMatch || positionsMatch || activityMatch;
};
