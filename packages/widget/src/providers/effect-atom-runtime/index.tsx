import { RegistryProvider, useAtomMount, useAtomSet } from "@effect/atom-react";
import { type PropsWithChildren, useEffect, useRef } from "react";
import {
  type BorrowWalletExecutionAdapter,
  borrowExecutionRuntimeRefreshAtom,
  borrowWalletExecutionAdapterAtom,
  disconnectedBorrowWalletState,
  makeSKWalletBorrowExecutionAdapter,
  type WalletState,
} from "../../borrow";
import { config } from "../../config";
import type { SKWallet } from "../../domain/types/wallet";
import { useBorrowWalletBridge } from "../../pages-dashboard/borrow/connected-wallet";
import { makeStakeKitApiLayer } from "../api/api-client";
import { useSettings } from "../settings";
import { useSKWallet } from "../sk-wallet";
import { stakeKitApiLayerAtom } from "./stakekit-api-service";

type BorrowWalletRuntimeSnapshot = {
  readonly signTransaction: SKWallet["signTransaction"];
  readonly walletState: WalletState;
};

const useBorrowWalletExecutionAdapter = (): BorrowWalletExecutionAdapter => {
  const skWallet = useSKWallet();
  const walletBridge = useBorrowWalletBridge();
  const walletState: WalletState =
    walletBridge.status === "connected"
      ? walletBridge.wallet
      : disconnectedBorrowWalletState;
  const latest = useRef<BorrowWalletRuntimeSnapshot>({
    signTransaction: skWallet.signTransaction,
    walletState,
  });
  const adapter = useRef<BorrowWalletExecutionAdapter | null>(null);

  latest.current = {
    signTransaction: skWallet.signTransaction,
    walletState,
  };

  if (!adapter.current) {
    adapter.current = makeSKWalletBorrowExecutionAdapter({
      getState: () => latest.current.walletState,
      signTransaction: (args) => latest.current.signTransaction(args),
    });
  }

  return adapter.current;
};

export const SKAtomRuntimeProvider = ({ children }: PropsWithChildren) => {
  const { apiKey, baseUrl, borrowApiUrl, yieldsApiUrl } = useSettings();
  const apiLayer = makeStakeKitApiLayer({
    apiKey,
    baseUrl: baseUrl ?? config.env.apiUrl,
    borrowApiUrl: borrowApiUrl ?? config.env.borrowApiUrl,
    yieldsApiUrl: yieldsApiUrl ?? config.env.yieldsApiUrl,
  });

  return (
    <RegistryProvider
      defaultIdleTTL={config.atomResources.defaultIdleTTL}
      initialValues={[[stakeKitApiLayerAtom, apiLayer]]}
    >
      {children}
    </RegistryProvider>
  );
};

export const SKAtomRuntimeBridge = ({ children }: PropsWithChildren) => {
  const walletExecutionAdapter = useBorrowWalletExecutionAdapter();
  const setWalletExecutionAdapter = useAtomSet(
    borrowWalletExecutionAdapterAtom
  );

  useEffect(() => {
    setWalletExecutionAdapter(walletExecutionAdapter);
  }, [setWalletExecutionAdapter, walletExecutionAdapter]);

  useAtomMount(borrowExecutionRuntimeRefreshAtom);

  return children;
};
