import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  type WalletIconSource,
  walletIconUrlAtom,
} from "../../state/wallet-icon";

export const useWalletIconUrl = (source: WalletIconSource | null | undefined) =>
  AsyncResult.getOrElse(
    useAtomValue(walletIconUrlAtom(source)),
    () => undefined
  );
