import { useAtomSet } from "@effect/atom-react";
import { logoutAtom } from "../state/workflows";

export const useLogout = () => {
  const logout = useAtomSet(logoutAtom, { mode: "promise" });

  return () => logout(undefined);
};
