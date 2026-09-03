import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { currentWalletStateResultAtom } from "../state/root-atom";

export const useSKWallet = () => {
  const walletStateResult = useAtomValue(currentWalletStateResultAtom);
  return walletStateResult.pipe(AsyncResult.value, Option.getOrNull);
};
