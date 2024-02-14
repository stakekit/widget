import { Address, Connector } from "wagmi";
import { Adapter } from "@tronweb3/tronwallet-abstract-adapter";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { WalletConnectAdapter } from "@tronweb3/tronwallet-adapter-walletconnect";
import { BitKeepAdapter } from "@tronweb3/tronwallet-adapter-bitkeep";
import { LedgerAdapter } from "@tronweb3/tronwallet-adapter-ledger";
import { EitherAsync, Maybe } from "purify-ts";
import { tron } from "./chains";
import { getTokenLogo } from "../../utils";
import { getStorageItem, setStorageItem } from "../../services/local-storage";
import { config } from "../../config";
import { WalletList } from "@stakekit/rainbowkit";
import { wcLogo } from "../../assets/images/wc-logo";
import bitget from "../../assets/images/bitget.png";
import { ledger } from "../../assets/images/ledger";

export class TronConnector extends Connector {
  id = "tron";
  name = "Tron";

  constructor(public adapter: Adapter) {
    super({ options: {}, chains: [tron] }); // only mainnet for now
  }

  ready = true;

  async connect() {
    this.emit("message", { type: "connecting" });

    await this.adapter.connect();

    setStorageItem("sk-widget@1//shimDisconnect/tron", true);

    return {
      account: this.adapter.address as Address,
      chain: {
        id: tron.id,
        unsupported: false,
      },
    };
  }

  async disconnect() {
    setStorageItem("sk-widget@1//shimDisconnect/tron", false);
    await this.adapter.disconnect();
  }

  async getAccount() {
    return (
      await EitherAsync.liftEither(
        Maybe.fromNullable(this.adapter.address as Address).toEither(
          new Error("No account found")
        )
      )
    ).unsafeCoerce();
  }

  async switchChain() {
    return tron;
  }

  async getChainId() {
    return tron.id;
  }

  async getProvider() {
    throw new Error("Not implemented");
  }

  getWalletClient = () => {
    throw new Error("Not implemented");
  };

  async isAuthorized() {
    return getStorageItem("sk-widget@1//shimDisconnect/tron")
      .map((val) => !!(val && this.adapter.connected && this.adapter.address))
      .orDefault(false);
  }

  protected onAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      this.emit("disconnect");
    } else {
      this.emit("change", { account: accounts[0] as Address });
    }
  };

  protected onChainChanged = (chainId: number | string) => {
    this.emit("change", {
      chain: { id: chainId as number, unsupported: false },
    });
  };

  protected onDisconnect(error: Error): void {
    this.emit("disconnect");
  }
}

export const tronConnector: WalletList[number] = {
  groupName: "Tron",
  wallets: [
    {
      id: "tron-link",
      name: "TronLink",
      iconUrl: getTokenLogo("trx"),
      iconBackground: "#fff",
      createConnector: () => ({
        connector: new TronConnector(new TronLinkAdapter()),
      }),
    },
    {
      id: "tron-wc",
      name: "Wallet Connect",
      iconUrl: wcLogo,
      iconBackground: "#fff",
      createConnector: () => ({
        connector: new TronConnector(
          new WalletConnectAdapter({
            network: "Mainnet",
            options: { projectId: config.walletConnectV2.projectId },
            web3ModalConfig: {
              themeVariables: {
                "--w3m-z-index": "99999999999",
              },
            },
          })
        ),
      }),
    },
    {
      id: "tron-bg",
      name: "Bitget",
      iconUrl: bitget,
      iconBackground: "#fff",
      createConnector: () => ({
        connector: new TronConnector(new BitKeepAdapter()),
      }),
    },
    {
      id: "tron-ledger",
      name: "Ledger",
      iconUrl: ledger,
      iconBackground: "#fff",
      createConnector: () => ({
        connector: new TronConnector(new LedgerAdapter()),
      }),
    },
  ],
};
