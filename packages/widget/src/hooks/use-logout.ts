import { useAtomSet } from "@effect/atom-react";
import { logoutAtom } from "../atoms/wallet-workflows";
import { useCloseChainModal } from "./use-close-chain-modal";

export const useLogout = () => {
  const { closeChainModal } = useCloseChainModal();
  const logout = useAtomSet(logoutAtom, { mode: "promise" });

  return () => logout(undefined).then(closeChainModal);
};
