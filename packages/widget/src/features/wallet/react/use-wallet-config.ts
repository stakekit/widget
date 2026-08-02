import { useAtomValue } from "@effect/atom-react";
import { currentWalletConfigResultAtom } from "../state/root-atom";

export const useWalletConfig = () =>
  useAtomValue(currentWalletConfigResultAtom);
