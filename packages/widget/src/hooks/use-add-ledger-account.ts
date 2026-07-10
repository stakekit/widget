import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Chain } from "@stakekit/rainbowkit";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { addLedgerAccountAtom } from "../atoms/wallet-workflows";
import { isLedgerLiveConnector } from "../providers/ledger/ledger-live-connector-meta";
import { useSKWallet } from "../providers/sk-wallet";
import { useCloseChainModal } from "./use-close-chain-modal";

export const useAddLedgerAccount = () => {
  const { connector } = useSKWallet();
  const { closeChainModal } = useCloseChainModal();
  const result = useAtomValue(addLedgerAccountAtom);
  const execute = useAtomSet(addLedgerAccountAtom, { mode: "promise" });
  const connectorCommand =
    connector && isLedgerLiveConnector(connector) ? connector : null;
  const mutateAsync = (chain: Chain) =>
    execute({ chain, closeChainModal, connector: connectorCommand });

  return {
    error: AsyncResult.isFailure(result) ? result.cause : undefined,
    isError: AsyncResult.isFailure(result),
    isPending: result.waiting,
    mutate: (chain: Chain) => {
      void mutateAsync(chain).catch(() => undefined);
    },
    mutateAsync,
  } as const;
};
