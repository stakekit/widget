import {
  RegistryProvider,
  useAtomMount,
  useAtomSubscribe,
} from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { type PropsWithChildren, useRef } from "react";
import {
  type BorrowWalletExecutionAdapter,
  borrowExecutionEventsAtom,
  borrowExecutionRuntimeRefreshAtom,
  borrowWalletExecutionAdapterAtom,
  disconnectedBorrowWalletState,
  makeSKWalletBorrowExecutionAdapter,
  type WalletState,
} from "../../borrow";
import { config } from "../../config";
import type { SKWallet } from "../../domain/types/wallet";
import { useInvalidateTokenBalances } from "../../hooks/api/use-token-balances-scan";
import { useBorrowWalletBridge } from "../../pages-dashboard/borrow/connected-wallet";
import { useApiClient } from "../api/api-client-provider";
import { useSKWallet } from "../sk-wallet";
import { stakeKitEffectApiClientAtom } from "./stakekit-api-service";

const immediateSubscription = { immediate: true };

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
  const apiClient = useApiClient();
  const walletExecutionAdapter = useBorrowWalletExecutionAdapter();

  return (
    <RegistryProvider
      defaultIdleTTL={config.queryClient.cacheTime}
      initialValues={[
        [stakeKitEffectApiClientAtom, apiClient.effect],
        [borrowWalletExecutionAdapterAtom, walletExecutionAdapter],
      ]}
    >
      <SKAtomRuntimeBridge>{children}</SKAtomRuntimeBridge>
    </RegistryProvider>
  );
};

const SKAtomRuntimeBridge = ({ children }: PropsWithChildren) => {
  useAtomMount(borrowExecutionRuntimeRefreshAtom);

  const invalidateTokenBalances = useInvalidateTokenBalances();

  useAtomSubscribe(
    borrowExecutionEventsAtom,
    (eventResult) => {
      if (AsyncResult.isSuccess(eventResult)) {
        invalidateTokenBalances();
      }
    },
    immediateSubscription
  );

  return children;
};
