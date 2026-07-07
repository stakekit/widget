import {
  createContext,
  type PropsWithChildren,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import { Navigate, Outlet } from "react-router";
import {
  type BorrowWalletBridgeState,
  type BorrowWalletConnectedBridgeState,
  toBorrowWalletBridgeState,
} from "../../borrow";
import { useSKWallet } from "../../providers/sk-wallet";

const BorrowWalletContext = createContext<BorrowWalletBridgeState | undefined>(
  undefined
);

export const BorrowWalletProvider = ({ children }: PropsWithChildren) => {
  const skWallet = useSKWallet();
  const walletBridge = useMemo(
    () =>
      toBorrowWalletBridgeState({
        address: skWallet.address,
        chain: skWallet.chain,
        connector: skWallet.connector,
        connectorChains: skWallet.connectorChains,
        isConnected: skWallet.isConnected,
        network: skWallet.network,
      }),
    [
      skWallet.address,
      skWallet.chain,
      skWallet.connector,
      skWallet.connectorChains,
      skWallet.isConnected,
      skWallet.network,
    ]
  );

  return (
    <BorrowWalletContext.Provider value={walletBridge}>
      {children}
    </BorrowWalletContext.Provider>
  );
};

export const useBorrowWalletBridge = () => {
  const walletBridge = useContext(BorrowWalletContext);

  if (!walletBridge) {
    throw new Error(
      "useBorrowWalletBridge must be used within a BorrowWalletProvider"
    );
  }

  return walletBridge;
};

export const useBorrowConnectedWalletBridge =
  (): BorrowWalletConnectedBridgeState => {
    const walletBridge = useBorrowWalletBridge();

    if (walletBridge.status !== "connected") {
      throw new Error(
        "useBorrowConnectedWalletBridge requires a connected borrow wallet"
      );
    }

    return walletBridge;
  };

export const BorrowConnectedWalletRoute = (): ReactNode => {
  const walletBridge = useBorrowWalletBridge();

  return walletBridge.status === "connected" ? (
    <Outlet />
  ) : (
    <Navigate to="/borrow" replace />
  );
};
