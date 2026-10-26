/**
 * Wraps the browser's injected EVM wallet (EIP-1193 `window.ethereum`) as a
 * playground wallet backend, so the scripted outcomes apply on top of real
 * signing and broadcasting. EVM requests only.
 */
import type {
  SKBorrowTx,
  SKEip712TypedData,
  SKTx,
} from "../../src/public-api/types";
import {
  isSupportedChainId,
  type WalletBackend,
  type WalletConnection,
  type WalletControls,
  type WalletReply,
} from "./playground-wallet";

type Eip1193Provider = {
  readonly request: (args: {
    readonly method: string;
    readonly params?: ReadonlyArray<unknown>;
  }) => Promise<unknown>;
  readonly on?: (event: string, listener: (value: unknown) => void) => void;
};

const isEip1193Provider = (value: unknown): value is Eip1193Provider =>
  typeof value === "object" &&
  value !== null &&
  typeof Reflect.get(value, "request") === "function";

const userRejectedCode = 4001;

const toFailure = (error: unknown): WalletReply => {
  const code =
    typeof error === "object" && error !== null
      ? Reflect.get(error, "code")
      : undefined;
  if (code === userRejectedCode) return { _tag: "Cancelled" };
  return {
    _tag: "Failed",
    error: error instanceof Error ? error.message : String(error),
  };
};

const hexChainId = (chainId: number) => `0x${chainId.toString(16)}`;

// EIP-712 messages may hold bigints, which JSON cannot encode.
const typedDataJson = (typedData: SKEip712TypedData) =>
  JSON.stringify(typedData, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

const firstAccount = (accounts: unknown) =>
  Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";

const parseChainId = (value: unknown) =>
  typeof value === "string" ? Number.parseInt(value, 16) : Number.NaN;

export type InjectedWallet = {
  readonly backend: WalletBackend;
  /** The wallet's account and chain at startup, after asking to connect. */
  readonly connection: WalletConnection;
  /** Forwards account and chain changes made in the wallet to the session. */
  readonly watch: (
    controls: Pick<WalletControls, "setAddress" | "setChain">
  ) => void;
};

/** Connects to the injected EVM wallet; fails when the page has none. */
export const connectInjectedWallet = async (): Promise<InjectedWallet> => {
  const ethereum: unknown = Reflect.get(window, "ethereum");
  if (!isEip1193Provider(ethereum)) {
    throw new Error(
      "Playground: no injected EVM wallet (window.ethereum) on this page"
    );
  }

  const address = firstAccount(
    await ethereum.request({ method: "eth_requestAccounts" })
  );
  const chainId = parseChainId(
    await ethereum.request({ method: "eth_chainId" })
  );
  const connection: WalletConnection = {
    address,
    chainId: isSupportedChainId(chainId) ? chainId : undefined,
  };
  const account = { address };

  const request = async (
    method: string,
    params: ReadonlyArray<unknown>
  ): Promise<WalletReply> => {
    try {
      const value = await ethereum.request({ method, params });
      return { _tag: "Done", value: typeof value === "string" ? value : "" };
    } catch (error) {
      return toFailure(error);
    }
  };

  const sendEvm = (tx: SKTx | SKBorrowTx) =>
    tx.type === "evm"
      ? request("eth_sendTransaction", [tx.tx])
      : Promise.resolve<WalletReply>({
          _tag: "Failed",
          error: `Playground: the injected wallet cannot send ${tx.type} transactions`,
        });

  const backend: WalletBackend = {
    execute: (walletRequest) => {
      switch (walletRequest.method) {
        case "sendTransaction":
        case "sendBorrowTransaction":
          return sendEvm(walletRequest.tx);
        case "signMessage":
          return request("personal_sign", [
            walletRequest.message,
            account.address,
          ]);
        case "signTypedData":
        case "signZamaPermit":
          return request("eth_signTypedData_v4", [
            account.address,
            typedDataJson(walletRequest.typedData),
          ]);
        case "switchChain":
          return request("wallet_switchEthereumChain", [
            { chainId: hexChainId(walletRequest.chainId) },
          ]);
      }
    },
  };

  return {
    backend,
    connection,
    watch: (controls) => {
      ethereum.on?.("accountsChanged", (accounts) => {
        account.address = firstAccount(accounts);
        controls.setAddress(account.address);
      });
      ethereum.on?.("chainChanged", (value) =>
        controls.setChain(parseChainId(value))
      );
    },
  };
};
