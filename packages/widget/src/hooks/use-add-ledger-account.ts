import type { Chain } from "@stakekit/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import { EitherAsync, Left, Right } from "purify-ts";
import { isLedgerLiveConnector } from "../providers/ledger/ledger-live-connector-meta";
import { useSKWallet } from "../providers/sk-wallet";
import { useCloseChainModal } from "./use-close-chain-modal";

export const useAddLedgerAccount = () => {
  const { connector } = useSKWallet();

  const { closeChainModal } = useCloseChainModal();

  return useMutation<void, Error, Chain>({
    mutationFn: async (chain) => {
      (
        await EitherAsync.liftEither(
          connector && isLedgerLiveConnector(connector)
            ? Right(connector)
            : Left(new Error("Only Ledger Live is supported"))
        )
          .chain((ledgerLiveConnector) =>
            ledgerLiveConnector.requestAndSwitchAccount(chain)
          )
          .ifRight(closeChainModal)
      ).unsafeCoerce();
    },
  });
};
