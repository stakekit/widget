import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { SKWallet } from "../../../domain/types/wallet";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../services/wallet/domain/state";
import {
  currentWalletStateResultAtom,
  useWalletRuntimeConfig,
} from "../runtime/root-atom";

export const useSKWallet = () => {
  const runtimeConfig = useWalletRuntimeConfig();
  const walletStateResult = useAtomValue(currentWalletStateResultAtom);
  const initialWalletState: NormalizedWalletState = runtimeConfig.isLoading
    ? {
        additionalAddresses: null,
        address: null,
        chain: null,
        connector: null,
        connectorChains: [],
        isLedgerLive: false,
        isLedgerLiveAccountPlaceholder: false,
        ledgerAccounts: null,
        network: null,
        status: "connecting",
      }
    : disconnectedNormalizedWalletState;
  const walletState = walletStateResult.pipe(
    AsyncResult.value,
    Option.getOrElse(() => initialWalletState)
  );
  const common = {
    connectorChains: walletState.connectorChains,
    isLedgerLive: walletState.isLedgerLive,
  };

  if (walletState.status === "connected") {
    return {
      ...common,
      additionalAddresses: walletState.additionalAddresses,
      address: walletState.address,
      chain: walletState.chain,
      connector: walletState.connector,
      isConnected: true,
      isConnecting: false,
      isLedgerLiveAccountPlaceholder:
        walletState.isLedgerLiveAccountPlaceholder,
      ledgerAccounts: walletState.ledgerAccounts,
      network: walletState.network,
    } satisfies SKWallet;
  }

  return {
    ...common,
    additionalAddresses: null,
    address: null,
    chain: null,
    connector: null,
    isConnected: false,
    isConnecting: walletState.status === "connecting",
    isLedgerLiveAccountPlaceholder: false,
    ledgerAccounts: null,
    network: null,
  } satisfies SKWallet;
};
