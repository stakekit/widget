import { useAtomValue } from "@effect/atom-react";

import { connectedWalletAtom } from "../state/connected-wallet";

export const useConnectedWallet = () => useAtomValue(connectedWalletAtom);
