import { useAtomValue } from "@effect/atom-react";
import {
  type WalletConfigResource,
  walletConfigAtom,
} from "../state/root-atom";

export const useWalletConfig = (): WalletConfigResource =>
  useAtomValue(walletConfigAtom);
