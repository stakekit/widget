import { useMatch } from "react-router-dom";

export const useDetailsMatch = () => {
  const rootMatch = useMatch("/");
  const positionsMatch = useMatch("/positions");

  return rootMatch || positionsMatch;
};
