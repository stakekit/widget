import { useAtomValue } from "@effect/atom-react";

import { knownWalletStateAtom } from "../state/selectors";

export const useSKWallet = () => useAtomValue(knownWalletStateAtom);
